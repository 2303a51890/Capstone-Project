import {initializeApp} from "firebase-admin/app";
import {onCall, HttpsError} from "firebase-functions/v2/https";
import {setGlobalOptions} from "firebase-functions";
import {
  GREENHOUSE_COMPANIES,
  fetchGreenhouseJson,
  JobSourceError,
  normalizeGreenhouseJob,
  normalizeGreenhouseJobs,
  type GreenhouseJobRecord,
} from "./job-source.js";

initializeApp();
setGlobalOptions({maxInstances: 10});

type CandidatePart = {
  text?: string;
};

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: CandidatePart[];
    };
  }>;
};

export const generateAiMatchAnalysis = onCall({
  region: "asia-south1",
  maxInstances: 10,
}, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be signed in to use AI analysis.");
  }

  const {studentProfile, job} = request.data ?? {};

  if (!studentProfile || !job) {
    throw new HttpsError("invalid-argument", "Missing student profile or job data.");
  }

  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

  if (!apiKey) {
    throw new HttpsError(
      "failed-precondition",
      "AI runtime is not configured. Please set GEMINI_API_KEY or GOOGLE_API_KEY.",
    );
  }

  const prompt = `
    Compare this student profile with the job description and return strict JSON with keys:
    - matchScore: integer from 0 to 100
    - summary: short 1 sentence summary
    - tips: array of exactly 3 strings

    Student profile:
    Name: ${studentProfile.fullName}
    Branch: ${studentProfile.branch}
    CGPA: ${studentProfile.cgpa}
    Graduation year: ${studentProfile.graduationYear}
    Skills: ${Array.isArray(studentProfile.skills) ? studentProfile.skills.join(', ') : ''}
    Resume: ${studentProfile.resume?.filename || 'Not provided'}
    Bio: ${studentProfile.bio || 'Not provided'}

    Job description:
    Title: ${job.title}
    Company: ${job.companyName}
    Location: ${job.location}
    Type: ${job.type}
    Salary: ${job.salary}
    Minimum CGPA: ${job.minimumCgpa}
    Eligible branches: ${job.eligibleBranches?.join(', ')}
    Eligible years: ${job.eligibleYears?.join(', ')}
    Description: ${job.description}

    Use a professional career-fit perspective. Keep exactly 3 tips and no more.
  `;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [{
          parts: [{text: prompt}],
        }],
      }),
    },
  );

  if (!response.ok) {
    throw new HttpsError("internal", "AI service request failed.");
  }

  const payload = (await response.json()) as GeminiResponse;
  const rawText = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "{}";
  const parsed = JSON.parse(rawText.match(/\{[\s\S]*\}/)?.[0] ?? "{") as {
    matchScore?: number;
    summary?: string;
    tips?: string[];
  };

  const score = Number(parsed.matchScore ?? 0);
  const tips = Array.isArray(parsed.tips) ? parsed.tips.slice(0, 3) : [
    "Strengthen your technical portfolio with relevant projects.",
    "Align your resume with the job responsibilities and keywords.",
    "Practice system design and communication for interviews.",
  ];

  return {
    matchScore: Number.isFinite(score) ? Math.min(Math.max(score, 0), 100) : 75,
    summary: parsed.summary || "This role is a strong fit with a few targeted improvements.",
    tips: tips.slice(0, 3),
  };
});

function requireAuthenticatedUser(uid: string | undefined): void {
  if (!uid) throw new HttpsError("unauthenticated", "Sign in to retrieve company job listings.");
}

function getGreenhouseCompany(companyId: unknown) {
  if (typeof companyId !== "string") {
    throw new HttpsError("invalid-argument", "Select a supported company.");
  }
  const company = GREENHOUSE_COMPANIES.find((entry) => entry.id === companyId);
  if (!company) throw new HttpsError("not-found", "This company is not available from a verified job source.");
  return company;
}

async function getGreenhouseJson(url: string): Promise<unknown> {
  try {
    return await fetchGreenhouseJson(url);
  } catch (error) {
    if (error instanceof JobSourceError) throw new HttpsError(error.code, error.message);
    throw new HttpsError("unavailable", "The careers source is temporarily unavailable. Please retry.");
  }
}

export const listExternalJobCompanies = onCall({
  region: "asia-south1",
  maxInstances: 10,
}, async (request) => {
  requireAuthenticatedUser(request.auth?.uid);
  return {companies: GREENHOUSE_COMPANIES};
});

export const listExternalCompanyJobs = onCall({
  region: "asia-south1",
  maxInstances: 10,
}, async (request) => {
  requireAuthenticatedUser(request.auth?.uid);
  const company = getGreenhouseCompany(request.data?.companyId);
  const url = `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(company.id)}/jobs`;
  const payload = await getGreenhouseJson(url) as {jobs?: GreenhouseJobRecord[]};
  if (!Array.isArray(payload.jobs)) {
    throw new HttpsError("unavailable", "The careers source did not return a job list. Please retry later.");
  }

  const checkedAt = new Date().toISOString();
  return {
    company,
    provider: "Greenhouse",
    checkedAt,
    jobs: normalizeGreenhouseJobs(company, payload.jobs, checkedAt),
  };
});

export const getExternalJobDetails = onCall({
  region: "asia-south1",
  maxInstances: 10,
}, async (request) => {
  requireAuthenticatedUser(request.auth?.uid);
  const company = getGreenhouseCompany(request.data?.companyId);
  const jobId = typeof request.data?.jobId === "string" ? request.data.jobId : String(request.data?.jobId ?? "");
  if (!/^\d+$/.test(jobId)) throw new HttpsError("invalid-argument", "Select a valid job listing.");

  const boardUrl = `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(company.id)}/jobs`;
  const currentPayload = await getGreenhouseJson(boardUrl) as {jobs?: GreenhouseJobRecord[]};
  const checkedAt = new Date().toISOString();
  const currentJobs = Array.isArray(currentPayload.jobs) ?
    normalizeGreenhouseJobs(company, currentPayload.jobs, checkedAt) : [];
  if (!currentJobs.some((job) => job.sourceJobId === jobId)) {
    throw new HttpsError("not-found", "This vacancy is no longer listed as open. Refresh the company listings.");
  }

  const detailUrl = `${boardUrl}/${encodeURIComponent(jobId)}?content=true`;
  const detail = await getGreenhouseJson(detailUrl) as GreenhouseJobRecord;
  const listing = normalizeGreenhouseJob(company, detail, new Date().toISOString(), true);
  if (!listing || listing.sourceJobId !== jobId) {
    throw new HttpsError("not-found", "The selected vacancy is no longer available.");
  }
  return listing;
});
