import { useEffect, useMemo, useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import {
  BriefcaseBusiness,
  Building2,
  FileText,
  Gauge,
  LayoutDashboard,
  LogOut,
  Sparkles,
  TrendingUp,
  UserCircle2,
  Users,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore'
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth'
import { httpsCallable } from 'firebase/functions'
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom'

import { ensureSeedData } from './data'
import { auth, db, functions, googleProvider } from './firebase'
import {
  analyzeResume,
  extractResumeText as extractATSResumeText,
  validateResumeFile,
} from './ats'
import {
  deduplicateJobListings,
  filterCompanyOptions,
  getCampusHirePublicationStatus,
  getCompanyOptions,
  isCampusHireJobOpen,
  matchesCampusHireCompany,
  mapCampusHireJob,
  mapGreenhouseJob,
  type ATSJobListing,
  type ExternalCompany,
  type GreenhouseJobPayload,
} from './job-data'
import type {
  AiAnalysisResult,
  ApplicationRecord,
  ApplicationStatus,
  ATSAnalysis,
  JobPosting,
  NotificationItem,
  RecruitmentRound,
  RoundStatus,
  StudentProfile,
  UserProfile,
  UserRole,
} from './types'

const CHART_COLORS = ['#2563eb', '#14b8a6', '#f59e0b', '#ef4444', '#8b5cf6']

const cn = (...values: Array<string | false | null | undefined>) => values.filter(Boolean).join(' ')

function applicationKey(application: Pick<ApplicationRecord, 'studentId' | 'opportunityId' | 'jobId'>): string {
  return `${application.studentId}:${application.opportunityId ?? application.jobId ?? ''}`
}

function deduplicateApplications<T extends ApplicationRecord>(applications: T[]): T[] {
  const seen = new Set<string>()
  return applications.filter((application) => {
    const key = applicationKey(application)
    if (seen.has(key)) {
      return false
    }
    seen.add(key)
    return true
  })
}

function safeNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}

function getNestedValue<T>(record: Record<string, any> | null | undefined, paths: string[]): T | undefined {
  if (!record || typeof record !== 'object') {
    return undefined
  }

  for (const path of paths) {
    const segments = path.split('.')
    let current: any = record
    let found = true

    for (const segment of segments) {
      if (current === null || current === undefined || !(segment in current)) {
        found = false
        break
      }
      current = current[segment]
    }

    if (found && current !== undefined && current !== null) {
      return current as T
    }
  }

  return undefined
}

function normalizeStudentProfile(raw: Partial<StudentProfile> | null | undefined): StudentProfile | null {
  if (!raw || typeof raw !== 'object') {
    return null
  }

  const normalizedSkills = Array.isArray(raw.skills) ? raw.skills.filter((skill): skill is string => typeof skill === 'string') : []
  const normalizedProjects = Array.isArray(raw.projects) ? raw.projects : []
  const normalizedCertifications = Array.isArray(raw.certifications) ? raw.certifications : []
  const normalizedResume = raw.resume && typeof raw.resume === 'object' ? raw.resume : null

  const rawRecord = raw as Record<string, any>
  const directCgpa = safeNumber(getNestedValue(rawRecord, ['cgpa', 'CGPA', 'academic.cgpa', 'academic.CGPA', 'student.cgpa', 'student.CGPA'])) ?? safeNumber(raw.cgpa) ?? safeNumber(raw.ug?.cgpa) ?? null
  const directBranch = getNestedValue<string>(rawRecord, ['branch', 'Branch', 'department', 'Department', 'academic.branch', 'academic.Branch', 'program.branch']) ?? raw.branch ?? (rawRecord.department as string | undefined) ?? raw.ug?.branch ?? ''
  const directGraduationYear = safeNumber(getNestedValue(rawRecord, ['graduationYear', 'graduation_year', 'graduation-year', 'academic.graduationYear', 'academic.graduation_year', 'ug.graduationYear', 'ug.graduation_year'])) ?? safeNumber(raw.graduationYear) ?? safeNumber(raw.ug?.graduationYear) ?? null

  const rawUid = getNestedValue<string>(rawRecord, ['uid', 'userId', 'studentId', 'id']) ?? raw.uid ?? (rawRecord.userId as string | undefined) ?? (rawRecord.studentId as string | undefined) ?? ''

  return {
    uid: rawUid,
    userId: (rawRecord.userId as string | undefined) ?? rawUid,
    email: getNestedValue<string>(rawRecord, ['email', 'Email']) ?? raw.email ?? '',
    fullName: getNestedValue<string>(rawRecord, ['fullName', 'full_name', 'name', 'studentName']) ?? raw.fullName ?? (rawRecord.name as string | undefined) ?? '',
    phone: getNestedValue<string>(rawRecord, ['phone', 'mobile', 'phoneNumber']) ?? raw.phone ?? '',
    rollNumber: getNestedValue<string>(rawRecord, ['rollNumber', 'rollNo', 'roll_number']) ?? raw.rollNumber ?? (rawRecord.rollNo as string | undefined) ?? '',
    aadhaarMasked: raw.aadhaarMasked,
    aadhaarLast4: raw.aadhaarLast4,
    panMasked: raw.panMasked,
    dateOfBirth: raw.dateOfBirth,
    gender: raw.gender,
    address: raw.address,
    city: raw.city,
    state: raw.state,
    pincode: raw.pincode,
    branch: typeof directBranch === 'string' ? directBranch : '',
    cgpa: typeof directCgpa === 'number' ? directCgpa : undefined,
    graduationYear: typeof directGraduationYear === 'number' ? directGraduationYear : undefined,
    percentage: raw.percentage,
    currentSemester: raw.currentSemester,
    backlogs: raw.backlogs,
    tenth: raw.tenth,
    intermediate: raw.intermediate,
    ug: raw.ug,
    skills: normalizedSkills,
    projects: normalizedProjects as StudentProfile['projects'],
    certifications: normalizedCertifications as StudentProfile['certifications'],
    resume: normalizedResume as StudentProfile['resume'],
    preferredRoles: raw.preferredRoles,
    preferredLocations: raw.preferredLocations,
    bio: raw.bio,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  }
}

function getStudentCgpa(student: StudentProfile | null): number | null {
  if (!student) {
    return null
  }

  return safeNumber(student.cgpa) ?? safeNumber(student.ug?.cgpa) ?? null
}

function maskAadhaar(value: string | undefined): string {
  const digits = (value ?? '').replace(/\D/g, '')
  return digits.length >= 4 ? `XXXX XXXX ${digits.slice(-4)}` : ''
}

function maskPan(value: string | undefined): string {
  const cleaned = (value ?? '').replace(/\s+/g, '').toUpperCase()
  return cleaned.length === 10 ? `${cleaned.slice(0, 5)}XXXX${cleaned.slice(9)}` : cleaned
}

function calculateProfileCompletion(profile: StudentProfile | null): number {
  if (!profile) return 0
  const checks = [
    !!profile.fullName,
    !!profile.email,
    !!profile.phone,
    !!profile.aadhaarMasked || !!profile.aadhaarLast4,
    !!profile.panMasked,
    !!profile.dateOfBirth,
    !!profile.address,
    !!profile.city,
    !!profile.state,
    !!profile.pincode,
    !!profile.tenth?.schoolName,
    !!profile.intermediate?.collegeName,
    !!profile.ug?.college,
    (profile.skills?.length ?? 0) > 0,
    (profile.projects?.length ?? 0) > 0,
    (profile.certifications?.length ?? 0) > 0,
    !!profile.resume?.url,
  ]
  return Math.round((checks.filter(Boolean).length / checks.length) * 100)
}

function getStudentGraduationYear(student: StudentProfile | null): number | null {
  if (!student) {
    return null
  }

  return safeNumber(student.graduationYear) ?? safeNumber(student.ug?.graduationYear) ?? null
}

function getStudentActiveBacklogs(student: StudentProfile | null): number {
  return safeNumber(student?.backlogs?.active) ?? 0
}

function normalizeBranchList(value: unknown): string[] {
  const values = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : []
  return values
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.trim().toUpperCase())
    .filter(Boolean)
}

function normalizeYearList(value: unknown): number[] {
  const values = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : []
  return values.map(safeNumber).filter((year): year is number => year !== null).map(Math.trunc)
}

function getOpportunityMinimumCgpa(job: Pick<JobPosting, 'minimumCgpa' | 'minCGPA'>): number | null {
  return safeNumber(job.minimumCgpa) ?? safeNumber(job.minCGPA) ?? null
}

function getOpportunityEligibleYears(job: Pick<JobPosting, 'eligibleYears' | 'graduationYears'>): number[] {
  const rawJob = job as Pick<JobPosting, 'eligibleYears' | 'graduationYears'> & Record<string, unknown>
  const eligibleYears = rawJob.eligibleYears
  return normalizeYearList(Array.isArray(eligibleYears) && eligibleYears.length > 0 ? eligibleYears : rawJob.graduationYears)
}

function normalizeRecruitmentRounds(value: unknown): RecruitmentRound[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map((entry, index) => {
      if (typeof entry === 'string') {
        const name = entry.trim()
        if (!name) return null
        const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || `round-${index + 1}`
        return { id: `${slug}-${index + 1}`, name, order: index + 1 }
      }
      if (!entry || typeof entry !== 'object') return null
      const rawRound = entry as Record<string, unknown>
      const name = typeof rawRound.name === 'string' ? rawRound.name.trim() : typeof rawRound.title === 'string' ? rawRound.title.trim() : ''
      if (!name) return null
      const order = safeNumber(rawRound.order) ?? index + 1
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
      const id = typeof rawRound.id === 'string' && rawRound.id.trim() ? rawRound.id : `${slug}-${order}`
      return { id, name, order }
    })
    .filter((round): round is RecruitmentRound => round !== null)
    .sort((left, right) => left.order - right.order)
}

function buildInitialRoundResults(job: JobPosting): Record<string, RoundStatus> {
  return Object.fromEntries(
    normalizeRecruitmentRounds(job.recruitmentRounds).map((round, index) => [round.id, index === 0 ? 'Pending' : 'Not Started']),
  )
}

function getOpportunityCompanyName(job: Pick<JobPosting, 'companyName' | 'organizationName'>): string {
  return job.organizationName?.trim() || job.companyName?.trim() || 'Campus Placement Office'
}

function getApplicationDeadlineTimestamp(deadline: string | undefined): number | null {
  if (!deadline) return null
  const date = new Date(deadline)
  if (Number.isNaN(date.getTime())) return null
  date.setHours(23, 59, 59, 999)
  return date.getTime()
}

function normalizeOpportunity(job: JobPosting): JobPosting {
  const deadlineTimestamp = getApplicationDeadlineTimestamp(job.applicationDeadline)
  const eligibleYears = getOpportunityEligibleYears(job)
  const graduationYears = normalizeYearList(job.graduationYears)
  const companyName = getOpportunityCompanyName(job)
  return {
    ...job,
    minimumCgpa: getOpportunityMinimumCgpa(job) ?? 0,
    companyName,
    organizationName: companyName,
    type: job.type || 'Placement',
    eligibleBranches: normalizeBranchList(job.eligibleBranches),
    eligibleYears,
    graduationYears: graduationYears.length > 0 ? graduationYears : eligibleYears,
    requiredSkills: Array.isArray(job.requiredSkills) ? job.requiredSkills : [],
    packageOrStipend: job.packageOrStipend ?? job.salary,
    published: job.published ?? true,
    status: job.status || (deadlineTimestamp !== null && deadlineTimestamp < Date.now() ? 'Closed' : 'Open'),
  }
}

function isOpportunityOpen(opportunity: JobPosting): boolean {
  const normalized = normalizeOpportunity(opportunity)
  if (!normalized.published || normalized.status === 'Closed') return false
  if (normalized.applicationStartDate && new Date(normalized.applicationStartDate).getTime() > Date.now()) return false
  if (normalized.applicationDeadline) {
    const deadlineTimestamp = getApplicationDeadlineTimestamp(normalized.applicationDeadline)
    return deadlineTimestamp !== null && deadlineTimestamp >= Date.now()
  }
  return true
}

function checkEligibility(student: StudentProfile | null, opportunity: JobPosting): {
  eligible: boolean
  cgpaEligible: boolean
  branchEligible: boolean
  yearEligible: boolean
  reasons: string[]
  failedRequirements: string[]
} {
  const reasons: string[] = []
  const failedRequirements: string[] = []
  if (!student) {
    return { eligible: false, cgpaEligible: false, branchEligible: false, yearEligible: false, reasons: ['✗ Student profile is not available.'], failedRequirements: ['Student profile'] }
  }

  const normalizedOpportunity = normalizeOpportunity(opportunity)
  const studentCgpa = getStudentCgpa(student)
  const minimumCgpa = getOpportunityMinimumCgpa(normalizedOpportunity)
  const eligibleBranches = normalizeBranchList(normalizedOpportunity.eligibleBranches)
  const eligibleYears = getOpportunityEligibleYears(normalizedOpportunity)
  const graduationYear = getStudentGraduationYear(student)
  const maxBacklogs = safeNumber(normalizedOpportunity.maxActiveBacklogs ?? normalizedOpportunity.backlogAllowed) ?? 0
  let cgpaEligible = studentCgpa !== null
  if (studentCgpa === null) {
    reasons.push('✗ Student CGPA is missing from the profile.')
    failedRequirements.push('CGPA requirement')
  } else if (minimumCgpa !== null && studentCgpa < minimumCgpa) {
    cgpaEligible = false
    reasons.push(`✗ CGPA below minimum: required ${minimumCgpa}, your CGPA is ${studentCgpa}.`)
    failedRequirements.push('CGPA requirement')
  } else {
    reasons.push('✓ CGPA requirement satisfied')
  }

  const studentBranch = student.branch ?? ''
  const branchEligible = eligibleBranches.length === 0 || eligibleBranches.includes(studentBranch.trim().toUpperCase())
  if (eligibleBranches.length === 0) reasons.push('✓ Branch requirement not specified')
  else if (branchEligible) reasons.push('✓ Branch eligible')
  else {
    reasons.push(`✗ Eligible branches: ${eligibleBranches.join(', ')}. Your branch: ${studentBranch || 'Not available'}.`)
    failedRequirements.push('Branch requirement')
  }

  const yearEligible = eligibleYears.length === 0 || (graduationYear !== null && eligibleYears.includes(graduationYear))
  if (eligibleYears.length === 0) reasons.push('✓ Graduation year requirement not specified')
  else if (yearEligible) reasons.push('✓ Graduation year eligible')
  else {
    reasons.push(`✗ Eligible graduation years: ${eligibleYears.join(', ')}. Your graduation year: ${graduationYear ?? 'Not available'}.`)
    failedRequirements.push('Graduation year requirement')
  }

  const activeBacklogs = getStudentActiveBacklogs(student)
  if (activeBacklogs <= maxBacklogs) reasons.push('✓ Backlog requirement satisfied')
  else {
    reasons.push(`✗ Active backlogs exceed the limit: allowed ${maxBacklogs}, your backlogs are ${activeBacklogs}.`)
    failedRequirements.push('Backlog requirement')
  }
  return { eligible: failedRequirements.length === 0, cgpaEligible, branchEligible, yearEligible, reasons, failedRequirements }
}

function evaluateJobEligibility(student: StudentProfile | null, opportunity: JobPosting): { eligible: boolean; reasons: string[]; failedRequirements: string[] } {
  const result = checkEligibility(student, opportunity)
  return { eligible: result.eligible, reasons: result.reasons, failedRequirements: result.failedRequirements }
}

function isStudentEligible(student: StudentProfile | null, opportunity: JobPosting): boolean {
  return checkEligibility(student, opportunity).eligible
}

function statusClass(status: ApplicationStatus): string {
  switch (status) {
    case 'Applied': return 'bg-blue-100 text-blue-700'
    case 'Shortlisted': return 'bg-amber-100 text-amber-700'
    case 'Rejected': return 'bg-rose-100 text-rose-700'
    case 'Selected': return 'bg-emerald-100 text-emerald-700'
    default: return 'bg-slate-100 text-slate-700'
  }
}

function evaluateOpportunityEligibility(student: StudentProfile | null, opportunity: JobPosting): { eligible: boolean; reason: string } {
  const opportunityItem = normalizeOpportunity(opportunity)

  if (!isOpportunityOpen(opportunityItem)) {
    return { eligible: false, reason: 'This opportunity is no longer open for applications.' }
  }

  const result = evaluateJobEligibility(student, opportunityItem)

  if (!result.eligible) {
    const firstFailure = result.reasons.find((reason) => reason.startsWith('✗'))
    return {
      eligible: false,
      reason: firstFailure ?? 'Not eligible for this opportunity.',
    }
  }

  return { eligible: true, reason: 'Eligible for this opportunity.' }
}

function evaluatePlacementEligibility(student: StudentProfile | null): { eligible: boolean; reasons: string[] } {
  if (!student) {
    return { eligible: false, reasons: ['✗ Student profile missing.'] }
  }

  const reasons: string[] = []
  const studentCgpa = getStudentCgpa(student)
  const graduationYear = getStudentGraduationYear(student)
  const activeBacklogs = getStudentActiveBacklogs(student)

  if (studentCgpa !== null) {
    reasons.push('✓ CGPA information available')
  } else {
    reasons.push('✗ CGPA information missing')
  }

  if (student.branch) {
    reasons.push('✓ Branch information available')
  } else {
    reasons.push('✗ Branch information missing')
  }

  if (graduationYear !== null) {
    reasons.push('✓ Graduation year information available')
  } else {
    reasons.push('✗ Graduation year information missing')
  }

  if (activeBacklogs === 0) {
    reasons.push('✓ No active backlogs')
  } else {
    reasons.push(`✗ Active backlogs: ${activeBacklogs}`)
  }

  const eligible = reasons.every((reason) => !reason.startsWith('✗'))

  return { eligible, reasons }
}

function calculateLocalCareerMatch(student: StudentProfile | null, job: JobPosting) {
  if (!student) {
    return {
      matchScore: 0,
      matchedSkills: [] as string[],
      missingSkills: [] as string[],
      strengths: ['Student profile is incomplete.'],
      summary: 'AI service unavailable — using local career matching.',
      tips: [
        'Complete your profile to improve match suggestions.',
        'Add relevant projects and skills.',
        'Update your resume with job-specific keywords.',
      ],
    }
  }

  const studentSkillSet = new Set((student.skills ?? []).map((skill) => skill.toLowerCase()))
  const jobSkills = job.description.toLowerCase().split(/[^a-z0-9+.#]+/).filter((token) => token.length > 3)
  const matchedSkills = [...new Set(jobSkills.filter((token) => studentSkillSet.has(token.toLowerCase())))]
  const missingSkills = [...new Set(jobSkills.filter((token) => !studentSkillSet.has(token.toLowerCase())))]

  const studentCgpa = getStudentCgpa(student)
  const minimumCgpa = getOpportunityMinimumCgpa(job) ?? 0
  const skillWeight = Math.min(55, matchedSkills.length * 10)
  const eligibilityWeight = studentCgpa !== null && Number(studentCgpa) >= Number(minimumCgpa) ? 20 : 8
  const projectWeight = (student.projects?.length ?? 0) > 0 ? 15 : 5
  const certificationWeight = (student.certifications?.length ?? 0) > 0 ? 10 : 5
  const score = Math.min(100, Math.round(skillWeight + eligibilityWeight + projectWeight + certificationWeight))

  const strengths = [
    `Relevant academic fit with ${student.branch} and ${studentCgpa ?? student.cgpa ?? 'N/A'} CGPA`,
    matchedSkills.length > 0 ? `Matched skills: ${matchedSkills.slice(0, 3).join(', ')}` : 'Profile needs additional technical depth',
    (student.projects?.length ?? 0) > 0 ? 'Project portfolio is present' : 'Add a project to improve match quality',
  ]

  const tips = [
    `Improve ${missingSkills.slice(0, 1)[0] ?? 'technical depth'} fundamentals relevant to this job.`,
    'Build or showcase a portfolio project aligned with the role requirements.',
    'Update your resume with role-specific keywords and measurable outcomes.',
  ]

  return {
    matchScore: score,
    matchedSkills: matchedSkills.slice(0, 5),
    missingSkills: missingSkills.slice(0, 4),
    strengths,
    summary: 'AI service unavailable — using local career matching.',
    tips: tips.slice(0, 3),
  }
}

const KEYWORD_ALIASES: Record<string, string[]> = {
  html: ['html', 'html5', 'html 5'],
  css: ['css', 'css3', 'css 3'],
  javascript: ['javascript', 'js', 'java script'],
  typescript: ['typescript', 'ts'],
  python: ['python'],
  java: ['java'],
  sql: ['sql', 'mysql', 'postgresql', 'sqlite', 'tsql'],
  mysql: ['mysql', 'sql'],
  nodejs: ['node.js', 'nodejs', 'node js', 'node'],
  react: ['react', 'reactjs', 'react js'],
  angular: ['angular', 'angularjs', 'angular js'],
  vue: ['vue', 'vuejs', 'vue js'],
  git: ['git', 'github', 'gitlab', 'bitbucket'],
  docker: ['docker', 'containers'],
  kubernetes: ['kubernetes', 'k8s'],
  aws: ['aws', 'amazon web services'],
  gcp: ['gcp', 'google cloud'],
  azure: ['azure', 'microsoft azure'],
  'data structures': ['data structures', 'data structure'],
  algorithms: ['algorithms', 'algorithm'],
  oop: ['oop', 'object-oriented programming', 'object oriented programming', 'object oriented', 'oo'],
  'rest api': ['rest api', 'rest', 'restful', 'api'],
  'ci/cd': ['ci/cd', 'ci cd', 'continuous integration', 'continuous deployment'],
  linux: ['linux', 'unix'],
  windows: ['windows'],
  macos: ['mac', 'macos', 'osx'],
  bash: ['bash', 'shell', 'shell script'],
  json: ['json'],
  xml: ['xml'],
  yaml: ['yaml', 'yml'],
  mongodb: ['mongodb', 'mongo'],
  firebase: ['firebase'],
  graphql: ['graphql'],
  'machine learning': ['machine learning', 'ml', 'machine learning', 'deep learning'],
  tensorflow: ['tensorflow', 'tf'],
  pytorch: ['pytorch'],
  scikit: ['scikit-learn', 'scikit learn', 'sklearn'],
  pandas: ['pandas'],
  numpy: ['numpy'],
  excel: ['excel', 'spreadsheet'],
  powerbi: ['power bi', 'powerbi', 'power-bi'],
  tableau: ['tableau'],
  figma: ['figma'],
  adobe: ['adobe', 'photoshop', 'illustrator', 'xd'],
  junit: ['junit', 'testing'],
  pytest: ['pytest', 'testing'],
  maven: ['maven', 'gradle'],
  webpack: ['webpack', 'bundler'],
  npm: ['npm', 'yarn', 'pnpm'],
  terraform: ['terraform'],
  jenkins: ['jenkins'],
  authentication: ['authentication', 'auth', 'oauth'],
  microservices: ['microservices', 'microservice'],
  monolith: ['monolith', 'monolithic'],
  'responsive design': ['responsive design', 'responsive', 'mobile'],
  ui: ['ui', 'user interface'],
  ux: ['ux', 'user experience'],
  agile: ['agile', 'scrum', 'kanban'],
  sprint: ['sprint'],
}

function normalizeResume(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s.@-]/g, ' ') // Remove special chars except email symbols
    .replace(/\s+/g, ' ') // Normalize multiple spaces
    .trim()
}

function detectContactInformation(text: string): { email: boolean; phone: boolean; linkedin: boolean; github: boolean } {
  const lowerText = text.toLowerCase()
  
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/
  const phoneRegex = /(\d{10}|\d{3}[-.\s]?\d{3}[-.\s]?\d{4}|\+\d{1,3}[-.\s]?\d{1,14})/
  const linkedinRegex = /linkedin\.com|linkedin/
  const githubRegex = /github\.com|github/
  
  return {
    email: emailRegex.test(text),
    phone: phoneRegex.test(text),
    linkedin: linkedinRegex.test(lowerText),
    github: githubRegex.test(lowerText),
  }
}

export async function extractResumeText(file: File): Promise<string> {
  try {
    const fileType = file.type.toLowerCase()
    
    // Handle PDF files
    if (fileType === 'application/pdf') {
      try {
        const { default: pdfjsLib } = await import('pdfjs-dist')
        const arrayBuffer = await file.arrayBuffer()
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
        
        let fullText = ''
        for (let i = 0; i < pdf.numPages; i++) {
          const page = await pdf.getPage(i + 1)
          const textContent = await page.getTextContent()
          const pageText = textContent.items.map((item: any) => item.str).join(' ')
          fullText += pageText + '\n'
        }
        
        if (!fullText.trim()) {
          throw new Error('No readable text found in PDF')
        }
        return fullText
      } catch (error) {
        console.error('PDF extraction error:', error)
        throw new Error('Failed to extract text from PDF file. Please ensure the PDF contains readable text.')
      }
    }
    
    // Handle DOCX files
    if (
      fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      fileType === 'application/msword'
    ) {
      try {
        const { default: mammoth } = await import('mammoth')
        const arrayBuffer = await file.arrayBuffer()
        const result = await mammoth.extractRawText({ arrayBuffer })
        
        if (!result.value.trim()) {
          throw new Error('No readable text found in DOCX')
        }
        return result.value
      } catch (error) {
        console.error('DOCX extraction error:', error)
        throw new Error('Failed to extract text from DOCX file. Please ensure the file is a valid Word document.')
      }
    }
    
    // Handle TXT files
    if (fileType === 'text/plain') {
      const text = await file.text()
      if (!text.trim()) {
        throw new Error('No readable text found in TXT file')
      }
      return text
    }
    
    // Fallback: try reading as text for other formats
    const text = await file.text()
    if (!text.trim()) {
      throw new Error('No readable text found in file')
    }
    return text
  } catch (error) {
    throw new Error(`Failed to extract resume text: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

export function detectResumeSections(text: string): string[] {
  const foundSections: Set<string> = new Set()
  
  // Define section patterns with variations
  const sectionPatterns: Record<string, string[]> = {
    'Contact Information': ['contact information', 'contact', 'phone', 'email', 'address'],
    'Objective': ['objective', 'career objective', 'professional objective', 'goal'],
    'Summary': ['summary', 'professional summary', 'executive summary', 'profile'],
    'Skills': ['skills', 'technical skills', 'core skills', 'competencies', 'abilities'],
    'Experience': ['experience', 'work experience', 'professional experience', 'employment', 'work history'],
    'Education': ['education', 'academic', 'academics', 'degree', 'qualification', 'school', 'university', 'college'],
    'Projects': ['projects', 'project experience', 'academic projects', 'personal projects'],
    'Certifications': ['certifications', 'certificates', 'courses', 'training', 'certified'],
    'Achievements': ['achievements', 'awards', 'accomplishments'],
    'Extra-Curricular': ['extra-curricular', 'extracurricular', 'activities', 'leadership'],
  }
  
  // Check for each section pattern
  for (const [sectionName, patterns] of Object.entries(sectionPatterns)) {
    for (const pattern of patterns) {
      const regex = new RegExp(`\\b${pattern}\\b`, 'i')
      if (regex.test(text)) {
        foundSections.add(sectionName)
        break
      }
    }
  }
  
  return foundSections.size > 0 ? Array.from(foundSections) : ['Resume text detected but no clear sections found']
}

export function extractKeywordsFromResume(resumeText: string, roleKeywords: string[]): { found: string[]; missing: string[] } {
  const normalizedText = normalizeResume(resumeText)
  const found: Set<string> = new Set()
  const missing: Set<string> = new Set()
  
  // Debug: log extraction info
  console.log('[ATS Debug] Resume text length:', resumeText.length)
  console.log('[ATS Debug] First 300 chars:', resumeText.substring(0, 300))
  console.log('[ATS Debug] Checking keywords:', roleKeywords)
  
  for (const keyword of roleKeywords) {
    const keywordLower = keyword.toLowerCase()
    let isFound = false
    
    // Check if exact keyword is in text
    if (normalizedText.includes(keywordLower)) {
      isFound = true
    }
    
    // Check keyword aliases
    if (!isFound && KEYWORD_ALIASES[keywordLower]) {
      for (const alias of KEYWORD_ALIASES[keywordLower]) {
        // Use word boundary matching for aliases
        const aliasRegex = new RegExp(`\\b${alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
        if (aliasRegex.test(resumeText)) {
          isFound = true
          break
        }
      }
    }
    
    // Check if any alias of the keyword is in normalized text
    if (!isFound) {
      for (const aliases of Object.values(KEYWORD_ALIASES)) {
        if (aliases.includes(keywordLower)) {
          // This keyword is an alias of baseKeyword
          for (const alias of aliases) {
            const aliasRegex = new RegExp(`\\b${alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
            if (aliasRegex.test(resumeText)) {
              isFound = true
              break
            }
          }
          if (isFound) break
        }
      }
    }
    
    if (isFound) {
      found.add(keyword)
      console.log(`[ATS Debug] ✓ Found keyword: ${keyword}`)
    } else {
      missing.add(keyword)
      console.log(`[ATS Debug] ✗ Missing keyword: ${keyword}`)
    }
  }
  
  const result = { 
    found: Array.from(found), 
    missing: Array.from(missing) 
  }
  console.log('[ATS Debug] Final result:', result)
  return result
}

export function calculateATSScore(
  resumeText: string,
  keywordStats: { found: string[]; missing: string[] },
  sectionsFound: string[],
): { score: number; breakdown: Record<string, number> } {
  let score = 0
  const scoreBreakdown: Record<string, number> = {
    keywordMatch: 0,
    resumeSections: 0,
    skillsMatch: 0,
    contactInfo: 0,
    completeness: 0,
  }

  // Keyword match (40 points)
  const totalKeywords = keywordStats.found.length + keywordStats.missing.length
  if (totalKeywords > 0) {
    const keywordScore = (keywordStats.found.length / totalKeywords) * 40
    scoreBreakdown.keywordMatch = keywordScore
    score += keywordScore
  }

  // Resume sections (20 points)
  const expectedSections = 5
  const validSections = sectionsFound.filter(s => !s.includes('but no clear'))
  const sectionScore = Math.min(20, (validSections.length / expectedSections) * 20)
  scoreBreakdown.resumeSections = sectionScore
  score += sectionScore

  // Skills match (20 points) - check if Skills section exists
  const hasSkillsSection = validSections.some((s) => s.toLowerCase().includes('skill'))
  scoreBreakdown.skillsMatch = hasSkillsSection ? 20 : 10
  score += scoreBreakdown.skillsMatch

  // Contact information (10 points)
  const contactInfo = detectContactInformation(resumeText)
  const contactCount = Object.values(contactInfo).filter(Boolean).length
  scoreBreakdown.contactInfo = Math.min(10, (contactCount / 2) * 10)
  score += scoreBreakdown.contactInfo

  // Resume completeness (10 points)
  const wordCount = resumeText.split(/\s+/).filter(w => w.length > 0).length
  if (wordCount > 300) {
    scoreBreakdown.completeness = 10
  } else if (wordCount > 150) {
    scoreBreakdown.completeness = 7
  } else if (wordCount > 50) {
    scoreBreakdown.completeness = 4
  } else {
    scoreBreakdown.completeness = 0
  }
  score += scoreBreakdown.completeness

  const finalScore = Math.min(100, Math.round(score))
  console.log('[ATS Debug] Score breakdown:', scoreBreakdown)
  console.log('[ATS Debug] Final ATS Score:', finalScore)

  return { score: finalScore, breakdown: scoreBreakdown }
}

export function generateATSSuggestions(
  resumeText: string,
  missingKeywords: string[],
  missingSections: string[],
  atsScore: number,
): string[] {
  const suggestions: string[] = []

  if (missingKeywords.length > 0) {
    suggestions.push(`Add missing important skills: ${missingKeywords.slice(0, 3).join(', ')}.`)
  }

  if (missingSections.length > 0) {
    suggestions.push(`Add or enhance missing sections: ${missingSections.slice(0, 2).join(', ')}.`)
  }

  if (!resumeText.toLowerCase().includes('project') && !resumeText.toLowerCase().includes('github')) {
    suggestions.push('Add relevant technical projects or GitHub links to demonstrate practical experience.')
  }

  if (!resumeText.toLowerCase().includes('achievement') && !resumeText.toLowerCase().includes('outcome')) {
    suggestions.push('Use measurable achievements and quantifiable outcomes instead of generic descriptions.')
  }

  if (atsScore < 70) {
    suggestions.push('Improve keyword coverage by matching resume content with job description keywords.')
  }

  if (!resumeText.toLowerCase().includes('certification') && !resumeText.toLowerCase().includes('certified')) {
    suggestions.push('Include relevant certifications or professional training to strengthen your profile.')
  }

  suggestions.push('Ensure consistent formatting and use ATS-friendly formatting (avoid graphics and complex tables).')

  return suggestions.slice(0, 5)
}

async function createNotification(userId: string, message: string, type: NotificationItem['type']) {
  const notificationId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

  await setDoc(doc(db, 'notifications', notificationId), {
    id: notificationId,
    userId,
    message,
    isRead: false,
    createdAt: serverTimestamp(),
    type,
  })
}

function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 text-slate-700">
      <div className="rounded-2xl border border-slate-200 bg-white px-6 py-4 shadow-sm">
        Loading placement portal...
      </div>
    </div>
  )
}

function ProtectedRoute({
  allowedRoles,
  currentRole,
  children,
}: {
  allowedRoles: UserRole[]
  currentRole: UserRole | null
  children: React.ReactNode
}) {
  if (!currentRole) {
    return <Navigate to="/login" replace />
  }

  if (!allowedRoles.includes(currentRole)) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

function AuthPage({
  onEmailLogin,
  onGoogleLogin,
  onEmailSignup,
}: {
  onEmailLogin: (email: string, password: string) => Promise<void>
  onGoogleLogin: () => Promise<void>
  onEmailSignup: (payload: {
    fullName: string
    email: string
    password: string
  }) => Promise<void>
}) {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [form, setForm] = useState({
    fullName: 'Student Demo',
    email: 'student@example.com',
    password: 'Password123',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setLoading(true)
    setError('')

    try {
      if (mode === 'signup') {
        await onEmailSignup(form)
      } else {
        await onEmailLogin(form.email, form.password)
      }
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : 'Unable to continue.'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#dbeafe_0%,#f8fafc_35%,#eef2ff_100%)] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-6xl overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-[0_30px_80px_rgba(15,23,42,0.12)] lg:grid-cols-[1.1fr_0.9fr]">
        <div className="relative overflow-hidden bg-gradient-to-br from-slate-950 via-blue-950 to-indigo-700 p-8 text-white md:p-10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(14,165,233,0.55),transparent_36%)]" />
          <div className="relative z-10 flex h-full flex-col justify-between">
            <div>
              <span className="inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-blue-100">
                CampusHire
              </span>
              <h1 className="mt-6 max-w-md text-4xl font-semibold leading-tight md:text-5xl">
                Placement operations for modern engineering campuses.
              </h1>
              <p className="mt-4 max-w-md text-base text-blue-100/90">
                A single platform to manage student readiness and TPO oversight with real-time placement intelligence.
              </p>
            </div>

            <div className="mt-8 grid gap-4 text-sm text-blue-50">
              {[
                'Role-based dashboards for students and the TPO office.',
                'Eligibility checks based on CGPA, branch, and graduation year.',
                'AI-powered career-fit recommendations using Gemini-backed cloud logic.',
              ].map((item) => (
                <div key={item} className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-center bg-slate-50 p-6 md:p-8">
          <div className="w-full max-w-md rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-6 flex rounded-full bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setMode('login')}
                className={cn(
                  'flex-1 rounded-full px-3 py-2 text-sm font-medium transition',
                  mode === 'login' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600',
                )}
              >
                Login
              </button>
              <button
                type="button"
                onClick={() => setMode('signup')}
                className={cn(
                  'flex-1 rounded-full px-3 py-2 text-sm font-medium transition',
                  mode === 'signup' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600',
                )}
              >
                Sign up
              </button>
            </div>

            <div className="mb-5">
              <h2 className="text-2xl font-semibold text-slate-900">
                {mode === 'login' ? 'Welcome back' : 'Create your account'}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Access your placement dashboard securely.
              </p>
            </div>

            <form className="space-y-4" onSubmit={handleSubmit}>
              {mode === 'signup' && (
                <div>
                  <label htmlFor="fullName" className="mb-1.5 block text-sm font-medium text-slate-700">
                    Full name
                  </label>
                  <input
                    id="fullName"
                    value={form.fullName}
                    onChange={(event) => setForm({ ...form, fullName: event.target.value })}
                    placeholder="Your name"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white"
                    required={mode === 'signup'}
                  />
                </div>
              )}

              <div>
                <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-slate-700">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(event) => setForm({ ...form, email: event.target.value })}
                  placeholder="name@college.edu"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white"
                  required
                />
              </div>

              <div>
                <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-slate-700">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={form.password}
                  onChange={(event) => setForm({ ...form, password: event.target.value })}
                  placeholder="Password"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white"
                  required
                />
              </div>

              {mode === 'signup' ? (
                <p className="text-sm text-slate-500">New accounts are created as students. TPO Admin accounts must be provisioned by an administrator.</p>
              ) : null}

              {error ? (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>
              ) : null}

              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center rounded-xl bg-blue-600 px-4 py-3 font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? 'Please wait...' : mode === 'login' ? 'Login' : 'Create account'}
              </button>
            </form>

            <button
              type="button"
              onClick={() => void onGoogleLogin()}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 font-medium text-slate-700 transition hover:bg-slate-50"
            >
              <span>Continue with Google</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

type StudentSection = 'overview' | 'personal' | 'academic' | 'skills' | 'projects' | 'certifications' | 'resume' | 'ats' | 'jobs' | 'applications' | 'ai' | 'notifications' | 'settings'

function DashboardShell({
  userProfile,
  onLogout,
  activeSection,
  onSectionChange,
  children,
}: {
  userProfile: UserProfile
  onLogout: () => Promise<void>
  activeSection?: string
  onSectionChange?: (section: StudentSection) => void
  children: React.ReactNode
}) {
  const navigate = useNavigate()

  const navItems: Array<{ key: StudentSection; label: string; icon: typeof LayoutDashboard }> = userProfile.role === 'student'
    ? [
        { key: 'overview', label: 'Overview', icon: LayoutDashboard },
        { key: 'jobs', label: 'Jobs', icon: BriefcaseBusiness },
        { key: 'applications', label: 'Applications', icon: FileText },
        { key: 'ai', label: 'AI Match', icon: Sparkles },
        { key: 'ats', label: 'ATS Checker', icon: Gauge },
      ]
    : [
        { key: 'overview', label: 'Overview', icon: LayoutDashboard },
        { key: 'jobs', label: 'Jobs', icon: BriefcaseBusiness },
        { key: 'applications', label: 'Applicants', icon: Users },
      ]

  const roleLabel = userProfile.role === 'student' ? 'Student Portal' : 'Admin / TPO'

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <div className="mx-auto flex max-w-[1600px] gap-4 p-4 lg:p-6 lg:pl-80">
        <aside className="fixed left-6 top-6 z-20 hidden h-[calc(100vh-3rem)] w-72 shrink-0 rounded-[28px] border border-slate-200 bg-slate-950 p-5 text-white shadow-2xl lg:flex lg:flex-col">
          <div className="flex items-center gap-3 border-b border-white/10 pb-5">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-400 text-lg font-bold text-white">
              C
            </div>
            <div>
              <p className="text-lg font-semibold">CampusHire</p>
              <p className="text-xs text-slate-300">Placement suite</p>
            </div>
          </div>

          <div className="mt-8 space-y-2">
            {navItems.map(({ key, label, icon: Icon }) => (
              <button
                key={label}
                type="button"
                onClick={() => {
                  if (userProfile.role === 'admin' && key === 'applications') {
                    navigate('/admin/applicants')
                  }
                  onSectionChange?.(key)
                }}
                className={cn(
                  'flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left text-sm font-medium transition',
                  activeSection === key
                    ? 'border-blue-400 bg-blue-500/15 text-white shadow-inner shadow-blue-500/20'
                    : 'border-transparent bg-white/5 text-slate-200 hover:border-blue-500/40 hover:bg-white/10',
                )}
              >
                <Icon size={16} />
                {label}
              </button>
            ))}
          </div>

          <div className="mt-auto rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-[0.22em] text-slate-300">Active role</p>
            <p className="mt-2 text-lg font-semibold">{roleLabel}</p>
            <p className="mt-2 text-sm text-slate-300">{userProfile.email}</p>
          </div>
        </aside>

        <main className="flex-1 rounded-[28px] border border-slate-200 bg-white shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
          <header className="flex flex-col gap-4 border-b border-slate-200 bg-slate-50/80 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Operations overview</p>
              <h1 className="mt-1 text-2xl font-semibold text-slate-900">{roleLabel}</h1>
            </div>

            <div className="flex items-center gap-3 self-end lg:self-auto">
              <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                <UserCircle2 size={18} className="text-slate-500" />
                {userProfile.fullName}
              </div>
              <button
                type="button"
                onClick={async () => {
                  await onLogout();
                  navigate('/login');
                }}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
              >
                <LogOut size={15} />
                Logout
              </button>
            </div>
          </header>

          {userProfile.role === 'admin' ? (
            <nav aria-label="Admin navigation" className="flex gap-2 overflow-x-auto border-b border-slate-200 px-4 py-3 lg:hidden">
              {navItems.map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    if (key === 'applications') navigate('/admin/applicants')
                    onSectionChange?.(key)
                  }}
                  className={cn('shrink-0 rounded-lg px-3 py-2 text-sm font-medium', activeSection === key ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700')}
                >
                  {label}
                </button>
              ))}
            </nav>
          ) : null}

          <div className="p-4 sm:p-6 lg:p-8">{children}</div>
        </main>
      </div>
    </div>
  )
}

function StatCard({ label, value, tone }: { label: string; value: string; tone: 'blue' | 'indigo' | 'green' | 'amber' | 'rose' }) {
  const tones = {
    blue: 'bg-blue-50 text-blue-700',
    indigo: 'bg-indigo-50 text-indigo-700',
    green: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
    rose: 'bg-rose-50 text-rose-700',
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ring-1 ring-slate-100">
      <div className={cn('inline-flex rounded-xl px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em]', tones[tone])}>
        {label}
      </div>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">{value}</p>
    </div>
  )
}

function JobOpportunityDetailsPage({
  jobs,
  studentProfile,
  applications,
}: {
  jobs: JobPosting[]
  studentProfile: StudentProfile | null
  applications: ApplicationRecord[]
}) {
  const navigate = useNavigate()
  const { jobId } = useParams()
  const [showApplicationForm, setShowApplicationForm] = useState(false)
  const [selectedResumeUrl, setSelectedResumeUrl] = useState(studentProfile?.resume?.url ?? '')
  const [applicationError, setApplicationError] = useState('')
  const [submittingApplication, setSubmittingApplication] = useState(false)
  const [submittedApplication, setSubmittedApplication] = useState(false)

  const job = jobs.find((entry) => entry.id === jobId) ?? null
  if (!job) {
    return (
      <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <button type="button" onClick={() => navigate(-1)} className="mb-4 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700">
          ← Back to Jobs
        </button>
        <p className="text-slate-600">This placement opportunity could not be found.</p>
      </div>
    )
  }

  const eligibility = studentProfile ? checkEligibility(studentProfile, job) : {
    eligible: false,
    cgpaEligible: false,
    branchEligible: false,
    yearEligible: false,
    reasons: ['Student profile is unavailable.'],
    failedRequirements: ['Profile'],
  }

  const hasApplied = submittedApplication || Boolean(
    studentProfile && applications.some(
      (application) => application.studentId === studentProfile.uid && (application.jobId === job.id || application.opportunityId === job.id),
    ),
  )

  const companyName = getOpportunityCompanyName(job)
  const roundSteps = normalizeRecruitmentRounds(job.recruitmentRounds)
  const studentCgpa = getStudentCgpa(studentProfile)
  const studentBranch = studentProfile?.branch || 'Not available'
  const graduationYear = getStudentGraduationYear(studentProfile)
  const requiredYears = Array.isArray(job.eligibleYears) && job.eligibleYears.length > 0 ? job.eligibleYears.join(', ') : 'Not specified'
  const requiredBranches = job.eligibleBranches.length > 0 ? job.eligibleBranches.join(', ') : 'All branches'

  const handleApply = () => {
    if (!studentProfile || !eligibility.eligible || hasApplied || !isOpportunityOpen(job)) {
      return
    }

    setSelectedResumeUrl(studentProfile.resume?.url ?? '')
    setApplicationError('')
    setShowApplicationForm(true)
  }

  const submitDetailApplication = async () => {
    if (submittingApplication) {
      return
    }

    if (!studentProfile || !selectedResumeUrl) {
      setApplicationError('Select a saved resume before submitting.')
      return
    }

    if (!isOpportunityOpen(job) || !eligibility.eligible || hasApplied) {
      setApplicationError('This application is no longer available.')
      return
    }

    setSubmittingApplication(true)
    try {
      const duplicateSnapshot = await getDocs(query(
        collection(db, 'applications'),
        where('studentId', '==', studentProfile.uid),
        where('opportunityId', '==', job.id),
      ))
      if (!duplicateSnapshot.empty) {
        setApplicationError('You have already applied to this opportunity.')
        return
      }

      const applicationId = `${studentProfile.uid}_${job.id}`
    const newApplication: ApplicationRecord = {
      id: applicationId,
      studentId: studentProfile.uid,
      opportunityId: job.id,
      studentName: studentProfile.fullName,
      jobId: job.id,
      companyId: job.companyId,
      organizationName: companyName,
      jobTitle: job.title,
      organization: companyName,
      type: job.type,
      location: job.location,
      lastDate: job.applicationDeadline ?? job.postedAt,
      status: 'Applied',
      appliedAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      resumeName: studentProfile.resume?.filename || 'resume.pdf',
      resumeUrl: selectedResumeUrl,
      rollNo: studentProfile.rollNumber ?? 'N/A',
      branch: studentProfile.branch,
      email: studentProfile.email,
      cgpa: getStudentCgpa(studentProfile) ?? 0,
      currentRound: roundSteps[0]?.name ?? 'Application',
      roundResults: buildInitialRoundResults(job),
    }

      await setDoc(doc(db, 'applications', newApplication.id), newApplication)
      await createNotification(studentProfile.uid, `Application submitted for ${job.title}.`, 'application')
      setSubmittedApplication(true)
      setShowApplicationForm(false)
    } catch (submitError) {
      setApplicationError(submitError instanceof Error ? submitError.message : 'Unable to submit application.')
    } finally {
      setSubmittingApplication(false)
    }
  }

  return (
    <div className="space-y-6">
      <button type="button" onClick={() => navigate(-1)} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50">
        ← Back to Jobs
      </button>

      <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-400 text-xl font-bold text-white">
              {companyName.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Company</p>
              <h2 className="mt-1 text-3xl font-semibold text-slate-900">{companyName}</h2>
              <p className="text-sm text-slate-500">{job.location}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-600">{job.type}</span>
            <span className={cn('rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em]', eligibility.eligible ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700')}>
              {eligibility.eligible ? 'Eligible' : 'Not eligible'}
            </span>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Placement opportunity</p>
          <h3 className="mt-2 text-2xl font-semibold text-slate-900">{job.title}</h3>
          <div className="mt-4 flex flex-wrap gap-2 text-sm text-slate-600">
            <span className="rounded-full bg-white px-3 py-1.5">₹{job.salary}</span>
            <span className="rounded-full bg-white px-3 py-1.5">{job.location}</span>
            <span className="rounded-full bg-white px-3 py-1.5">Openings: {job.status === 'Open' ? '12' : '0'}</span>
            <span className="rounded-full bg-white px-3 py-1.5">Deadline: {job.applicationDeadline ? new Date(job.applicationDeadline).toLocaleDateString() : 'N/A'}</span>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Company information</p>
          <h3 className="mt-1 text-2xl font-semibold text-slate-900">{companyName}</h3>
          <div className="mt-5 space-y-3 text-sm text-slate-700">
            <p><span className="font-medium text-slate-900">Industry:</span> {job.type || 'Not specified'}</p>
            <p><span className="font-medium text-slate-900">Location:</span> {job.location || 'Not specified'}</p>
            <p><span className="font-medium text-slate-900">Opportunity:</span> {job.title}</p>
          </div>
        </section>

        <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Placement opportunity</p>
          <h3 className="mt-1 text-2xl font-semibold text-slate-900">Opportunity details</h3>
          <div className="mt-5 space-y-3 text-sm text-slate-700">
            <p><span className="font-medium text-slate-900">Type:</span> {job.type || 'Not specified'}</p>
            <p><span className="font-medium text-slate-900">Location:</span> {job.location || 'Not specified'}</p>
            <p><span className="font-medium text-slate-900">Salary / CTC:</span> {job.salary || 'Not specified'}</p>
            <p><span className="font-medium text-slate-900">Openings:</span> {job.status === 'Open' ? '12' : '0'}</p>
            <p><span className="font-medium text-slate-900">Application deadline:</span> {job.applicationDeadline ? new Date(job.applicationDeadline).toLocaleDateString() : 'N/A'}</p>
          </div>
        </section>
      </div>

      <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Eligibility</p>
        <h3 className="mt-1 text-2xl font-semibold text-slate-900">Student eligibility check</h3>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-medium text-slate-600">Your CGPA</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{studentCgpa ?? 'N/A'}</p>
            <p className="mt-2 text-sm text-slate-600">Minimum required: {job.minimumCgpa ?? 'N/A'}</p>
            <p className="mt-2 text-sm text-slate-700">{studentCgpa !== null && Number(studentCgpa) >= Number(job.minimumCgpa) ? '✓ CGPA requirement satisfied' : '✕ CGPA requirement not satisfied'}</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-medium text-slate-600">Branch & graduation year</p>
            <p className="mt-2 text-sm text-slate-700">Branch: {studentBranch}</p>
            <p className="mt-1 text-sm text-slate-700">Required: {requiredBranches}</p>
            <p className="mt-1 text-sm text-slate-700">Graduation year: {graduationYear ?? 'N/A'}</p>
            <p className="mt-1 text-sm text-slate-700">Required: {requiredYears}</p>
          </div>
        </div>

        <div className="mt-5 space-y-2">
          {eligibility.reasons.map((reason) => (
            <div key={reason} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
              {reason}
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Job description</p>
        <h3 className="mt-1 text-2xl font-semibold text-slate-900">Description</h3>
        <p className="mt-4 text-sm leading-7 text-slate-700">{job.description}</p>
      </section>

      <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Required skills</p>
        <h3 className="mt-1 text-2xl font-semibold text-slate-900">Skills</h3>
        <div className="mt-4 flex flex-wrap gap-2">
          {(job.requiredSkills?.length ? job.requiredSkills : ['Not specified']).map((skill) => (
            <span key={skill} className="rounded-full bg-slate-100 px-3 py-1.5 text-sm text-slate-700">{skill}</span>
          ))}
        </div>
      </section>

      <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Recruitment process</p>
        <h3 className="mt-1 text-2xl font-semibold text-slate-900">Rounds</h3>

        {roundSteps.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">No recruitment rounds configured for this opportunity yet.</p>
        ) : (
          <div className="mt-5 space-y-4">
            {roundSteps.map((round, index) => {
              const status = studentProfile && applications.find((application) => application.studentId === studentProfile.uid && (application.jobId === job.id || application.opportunityId === job.id))?.roundResults?.[round.id] || 'Not Started'
              const statusClass = status === 'Passed' ? 'bg-emerald-100 text-emerald-700' : status === 'Failed' ? 'bg-rose-100 text-rose-700' : status === 'Pending' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'

              return (
                <div key={round.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-500">Round {index + 1}</p>
                    <span className={cn('rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em]', statusClass)}>{status}</span>
                  </div>
                  <h4 className="mt-2 text-xl font-semibold text-slate-900">{round.name}</h4>
                </div>
              )
            })}
          </div>
        )}
      </section>

      <div className="flex justify-end">
        <button
          type="button"
          disabled={!studentProfile || !eligibility.eligible || hasApplied || !isOpportunityOpen(job)}
          onClick={() => void handleApply()}
          className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {!studentProfile ? 'Checking...' : hasApplied ? 'Already Applied' : !eligibility.eligible ? 'Not Eligible' : !isOpportunityOpen(job) ? 'Closed' : 'Apply Now'}
        </button>
      </div>
      {showApplicationForm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div className="w-full max-w-xl rounded-[28px] border border-slate-200 bg-white p-6 shadow-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Apply now</p>
            <h3 className="mt-1 text-2xl font-semibold text-slate-900">{job.title}</h3>
            <div className="mt-5 grid gap-3 text-sm text-slate-700 sm:grid-cols-2">
              <p><span className="font-medium">Roll Number:</span> {studentProfile?.rollNumber || 'N/A'}</p>
              <p><span className="font-medium">Full Name:</span> {studentProfile?.fullName}</p>
              <p><span className="font-medium">Branch:</span> {studentProfile?.branch}</p>
              <p><span className="font-medium">Email:</span> {studentProfile?.email}</p>
              <p><span className="font-medium">CGPA:</span> {studentCgpa ?? 'N/A'}</p>
              <p><span className="font-medium">Deadline:</span> {job.applicationDeadline ? new Date(job.applicationDeadline).toLocaleDateString() : 'N/A'}</p>
            </div>
            <div className="mt-5">
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Saved resume</label>
              <select value={selectedResumeUrl} onChange={(event) => setSelectedResumeUrl(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-900">
                <option value="">Select a saved resume</option>
                {studentProfile?.resume?.url ? <option value={studentProfile.resume.url}>{studentProfile.resume.filename}</option> : null}
              </select>
            </div>
            {applicationError ? <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{applicationError}</p> : null}
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setShowApplicationForm(false)} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700">Cancel</button>
              <button type="button" disabled={submittingApplication} onClick={() => void submitDetailApplication()} className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60">{submittingApplication ? 'Submitting...' : 'Submit Application'}</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function StudentDashboard({
  studentProfile,
  jobs,
  applications,
  notifications,
  userProfile,
  activeSection,
  onSectionChange,
}: {
  studentProfile: StudentProfile | null
  jobs: JobPosting[]
  applications: ApplicationRecord[]
  notifications: NotificationItem[]
  userProfile: UserProfile
  activeSection: StudentSection
  onSectionChange: (section: StudentSection) => void
}) {
  const [profileForm, setProfileForm] = useState<StudentProfile | null>(studentProfile)
  const [savingProfile, setSavingProfile] = useState(false)
  const [aiResult, setAiResult] = useState<AiAnalysisResult | null>(null)
  const [aiLoading, setAiLoading] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [jobSearch, setJobSearch] = useState('')
  const [jobFilter, setJobFilter] = useState<'all' | 'eligible'>('all')
  const [newSkill, setNewSkill] = useState('')
  const [resumeUrl, setResumeUrl] = useState(studentProfile?.resume?.url ?? '')
  const [resumeName, setResumeName] = useState(studentProfile?.resume?.filename ?? '')
  
  // ATS Resume Checker state
  const [atsAnalysis, setAtsAnalysis] = useState<ATSAnalysis | null>(null)
  const [atsLoading, setAtsLoading] = useState(false)
  const [atsMode, setAtsMode] = useState<'general' | 'job'>('general')
  const [atsExtractedText, setAtsExtractedText] = useState('')
  const [atsExtracting, setAtsExtracting] = useState(false)
  const [atsCompanies, setAtsCompanies] = useState<ExternalCompany[]>([])
  const [atsCompaniesLoading, setAtsCompaniesLoading] = useState(false)
  const [atsCompanyError, setAtsCompanyError] = useState('')
  const [atsCompanySearch, setAtsCompanySearch] = useState('')
  const [atsSelectedCompanyKey, setAtsSelectedCompanyKey] = useState('')
  const [atsCompanyJobs, setAtsCompanyJobs] = useState<ATSJobListing[]>([])
  const [atsJobsLoading, setAtsJobsLoading] = useState(false)
  const [atsJobsError, setAtsJobsError] = useState('')
  const [atsSelectedJobKey, setAtsSelectedJobKey] = useState('')
  const [atsSelectedJob, setAtsSelectedJob] = useState<ATSJobListing | null>(null)
  const [atsJobDetailsLoading, setAtsJobDetailsLoading] = useState(false)
  const [atsJobDetailsError, setAtsJobDetailsError] = useState('')
  const [atsJobsRefreshKey, setAtsJobsRefreshKey] = useState(0)
  const [atsCompanyCatalogRefreshKey, setAtsCompanyCatalogRefreshKey] = useState(0)
  const [atsResumeFile, setAtsResumeFile] = useState<File | null>(null)
  const [atsAnalysisHistory, setAtsAnalysisHistory] = useState<ATSAnalysis[]>([])
  const [atsSelectedResume, setAtsSelectedResume] = useState<'new' | 'saved'>('saved')
  const [atsError, setAtsError] = useState('')

  const atsCompanyOptions = useMemo(
    () => getCompanyOptions(atsCompanies, jobs),
    [atsCompanies, jobs],
  )
  const filteredATSCompanies = useMemo(
    () => filterCompanyOptions(atsCompanyOptions, atsCompanySearch),
    [atsCompanyOptions, atsCompanySearch],
  )
  const atsSelectedCompany = atsCompanyOptions.find((company) => company.key === atsSelectedCompanyKey) ?? null

  useEffect(() => {
    setProfileForm(studentProfile)
    setResumeUrl(studentProfile?.resume?.url ?? '')
    setResumeName(studentProfile?.resume?.filename ?? '')
  }, [studentProfile])

  useEffect(() => {
    if (activeSection !== 'ats' || atsMode !== 'job') return
    let active = true
    setAtsCompaniesLoading(true)
    setAtsCompanyError('')
    const callable = httpsCallable<Record<string, never>, { companies: ExternalCompany[] }>(functions, 'listExternalJobCompanies')
    void callable({}).then((result) => {
      if (active) setAtsCompanies(result.data.companies ?? [])
    }).catch((catalogError: unknown) => {
      if (active) setAtsCompanyError(catalogError instanceof Error ? catalogError.message : 'External company sources are unavailable.')
    }).finally(() => {
      if (active) setAtsCompaniesLoading(false)
    })
    return () => { active = false }
  }, [activeSection, atsMode, atsCompanyCatalogRefreshKey])

  useEffect(() => {
    if (activeSection !== 'ats' || atsMode !== 'job' || !atsSelectedCompany) return
    let active = true
    setAtsCompanyJobs([])
    setAtsSelectedJobKey('')
    setAtsSelectedJob(null)
    setAtsJobsError('')
    setAtsJobsLoading(true)

    const loadCompanyJobs = async () => {
      try {
        if (atsSelectedCompany.source === 'CampusHire') {
          const checkedAt = new Date().toISOString()
          const internalListings = jobs
            .filter((job) => matchesCampusHireCompany(job, atsSelectedCompany.id) && job.published === true && isCampusHireJobOpen(job))
            .map((job) => mapCampusHireJob(job, checkedAt))
          if (active) setAtsCompanyJobs(deduplicateJobListings(internalListings))
          return
        }

        const callable = httpsCallable<{ companyId: string }, { checkedAt: string; jobs: GreenhouseJobPayload[] }>(functions, 'listExternalCompanyJobs')
        const result = await callable({ companyId: atsSelectedCompany.id })
        if (active) setAtsCompanyJobs(deduplicateJobListings(result.data.jobs.map(mapGreenhouseJob)))
      } catch (loadError) {
        if (active) setAtsJobsError(loadError instanceof Error ? loadError.message : 'Unable to retrieve current company jobs.')
      } finally {
        if (active) setAtsJobsLoading(false)
      }
    }

    void loadCompanyJobs()
    return () => { active = false }
  }, [activeSection, atsMode, atsSelectedCompany?.id, atsSelectedCompany?.source, atsJobsRefreshKey, jobs])

  useEffect(() => {
    if (activeSection !== 'ats' || atsMode !== 'job' || !atsSelectedJobKey) return
    const selectedListing = atsCompanyJobs.find((job) => `${job.source}:${job.companyId}:${job.jobId}` === atsSelectedJobKey)
    if (!selectedListing) return
    let active = true
    setAtsSelectedJob(null)
    setAtsJobDetailsError('')
    setAtsJobDetailsLoading(true)

    const loadSelectedJobDetails = async () => {
      try {
        if (selectedListing.source === 'CampusHire') {
          if (selectedListing.internalJob && isCampusHireJobOpen(selectedListing.internalJob)) {
            if (active) setAtsSelectedJob(selectedListing)
          } else {
            throw new Error('This CampusHire posting is no longer open. Refresh the company jobs.')
          }
          return
        }
        const callable = httpsCallable<{ companyId: string; jobId: string }, GreenhouseJobPayload>(functions, 'getExternalJobDetails')
        const result = await callable({ companyId: selectedListing.companyId, jobId: selectedListing.jobId })
        if (active) setAtsSelectedJob(mapGreenhouseJob(result.data))
      } catch (detailsError) {
        if (active) setAtsJobDetailsError(detailsError instanceof Error ? detailsError.message : 'Unable to retrieve this job description.')
      } finally {
        if (active) setAtsJobDetailsLoading(false)
      }
    }

    void loadSelectedJobDetails()
    return () => { active = false }
  }, [activeSection, atsMode, atsSelectedJobKey, atsCompanyJobs])

  // Load ATS analysis history when ATS section is accessed
  const atsHistoryLoadedRef = useRef(false)
  useEffect(() => {
    if (activeSection === 'ats' && studentProfile && !atsHistoryLoadedRef.current) {
      atsHistoryLoadedRef.current = true
      const loadATSHistory = async () => {
        try {
          const snapshot = await getDocs(
            query(
              collection(db, 'students', studentProfile.uid, 'atsAnalyses'),
              orderBy('createdAt', 'desc'),
            ),
          )
          const analyses = snapshot.docs.map((doc) => doc.data() as ATSAnalysis)
          setAtsAnalysisHistory(analyses)
        } catch (error) {
          console.error('Failed to load ATS analysis history:', error)
        }
      }
      void loadATSHistory()
    }
  }, [activeSection, studentProfile])

  useEffect(() => {
    let active = true
    setAtsExtractedText('')
    if (activeSection !== 'ats') {
      setAtsExtracting(false)
      return () => { active = false }
    }
    setAtsError('')

    const loadResumeText = async () => {
      if (atsSelectedResume === 'new' && !atsResumeFile) {
        setAtsExtracting(false)
        return
      }
      if (atsSelectedResume === 'saved' && !studentProfile?.resume?.url) {
        setAtsExtracting(false)
        return
      }

      setAtsExtracting(true)
      try {
        let file: File
        if (atsSelectedResume === 'new' && atsResumeFile) {
          file = atsResumeFile
        } else {
          const filename = studentProfile?.resume?.filename || 'resume.pdf'
          const response = await fetch(studentProfile?.resume?.url ?? '')
          if (!response.ok) {
            throw new Error('Could not download the saved resume. Check that its link is accessible or upload the file directly.')
          }
          const blob = await response.blob()
          if (blob.type.includes('text/html')) {
            throw new Error('The saved link returned a web page instead of a resume file. Use a direct PDF, DOCX, or TXT link.')
          }
          const blobType = blob.type === 'application/octet-stream' ? '' : blob.type
          file = new File([blob], filename, { type: blobType })
        }

        await validateResumeFile(file)
        const extractedText = await extractATSResumeText(file)
        if (!extractedText.trim()) throw new Error('No readable text was extracted from this resume.')
        if (active) setAtsExtractedText(extractedText)
      } catch (loadError) {
        if (active) {
          setAtsError(loadError instanceof Error ? loadError.message : 'Unable to read this resume.')
        }
      } finally {
        if (active) setAtsExtracting(false)
      }
    }

    void loadResumeText()
    return () => { active = false }
  }, [activeSection, atsSelectedResume, atsResumeFile, studentProfile?.resume?.filename, studentProfile?.resume?.url])

  const eligibleJobs = useMemo(
    () => (studentProfile ? jobs.filter((job) => checkEligibility(studentProfile, job).eligible) : []),
    [jobs, studentProfile],
  )

  const completion = useMemo(
    () => calculateProfileCompletion(profileForm),
    [profileForm],
  )

  const eligibility = useMemo(
    () => evaluatePlacementEligibility(studentProfile),
    [studentProfile],
  )

  const filteredJobs = useMemo(() => {
    const searchText = jobSearch.trim().toLowerCase()

    return jobs.filter((job) => {
      const matchesSearch =
        searchText.length === 0 ||
        job.title.toLowerCase().includes(searchText) ||
        job.companyName.toLowerCase().includes(searchText) ||
        job.location.toLowerCase().includes(searchText)

      const eligible = studentProfile ? checkEligibility(studentProfile, job).eligible : false
      const matchesFilter = jobFilter === 'all' || (jobFilter === 'eligible' && eligible)

      return matchesSearch && matchesFilter
    })
  }, [jobSearch, jobFilter, jobs, studentProfile])

  const handleProfileSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!profileForm) {
      return
    }

    setSavingProfile(true)
    setError('')

    try {
      const nextProfile = {
        ...profileForm,
        userId: profileForm.uid,
        aadhaarMasked: profileForm.aadhaarMasked || maskAadhaar(profileForm.aadhaarLast4),
        panMasked: profileForm.panMasked || maskPan(profileForm.panMasked),
        updatedAt: new Date().toISOString(),
        cgpa: Number(profileForm.cgpa),
        graduationYear: Number(profileForm.graduationYear),
        skills: profileForm.skills,
        projects: profileForm.projects ?? [],
        certifications: profileForm.certifications ?? [],
      }

      await setDoc(doc(db, 'students', profileForm.uid), nextProfile)
      await setDoc(doc(db, 'users', userProfile.uid), {
        ...userProfile,
        fullName: profileForm.fullName,
        email: profileForm.email,
      })
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : 'Unable to save profile.'
      setError(message)
    } finally {
      setSavingProfile(false)
    }
  }

  const addSkill = () => {
    if (!profileForm || !newSkill.trim()) {
      return
    }

    setProfileForm({
      ...profileForm,
      skills: Array.from(new Set([...(profileForm.skills ?? []), newSkill.trim()])),
    })
    setNewSkill('')
  }

  const removeSkill = (skillToRemove: string) => {
    if (!profileForm) {
      return
    }

    setProfileForm({
      ...profileForm,
      skills: profileForm.skills.filter((skill) => skill !== skillToRemove),
    })
  }

  const addProject = () => {
    if (!profileForm) {
      return
    }

    setProfileForm({
      ...profileForm,
      projects: [
        ...(profileForm.projects ?? []),
        {
          id: `project-${Date.now()}`,
          name: 'New Project',
          description: 'Describe project impact and technical stack.',
          technologies: ['React', 'Firebase'],
          projectUrl: 'https://example.com',
          githubUrl: 'https://github.com/example',
          role: 'Developer',
          duration: '3 months',
        },
      ],
    })
  }

  const addCertification = () => {
    if (!profileForm) {
      return
    }

    setProfileForm({
      ...profileForm,
      certifications: [
        ...(profileForm.certifications ?? []),
        {
          id: `cert-${Date.now()}`,
          name: 'New Certification',
          issuingOrganization: 'Platform',
          issueDate: new Date().toISOString().slice(0, 10),
          credentialId: 'CERT-001',
          credentialUrl: 'https://example.com',
        },
      ],
    })
  }

  // ATS Resume Checker handler
  const handleATSAnalysis = async () => {
    if (!studentProfile) {
      setAtsError('Student profile not available.')
      return
    }
    if (atsExtracting || !atsExtractedText.trim()) {
      setAtsError(atsExtracting ? 'Resume text is still being extracted.' : 'Upload a readable resume before analyzing it.')
      return
    }
    if (atsMode === 'job' && !atsSelectedJob) {
      setAtsError('Select a current company role before running a job-specific analysis.')
      return
    }

    setAtsError('')
    setAtsLoading(true)
    try {
      let selectedJobForAnalysis = atsSelectedJob
      if (atsMode === 'job' && selectedJobForAnalysis?.source === 'Greenhouse') {
        const callable = httpsCallable<{ companyId: string; jobId: string }, GreenhouseJobPayload>(functions, 'getExternalJobDetails')
        const refreshed = await callable({ companyId: selectedJobForAnalysis.companyId, jobId: selectedJobForAnalysis.jobId })
        selectedJobForAnalysis = mapGreenhouseJob(refreshed.data)
        setAtsSelectedJob(selectedJobForAnalysis)
      }
      if (atsMode === 'job' && selectedJobForAnalysis?.source === 'CampusHire'
        && (!selectedJobForAnalysis.internalJob || !isCampusHireJobOpen(selectedJobForAnalysis.internalJob))) {
        throw new Error('This CampusHire opportunity is no longer open. Refresh the company listings and choose another role.')
      }
      if (atsMode === 'job' && !selectedJobForAnalysis?.descriptionText.trim()) {
        throw new Error('This source does not provide a complete job description, so a job match cannot be calculated.')
      }

      const generalResult = analyzeResume(atsExtractedText, { mode: 'general' })
      const jobResult = atsMode === 'job' && selectedJobForAnalysis
        ? analyzeResume(atsExtractedText, {
          mode: 'job',
          targetRole: selectedJobForAnalysis.title,
          jobDescription: selectedJobForAnalysis.descriptionText,
        })
        : null
      const result = jobResult ?? generalResult
      const analysisId = `${studentProfile.uid}-${Date.now()}`
      const selectedResumeName = atsSelectedResume === 'new'
        ? atsResumeFile?.name ?? 'resume'
        : studentProfile.resume?.filename ?? 'resume'
      const analysis: ATSAnalysis = {
        id: analysisId,
        studentId: studentProfile.uid,
        resumeUrl: atsSelectedResume === 'saved' ? studentProfile.resume?.url ?? '' : 'new-upload',
        resumeFilename: selectedResumeName,
        selectedRole: selectedJobForAnalysis?.title ?? result.targetRole,
        mode: result.mode,
        candidateLevel: result.candidateLevel,
        atsScore: jobResult?.score ?? generalResult.score,
        generalScore: generalResult.score,
        generalScoreBreakdown: generalResult.scoreBreakdown,
        generalScoreWeights: generalResult.scoreWeights,
        generalScoreDescriptions: generalResult.scoreDescriptions,
        companyName: selectedJobForAnalysis?.companyName,
        jobId: selectedJobForAnalysis?.jobId,
        jobSource: selectedJobForAnalysis?.source,
        jobSourceUrl: selectedJobForAnalysis?.sourceUrl,
        jobCheckedAt: selectedJobForAnalysis?.checkedAt,
        jobClosingDate: selectedJobForAnalysis?.closingDate,
        jobLocation: selectedJobForAnalysis?.location,
        jobDescription: selectedJobForAnalysis?.descriptionText,
        jobDescriptionHtml: selectedJobForAnalysis?.descriptionHtml,
        jobRequiredSkills: selectedJobForAnalysis?.requiredSkills,
        jobPreferredSkills: selectedJobForAnalysis?.preferredSkills,
        jobQualifications: selectedJobForAnalysis?.qualifications,
        jobRequiredQualifications: selectedJobForAnalysis?.requiredQualifications,
        jobPreferredQualifications: selectedJobForAnalysis?.preferredQualifications,
        jobResponsibilities: selectedJobForAnalysis?.responsibilities,
        jobExperienceLevel: selectedJobForAnalysis?.experienceLevel,
        jobRequiredExperience: selectedJobForAnalysis?.requiredExperience,
        jobPreferredExperience: selectedJobForAnalysis?.preferredExperience,
        jobMissingInformation: selectedJobForAnalysis?.missingDescriptionInformation,
        eligibilityComparison: selectedJobForAnalysis?.source === 'CampusHire' && selectedJobForAnalysis.internalJob
          ? (() => {
            const eligibility = checkEligibility(studentProfile, selectedJobForAnalysis.internalJob!)
            return { eligible: eligibility.eligible, reasons: eligibility.reasons }
          })()
          : undefined,
        keywordsFound: result.requirements.filter((requirement) => requirement.status === 'matched').map((requirement) => requirement.name),
        missingKeywords: result.requirements.filter((requirement) => requirement.status === 'missing').map((requirement) => requirement.name),
        detectedSkills: result.detectedSkills.map((skill) => skill.name),
        requirements: result.requirements,
        sectionsFound: result.sectionsFound,
        missingSections: [],
        suggestions: result.suggestions,
        contactInfo: result.contacts,
        scoreBreakdown: jobResult?.scoreBreakdown ?? generalResult.scoreBreakdown,
        scoreWeights: jobResult?.scoreWeights ?? generalResult.scoreWeights,
        scoreDescriptions: jobResult?.scoreDescriptions ?? generalResult.scoreDescriptions,
        readability: result.readability,
        createdAt: new Date().toISOString(),
      }

      try {
        await setDoc(doc(db, 'students', studentProfile.uid, 'atsAnalyses', analysisId), analysis)
      } catch (firestoreError) {
        console.error('Failed to save ATS analysis to Firestore:', firestoreError)
        const reason = firestoreError instanceof Error ? ` ${firestoreError.message}` : ''
        setAtsError(`Analysis completed, but it could not be saved to your private history.${reason}`)
      }

      setAtsAnalysis(analysis)
      setAtsAnalysisHistory((previous) => [analysis, ...previous].slice(0, 10))
      try {
        await createNotification(studentProfile.uid, `Resume analysis completed: ${selectedJobForAnalysis?.title ?? result.targetRole}.`, 'system')
      } catch (notificationError) {
        console.error('Failed to create resume analysis notification:', notificationError)
      }
    } catch (analysisError) {
      setAtsError(analysisError instanceof Error ? analysisError.message : 'Failed to analyze resume.')
    } finally {
      setAtsLoading(false)
    }
  }

  const handleATSFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    setAtsAnalysis(null)
    setAtsExtractedText('')
    setAtsError('')
    setAtsSelectedResume('new')
    setAtsResumeFile(file)
  }

  const navigate = useNavigate()
  const [applyingJob, setApplyingJob] = useState<JobPosting | null>(null)
  const [appForm, setAppForm] = useState({
    resumeUrl: studentProfile?.resume?.url ?? '',
    resumeName: studentProfile?.resume?.filename ?? 'resume.pdf',
  })
  const [submittingApplication, setSubmittingApplication] = useState(false)
  const [submittedOpportunityIds, setSubmittedOpportunityIds] = useState<string[]>([])

  useEffect(() => {
    setAppForm({
      resumeUrl: studentProfile?.resume?.url ?? '',
      resumeName: studentProfile?.resume?.filename ?? 'resume.pdf',
    })
  }, [studentProfile])

  const openApplyModal = (job: JobPosting) => {
    if (!studentProfile) {
      return
    }

    const eligibilityCheck = evaluateOpportunityEligibility(studentProfile, job)
    if (!eligibilityCheck.eligible) {
      setError(eligibilityCheck.reason)
      return
    }

    if (!isOpportunityOpen(job)) {
      setError('This opportunity is closed.')
      return
    }

    const existing = applications.find(
      (application) => application.studentId === studentProfile.uid && (application.jobId === job.id || application.opportunityId === job.id),
    )

    if (existing) {
      setError('This application already exists for this opportunity.')
      return
    }

    setApplyingJob(job)
    setError('')
    setSuccessMessage('')
  }

  const submitApplication = async () => {
    if (submittingApplication || !studentProfile || !applyingJob) {
      return
    }

    setSubmittingApplication(true)

    try {
      const eligibilityCheck = evaluateOpportunityEligibility(studentProfile, applyingJob)
      if (!eligibilityCheck.eligible) {
        setError(eligibilityCheck.reason)
        return
      }

      if (!isOpportunityOpen(applyingJob)) {
        setError('Applications are closed for this opportunity.')
        return
      }

    const cgpa = getStudentCgpa(studentProfile)
    const graduationYear = getStudentGraduationYear(studentProfile)
    const profileReady = Boolean(
      studentProfile.fullName &&
      studentProfile.email &&
      studentProfile.rollNumber &&
      studentProfile.branch &&
      cgpa !== null &&
      graduationYear !== null,
    )

      if (!profileReady) {
        setError('Complete the student profile before applying.')
        return
      }

      const duplicateSnapshot = await getDocs(query(
        collection(db, 'applications'),
        where('studentId', '==', studentProfile.uid),
        where('opportunityId', '==', applyingJob.id),
      ))

      if (!duplicateSnapshot.empty) {
        setError('You have already applied to this opportunity.')
        return
      }

      const applicationId = `${studentProfile.uid}_${applyingJob.id}`
    const organizationName = getOpportunityCompanyName(applyingJob)
    const recruitmentRounds = normalizeRecruitmentRounds(applyingJob.recruitmentRounds)
    const roundResults = buildInitialRoundResults(applyingJob)
    const currentRound = recruitmentRounds[0]?.name ?? 'Application'
    const newApplication: ApplicationRecord = {
      id: applicationId,
      studentId: studentProfile.uid,
      opportunityId: applyingJob.id,
      studentName: studentProfile.fullName,
      jobId: applyingJob.id,
      companyId: applyingJob.companyId,
      organizationName,
      jobTitle: applyingJob.title,
      organization: organizationName,
      type: applyingJob.type,
      location: applyingJob.location,
      lastDate: applyingJob.applicationDeadline ?? applyingJob.postedAt,
      status: 'Applied',
      appliedAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      resumeName: appForm.resumeName || studentProfile.resume?.filename || 'resume.pdf',
      resumeUrl: appForm.resumeUrl || studentProfile.resume?.url || '',
      rollNo: studentProfile.rollNumber ?? 'N/A',
      branch: studentProfile.branch,
      email: studentProfile.email,
      cgpa: cgpa ?? 0,
      currentRound,
      roundResults,
    }

      await setDoc(doc(db, 'applications', newApplication.id), newApplication)
      await createNotification(studentProfile.uid, `Application submitted for ${applyingJob.title}.`, 'application')
      setError('')
      setSuccessMessage('Application submitted successfully.')
      setSubmittedOpportunityIds((current) => current.includes(applyingJob.id) ? current : [...current, applyingJob.id])
      setApplyingJob(null)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to submit application.')
    } finally {
      setSubmittingApplication(false)
    }
  }

  const runAiAnalysis = async (job: JobPosting) => {
    if (!studentProfile) {
      return
    }

    setAiLoading(job.id)
    setError('')

    try {
      const callable = httpsCallable<{ studentProfile: StudentProfile; job: JobPosting }, AiAnalysisResult>(
        functions,
        'generateAiMatchAnalysis',
      )

      const result = await callable({ studentProfile, job })
      const payload = result.data as AiAnalysisResult

      await setDoc(doc(db, 'aiAnalyses', `${studentProfile.uid}-${job.id}`), {
        id: `${studentProfile.uid}-${job.id}`,
        studentId: studentProfile.uid,
        jobId: job.id,
        matchScore: payload.matchScore,
        summary: payload.summary,
        tips: payload.tips,
        createdAt: new Date().toISOString(),
      })

      setAiResult(payload)
    } catch (analysisError) {
      const fallback = calculateLocalCareerMatch(studentProfile, job)
      setAiResult({
        id: `${studentProfile.uid}-${job.id}`,
        studentId: studentProfile.uid,
        jobId: job.id,
        matchScore: fallback.matchScore,
        summary: fallback.summary,
        tips: fallback.tips,
        createdAt: new Date().toISOString(),
      })
      setError('AI service unavailable — using local career matching.')
    } finally {
      setAiLoading(null)
    }
  }

  const saveResume = async () => {
    if (!profileForm) {
      return
    }

    const url = resumeUrl.trim()
    if (url && !/^https?:\/\//i.test(url)) {
      setError('Resume link must be a valid URL starting with http:// or https://')
      return
    }

    await setDoc(doc(db, 'students', profileForm.uid), {
      ...profileForm,
      resume: {
        filename: resumeName || 'resume.pdf',
        url: url || '',
        updatedAt: new Date().toISOString(),
        status: url ? 'Linked' : 'Not uploaded',
      },
      updatedAt: new Date().toISOString(),
    })

    setError('')
  }

  const markNotificationRead = async (notificationId: string) => {
    const notification = notifications.find((item) => item.id === notificationId)
    if (!notification) {
      return
    }

    await updateDoc(doc(db, 'notifications', notificationId), { isRead: true })
    notification.isRead = true
  }

  const markAllRead = async () => {
    for (const notification of notifications) {
      if (!notification.isRead) {
        await updateDoc(doc(db, 'notifications', notification.id), { isRead: true })
      }
    }
  }

  if (!studentProfile || !profileForm) {
    return <div className="rounded-2xl bg-white p-6 shadow-sm">Student profile not found.</div>
  }

  const selectedCount = applications.filter((item) => item.status === 'Selected').length
  const applicationCounts = {
    Applied: applications.filter((item) => item.status === 'Applied').length,
    Shortlisted: applications.filter((item) => item.status === 'Shortlisted').length,
    Selected: selectedCount,
    Rejected: applications.filter((item) => item.status === 'Rejected').length,
  }

  const navItems = [
    { key: 'overview', label: 'Dashboard' },
    { key: 'personal', label: 'My Profile' },
    { key: 'academic', label: 'Academic Details' },
    { key: 'skills', label: 'Skills & Projects' },
    { key: 'resume', label: 'Resume' },
    { key: 'ats', label: 'ATS Resume Checker' },
    { key: 'jobs', label: 'Job Opportunities' },
    { key: 'applications', label: 'My Applications' },
    { key: 'ai', label: 'AI Career Match' },
    { key: 'notifications', label: 'Notifications' },
    { key: 'settings', label: 'Settings' },
  ] as const

  const studentOverview = (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-slate-200 bg-gradient-to-r from-slate-950 via-blue-950 to-indigo-800 p-6 text-white shadow-xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-200">Placement dashboard</p>
            <h2 className="mt-2 text-3xl font-semibold">Welcome back, {studentProfile.fullName}</h2>
          </div>
          <div className="rounded-2xl bg-white/10 px-4 py-3 backdrop-blur-sm">
            <div className="text-sm text-sky-100">Profile completion</div>
            <div className="mt-2 flex items-center gap-3">
              <div className="h-2.5 w-32 rounded-full bg-white/15">
                <div className="h-2.5 rounded-full bg-emerald-400" style={{ width: `${completion}%` }} />
              </div>
              <span className="text-lg font-semibold">{completion}%</span>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Profile Completion" value={`${completion}%`} tone="blue" />
        <StatCard label="Eligible Jobs" value={String(eligibleJobs.length)} tone="indigo" />
        <StatCard label="Applications" value={String(applications.length)} tone="amber" />
        <StatCard label="Shortlisted" value={String(applicationCounts.Shortlisted)} tone="green" />
        <StatCard label="Selected" value={String(selectedCount)} tone="rose" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_0.8fr]">
        <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Placement eligibility</p>
              <h3 className="mt-1 text-2xl font-semibold text-slate-900">{eligibility.eligible ? 'Eligible for this placement drive' : 'Not eligible yet'}</h3>
            </div>
            <div className={cn('rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em]', eligibility.eligible ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700')}>
              {eligibility.eligible ? 'Eligible' : 'Not Eligible'}
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {eligibility.reasons.map((reason) => (
              <div key={reason} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                {reason}
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Recommended</p>
              <h3 className="mt-1 text-2xl font-semibold text-slate-900">Opportunities</h3>
            </div>
            <Sparkles size={18} className="text-violet-600" />
          </div>

          <div className="mt-5 space-y-3">
            {jobs.slice(0, 3).map((job) => (
              <div key={job.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-900">{job.title}</p>
                    <p className="text-xs text-slate-500">{job.companyName}</p>
                  </div>
                  <span className="rounded-full bg-blue-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-blue-700">
                    {isStudentEligible(studentProfile, job) ? 'Match' : 'Check'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )

  const personalSection = (
    <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Profile</p>
          <h3 className="mt-1 text-2xl font-semibold text-slate-900">Personal Information</h3>
        </div>
        <div className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">
          {completion}% complete
        </div>
      </div>

      <form className="grid gap-4 md:grid-cols-2" onSubmit={handleProfileSubmit}>
        {[
          ['fullName', 'Full Name'],
          ['email', 'Email'],
          ['phone', 'Mobile Number'],
          ['aadhaarMasked', 'Aadhaar Number'],
          ['panMasked', 'PAN Card Number'],
          ['dateOfBirth', 'Date of Birth'],
          ['gender', 'Gender'],
          ['address', 'Address'],
          ['city', 'City'],
          ['state', 'State'],
          ['pincode', 'Pincode'],
        ].map(([field, label]) => (
          <label key={field} className="block text-sm text-slate-700">
            <span className="mb-1.5 block font-medium text-slate-600">{label}</span>
            <input
              value={String((profileForm as unknown as Record<string, string | undefined>)[field] ?? '')}
              onChange={(event) => setProfileForm({ ...profileForm, [field]: event.target.value })}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white"
            />
          </label>
        ))}

        <div className="md:col-span-2 flex items-center justify-end gap-3">
          <button type="button" onClick={() => setProfileForm({ ...profileForm, aadhaarMasked: maskAadhaar(profileForm.aadhaarLast4), panMasked: maskPan(profileForm.panMasked) })} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700">Mask sensitive values</button>
          <button type="submit" disabled={savingProfile} className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white">{savingProfile ? 'Saving...' : 'Save Information'}</button>
        </div>
      </form>
    </section>
  )

  const academicSection = (
    <section className="space-y-6">
      <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Academics</p>
        <h3 className="mt-1 text-2xl font-semibold text-slate-900">Academic Details</h3>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {[
            ['tenth', '10th / SSC'],
            ['intermediate', 'Intermediate / 12th'],
            ['ug', 'UG / Degree'],
          ].map(([key, label]) => (
            <div key={key} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <h4 className="text-lg font-semibold text-slate-900">{label}</h4>
              <div className="mt-3 space-y-2 text-sm text-slate-700">
                {key === 'tenth' ? (
                  <>
                    <p>School: {profileForm.tenth?.schoolName ?? '—'}</p>
                    <p>Board: {profileForm.tenth?.board ?? '—'}</p>
                    <p>Percentage: {profileForm.tenth?.percentage ?? '—'}</p>
                    <p>Passing year: {profileForm.tenth?.passingYear ?? '—'}</p>
                  </>
                ) : key === 'intermediate' ? (
                  <>
                    <p>College: {profileForm.intermediate?.collegeName ?? '—'}</p>
                    <p>Board: {profileForm.intermediate?.board ?? '—'}</p>
                    <p>Percentage: {profileForm.intermediate?.percentage ?? '—'}</p>
                    <p>Passing year: {profileForm.intermediate?.passingYear ?? '—'}</p>
                  </>
                ) : (
                  <>
                    <p>Degree: {profileForm.ug?.degree ?? '—'}</p>
                    <p>University: {profileForm.ug?.university ?? '—'}</p>
                    <p>College: {profileForm.ug?.college ?? '—'}</p>
                    <p>Branch: {profileForm.ug?.branch ?? '—'}</p>
                    <p>CGPA: {profileForm.ug?.cgpa ?? profileForm.cgpa ?? '—'}</p>
                    <p>Expected graduation: {profileForm.ug?.graduationYear ?? profileForm.graduationYear ?? '—'}</p>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )

  const skillsSection = (
    <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Skills</p>
          <h3 className="mt-1 text-2xl font-semibold text-slate-900">Skills & Technologies</h3>
        </div>
      </div>

      <div className="mt-5 flex gap-2">
        <input
          value={newSkill}
          onChange={(event) => setNewSkill(event.target.value)}
          placeholder="Add skill"
          className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white"
        />
        <button type="button" onClick={addSkill} className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white">Add</button>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {(profileForm.skills ?? []).map((skill) => (
          <button
            key={skill}
            type="button"
            onClick={() => removeSkill(skill)}
            className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-700 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"
          >
            {skill} ×
          </button>
        ))}
      </div>
    </section>
  )

  const projectsSection = (
    <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Projects</p>
          <h3 className="mt-1 text-2xl font-semibold text-slate-900">Project Portfolio</h3>
        </div>
        <button type="button" onClick={addProject} className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white">Add project</button>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        {(profileForm.projects ?? []).map((project) => (
          <div key={project.id ?? project.name} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between">
              <h4 className="text-lg font-semibold text-slate-900">{project.name}</h4>
              <span className="rounded-full bg-blue-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-blue-700">{project.role}</span>
            </div>
            <p className="mt-2 text-sm text-slate-600">{project.description}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {(project.technologies ?? []).map((tech) => (
                <span key={tech} className="rounded-full bg-white px-2 py-1 text-[10px] font-medium text-slate-600">{tech}</span>
              ))}
            </div>
            <div className="mt-3 text-xs text-slate-500">Duration: {project.duration}</div>
          </div>
        ))}
      </div>
    </section>
  )

  const certificationsSection = (
    <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Certifications</p>
          <h3 className="mt-1 text-2xl font-semibold text-slate-900">Professional Certifications</h3>
        </div>
        <button type="button" onClick={addCertification} className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white">Add certification</button>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        {(profileForm.certifications ?? []).map((certificate) => (
          <div key={certificate.id ?? certificate.name} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <h4 className="text-lg font-semibold text-slate-900">{certificate.name}</h4>
            <p className="mt-1 text-sm text-slate-600">{certificate.issuingOrganization}</p>
            <div className="mt-3 text-sm text-slate-600">Issued: {certificate.issueDate}</div>
            <div className="mt-1 text-sm text-slate-600">Credential: {certificate.credentialId}</div>
          </div>
        ))}
      </div>
    </section>
  )

  const resumeSection = (
    <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Resume</p>
          <h3 className="mt-1 text-2xl font-semibold text-slate-900">Resume management</h3>
        </div>
        <button type="button" onClick={() => onSectionChange('ats')} className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700">
          <Gauge size={17} /> ATS Resume Checker
        </button>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-medium text-slate-600">Resume filename</p>
          <p className="mt-2 text-lg font-semibold text-slate-900">{profileForm.resume?.filename ?? 'No resume linked'}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-medium text-slate-600">Resume status</p>
          <p className="mt-2 text-lg font-semibold text-slate-900">{profileForm.resume?.status ?? 'Not uploaded'}</p>
        </div>
      </div>

      <div className="mt-5 space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Resume link</label>
          <input
            value={resumeUrl}
            onChange={(event) => setResumeUrl(event.target.value)}
            placeholder="https://drive.google.com/... or https://example.com/resume.pdf"
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-slate-900 outline-none transition focus:border-blue-500"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Resume filename</label>
          <input
            value={resumeName}
            onChange={(event) => setResumeName(event.target.value)}
            placeholder="resume.pdf"
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-slate-900 outline-none transition focus:border-blue-500"
          />
        </div>

        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={() => void saveResume()} className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white">Save resume link</button>
          <a href={resumeUrl || '#'} target="_blank" rel="noreferrer" className={cn('rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700', !resumeUrl && 'pointer-events-none opacity-50')}>View Resume</a>
          <button type="button" onClick={() => { setResumeUrl(''); setResumeName(''); }} className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700">Remove Resume</button>
        </div>
      </div>
    </section>
  )

  const atsSection = (
    <section className="space-y-5">
      <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">ATS Resume Checker</p>
          <h3 className="mt-1 text-2xl font-semibold text-slate-900">Analyze Your Resume</h3>
          <p className="mt-2 text-sm text-slate-600">Review resume structure and content generally, or compare it with a target role or job description.</p>
        </div>
      </div>

      {!atsAnalysis ? (
        <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="space-y-5">
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-900">Analysis mode</label>
              <div className="grid grid-cols-2 rounded-xl border border-slate-200 bg-slate-50 p-1">
                {(['general', 'job'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    aria-pressed={atsMode === mode}
                    onClick={() => { setAtsMode(mode); setAtsAnalysis(null); setAtsError('') }}
                    className={cn('rounded-lg px-3 py-2.5 text-sm font-semibold transition', atsMode === mode ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800')}
                  >
                    {mode === 'general' ? 'General Review' : 'Job-Specific Analysis'}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-slate-500">General review does not estimate compatibility with a particular job.</p>
            </div>

            {/* Resume source selection */}
            <div>
              <label className="mb-3 block text-sm font-semibold text-slate-900">Step 1: Select Resume</label>
              <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <label className="flex items-center gap-3">
                  <input
                    type="radio"
                    value="saved"
                    checked={atsSelectedResume === 'saved'}
                    onChange={() => { setAtsSelectedResume('saved'); setAtsResumeFile(null); setAtsAnalysis(null); setAtsExtractedText('') }}
                    className="rounded"
                  />
                  <span className="text-sm font-medium text-slate-700">Use Saved Resume</span>
                </label>
                <label className="flex items-center gap-3">
                  <input
                    type="radio"
                    value="new"
                    checked={atsSelectedResume === 'new'}
                    onChange={() => { setAtsSelectedResume('new'); setAtsResumeFile(null); setAtsAnalysis(null); setAtsExtractedText('') }}
                    className="rounded"
                  />
                  <span className="text-sm font-medium text-slate-700">Upload New Resume</span>
                </label>
              </div>
            </div>

            {/* File upload or saved resume display */}
            {atsSelectedResume === 'new' ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                <div className="mb-4">
                  <FileText size={40} className="mx-auto text-slate-400" />
                </div>
                <label className="block cursor-pointer">
                  <span className="text-sm font-medium text-blue-600 hover:text-blue-700">Click to upload</span>
                  <span className="ml-1 text-sm text-slate-500">or drag and drop</span>
                  <input
                    type="file"
                    accept=".pdf,.docx,.txt"
                    onChange={handleATSFileUpload}
                    className="hidden"
                  />
                </label>
                <p className="mt-3 text-xs text-slate-500">PDF, DOCX, or TXT files up to 10 MB</p>
                {atsResumeFile ? (
                  <div className="mt-4 rounded-lg bg-white p-3 text-sm text-slate-700">
                    <p className="font-medium">✓ {atsResumeFile.name}</p>
                    <p className="text-xs text-slate-500 mt-1">{(atsResumeFile.size / 1024).toFixed(2)} KB</p>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-medium text-slate-700">Your Saved Resume</p>
                {studentProfile?.resume?.url ? (
                  <>
                    <div className="rounded-lg bg-white p-3">
                      <p className="font-medium text-slate-900">{studentProfile.resume.filename}</p>
                      <p className="text-xs text-slate-500 mt-1">Status: {studentProfile.resume.status || 'Linked'}</p>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-amber-600 bg-amber-50 p-3 rounded-lg">No saved resume found. Please save a resume in the Resume section first.</p>
                )}
              </div>
            )}

            {atsMode === 'job' ? (
              <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label htmlFor="ats-company-search" className="mb-2 block text-sm font-semibold text-slate-900">Search companies</label>
                    <input
                      id="ats-company-search"
                      type="search"
                      value={atsCompanySearch}
                      onChange={(event) => setAtsCompanySearch(event.target.value)}
                      placeholder="Company name"
                      className="mb-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900"
                    />
                    <select
                      aria-label="Select company and job source"
                      value={atsSelectedCompanyKey}
                      onChange={(event) => {
                        setAtsSelectedCompanyKey(event.target.value)
                        setAtsSelectedJobKey('')
                        setAtsSelectedJob(null)
                        setAtsAnalysis(null)
                      }}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900"
                    >
                      <option value="">Select a company</option>
                      {filteredATSCompanies.map((company) => (
                        <option key={company.key} value={company.key}>{company.name} · {company.source}</option>
                      ))}
                    </select>
                    {atsCompaniesLoading ? <p role="status" className="mt-2 text-xs text-slate-500">Loading verified external company sources…</p> : null}
                    {atsCompanyError ? (
                      <div className="mt-2 flex items-center justify-between gap-2 text-xs text-amber-800">
                        <span>{atsCompanyError}</span>
                        <button type="button" onClick={() => setAtsCompanyCatalogRefreshKey((value) => value + 1)} className="shrink-0 font-semibold underline">Retry</button>
                      </div>
                    ) : null}
                  </div>

                  <div>
                    <label htmlFor="ats-company-job" className="mb-2 block text-sm font-semibold text-slate-900">Currently listed roles</label>
                    <select
                      id="ats-company-job"
                      value={atsSelectedJobKey}
                      disabled={!atsSelectedCompany || atsJobsLoading || atsCompanyJobs.length === 0}
                      onChange={(event) => {
                        setAtsSelectedJobKey(event.target.value)
                        setAtsAnalysis(null)
                      }}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 disabled:opacity-60"
                    >
                      <option value="">{atsJobsLoading ? 'Retrieving current roles…' : 'Select a current role'}</option>
                      {atsCompanyJobs.map((job) => (
                        <option key={`${job.source}:${job.companyId}:${job.jobId}`} value={`${job.source}:${job.companyId}:${job.jobId}`}>
                          {job.title} · {job.location || 'Location not provided'}
                        </option>
                      ))}
                    </select>
                    {atsSelectedCompany ? (
                      <div className="mt-2 flex items-center justify-between gap-2 text-xs text-slate-500">
                        <span>
                          {atsJobsLoading ? 'Checking source…' : atsCompanyJobs.length > 0
                            ? `Last checked ${new Date(atsCompanyJobs[0].checkedAt).toLocaleString()} · ${atsCompanyJobs[0].source}`
                            : 'No verified open listings returned.'}
                        </span>
                        <button type="button" disabled={atsJobsLoading} onClick={() => setAtsJobsRefreshKey((value) => value + 1)} className="shrink-0 font-semibold text-blue-700 disabled:opacity-50">Refresh</button>
                      </div>
                    ) : null}
                    {atsJobsError ? <p role="alert" className="mt-2 text-xs text-rose-700">{atsJobsError}</p> : null}
                  </div>
                </div>

                {!atsSelectedCompany && atsCompanies.length === 0 && !atsCompaniesLoading && !jobs.some((job) => job.published && isCampusHireJobOpen(job)) ? (
                  <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">No job sources are currently available. Retry the external catalogue or check back later.</p>
                ) : null}

                {atsSelectedCompany && !atsJobsLoading && !atsJobsError && atsCompanyJobs.length === 0 ? (
                  <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">No verified open roles were returned for {atsSelectedCompany.name}. Refresh or choose another company/source.</p>
                ) : null}

                {atsJobDetailsLoading ? <p role="status" className="rounded-lg bg-blue-50 p-3 text-sm text-blue-800">Rechecking vacancy and loading the full job description…</p> : null}
                {atsJobDetailsError ? <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{atsJobDetailsError}</p> : null}

                {atsSelectedJob ? (
                  <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h4 className="font-semibold text-slate-900">{atsSelectedJob.title}</h4>
                        <p className="mt-1 text-sm text-slate-600">{atsSelectedJob.companyName} · {atsSelectedJob.location || 'Location not provided'}</p>
                      </div>
                      <span className={cn('rounded-full px-2.5 py-1 text-xs font-semibold', atsSelectedJob.source === 'Greenhouse' ? 'bg-emerald-100 text-emerald-800' : 'bg-sky-100 text-sky-800')}>
                        {atsSelectedJob.source === 'Greenhouse' ? 'External · Greenhouse' : 'CampusHire internal posting'}
                      </span>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div><p className="text-xs font-semibold uppercase text-slate-500">Required experience</p><p className="mt-1 text-sm text-slate-700">{atsSelectedJob.requiredExperience.join('; ') || 'Not specified by source'}</p></div>
                      <div><p className="text-xs font-semibold uppercase text-slate-500">Preferred experience</p><p className="mt-1 text-sm text-slate-700">{atsSelectedJob.preferredExperience.join('; ') || 'Not specified by source'}</p></div>
                      <div><p className="text-xs font-semibold uppercase text-slate-500">Closing date</p><p className="mt-1 text-sm text-slate-700">{atsSelectedJob.closingDate ? new Date(atsSelectedJob.closingDate).toLocaleDateString() : 'Not provided by source'}</p></div>
                      <div><p className="text-xs font-semibold uppercase text-slate-500">Required skills</p><p className="mt-1 text-sm text-slate-700">{atsSelectedJob.requiredSkills.join(', ') || 'Not explicitly identified'}</p></div>
                      <div><p className="text-xs font-semibold uppercase text-slate-500">Preferred skills</p><p className="mt-1 text-sm text-slate-700">{atsSelectedJob.preferredSkills.join(', ') || 'Not explicitly identified'}</p></div>
                      <div><p className="text-xs font-semibold uppercase text-slate-500">Required qualifications</p><p className="mt-1 text-sm text-slate-700">{atsSelectedJob.requiredQualifications.join('; ') || 'Not explicitly identified'}</p></div>
                      <div><p className="text-xs font-semibold uppercase text-slate-500">Preferred qualifications</p><p className="mt-1 text-sm text-slate-700">{atsSelectedJob.preferredQualifications.join('; ') || 'Not explicitly identified'}</p></div>
                    </div>
                    {atsSelectedJob.responsibilities.length > 0 ? (
                      <div><p className="text-xs font-semibold uppercase text-slate-500">Responsibilities</p><ul className="mt-1 list-inside list-disc space-y-1 text-sm text-slate-700">{atsSelectedJob.responsibilities.map((item, index) => <li key={index}>{item}</li>)}</ul></div>
                    ) : null}
                    {atsSelectedJob.missingDescriptionInformation.length > 0 ? (
                      <p className="text-xs text-amber-700">Source description gaps: {atsSelectedJob.missingDescriptionInformation.join(' ')}</p>
                    ) : null}
                    <details className="rounded-lg bg-slate-50 p-3">
                      <summary className="cursor-pointer text-sm font-semibold text-slate-800">Complete job description</summary>
                      <div className="mt-3 max-h-80 overflow-y-auto whitespace-pre-wrap text-sm leading-6 text-slate-700">{atsSelectedJob.descriptionText || 'The source did not provide a job description.'}</div>
                    </details>
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                      <span>Last checked {new Date(atsSelectedJob.checkedAt).toLocaleString()}</span>
                      {atsSelectedJob.sourceUrl ? <a href={atsSelectedJob.sourceUrl} target="_blank" rel="noreferrer" className="font-semibold text-blue-700 underline">Open source listing</a> : <span>Source: CampusHire postings</span>}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            {atsExtracting ? <p role="status" className="rounded-xl bg-blue-50 p-3 text-sm text-blue-800">Extracting resume text…</p> : null}
            {atsExtractedText ? (
              <details open className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <summary className="cursor-pointer text-sm font-semibold text-slate-800">Extracted text preview ({atsExtractedText.length.toLocaleString()} characters)</summary>
                <textarea readOnly value={atsExtractedText} aria-label="Extracted resume text preview" className="mt-3 max-h-72 min-h-40 w-full resize-y rounded-lg border border-slate-200 bg-white p-3 font-mono text-xs leading-5 text-slate-700" />
              </details>
            ) : null}

            {/* Error message */}
            {atsError ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{atsError}</div>
            ) : null}

            {/* Analyze button */}
            <div>
              <button
                type="button"
                disabled={atsLoading || atsExtracting || !atsExtractedText.trim() || (atsMode === 'job' && (!atsSelectedJob || atsJobDetailsLoading))}
                onClick={() => void handleATSAnalysis()}
                className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {atsLoading ? atsMode === 'job' ? 'Rechecking vacancy and analyzing…' : 'Reviewing resume…' : atsMode === 'job' ? 'Analyze Against Selected Job' : 'Review Resume'}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          {/* ATS Score Card */}
          <div className="rounded-[28px] border border-blue-200 bg-gradient-to-br from-blue-50 via-white to-indigo-50 p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">
              {atsAnalysis.mode === 'general' ? 'GENERAL RESUME QUALITY' : 'ESTIMATED JOB MATCH SCORE'}
            </p>
            <div className="mt-4 flex items-baseline gap-3">
              <span className="text-6xl font-bold text-blue-900">{atsAnalysis.atsScore}</span>
              <span className="text-xl text-blue-700">/ 100</span>
            </div>
            <div className="mt-4 flex items-center gap-3">
              <div className="h-2 flex-1 rounded-full bg-slate-200">
                <div
                  className="h-2 rounded-full bg-blue-600"
                  style={{ width: `${atsAnalysis.atsScore}%` }}
                />
              </div>
            </div>
            <p className="mt-3 text-sm font-medium text-blue-700">
              {atsAnalysis.mode === 'general'
                ? atsAnalysis.atsScore >= 80 ? 'Strong resume fundamentals' : atsAnalysis.atsScore >= 60 ? 'Several strengths identified' : 'Review the recommendations below'
                : atsAnalysis.atsScore >= 80 ? 'High requirement coverage' : atsAnalysis.atsScore >= 60 ? 'Moderate requirement coverage' : 'Limited demonstrated coverage'}
            </p>
            <p className="mt-2 text-sm text-slate-700">{atsAnalysis.mode === 'general' ? 'Mode' : 'Target'}: <strong>{atsAnalysis.selectedRole}</strong></p>
            {atsAnalysis.candidateLevel ? <p className="mt-1 text-sm text-slate-600">Resume signals: {atsAnalysis.candidateLevel}</p> : null}
            <p className="mt-2 text-xs text-slate-500">
              {atsAnalysis.mode === 'general'
                ? 'This reviews resume content and readability; it does not measure fit for a particular job.'
                : "An estimate from the published job description, not the company's internal ATS score."}
            </p>
          </div>

          {atsAnalysis.mode === 'job' ? (
            <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h4 className="font-semibold text-slate-900">{atsAnalysis.selectedRole}</h4>
                  <p className="mt-1 text-sm text-slate-600">{atsAnalysis.companyName} · {atsAnalysis.jobLocation || 'Location not provided'}</p>
                </div>
                <span className={cn('rounded-full px-2.5 py-1 text-xs font-semibold', atsAnalysis.jobSource === 'Greenhouse' ? 'bg-emerald-100 text-emerald-800' : 'bg-sky-100 text-sky-800')}>
                  {atsAnalysis.jobSource === 'Greenhouse' ? 'External · Greenhouse' : 'CampusHire internal posting'}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                <span>Vacancy checked {atsAnalysis.jobCheckedAt ? new Date(atsAnalysis.jobCheckedAt).toLocaleString() : 'not recorded'}</span>
                <span>Closing date: {atsAnalysis.jobClosingDate ? new Date(atsAnalysis.jobClosingDate).toLocaleDateString() : 'Not provided by source'}</span>
                {atsAnalysis.jobSourceUrl ? <a href={atsAnalysis.jobSourceUrl} target="_blank" rel="noreferrer" className="font-semibold text-blue-700 underline">Open original job listing</a> : null}
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div><p className="text-xs font-semibold uppercase text-slate-500">Required skills</p><p className="mt-1 text-sm text-slate-700">{atsAnalysis.jobRequiredSkills?.join(', ') || 'Not explicitly identified'}</p></div>
                <div><p className="text-xs font-semibold uppercase text-slate-500">Preferred skills</p><p className="mt-1 text-sm text-slate-700">{atsAnalysis.jobPreferredSkills?.join(', ') || 'Not explicitly identified'}</p></div>
                <div><p className="text-xs font-semibold uppercase text-slate-500">Qualifications</p><p className="mt-1 text-sm text-slate-700">{atsAnalysis.jobQualifications?.join('; ') || 'Not explicitly identified'}</p></div>
                <div><p className="text-xs font-semibold uppercase text-slate-500">Experience expectation</p><p className="mt-1 text-sm text-slate-700">{atsAnalysis.jobExperienceLevel || 'Not specified by source'}</p></div>
              </div>
              {atsAnalysis.jobResponsibilities && atsAnalysis.jobResponsibilities.length > 0 ? (
                <div className="mt-4"><p className="text-xs font-semibold uppercase text-slate-500">Responsibilities</p><ul className="mt-1 list-inside list-disc space-y-1 text-sm text-slate-700">{atsAnalysis.jobResponsibilities.map((item, index) => <li key={index}>{item}</li>)}</ul></div>
              ) : null}
              {atsAnalysis.jobMissingInformation && atsAnalysis.jobMissingInformation.length > 0 ? <p className="mt-3 text-xs text-amber-700">Description gaps: {atsAnalysis.jobMissingInformation.join(' ')}</p> : null}
              {atsAnalysis.jobDescription ? <details className="mt-4 rounded-lg bg-slate-50 p-3"><summary className="cursor-pointer text-sm font-semibold text-slate-800">Complete source description</summary><div className="mt-3 max-h-96 overflow-y-auto whitespace-pre-wrap text-sm leading-6 text-slate-700">{atsAnalysis.jobDescription}</div></details> : null}
            </div>
          ) : null}

          {atsAnalysis.mode === 'job' && atsAnalysis.eligibilityComparison ? (
            <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <h4 className="font-semibold text-slate-900">CampusHire Opportunity Eligibility</h4>
              <p className={cn('mt-2 text-sm font-semibold', atsAnalysis.eligibilityComparison.eligible ? 'text-emerald-700' : 'text-amber-800')}>
                {atsAnalysis.eligibilityComparison.eligible ? 'Eligible under the published criteria' : 'One or more published criteria are not met'}
              </p>
              <ul className="mt-2 space-y-1 text-sm text-slate-600">{atsAnalysis.eligibilityComparison.reasons.map((reason, index) => <li key={index}>{reason}</li>)}</ul>
            </div>
          ) : null}

          {atsAnalysis.mode === 'job' && atsAnalysis.generalScore !== undefined ? (
            <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h4 className="font-semibold text-slate-900">General Resume Quality</h4>
                <span className="text-lg font-bold text-slate-900">{atsAnalysis.generalScore} / 100</span>
              </div>
              <p className="mt-1 text-xs text-slate-500">This score is independent of the selected job match.</p>
              <div className="mt-4 space-y-3">
                {Object.entries(atsAnalysis.generalScoreBreakdown ?? {}).map(([category, score]) => {
                  const maximum = atsAnalysis.generalScoreWeights?.[category] ?? 0
                  return <div key={category} className="flex items-start justify-between gap-4 text-sm"><div><span className="font-medium capitalize text-slate-700">{category}</span>{atsAnalysis.generalScoreDescriptions?.[category] ? <p className="mt-0.5 text-xs text-slate-500">{atsAnalysis.generalScoreDescriptions[category]}</p> : null}</div><span className="shrink-0 text-slate-800">{score}{maximum ? ` / ${maximum}` : ''}</span></div>
                })}
              </div>
            </div>
          ) : null}

            {atsError ? <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">{atsError}</div> : null}

          {atsAnalysis.mode === 'job' ? (
            <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <h4 className="font-semibold text-slate-900">Job Requirement Comparison</h4>
              {atsAnalysis.requirements && atsAnalysis.requirements.length > 0 ? (
                <div className="mt-4 space-y-3">
                  {atsAnalysis.requirements.map((requirement) => (
                    <div key={`${requirement.category}-${requirement.name}`} className="rounded-xl border border-slate-200 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-medium text-slate-900">{requirement.name}</span>
                        <span className={cn('rounded-full px-2.5 py-1 text-xs font-semibold capitalize', requirement.status === 'matched' ? 'bg-emerald-100 text-emerald-700' : requirement.status === 'partial' ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700')}>
                          {requirement.status} · {requirement.priority ?? 'unspecified'} · {requirement.category}
                        </span>
                      </div>
                      {requirement.evidence.length > 0 ? (
                        <ul className="mt-2 space-y-1 text-sm text-slate-600">
                          {requirement.evidence.map((evidence, index) => <li key={`${requirement.name}-${index}`}>“{evidence}”</li>)}
                        </ul>
                      ) : requirement.status === 'missing' ? <p className="mt-1 text-sm text-slate-500">No supporting evidence found in the resume.</p> : null}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-sm text-slate-600">No recognizable requirements were extracted from this job description. Add explicit skills, qualifications, or experience expectations for comparison.</p>
              )}
            </div>
          ) : null}

          {/* Keywords Found */}
          {atsAnalysis.keywordsFound.length > 0 ? (
            <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <h4 className="font-semibold text-slate-900">✓ Matched Requirements ({atsAnalysis.keywordsFound.length})</h4>
              <div className="mt-4 flex flex-wrap gap-2">
                {atsAnalysis.keywordsFound.map((keyword) => (
                  <span key={keyword} className="rounded-full bg-emerald-100 px-3 py-1.5 text-sm font-medium text-emerald-700">
                    ✓ {keyword}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          {atsAnalysis.detectedSkills && atsAnalysis.detectedSkills.length > 0 ? (
            <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <h4 className="font-semibold text-slate-900">Detected Skills in Resume</h4>
              <div className="mt-4 flex flex-wrap gap-2">
                {atsAnalysis.detectedSkills.map((skill) => (
                  <span key={skill} className="rounded-full bg-sky-100 px-3 py-1.5 text-sm font-medium text-sky-800">{skill}</span>
                ))}
              </div>
            </div>
          ) : null}

          {/* Missing Keywords */}
          {atsAnalysis.missingKeywords.length > 0 ? (
            <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <h4 className="font-semibold text-slate-900">⚠ Requirements Not Demonstrated ({atsAnalysis.missingKeywords.length})</h4>
              <div className="mt-4 flex flex-wrap gap-2">
                {atsAnalysis.missingKeywords.map((keyword) => (
                  <span key={keyword} className="rounded-full bg-amber-100 px-3 py-1.5 text-sm font-medium text-amber-700">
                    ✗ {keyword}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <h4 className="font-semibold text-slate-900">Contact Information</h4>
            <div className="mt-3 flex flex-wrap gap-2">
              {atsAnalysis.contactInfo ? Object.entries(atsAnalysis.contactInfo).map(([label, found]) => (
                <span key={label} className={cn('rounded-full px-3 py-1.5 text-sm font-medium', found ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700')}>
                  {label === 'linkedin' ? 'LinkedIn URL' : label}: {found ? 'Detected' : 'Not detected'}
                </span>
              )) : <p className="text-sm text-slate-500">Contact checks were not recorded for this earlier analysis.</p>}
            </div>
          </div>

          {/* Resume Sections */}
          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <h4 className="font-semibold text-slate-900">Resume Sections Analysis</h4>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {atsAnalysis.sectionsFound.map((section) => (
                <div key={section} className="flex items-center gap-3 rounded-lg bg-emerald-50 p-3">
                  <span className="text-emerald-600 font-bold">✓</span>
                  <span className="text-sm font-medium text-slate-900">{section}</span>
                </div>
              ))}
              {(atsAnalysis.missingSections ?? []).slice(0, 4).map((section) => (
                <div key={section} className="flex items-center gap-3 rounded-lg bg-amber-50 p-3">
                  <span className="text-amber-600 font-bold">⚠</span>
                  <span className="text-sm font-medium text-slate-900">{section}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Suggestions */}
          {atsAnalysis.suggestions.length > 0 ? (
            <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <h4 className="font-semibold text-slate-900">Personalized Suggestions</h4>
              <ol className="mt-4 list-inside list-decimal space-y-3">
                {atsAnalysis.suggestions.map((suggestion, index) => (
                  <li key={index} className="text-sm font-medium text-slate-700">
                    {suggestion}
                  </li>
                ))}
              </ol>
            </div>
          ) : null}

          {/* Score Breakdown */}
          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <h4 className="font-semibold text-slate-900">{atsAnalysis.mode === 'job' ? 'Job Match Score Breakdown' : 'General Review Score Breakdown'}</h4>
            <div className="mt-4 space-y-3">
              {Object.entries(atsAnalysis.scoreBreakdown).map(([category, score]) => {
                const legacyMaximum = ({ keywordMatch: 40, skillsMatch: 20, resumeSections: 20, contactInfo: 10, completeness: 10 } as Record<string, number>)[category]
                const maximum = atsAnalysis.scoreWeights?.[category] ?? legacyMaximum
                return (
                  <div key={category} className="flex flex-col gap-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-slate-700 capitalize">{category.replace(/([A-Z])/g, ' $1').trim()}</span>
                      <span className="font-medium text-slate-900">{Math.round(score)}{maximum === undefined ? ' pts' : ` / ${maximum} pts`}</span>
                    </div>
                    {atsAnalysis.scoreDescriptions?.[category] ? <p className="text-xs text-slate-500">{atsAnalysis.scoreDescriptions[category]}</p> : null}
                    <div className="h-2 rounded-full bg-slate-200">
                      <div
                        className="h-2 rounded-full bg-gradient-to-r from-blue-500 to-blue-600"
                        style={{ width: `${Math.min(100, (score / (maximum || 1)) * 100)}%` }}
                      />
                    </div>
                  </div>
                )
              })}
              <div className="mt-4 flex items-center justify-between rounded-lg bg-blue-50 p-3">
                <span className="font-semibold text-slate-900">Total Score</span>
                <span className="text-lg font-bold text-blue-600">{atsAnalysis.atsScore} / 100</span>
              </div>
            </div>
          </div>

          {/* Analysis History */}
          {atsAnalysisHistory.length > 1 ? (
            <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <h4 className="font-semibold text-slate-900">Previous Analyses</h4>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {atsAnalysisHistory.slice(1, 7).map((analysis) => (
                  <button
                    key={analysis.id}
                    type="button"
                    onClick={() => setAtsAnalysis(analysis)}
                    className="text-left rounded-lg border border-slate-300 bg-slate-50 p-3 transition hover:bg-slate-100"
                  >
                    <div className="font-medium text-slate-900">{analysis.selectedRole}</div>
                    <div className="flex items-center justify-between gap-2 mt-1">
                      <span className="text-sm font-semibold text-blue-600">{analysis.atsScore}/100</span>
                      <span className="text-xs text-slate-500">{new Date(analysis.createdAt).toLocaleDateString()}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => {
                setAtsAnalysis(null)
                setAtsResumeFile(null)
                setAtsError('')
              }}
              className="flex-1 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Analyze Another Resume
            </button>
            <button
              type="button"
              onClick={() => onSectionChange('resume')}
              className="flex-1 rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              Back to Resume
            </button>
          </div>
        </div>
      )}
    </section>
  )

  const jobsSection = (
    <section className="space-y-5">
      <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Job search</p>
            <h3 className="mt-1 text-2xl font-semibold text-slate-900">Job Opportunities</h3>
          </div>
          <div className="flex gap-2">
            <input
              value={jobSearch}
              onChange={(event) => setJobSearch(event.target.value)}
              placeholder="Search jobs"
              className="w-64 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white"
            />
            <select value={jobFilter} onChange={(event) => setJobFilter(event.target.value as 'all' | 'eligible')} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white">
              <option value="all">All</option>
              <option value="eligible">Eligible</option>
            </select>
          </div>
        </div>
      </div>

      <div className="grid gap-4">
        {filteredJobs.length === 0 ? (
          <div className="rounded-[28px] border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">No matching jobs found.</div>
        ) : (
          filteredJobs.map((job) => {
            const eligibility = studentProfile ? checkEligibility(studentProfile, job) : { eligible: false, reasons: ['Checking eligibility...'], failedRequirements: ['Loading'] }
            const eligible = eligibility.eligible
            const organizationName = getOpportunityCompanyName(job)
            const alreadyApplied = submittedOpportunityIds.includes(job.id) || (!!studentProfile && applications.some((application) => application.studentId === studentProfile.uid && (application.jobId === job.id || application.opportunityId === job.id)))

            return (
              <div
                key={job.id}
                role="button"
                tabIndex={0}
                onClick={() => navigate(`/jobs/${job.id}`)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    navigate(`/jobs/${job.id}`)
                  }
                }}
                className="cursor-pointer rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm transition hover:border-blue-200 hover:shadow-md sm:p-6"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-400 text-sm font-semibold text-white">
                      {organizationName.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h4 className="text-xl font-semibold text-slate-900">{job.title}</h4>
                      <p className="text-sm text-slate-500">{organizationName} · {job.location}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-600">{job.type}</span>
                    <span className={cn('rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em]', studentProfile ? (eligible ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700') : 'bg-slate-100 text-slate-600')}>
                      {studentProfile ? (eligible ? 'Eligible' : 'Not eligible') : 'Loading...'}
                    </span>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-600">
                  <span className="rounded-full bg-slate-100 px-2 py-1">{job.salary}</span>
                  <span className="rounded-full bg-slate-100 px-2 py-1">Min CGPA {job.minimumCgpa}</span>
                  <span className="rounded-full bg-slate-100 px-2 py-1">{job.eligibleBranches.join(', ')}</span>
                  <span className="rounded-full bg-slate-100 px-2 py-1">{job.eligibleYears.join(', ')}</span>
                </div>

                <p className="mt-4 text-sm leading-6 text-slate-600">{job.description}</p>

                <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                    <span>Openings: {job.status === 'Open' ? '12' : '0'}</span>
                    <span>Deadline: {new Date(job.postedAt).toLocaleDateString()}</span>
                  </div>
                  <div className="flex gap-2" onClick={(event) => event.stopPropagation()}>
                    <button type="button" onClick={() => void runAiAnalysis(job)} className="rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-sm font-medium text-violet-700">AI Match</button>
                    <button
                      type="button"
                      disabled={!studentProfile || !eligible || !isOpportunityOpen(job) || alreadyApplied}
                      onClick={() => openApplyModal(job)}
                      className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-300"
                    >
                      {!studentProfile ? 'Checking...' : alreadyApplied ? 'Already Applied' : !isOpportunityOpen(job) ? 'Closed' : eligible ? 'Apply now' : 'Not eligible'}
                    </button>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </section>
  )

  const applicationsSection = (
    <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Applications</p>
          <h3 className="mt-1 text-2xl font-semibold text-slate-900">My Applications</h3>
        </div>
      </div>

      <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
        <table className="min-w-full bg-white text-left text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-3 font-medium">Company</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Applied</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">AI Match</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {applications.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-slate-500">No applications yet.</td>
              </tr>
            ) : (
              applications.map((application) => (
                <tr key={application.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-800">{application.organization || application.organizationName || application.companyId || 'Campus Placement Office'}</td>
                  <td className="px-4 py-3 text-slate-800">{application.jobTitle}</td>
                  <td className="px-4 py-3 text-slate-600">{new Date(application.appliedAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3"><span className={cn('inline-flex rounded-full px-2.5 py-1 text-xs font-medium', statusClass(application.status))}>{application.status}</span></td>
                  <td className="px-4 py-3 text-slate-700">{aiResult?.matchScore ?? 86}%</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  )

  const fallbackJob: JobPosting = {
    id: 'fallback-job',
    companyId: '',
    companyName: 'CampusHire',
    title: 'Software Engineer',
    description: 'Build and ship modern software products with a focus on frontend, API integration, and cloud-based problem solving.',
    location: 'Remote',
    type: 'Full Time',
    salary: '₹18 LPA',
    minimumCgpa: 7.5,
    eligibleBranches: ['CSE', 'IT'],
    eligibleYears: [2026, 2027],
    postedAt: new Date().toISOString(),
    status: 'Open',
  }

  const aiSection = (
    <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">AI Career Match</p>
          <h3 className="mt-1 text-2xl font-semibold text-slate-900">Career fit analyzer</h3>
        </div>
      </div>

      {aiResult ? (
        <div className="mt-5 space-y-5">
          <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4">
            <div className="text-sm font-medium text-violet-700">MATCH SCORE</div>
            <div className="mt-2 text-4xl font-semibold text-slate-900">{aiResult.matchScore}% Match</div>
            <div className="mt-2 text-sm text-slate-700">{aiResult.summary}</div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <h4 className="font-semibold text-slate-900">Matched Skills</h4>
              <ul className="mt-3 space-y-2 text-sm text-slate-700">
                {(calculateLocalCareerMatch(studentProfile, fallbackJob).matchedSkills ?? []).slice(0, 3).map((skill) => (
                  <li key={skill}>✓ {skill}</li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <h4 className="font-semibold text-slate-900">Missing Skills</h4>
              <ul className="mt-3 space-y-2 text-sm text-slate-700">
                {(calculateLocalCareerMatch(studentProfile, fallbackJob).missingSkills ?? []).slice(0, 3).map((skill) => (
                  <li key={skill}>• {skill}</li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <h4 className="font-semibold text-slate-900">Strengths</h4>
              <ul className="mt-3 space-y-2 text-sm text-slate-700">
                {(calculateLocalCareerMatch(studentProfile, fallbackJob).strengths ?? []).slice(0, 3).map((strength) => (
                  <li key={strength}>- {strength}</li>
                ))}
              </ul>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <h4 className="font-semibold text-slate-900">Improvement tips</h4>
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-slate-700">
              {aiResult.tips.map((tip, index) => (
                <li key={`${tip}-${index}`}>{tip}</li>
              ))}
            </ol>
          </div>
        </div>
      ) : (
        <div className="mt-5 text-sm text-slate-500">Run a job match analysis to evaluate your profile.</div>
      )}
    </section>
  )

  const notificationsSection = (
    <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Notifications</p>
          <h3 className="mt-1 text-2xl font-semibold text-slate-900">Inbox</h3>
        </div>
        <button type="button" onClick={() => void markAllRead()} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700">Mark all as read</button>
      </div>

      <div className="mt-5 space-y-3">
        {notifications.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">No notifications yet.</div>
        ) : (
          notifications.map((notification) => (
            <div key={notification.id} className={cn('flex items-center justify-between gap-3 rounded-2xl border p-4', notification.isRead ? 'border-slate-200 bg-slate-50' : 'border-blue-200 bg-blue-50')}>
              <div>
                <p className="font-medium text-slate-800">{notification.message}</p>
                <p className="mt-1 text-xs text-slate-500">{new Date(notification.createdAt as string).toLocaleString()}</p>
              </div>
              {!notification.isRead ? (
                <button type="button" onClick={() => void markNotificationRead(notification.id)} className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white">Mark read</button>
              ) : null}
            </div>
          ))
        )}
      </div>
    </section>
  )

  const settingsSection = (
    <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Settings</p>
        <h3 className="mt-1 text-2xl font-semibold text-slate-900">Student account settings</h3>
      </div>
      <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
        Student role is protected and cannot be changed. Profile updates are limited to the current authenticated account.
      </div>
    </section>
  )

  const sectionContent = {
    overview: studentOverview,
    personal: personalSection,
    academic: academicSection,
    skills: skillsSection,
    projects: projectsSection,
    certifications: certificationsSection,
    resume: resumeSection,
    ats: atsSection,
    jobs: jobsSection,
    applications: applicationsSection,
    ai: aiSection,
    notifications: notificationsSection,
    settings: settingsSection,
  }[activeSection]

  return (
    <div className="space-y-6">
      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div> : null}
      {successMessage ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{successMessage}</div> : null}
      {aiLoading ? <div className="rounded-2xl border border-violet-200 bg-violet-50 p-3 text-sm text-violet-700">AI matching in progress...</div> : null}
      <div className="flex flex-wrap gap-2">
        {navItems.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => onSectionChange(key)}
            className={cn(
              'rounded-full px-3 py-2 text-sm font-medium transition',
              activeSection === key ? 'bg-slate-900 text-white' : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {sectionContent}

      {applyingJob ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div className="w-full max-w-2xl rounded-[28px] border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Apply now</p>
                <h3 className="mt-1 text-2xl font-semibold text-slate-900">{applyingJob.title}</h3>
              </div>
              <button type="button" onClick={() => setApplyingJob(null)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700">Close</button>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Student details</p>
                <div className="mt-3 space-y-2 text-sm text-slate-700">
                  <p><span className="font-medium">Roll Number:</span> {studentProfile.rollNumber ?? 'N/A'}</p>
                  <p><span className="font-medium">Full Name:</span> {studentProfile.fullName}</p>
                  <p><span className="font-medium">Branch:</span> {studentProfile.branch}</p>
                  <p><span className="font-medium">Email ID:</span> {studentProfile.email}</p>
                  <p><span className="font-medium">CGPA:</span> {getStudentCgpa(studentProfile) ?? 'N/A'}</p>
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Opportunity</p>
                <div className="mt-3 space-y-2 text-sm text-slate-700">
                  <p><span className="font-medium">Title:</span> {applyingJob.title}</p>
                  <p><span className="font-medium">Organization:</span> {applyingJob.companyName}</p>
                  <p><span className="font-medium">Type:</span> {applyingJob.type}</p>
                  <p><span className="font-medium">Location:</span> {applyingJob.location}</p>
                  <p><span className="font-medium">Package:</span> {applyingJob.salary}</p>
                  <p><span className="font-medium">Eligibility:</span> {applyingJob.minimumCgpa}+ CGPA, {applyingJob.eligibleBranches.join(', ') || 'All branches'}</p>
                  <p><span className="font-medium">Last date:</span> {applyingJob.applicationDeadline ? new Date(applyingJob.applicationDeadline).toLocaleString() : 'N/A'}</p>
                </div>
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <label className="mb-2 block text-sm font-medium text-slate-700">Resume to attach</label>
              <input
                value={appForm.resumeUrl}
                onChange={(event) => setAppForm((current) => ({ ...current, resumeUrl: event.target.value }))}
                placeholder="Resume URL or file link"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-slate-900 outline-none transition focus:border-blue-500"
              />
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button type="button" onClick={() => setApplyingJob(null)} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700">Cancel</button>
              <button type="button" disabled={submittingApplication} onClick={() => void submitApplication()} className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60">{submittingApplication ? 'Submitting...' : 'Submit Application'}</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function AdminDashboard({
  jobs,
  setJobs,
  applications,
  notifications,
  activeSection,
}: {
  jobs: JobPosting[]
  setJobs: React.Dispatch<React.SetStateAction<JobPosting[]>>
  applications: ApplicationRecord[]
  notifications: NotificationItem[]
  activeSection: StudentSection
}) {
  const [jobForm, setJobForm] = useState({
    title: 'Software Engineer',
    organizationName: 'TCS',
    description: 'Build modern product experiences and support engineering operations.',
    location: 'Bengaluru',
    type: 'Placement',
    salary: '₹18 LPA',
    minimumCgpa: 8.5,
    eligibleBranches: 'CSE, IT',
    eligibleYears: '2026, 2027',
    recruitmentRounds: ['Online Assessment', 'Technical Interview', 'HR Interview'],
    applicationStartDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 3).toISOString().slice(0, 10),
    applicationDeadline: new Date(Date.now() + 1000 * 60 * 60 * 24 * 14).toISOString().slice(0, 10),
    driveDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 21).toISOString().slice(0, 10),
    requiredSkills: 'React, TypeScript, Firebase',
    maxActiveBacklogs: 0,
  })
  const [jobFormErrors, setJobFormErrors] = useState<Record<string, string>>({})
  const [statusMessage, setStatusMessage] = useState('')
  const [opportunityError, setOpportunityError] = useState('')
  const [pendingOpportunityId, setPendingOpportunityId] = useState<string | null>(null)
  const opportunityActionLock = useRef(false)
  const [bulkStatus, setBulkStatus] = useState<ApplicationStatus>('Shortlisted')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [statusFilter, setStatusFilter] = useState<'All' | ApplicationStatus>('All')
  const [roundFilter, setRoundFilter] = useState('All Rounds')
  const [roundFocus, setRoundFocus] = useState<string | null>(null)
  const [roundSelectionIds, setRoundSelectionIds] = useState<string[]>([])
  const [error, setError] = useState('')
  const navigate = useNavigate()
  const { jobId: selectedJobId } = useParams()

  const selectedJob = useMemo(
    () => jobs.find((job) => job.id === selectedJobId) ?? null,
    [jobs, selectedJobId],
  )

  const statusData = useMemo(() => {
    const counts = {
      Applied: applications.filter((application) => application.status === 'Applied').length,
      Shortlisted: applications.filter((application) => application.status === 'Shortlisted').length,
      Rejected: applications.filter((application) => application.status === 'Rejected').length,
    }

    return [
      { name: 'Applied', value: counts.Applied },
      { name: 'Shortlisted', value: counts.Shortlisted },
      { name: 'Rejected', value: counts.Rejected },
    ]
  }, [applications])

  const opportunitySummary = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const job of jobs) {
      counts[job.type] = (counts[job.type] ?? 0) + 1
    }

    return Object.entries(counts).map(([name, value], index) => ({ name, value, color: CHART_COLORS[index % CHART_COLORS.length] }))
  }, [jobs])

  const addRecruitmentRound = () => {
    setJobForm((current) => ({
      ...current,
      recruitmentRounds: [...current.recruitmentRounds, `Round ${current.recruitmentRounds.length + 1}`],
    }))
  }

  const updateRecruitmentRound = (index: number, value: string) => {
    setJobForm((current) => ({
      ...current,
      recruitmentRounds: current.recruitmentRounds.map((entry, currentIndex) => (currentIndex === index ? value : entry)),
    }))
  }

  const removeRecruitmentRound = (index: number) => {
    setJobForm((current) => ({
      ...current,
      recruitmentRounds: current.recruitmentRounds.filter((_, currentIndex) => currentIndex !== index),
    }))
  }

  const validateOpportunityForm = () => {
    const errors: Record<string, string> = {}

    if (!jobForm.title.trim()) {
      errors.title = 'Job / Internship Title is required.'
    }

    if (!jobForm.organizationName.trim()) {
      errors.organizationName = 'Company / Organization Name is required.'
    }

    if (!jobForm.description.trim()) {
      errors.description = 'Job Description is required.'
    }

    if (!jobForm.location.trim()) {
      errors.location = 'Location is required.'
    }

    if (!jobForm.type.trim()) {
      errors.type = 'Opportunity Type is required.'
    }

    if (!jobForm.salary.trim()) {
      errors.salary = 'Package / Stipend is required.'
    }

    const minCgpaValue = Number(jobForm.minimumCgpa)
    if (!Number.isFinite(minCgpaValue)) {
      errors.minimumCgpa = 'Minimum CGPA must be a valid number.'
    }

    if (!jobForm.eligibleBranches.trim()) {
      errors.eligibleBranches = 'Eligible branches are required.'
    }

    if (!jobForm.eligibleYears.trim()) {
      errors.eligibleYears = 'Eligible graduation year is required.'
    }

    if (jobForm.recruitmentRounds.length === 0 || jobForm.recruitmentRounds.every((round) => !round.trim())) {
      errors.recruitmentRounds = 'Add at least one recruitment round.'
    }

    if (!jobForm.applicationStartDate) {
      errors.applicationStartDate = 'Application start date is required.'
    }

    if (!jobForm.applicationDeadline) {
      errors.applicationDeadline = 'Last date to apply is required.'
    }

    if (jobForm.applicationStartDate && jobForm.applicationDeadline) {
      const startDate = new Date(`${jobForm.applicationStartDate}T00:00:00`)
      const endDate = new Date(`${jobForm.applicationDeadline}T00:00:00`)
      if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || endDate <= startDate) {
        errors.applicationDeadline = 'Last date must be after the application start date.'
      }
    }

    if (!jobForm.requiredSkills.trim()) {
      errors.requiredSkills = 'Required skills are required.'
    }

    const backlogValue = Number(jobForm.maxActiveBacklogs)
    if (!Number.isFinite(backlogValue)) {
      errors.maxActiveBacklogs = 'Maximum allowed backlogs must be a valid number.'
    }

    setJobFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleCreateOpportunity = async (event: React.FormEvent) => {
    event.preventDefault()

    if (!validateOpportunityForm()) {
      setStatusMessage('')
      setOpportunityError('Please correct the highlighted fields and try again.')
      return
    }

    setOpportunityError('')
    setStatusMessage('')

    const jobId = `job-${Date.now()}`
    const organizationName = jobForm.organizationName.trim()
    const startDate = jobForm.applicationStartDate ? new Date(`${jobForm.applicationStartDate}T00:00:00`).toISOString() : new Date().toISOString()
    const deadlineDate = jobForm.applicationDeadline ? new Date(`${jobForm.applicationDeadline}T00:00:00`).toISOString() : new Date().toISOString()
    const recruitmentRounds = jobForm.recruitmentRounds
      .map((roundName) => roundName.trim())
      .filter(Boolean)
      .map((roundName, index) => ({
        id: `${organizationName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${roundName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${index + 1}`,
        name: roundName,
        order: index + 1,
      }))

    const docData: JobPosting = {
      id: jobId,
      companyId: 'tpo-admin',
      companyName: organizationName,
      organizationName,
      title: jobForm.title.trim(),
      description: jobForm.description.trim(),
      location: jobForm.location.trim(),
      type: jobForm.type,
      salary: jobForm.salary.trim(),
      packageOrStipend: jobForm.salary.trim(),
      minimumCgpa: Number(jobForm.minimumCgpa),
      minCGPA: Number(jobForm.minimumCgpa),
      eligibleBranches: jobForm.eligibleBranches.split(',').map((value) => value.trim()).filter(Boolean),
      eligibleYears: jobForm.eligibleYears.split(',').map((value) => Number(value.trim())).filter((value) => !Number.isNaN(value)),
      graduationYears: jobForm.eligibleYears.split(',').map((value) => Number(value.trim())).filter((value) => !Number.isNaN(value)),
      recruitmentRounds,
      postedAt: new Date().toISOString(),
      applicationStartDate: startDate,
      applicationDeadline: deadlineDate,
      driveDate: jobForm.driveDate ? new Date(`${jobForm.driveDate}T00:00:00`).toISOString() : undefined,
      requiredSkills: jobForm.requiredSkills.split(',').map((value) => value.trim()).filter(Boolean),
      maxActiveBacklogs: Number(jobForm.maxActiveBacklogs),
      maxBacklogs: Number(jobForm.maxActiveBacklogs),
      published: true,
      status: 'Open',
      createdAt: new Date().toISOString(),
      createdBy: 'tpo-admin',
    }

    try {
      await setDoc(doc(db, 'jobs', jobId), docData)
      setJobs((current) => [normalizeOpportunity(docData), ...current.filter((job) => job.id !== jobId)])
      setStatusMessage('Opportunity published successfully.')
      setJobFormErrors({})
    } catch (createError) {
      setOpportunityError(createError instanceof Error ? createError.message : String(createError) || 'Unable to create opportunity.')
    }
  }

  const handleToggleOpportunity = async (job: JobPosting) => {
    if (opportunityActionLock.current) return
    if (!job.id) {
      setOpportunityError('Unable to update opportunity: its Firestore document ID is missing.')
      return
    }

    opportunityActionLock.current = true
    setPendingOpportunityId(job.id)
    setOpportunityError('')
    setStatusMessage('')
    const nextPublished = !(job.published ?? true)
    const nextStatus = getCampusHirePublicationStatus(job, nextPublished)

    try {
      await updateDoc(doc(db, 'jobs', job.id), {
        published: nextPublished,
        status: nextStatus,
        updatedAt: new Date().toISOString(),
      })
      setJobs((current) => current.map((currentJob) => (
        currentJob.id === job.id
          ? { ...currentJob, published: nextPublished, status: nextStatus }
          : currentJob
      )))
      setStatusMessage(nextPublished ? 'Opportunity published.' : 'Opportunity unpublished.')
    } catch (toggleError) {
      setOpportunityError(toggleError instanceof Error ? toggleError.message : String(toggleError) || 'Unable to update opportunity.')
    } finally {
      opportunityActionLock.current = false
      setPendingOpportunityId(null)
    }
  }

  const handleDeleteOpportunity = async (job: JobPosting) => {
    if (opportunityActionLock.current) return
    if (!job.id) {
      setOpportunityError('Unable to delete opportunity: its Firestore document ID is missing.')
      return
    }
    if (!window.confirm('Are you sure you want to delete this opportunity?')) return

    opportunityActionLock.current = true
    setPendingOpportunityId(job.id)
    setOpportunityError('')
    setStatusMessage('')

    try {
      const applications = collection(db, 'applications')
      const [byOpportunityId, byJobId] = await Promise.all([
        getDocs(query(applications, where('opportunityId', '==', job.id), limit(1))),
        getDocs(query(applications, where('jobId', '==', job.id), limit(1))),
      ])
      if (!byOpportunityId.empty || !byJobId.empty) {
        throw new Error('This opportunity has existing applications. Deletion is blocked to preserve applicant history.')
      }

      await deleteDoc(doc(db, 'jobs', job.id))
      setJobs((current) => current.filter((currentJob) => currentJob.id !== job.id))
      setStatusMessage('Opportunity deleted.')
    } catch (deleteError) {
      setOpportunityError(deleteError instanceof Error ? deleteError.message : String(deleteError) || 'Unable to delete opportunity.')
    } finally {
      opportunityActionLock.current = false
      setPendingOpportunityId(null)
    }
  }

  const companyCards = useMemo(() => {
    return jobs.map((job) => {
      const relevantApplications = applications.filter((application) => {
        return application.jobId === job.id || application.opportunityId === job.id || application.companyId === job.companyId
      })

      const counts = {
        Applied: 0,
        Shortlisted: 0,
        Rejected: 0,
        Selected: 0,
      }

      relevantApplications.forEach((application) => {
        if (application.status in counts) {
          counts[application.status as keyof typeof counts] += 1
        }
      })

      return {
        ...job,
        totalApplicants: relevantApplications.length,
        counts,
      }
    })
  }, [applications, jobs])

  const selectedApplicants = useMemo(() => {
    if (!selectedJob) {
      return []
    }

    return applications.filter((application) => {
      const matchesJob = application.jobId === selectedJob.id || application.opportunityId === selectedJob.id
      const matchesCompany = application.companyId === selectedJob.companyId || application.organizationName === selectedJob.companyName
      return matchesJob || matchesCompany
    })
  }, [applications, selectedJob])

  const resolvedApplicants = useMemo(() => {
    return selectedApplicants.map((application, index) => ({
      ...application,
      rowNumber: index + 1,
      companyName: application.organization || application.organizationName || application.companyId || selectedJob?.companyName || 'Campus Placement Office',
    }))
  }, [selectedApplicants, selectedJob])

  const filteredApplicants = useMemo(() => {
    let rows = resolvedApplicants

    if (statusFilter !== 'All') {
      rows = rows.filter((row) => row.status === statusFilter)
    }

    if (roundFilter !== 'All Rounds') {
      rows = rows.filter((row) => {
        const rounds = normalizeRecruitmentRounds(selectedJob?.recruitmentRounds)
        const selectedRound = rounds.find((round) => round.name === roundFilter)
        if (!selectedRound) {
          return false
        }

        const roundValue = row.roundResults?.[selectedRound.id] ?? row.roundResults?.[selectedRound.name]
        return Boolean(roundValue)
      })
    }

    return rows
  }, [resolvedApplicants, roundFilter, selectedJob, statusFilter])

  const roundOptions = useMemo(() => {
    if (!selectedJob) {
      return ['All Rounds']
    }

    const uniqueRounds = new Set<string>(['All Rounds'])
    normalizeRecruitmentRounds(selectedJob.recruitmentRounds).forEach((round) => uniqueRounds.add(round.name))
    return Array.from(uniqueRounds)
  }, [selectedJob])

  const focusedRoundApplicants = useMemo(() => {
    if (!selectedJob || !roundFocus) {
      return []
    }

    const roundMeta = normalizeRecruitmentRounds(selectedJob.recruitmentRounds).find((round) => round.name === roundFocus)
    if (!roundMeta) {
      return []
    }

    return resolvedApplicants.filter((application) => {
      const roundValue = application.roundResults?.[roundMeta.id] ?? application.roundResults?.[roundMeta.name]
      return roundValue !== undefined
    })
  }, [resolvedApplicants, roundFocus, selectedJob])

  const handleBulkStatusUpdate = async () => {
    const activeSelection = filteredApplicants.filter((row) => selectedIds.includes(row.id))
    if (activeSelection.length === 0) {
      setError('Select at least one visible application to update.')
      return
    }

    try {
      for (const application of activeSelection) {
        await updateDoc(doc(db, 'applications', application.id), { status: bulkStatus, lastUpdated: new Date().toISOString() })
        await createNotification(application.studentId, `Your application for ${application.jobTitle} is ${bulkStatus} by the TPO.`, 'status')
      }
      setSelectedIds([])
      setError('')
    } catch (bulkError) {
      const message = bulkError instanceof Error ? bulkError.message : 'Bulk update failed.'
      setError(message)
    }
  }

  const handleRoundAction = async (outcome: 'Passed' | 'Failed') => {
    if (!selectedJob || !roundFocus) {
      return
    }

    const roundMeta = normalizeRecruitmentRounds(selectedJob.recruitmentRounds).find((round) => round.name === roundFocus)
    if (!roundMeta) {
      return
    }

    const activeSelection = focusedRoundApplicants.filter((row) => roundSelectionIds.includes(row.id))
    if (activeSelection.length === 0) {
      setError('Select at least one student for the selected round.')
      return
    }

    try {
      for (const application of activeSelection) {
        const nextRoundResults = {
          ...(application.roundResults ?? {}),
          [roundMeta.id]: outcome,
          [roundMeta.name]: outcome,
        }

        await updateDoc(doc(db, 'applications', application.id), {
          roundResults: nextRoundResults,
          currentRound: roundMeta.name,
          lastUpdated: new Date().toISOString(),
        })
      }

      setRoundSelectionIds([])
      setError('')
    } catch (roundError) {
      const message = roundError instanceof Error ? roundError.message : 'Round update failed.'
      setError(message)
    }
  }

  const handleExportApplicants = () => {
    if (!selectedJob) {
      return
    }

    const exportRows = deduplicateApplications(filteredApplicants).map((application, index) => {
      const row: Record<string, unknown> = {
        'S.No': index + 1,
        'Roll No': application.rollNo ?? '—',
        Name: application.studentName || '—',
        Branch: application.branch ?? '—',
        'Email ID': application.email ?? '—',
        CGPA: application.cgpa ?? '—',
        'Application Date': application.appliedAt ? new Date(application.appliedAt).toLocaleString() : '—',
        Status: application.status,
      }

      return row
    })

    const worksheet = XLSX.utils.json_to_sheet(exportRows)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Applicants')
    const safeCompanyName = selectedJob.companyName.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '')
    const fileName = `${safeCompanyName}_${selectedJob.title.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '')}_Applicants.xlsx`
    XLSX.writeFile(workbook, fileName)
  }

  const renderAdminSection = () => {
    if (activeSection === 'jobs') {
      return (
        <div className="space-y-6">
          <div className="grid gap-6 xl:grid-cols-[0.95fr_1.55fr]">
            <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Placement</p>
                  <h2 className="mt-1 text-2xl font-semibold text-slate-900">Create opportunity</h2>
                </div>
                <Building2 size={20} className="text-blue-600" />
              </div>

              <form className="mt-5 space-y-4" onSubmit={handleCreateOpportunity}>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">Job / Internship Title</label>
                    <input value={jobForm.title} onChange={(event) => setJobForm({ ...jobForm, title: event.target.value })} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white" />
                    {jobFormErrors.title ? <p className="mt-1 text-xs text-rose-600">{jobFormErrors.title}</p> : null}
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">Company / Organization Name</label>
                    <input value={jobForm.organizationName} onChange={(event) => setJobForm({ ...jobForm, organizationName: event.target.value })} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white" />
                    {jobFormErrors.organizationName ? <p className="mt-1 text-xs text-rose-600">{jobFormErrors.organizationName}</p> : null}
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Job Description</label>
                  <textarea value={jobForm.description} onChange={(event) => setJobForm({ ...jobForm, description: event.target.value })} className="min-h-[110px] w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white" />
                  {jobFormErrors.description ? <p className="mt-1 text-xs text-rose-600">{jobFormErrors.description}</p> : null}
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">Location</label>
                    <input value={jobForm.location} onChange={(event) => setJobForm({ ...jobForm, location: event.target.value })} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white" />
                    {jobFormErrors.location ? <p className="mt-1 text-xs text-rose-600">{jobFormErrors.location}</p> : null}
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">Opportunity Type</label>
                    <select value={jobForm.type} onChange={(event) => setJobForm({ ...jobForm, type: event.target.value })} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white">
                      <option value="Placement">Placement</option>
                      <option value="Internship">Internship</option>
                    </select>
                    {jobFormErrors.type ? <p className="mt-1 text-xs text-rose-600">{jobFormErrors.type}</p> : null}
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">Package / Stipend</label>
                    <input value={jobForm.salary} onChange={(event) => setJobForm({ ...jobForm, salary: event.target.value })} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white" />
                    {jobFormErrors.salary ? <p className="mt-1 text-xs text-rose-600">{jobFormErrors.salary}</p> : null}
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">Minimum CGPA</label>
                    <input type="number" step="0.1" value={jobForm.minimumCgpa} onChange={(event) => setJobForm({ ...jobForm, minimumCgpa: Number(event.target.value) })} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white" />
                    {jobFormErrors.minimumCgpa ? <p className="mt-1 text-xs text-rose-600">{jobFormErrors.minimumCgpa}</p> : null}
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">Eligible Branches</label>
                    <input value={jobForm.eligibleBranches} onChange={(event) => setJobForm({ ...jobForm, eligibleBranches: event.target.value })} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white" />
                    {jobFormErrors.eligibleBranches ? <p className="mt-1 text-xs text-rose-600">{jobFormErrors.eligibleBranches}</p> : null}
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">Eligible Graduation Year</label>
                    <input value={jobForm.eligibleYears} onChange={(event) => setJobForm({ ...jobForm, eligibleYears: event.target.value })} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white" />
                    {jobFormErrors.eligibleYears ? <p className="mt-1 text-xs text-rose-600">{jobFormErrors.eligibleYears}</p> : null}
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Recruitment Rounds</label>
                  <div className="space-y-2">
                    {jobForm.recruitmentRounds.map((roundName, index) => (
                      <div key={`${roundName}-${index}`} className="flex gap-2">
                        <input
                          value={roundName}
                          onChange={(event) => updateRecruitmentRound(index, event.target.value)}
                          className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white"
                          placeholder={`Round ${index + 1}`}
                        />
                        <button
                          type="button"
                          onClick={() => removeRecruitmentRound(index)}
                          className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700"
                        >
                          Delete
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={addRecruitmentRound}
                      className="mt-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700"
                    >
                      + Add Round
                    </button>
                  </div>
                  {jobFormErrors.recruitmentRounds ? <p className="mt-1 text-xs text-rose-600">{jobFormErrors.recruitmentRounds}</p> : null}
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">Application Start Date</label>
                    <input type="date" value={jobForm.applicationStartDate} onChange={(event) => setJobForm({ ...jobForm, applicationStartDate: event.target.value })} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white" />
                    {jobFormErrors.applicationStartDate ? <p className="mt-1 text-xs text-rose-600">{jobFormErrors.applicationStartDate}</p> : null}
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">Last Date to Apply</label>
                    <input type="date" value={jobForm.applicationDeadline} onChange={(event) => setJobForm({ ...jobForm, applicationDeadline: event.target.value })} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white" />
                    {jobFormErrors.applicationDeadline ? <p className="mt-1 text-xs text-rose-600">{jobFormErrors.applicationDeadline}</p> : null}
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Required Skills</label>
                  <input value={jobForm.requiredSkills} onChange={(event) => setJobForm({ ...jobForm, requiredSkills: event.target.value })} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white" />
                  {jobFormErrors.requiredSkills ? <p className="mt-1 text-xs text-rose-600">{jobFormErrors.requiredSkills}</p> : null}
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Maximum Allowed Backlogs</label>
                  <input type="number" value={jobForm.maxActiveBacklogs} onChange={(event) => setJobForm({ ...jobForm, maxActiveBacklogs: Number(event.target.value) })} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white" />
                  {jobFormErrors.maxActiveBacklogs ? <p className="mt-1 text-xs text-rose-600">{jobFormErrors.maxActiveBacklogs}</p> : null}
                </div>

                {statusMessage ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{statusMessage}</div> : null}
                <button type="submit" className="w-full rounded-xl bg-blue-600 px-4 py-3 font-medium text-white transition hover:bg-blue-700">Publish Opportunity</button>
              </form>
            </section>

            <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Current</p>
                  <h2 className="mt-1 text-2xl font-semibold text-slate-900">Available opportunities</h2>
                </div>
                <BriefcaseBusiness size={20} className="text-indigo-600" />
              </div>

              {opportunityError ? <div role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{opportunityError}</div> : null}
              {statusMessage ? <div role="status" className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{statusMessage}</div> : null}

              <div className="mt-5 space-y-3">
                {jobs.length === 0 ? (
                  <p className="text-sm text-slate-500">No opportunities available yet.</p>
                ) : (
                  jobs.map((job) => (
                    <div key={job.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-semibold text-slate-900">{job.title}</p>
                          <p className="text-sm text-slate-500">{job.companyName}</p>
                        </div>
                        <span className={cn('rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em]', job.status === 'Open' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-700')}>
                          {job.status}
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-600">
                        <span className="rounded-full bg-white px-2 py-1">{job.type}</span>
                        <span className="rounded-full bg-white px-2 py-1">{job.location}</span>
                        <span className="rounded-full bg-white px-2 py-1">Min CGPA {job.minimumCgpa}</span>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={pendingOpportunityId !== null}
                          onClick={(event) => {
                            event.stopPropagation()
                            void handleToggleOpportunity(job)
                          }}
                          className="rounded-xl border border-blue-200 bg-white px-3 py-2 text-xs font-medium text-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {pendingOpportunityId === job.id
                            ? (job.published ?? true ? 'Unpublishing...' : 'Publishing...')
                            : (job.published ?? true ? 'Unpublish' : 'Publish')}
                        </button>
                        <button
                          type="button"
                          disabled={pendingOpportunityId !== null}
                          onClick={(event) => {
                            event.stopPropagation()
                            void handleDeleteOpportunity(job)
                          }}
                          className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {pendingOpportunityId === job.id ? 'Deleting...' : 'Delete'}
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        </div>
      )
    }

    if (activeSection === 'applications') {
      if (!selectedJob) {
        return (
          <div className="space-y-6">
            <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="mb-6">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Applications</p>
                <h2 className="mt-1 text-2xl font-semibold text-slate-900">Placement Drives</h2>
              </div>

              <div className="grid gap-4 xl:grid-cols-3">
                {companyCards.length === 0 ? (
                  <p className="text-sm text-slate-500">No placement opportunities available.</p>
                ) : (
                  companyCards.map((job) => (
                    <div
                      key={job.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => navigate(`/admin/applicants/${job.id}`)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          navigate(`/admin/applicants/${job.id}`)
                        }
                      }}
                      className="cursor-pointer rounded-[24px] border border-slate-200 bg-slate-50 p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:bg-white"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-lg font-semibold text-slate-900">{job.companyName}</p>
                          <p className="mt-1 text-sm text-slate-600">{job.title}</p>
                        </div>
                        <span className={cn('rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]', job.status === 'Open' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-700')}>
                          {job.status}
                        </span>
                      </div>

                      <div className="mt-5 space-y-2 border-t border-slate-200 pt-4 text-sm text-slate-600">
                        <div className="flex items-center justify-between"><span>Total Applicants</span><strong className="text-slate-900">{job.totalApplicants}</strong></div>
                        <div className="flex items-center justify-between"><span>Applied</span><strong className="text-blue-700">{job.counts.Applied}</strong></div>
                        <div className="flex items-center justify-between"><span>Shortlisted</span><strong className="text-amber-700">{job.counts.Shortlisted}</strong></div>
                        <div className="flex items-center justify-between"><span>Rejected</span><strong className="text-rose-700">{job.counts.Rejected}</strong></div>
                        <div className="flex items-center justify-between"><span>Selected</span><strong className="text-emerald-700">{job.counts.Selected}</strong></div>
                      </div>

                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation()
                          navigate(`/admin/applicants/${job.id}`)
                        }}
                        className="mt-5 w-full rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700"
                      >
                        View Applicants
                      </button>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        )
      }

      return (
        <div className="space-y-6">
          <button type="button" onClick={() => navigate('/admin/applicants')} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100">
            ← Back to Applicants
          </button>

          <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Company</p>
                <h2 className="mt-1 text-3xl font-semibold text-slate-900">{selectedJob.companyName}</h2>
                <p className="mt-1 text-base text-slate-600">{selectedJob.title}</p>
              </div>
              <button type="button" onClick={handleExportApplicants} className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-medium text-blue-700 transition hover:bg-blue-100">Download Excel</button>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Location</p>
                <p className="mt-2 text-lg font-semibold text-slate-900">{selectedJob.location}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Package</p>
                <p className="mt-2 text-lg font-semibold text-slate-900">{selectedJob.salary}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Openings</p>
                <p className="mt-2 text-lg font-semibold text-slate-900">{selectedApplicants.length}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Minimum CGPA</p>
                <p className="mt-2 text-lg font-semibold text-slate-900">{selectedJob.minimumCgpa}</p>
              </div>
            </div>
          </section>

          <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Statistics</p>
                <h3 className="mt-1 text-2xl font-semibold text-slate-900">Placement Statistics</h3>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-5">
              <StatCard label="Total Applicants" value={String(resolvedApplicants.length)} tone="blue" />
              <StatCard label="Applied" value={String(resolvedApplicants.filter((row) => row.status === 'Applied').length)} tone="indigo" />
              <StatCard label="Shortlisted" value={String(resolvedApplicants.filter((row) => row.status === 'Shortlisted').length)} tone="amber" />
              <StatCard label="Rejected" value={String(resolvedApplicants.filter((row) => row.status === 'Rejected').length)} tone="rose" />
              <StatCard label="Selected" value={String(resolvedApplicants.filter((row) => row.status === 'Selected').length)} tone="green" />
            </div>
          </section>

          <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="mb-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Process</p>
              <h3 className="mt-1 text-2xl font-semibold text-slate-900">Recruitment Process</h3>
            </div>

            <div className="space-y-3">
              {normalizeRecruitmentRounds(selectedJob.recruitmentRounds).length === 0 ? (
                <p className="text-sm text-slate-500">No recruitment rounds configured for this opportunity.</p>
              ) : (
                normalizeRecruitmentRounds(selectedJob.recruitmentRounds).map((round) => (
                  <div key={round.id} className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-medium text-slate-900">Round {round.order} — {round.name}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setRoundFocus(round.name)}
                      className="rounded-xl border border-blue-200 bg-white px-3 py-2 text-sm font-medium text-blue-700 transition hover:bg-blue-50"
                    >
                      Manage
                    </button>
                  </div>
                ))
              )}
            </div>

            {roundFocus ? (
              <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h4 className="text-lg font-semibold text-slate-900">{roundFocus}</h4>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => void handleRoundAction('Passed')} className="rounded-xl bg-emerald-600 px-3 py-2 text-sm font-medium text-white">Mark Passed</button>
                    <button type="button" onClick={() => void handleRoundAction('Failed')} className="rounded-xl bg-rose-600 px-3 py-2 text-sm font-medium text-white">Mark Failed</button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-white text-slate-600">
                      <tr>
                        <th className="px-3 py-2 font-medium"><input type="checkbox" checked={focusedRoundApplicants.length > 0 && focusedRoundApplicants.every((row) => roundSelectionIds.includes(row.id))} onChange={() => { const allVisibleIds = focusedRoundApplicants.map((item) => item.id); setRoundSelectionIds((current) => { const hasAll = allVisibleIds.every((id) => current.includes(id)); if (hasAll) return current.filter((id) => !allVisibleIds.includes(id)); return Array.from(new Set([...current, ...allVisibleIds])); }) }} /></th>
                        <th className="px-3 py-2 font-medium">Name</th>
                        <th className="px-3 py-2 font-medium">Roll No</th>
                        <th className="px-3 py-2 font-medium">Branch</th>
                        <th className="px-3 py-2 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {focusedRoundApplicants.length === 0 ? (
                        <tr><td colSpan={5} className="px-3 py-3 text-slate-500">No applicants are assigned to this round yet.</td></tr>
                      ) : (
                        focusedRoundApplicants.map((application) => (
                          <tr key={application.id}>
                            <td className="px-3 py-2"><input type="checkbox" checked={roundSelectionIds.includes(application.id)} onChange={() => setRoundSelectionIds((current) => current.includes(application.id) ? current.filter((item) => item !== application.id) : [...current, application.id])} /></td>
                            <td className="px-3 py-2 text-slate-800">{application.studentName || '—'}</td>
                            <td className="px-3 py-2 text-slate-800">{application.rollNo ?? '—'}</td>
                            <td className="px-3 py-2 text-slate-800">{application.branch ?? '—'}</td>
                            <td className="px-3 py-2"><span className={cn('inline-flex rounded-full px-2.5 py-1 text-xs font-medium', statusClass(application.status))}>{application.status}</span></td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}
          </section>

          <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Applicants</p>
                <h3 className="mt-1 text-2xl font-semibold text-slate-900">{selectedJob.companyName} Applicants</h3>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as 'All' | ApplicationStatus)} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500">
                  <option value="All">All Statuses</option>
                  <option value="Applied">Applied</option>
                  <option value="Shortlisted">Shortlisted</option>
                  <option value="Rejected">Rejected</option>
                  <option value="Selected">Selected</option>
                </select>
                <select value={roundFilter} onChange={(event) => setRoundFilter(event.target.value)} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500">
                  {roundOptions.map((round) => (
                    <option key={round} value={round}>{round}</option>
                  ))}
                </select>
                <select value={bulkStatus} onChange={(event) => setBulkStatus(event.target.value as ApplicationStatus)} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500">
                  <option value="Shortlisted">Shortlist</option>
                  <option value="Rejected">Reject</option>
                  <option value="Selected">Select</option>
                </select>
                <button type="button" onClick={() => void handleBulkStatusUpdate()} className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800">Update Selected</button>
              </div>
            </div>

            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm text-slate-600">Selected company: {selectedJob.companyName}</div>
              <div className="flex items-center gap-3 text-sm text-slate-600">
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={filteredApplicants.length > 0 && filteredApplicants.every((item) => selectedIds.includes(item.id))}
                    onChange={() => {
                      const allVisibleIds = filteredApplicants.map((item) => item.id)
                      setSelectedIds((current) => {
                        const hasAll = allVisibleIds.every((id) => current.includes(id))
                        if (hasAll) {
                          return current.filter((id) => !allVisibleIds.includes(id))
                        }
                        return Array.from(new Set([...current, ...allVisibleIds]))
                      })
                    }}
                  />
                  Select All
                </label>
                <span>Selected: {filteredApplicants.filter((row) => selectedIds.includes(row.id)).length}</span>
              </div>
            </div>

            {error ? <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div> : null}

            <div className="overflow-hidden rounded-2xl border border-slate-200">
              {filteredApplicants.length === 0 ? (
                <p className="p-4 text-sm text-slate-500">No applicants match the current filters for this company.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full bg-white text-left text-sm">
                    <thead className="bg-slate-50 text-slate-600">
                      <tr>
                        <th className="px-3 py-3 font-medium">S.No</th>
                        <th className="px-3 py-3 font-medium">Roll No</th>
                        <th className="px-3 py-3 font-medium">Name</th>
                        <th className="px-3 py-3 font-medium">Branch</th>
                        <th className="px-3 py-3 font-medium">Email ID</th>
                        <th className="px-3 py-3 font-medium">CGPA</th>
                        <th className="px-3 py-3 font-medium">Application Date</th>
                        <th className="px-3 py-3 font-medium">Status</th>
                        <th className="px-3 py-3 font-medium">Current Round</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {filteredApplicants.map((application, index) => (
                        <tr key={application.id} className="hover:bg-slate-50">
                          <td className="px-3 py-3 text-slate-800">
                            <label className="flex items-center gap-3">
                              <input
                                type="checkbox"
                                checked={selectedIds.includes(application.id)}
                                onChange={() =>
                                  setSelectedIds((current) =>
                                    current.includes(application.id)
                                      ? current.filter((item) => item !== application.id)
                                      : [...current, application.id],
                                  )
                                }
                              />
                              <span>{index + 1}</span>
                            </label>
                          </td>
                          <td className="px-3 py-3 text-slate-800">{application.rollNo ?? '—'}</td>
                          <td className="px-3 py-3 text-slate-800">{application.studentName || '—'}</td>
                          <td className="px-3 py-3 text-slate-800">{application.branch ?? '—'}</td>
                          <td className="px-3 py-3 text-slate-800">{application.email ?? '—'}</td>
                          <td className="px-3 py-3 text-slate-800">{application.cgpa ?? '—'}</td>
                          <td className="px-3 py-3 text-slate-600">{application.appliedAt ? new Date(application.appliedAt).toLocaleDateString() : '—'}</td>
                          <td className="px-3 py-3"><span className={cn('inline-flex rounded-full px-2.5 py-1 text-xs font-medium', statusClass(application.status))}>{application.status}</span></td>
                          <td className="px-3 py-3 text-slate-800">{application.currentRound ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        </div>
      )
    }

    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-4">
          <StatCard label="Students" value={String(new Set(applications.map((application) => application.studentId)).size)} tone="blue" />
          <StatCard label="Jobs" value={String(jobs.length)} tone="indigo" />
          <StatCard label="Applications" value={String(applications.length)} tone="amber" />
          <StatCard label="Notifications" value={String(notifications.length)} tone="green" />
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Overview</p>
                <h2 className="mt-1 text-2xl font-semibold text-slate-900">Application status</h2>
              </div>
              <TrendingUp size={20} className="text-emerald-600" />
            </div>

            <div className="mt-5 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={statusData}>
                  <CartesianGrid stroke="#e2e8f0" strokeDasharray="4 4" />
                  <XAxis dataKey="name" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                    {statusData.map((entry, index) => (
                      <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Distribution</p>
                <h2 className="mt-1 text-2xl font-semibold text-slate-900">Hiring mix</h2>
              </div>
              <Gauge size={20} className="text-blue-600" />
            </div>

            <div className="mt-5 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie dataKey="value" data={opportunitySummary} innerRadius={42} outerRadius={88} paddingAngle={4}>
                    {opportunitySummary.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </section>
        </div>
      </div>
    )
  }

  return renderAdminSection()
}

function AppContent() {
  const location = useLocation()
  const [authUser, setAuthUser] = useState<User | null>(null)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [studentProfile, setStudentProfile] = useState<StudentProfile | null>(null)
  const [jobs, setJobs] = useState<JobPosting[]>([])
  const [applications, setApplications] = useState<ApplicationRecord[]>([])
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [activeStudentSection, setActiveStudentSection] = useState<StudentSection>('overview')
  const [activeAdminSection, setActiveAdminSection] = useState<StudentSection>('overview')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (userProfile?.role === 'admin' && location.pathname.startsWith('/admin/applicants')) {
      setActiveAdminSection('applications')
    }
    if (userProfile?.role === 'admin' && location.pathname === '/admin') {
      setActiveAdminSection('overview')
    }
    if (userProfile?.role === 'student' && location.pathname.startsWith('/jobs/')) {
      setActiveStudentSection('jobs')
    }
  }, [location.pathname, userProfile])

  const fetchAllData = async (profile: UserProfile) => {
    const jobsSnapshot = profile.role === 'admin'
      ? await getDocs(collection(db, 'jobs'))
      : await getDocs(query(collection(db, 'jobs'), where('published', '==', true)))
    const jobsList = jobsSnapshot.docs.map((item) => normalizeOpportunity({ ...item.data(), id: item.id } as JobPosting))
    const jobsMap = Object.fromEntries(jobsList.map((job) => [job.id, job]))
    setJobs(jobsList)

    const studentsSnapshot = profile.role === 'admin'
      ? await getDocs(collection(db, 'students'))
      : await getDocs(query(collection(db, 'students'), where('__name__', '==', profile.uid)))
    const studentMap = Object.fromEntries(
      studentsSnapshot.docs
        .map((item) => {
          const normalized = normalizeStudentProfile(item.data() as Partial<StudentProfile>)
          return normalized ? [item.id, normalized] : null
        })
        .filter((entry): entry is [string, StudentProfile] => Boolean(entry)),
    )

    const applicationsSnapshot = profile.role === 'admin'
      ? await getDocs(collection(db, 'applications'))
      : await getDocs(query(collection(db, 'applications'), where('studentId', '==', profile.uid)))
    const applicationList = applicationsSnapshot.docs.map((item) => {
      const raw = { ...item.data(), id: item.id } as ApplicationRecord & Record<string, any>
      const linkedStudent = raw.studentId ? studentMap[raw.studentId] ?? studentMap[(raw.userId as string | undefined) ?? ''] ?? null : null
      const linkedJob = raw.jobId ? jobsMap[raw.jobId] ?? jobsMap[raw.opportunityId ?? ''] ?? null : null
      const linkedCompany = linkedJob ? getOpportunityCompanyName(linkedJob) : raw.organization || raw.organizationName || raw.companyId || 'Campus Placement Office'

      return {
        ...raw,
        studentName: raw.studentName || linkedStudent?.fullName || '—',
        rollNo: raw.rollNo || linkedStudent?.rollNumber || '—',
        branch: raw.branch || linkedStudent?.branch || '—',
        email: raw.email || linkedStudent?.email || '—',
        cgpa: raw.cgpa ?? getStudentCgpa(linkedStudent) ?? undefined,
        organization: raw.organization || raw.organizationName || linkedCompany,
        organizationName: raw.organizationName || linkedCompany,
        jobTitle: raw.jobTitle || linkedJob?.title || '—',
        companyId: raw.companyId || linkedJob?.companyId,
        opportunityId: raw.opportunityId || linkedJob?.id,
        jobId: raw.jobId || linkedJob?.id,
      }
    })
    setApplications(deduplicateApplications(applicationList))

    const notificationsSnapshot = await getDocs(
      query(collection(db, 'notifications'), where('userId', '==', profile.uid), orderBy('createdAt', 'desc')),
    )
    const notificationsList = notificationsSnapshot.docs.map((item) => ({ id: item.id, ...item.data() } as NotificationItem))
    setNotifications(notificationsList)

    if (profile.role === 'student') {
      const studentSnapshot = await getDoc(doc(db, 'students', profile.uid))
      if (studentSnapshot.exists()) {
        const normalizedStudent = normalizeStudentProfile(studentSnapshot.data() as Partial<StudentProfile>)
        setStudentProfile(normalizedStudent)
      } else {
        setStudentProfile(null)
      }
    }
  }

  useEffect(() => {
    let unsubscribeJobs: (() => void) | null = null
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setLoading(true)

      if (!firebaseUser) {
        unsubscribeJobs?.()
        unsubscribeJobs = null
        setAuthUser(null)
        setUserProfile(null)
        setStudentProfile(null)
        setJobs([])
        setApplications([])
        setNotifications([])
        setLoading(false)
        return
      }

      setAuthUser(firebaseUser)

      try {
        const userRef = doc(db, 'users', firebaseUser.uid)
        const userSnapshot = await getDoc(userRef)

        let foundProfile: UserProfile | null = userSnapshot.exists() ? (userSnapshot.data() as UserProfile) : null

        if (!foundProfile) {
          const defaultProfile: UserProfile = {
            uid: firebaseUser.uid,
            email: firebaseUser.email ?? '',
            fullName: firebaseUser.displayName ?? firebaseUser.email?.split('@')[0] ?? 'User',
            role: 'student',
            createdAt: new Date().toISOString(),
          }
          await setDoc(userRef, defaultProfile)
          foundProfile = defaultProfile
        }

        if (foundProfile.role === 'admin') {
          await ensureSeedData()
        }

        setUserProfile(foundProfile)

        if (foundProfile.role === 'student') {
          const studentSnapshot = await getDoc(doc(db, 'students', foundProfile.uid))

          if (studentSnapshot.exists()) {
            setStudentProfile(normalizeStudentProfile(studentSnapshot.data() as Partial<StudentProfile>))
          } else {
            const studentProfileData: StudentProfile = {
              uid: foundProfile.uid,
              userId: foundProfile.uid,
              email: foundProfile.email,
              fullName: foundProfile.fullName,
              phone: '',
              branch: '',
              skills: [],
              projects: [],
              certifications: [],
              resume: null,
              bio: '',
            }
            await setDoc(doc(db, 'students', foundProfile.uid), studentProfileData)
            setStudentProfile(studentProfileData)
          }
        }

        await fetchAllData(foundProfile)
        unsubscribeJobs?.()
        const jobsQuery = foundProfile.role === 'admin'
          ? collection(db, 'jobs')
          : query(collection(db, 'jobs'), where('published', '==', true))
        unsubscribeJobs = onSnapshot(
          jobsQuery,
          (snapshot) => {
            const jobsList = snapshot.docs.map((item) => normalizeOpportunity({ ...item.data(), id: item.id } as JobPosting))
            setJobs(jobsList)
          },
          (snapshotError) => {
            console.error('Unable to listen for opportunity updates.', snapshotError)
          },
        )
      } catch (fetchError) {
        console.error(fetchError)
      } finally {
        setLoading(false)
      }
    })

    return () => {
      unsubscribe()
      unsubscribeJobs?.()
    }
  }, [])

  const handleEmailLogin = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password)
  }

  const handleGoogleLogin = async () => {
    await signInWithPopup(auth, googleProvider)
  }

  const handleEmailSignup = async (payload: {
    fullName: string
    email: string
    password: string
  }) => {
    const result = await createUserWithEmailAndPassword(auth, payload.email, payload.password)
    const profile: UserProfile = {
      uid: result.user.uid,
      email: payload.email,
      fullName: payload.fullName,
      role: 'student',
      createdAt: new Date().toISOString(),
    }

    await setDoc(doc(db, 'users', result.user.uid), profile)

    const student: StudentProfile = {
      uid: result.user.uid,
      userId: result.user.uid,
      email: payload.email,
      fullName: payload.fullName,
      phone: '',
      branch: '',
      skills: [],
      projects: [],
      certifications: [],
      resume: null,
      bio: '',
    }
    await setDoc(doc(db, 'students', result.user.uid), student)

  }

  const handleLogout = async () => {
    await signOut(auth)
  }

  if (loading) {
    return <LoadingScreen />
  }

  if (!authUser) {
    return (
      <AuthPage
        onEmailLogin={handleEmailLogin}
        onGoogleLogin={handleGoogleLogin}
        onEmailSignup={handleEmailSignup}
      />
    )
  }

  if (!userProfile) {
    return <LoadingScreen />
  }

  const { jobId } = useParams()

  if (jobId && userProfile?.role === 'student') {
    return (
      <ProtectedRoute allowedRoles={['student']} currentRole={userProfile.role}>
        <DashboardShell
          userProfile={userProfile}
          onLogout={handleLogout}
          activeSection={activeStudentSection}
          onSectionChange={setActiveStudentSection}
        >
          <JobOpportunityDetailsPage
            jobs={jobs}
            studentProfile={studentProfile}
            applications={applications}
          />
        </DashboardShell>
      </ProtectedRoute>
    )
  }

  const roleBasedContent =
    userProfile.role === 'student' ? (
      <ProtectedRoute allowedRoles={['student']} currentRole={userProfile.role}>
        <DashboardShell
          userProfile={userProfile}
          onLogout={handleLogout}
          activeSection={activeStudentSection}
          onSectionChange={setActiveStudentSection}
        >
          <StudentDashboard
            studentProfile={studentProfile}
            jobs={jobs}
            applications={applications.filter((application) => application.studentId === userProfile.uid)}
            notifications={notifications}
            userProfile={userProfile}
            activeSection={activeStudentSection}
            onSectionChange={setActiveStudentSection}
          />
        </DashboardShell>
      </ProtectedRoute>
    ) : (
      <ProtectedRoute allowedRoles={['admin']} currentRole={userProfile.role}>
        <DashboardShell
          userProfile={userProfile}
          onLogout={handleLogout}
          activeSection={activeAdminSection}
          onSectionChange={setActiveAdminSection}
        >
          <AdminDashboard
            jobs={jobs}
            setJobs={setJobs}
            applications={applications}
            notifications={notifications}
            activeSection={activeAdminSection}
          />
        </DashboardShell>
      </ProtectedRoute>
    )

  return roleBasedContent
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<AppContent />} />
        <Route path="/" element={<AppContent />} />
        <Route path="/jobs/:jobId" element={<AppContent />} />
        <Route path="/admin/applicants" element={<AppContent />} />
        <Route path="/admin/applicants/:jobId" element={<AppContent />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
