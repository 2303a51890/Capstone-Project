export type UserRole = 'student' | 'admin'

export type ApplicationStatus = 'Applied' | 'Shortlisted' | 'Rejected' | 'Selected' | 'Closed'
export type RoundStatus = 'Not Started' | 'Pending' | 'Passed' | 'Failed'

export interface RecruitmentRound {
  id: string
  name: string
  order: number
}

export interface UserProfile {
  uid: string
  email: string
  fullName: string
  role: UserRole
  phone?: string
  createdAt?: string
}

export interface StudentProfile {
  uid: string
  userId?: string
  email: string
  fullName: string
  phone: string
  rollNumber?: string
  aadhaarMasked?: string
  aadhaarLast4?: string
  panMasked?: string
  dateOfBirth?: string
  gender?: string
  address?: string
  city?: string
  state?: string
  pincode?: string
  branch?: string
  cgpa?: number
  graduationYear?: number
  percentage?: number
  currentSemester?: string
  backlogs?: {
    current: number
    total: number
    active: number
    gapYears?: number
  }
  tenth?: {
    schoolName: string
    board: string
    percentage: number
    passingYear: number
  }
  intermediate?: {
    collegeName: string
    board: string
    percentage: number
    passingYear: number
  }
  ug?: {
    degree: string
    university: string
    college: string
    branch: string
    cgpa: number
    percentage?: number
    graduationYear: number
    currentSemester?: string
  }
  skills: string[]
  projects: Array<{
    id?: string
    name: string
    description: string
    technologies: string[]
    projectUrl?: string
    githubUrl?: string
    role: string
    duration: string
  }>
  certifications: Array<{
    id?: string
    name: string
    issuingOrganization: string
    issueDate: string
    credentialId: string
    credentialUrl: string
  }>
  resume: {
    filename: string
    url: string
    updatedAt?: string
    uploadedAt?: string
    status?: 'Linked' | 'Not uploaded'
  } | null
  preferredRoles?: string[]
  preferredLocations?: string[]
  bio?: string
  createdAt?: string
  updatedAt?: string
}

export interface JobPosting {
  id: string
  companyId: string
  companyName: string
  organizationName?: string
  title: string
  description: string
  location: string
  type: 'Placement' | 'Internship' | 'Full Time' | string
  salary: string
  packageOrStipend?: string
  minimumCgpa: number
  minCGPA?: number
  eligibleBranches: string[]
  eligibleYears: number[]
  graduationYears?: number[]
  recruitmentRounds?: RecruitmentRound[]
  postedAt: string
  applicationStartDate?: string
  applicationDeadline?: string
  driveDate?: string
  requiredSkills?: string[]
  backlogAllowed?: number
  minBacklogs?: number
  maxActiveBacklogs?: number
  maxBacklogs?: number
  published?: boolean
  status: 'Open' | 'Closed'
  opportunityId?: string
  createdAt?: string
  createdBy?: string
}

export interface ApplicationRecord {
  id: string
  studentId: string
  opportunityId?: string
  studentName: string
  jobId?: string
  companyId?: string
  organizationName?: string
  jobTitle: string
  organization?: string
  type?: 'Placement' | 'Internship' | string
  location?: string
  lastDate?: string
  status: ApplicationStatus
  appliedAt: string
  lastUpdated?: string
  resumeName?: string
  resumeUrl?: string
  rollNo?: string
  branch?: string
  email?: string
  cgpa?: number
  currentRound?: string
  roundResults?: Record<string, RoundStatus>
  notes?: string
}

export interface NotificationItem {
  id: string
  userId: string
  message: string
  isRead: boolean
  createdAt: string
  type: 'status' | 'application' | 'system' | 'announcement'
}

export interface AnnouncementRecord {
  id: string
  title: string
  description: string
  date: string
  type: 'Placement' | 'Internship' | 'Announcement' | 'Interview' | 'Deadline'
  postedBy: string
  createdAt?: string
}

export interface AiAnalysisResult {
  id: string
  studentId: string
  jobId: string
  matchScore: number
  summary: string
  tips: string[]
  createdAt: string
}

export type ATSJobRole = string

export interface ATSRequirementResult {
  name: string
  category: 'skill' | 'qualification' | 'experience'
  priority?: 'required' | 'preferred' | 'unspecified'
  aliases: string[]
  status: 'matched' | 'partial' | 'missing'
  evidence: string[]
}

export interface ATSAnalysis {
  id: string
  studentId: string
  resumeUrl: string
  resumeFilename: string
  selectedRole: ATSJobRole
  mode?: 'general' | 'job'
  candidateLevel?: string
  companyName?: string
  jobId?: string
  jobSource?: 'Greenhouse' | 'CampusHire'
  jobSourceUrl?: string | null
  jobCheckedAt?: string
  jobClosingDate?: string | null
  jobLocation?: string
  jobDescription?: string
  jobDescriptionHtml?: string
  jobRequiredSkills?: string[]
  jobPreferredSkills?: string[]
  jobQualifications?: string[]
  jobRequiredQualifications?: string[]
  jobPreferredQualifications?: string[]
  jobResponsibilities?: string[]
  jobExperienceLevel?: string
  jobRequiredExperience?: string[]
  jobPreferredExperience?: string[]
  jobMissingInformation?: string[]
  eligibilityComparison?: {
    eligible: boolean
    reasons: string[]
  }
  atsScore: number
  generalScore?: number
  generalScoreBreakdown?: Record<string, number>
  generalScoreWeights?: Record<string, number>
  generalScoreDescriptions?: Record<string, string>
  keywordsFound: string[]
  missingKeywords: string[]
  detectedSkills?: string[]
  requirements?: ATSRequirementResult[]
  scoreWeights?: Record<string, number>
  scoreDescriptions?: Record<string, string>
  readability?: {
    wordCount: number
    lineCount: number
    bulletCount: number
    averageWordsPerLine: number
  }
  sectionsFound: string[]
  missingSections: string[]
  suggestions: string[]
  contactInfo?: {
    email: boolean
    phone: boolean
    linkedin: boolean
  }
  scoreBreakdown: Record<string, number>
  createdAt: string
  updatedAt?: string
}
