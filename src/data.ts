import { collection, doc, getDocs, serverTimestamp, setDoc } from 'firebase/firestore'

import { db } from './firebase'
import type { JobPosting, StudentProfile, UserProfile } from './types'

export async function ensureSeedData(): Promise<void> {
  const jobsSnapshot = await getDocs(collection(db, 'jobs'))

  if (!jobsSnapshot.empty) {
    return
  }

  const adminProfile: UserProfile = {
    uid: 'admin-tpo',
    email: 'tpo@college.edu',
    fullName: 'TPO Admin',
    role: 'admin',
    phone: '+91 98765 43210',
    createdAt: new Date().toISOString(),
  }

  const studentOne: StudentProfile = {
    uid: 'student-arya',
    email: 'arya@student.college.edu',
    fullName: 'Arya Sharma',
    phone: '+91 90000 11111',
    branch: 'CSE',
    cgpa: 9.4,
    graduationYear: 2027,
    skills: ['React', 'TypeScript', 'Node.js', 'MongoDB'],
    projects: [],
    certifications: [],
    resume: {
      filename: 'arya_resume.pdf',
      url: 'https://example.com/resume/arya_resume.pdf',
      uploadedAt: new Date().toISOString(),
    },
    bio: 'Final-year CSE student specializing in frontend engineering and cloud applications.',
  }

  const studentTwo: StudentProfile = {
    uid: 'student-neha',
    email: 'neha@student.college.edu',
    fullName: 'Neha Verma',
    phone: '+91 90000 22222',
    branch: 'ECE',
    cgpa: 8.8,
    graduationYear: 2026,
    skills: ['Embedded Systems', 'C++', 'Signal Processing', 'VLSI'],
    projects: [],
    certifications: [],
    resume: {
      filename: 'neha_resume.pdf',
      url: 'https://example.com/resume/neha_resume.pdf',
      uploadedAt: new Date().toISOString(),
    },
    bio: 'Electronics graduate interested in firmware and hardware-software integration.',
  }

  const jobs: JobPosting[] = [
    {
      id: 'job-campus-frontend',
      companyId: 'tpo-admin',
      companyName: 'Campus Placement Office',
      title: 'Frontend Engineer',
      description:
        'Build scalable web workflows, collaborate with product teams, and ship user-centric interfaces using React and TypeScript.',
      location: 'Bengaluru',
      type: 'Placement',
      salary: '₹18 LPA',
      minimumCgpa: 8.5,
      eligibleBranches: ['CSE', 'IT'],
      eligibleYears: [2026, 2027],
      postedAt: new Date().toISOString(),
      applicationDeadline: new Date(Date.now() + 12096e5).toISOString(),
      driveDate: new Date(Date.now() + 24192e5).toISOString(),
      requiredSkills: ['React', 'TypeScript', 'CSS'],
      maxActiveBacklogs: 0,
      published: true,
      status: 'Open',
    },
    {
      id: 'job-campus-data',
      companyId: 'tpo-admin',
      companyName: 'Campus Placement Office',
      title: 'Data Engineer',
      description:
        'Work with pipelines, cloud data systems, and analytics dashboards. Strong SQL, Python, and ETL experience preferred.',
      location: 'Hyderabad',
      type: 'Internship',
      salary: '₹20 LPA',
      minimumCgpa: 8.8,
      eligibleBranches: ['CSE', 'IT', 'ECE'],
      eligibleYears: [2026, 2027],
      postedAt: new Date().toISOString(),
      applicationDeadline: new Date(Date.now() + 12096e5).toISOString(),
      driveDate: new Date(Date.now() + 24192e5).toISOString(),
      requiredSkills: ['SQL', 'Python', 'ETL'],
      maxActiveBacklogs: 0,
      published: true,
      status: 'Open',
    },
  ]

  await setDoc(doc(db, 'users', adminProfile.uid), {
    ...adminProfile,
    createdAt: serverTimestamp(),
  })
  await setDoc(doc(db, 'students', studentOne.uid), studentOne)
  await setDoc(doc(db, 'students', studentTwo.uid), studentTwo)

  for (const job of jobs) {
    await setDoc(doc(db, 'jobs', job.id), job)
  }
}
