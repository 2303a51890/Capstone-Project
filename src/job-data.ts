import type { JobPosting } from './types'
import { parseJobDescription } from './ats-engine.ts'

export type JobSource = 'Greenhouse' | 'CampusHire'

export interface CompanyOption {
  key: string
  id: string
  name: string
  source: JobSource
  careersUrl?: string
}

export interface ATSJobListing {
  source: JobSource
  companyId: string
  companyName: string
  jobId: string
  title: string
  location: string
  sourceUrl: string | null
  checkedAt: string
  sourceUpdatedAt: string | null
  firstPublishedAt: string | null
  closingDate: string | null
  descriptionText: string
  descriptionHtml?: string
  internalJob?: JobPosting
  requiredSkills: string[]
  preferredSkills: string[]
  qualifications: string[]
  requiredQualifications: string[]
  preferredQualifications: string[]
  responsibilities: string[]
  experienceLevel: string
  requiredExperience: string[]
  preferredExperience: string[]
  missingDescriptionInformation: string[]
}

export interface ExternalCompany {
  id: string
  name: string
  provider: 'Greenhouse'
  careersUrl: string
}

export interface GreenhouseJobPayload {
  provider: 'Greenhouse'
  companyId: string
  companyName: string
  sourceJobId: string
  title: string
  location: string
  sourceUrl: string
  checkedAt: string
  sourceUpdatedAt: string | null
  firstPublishedAt: string | null
  closingDate: string | null
  descriptionHtml?: string
  descriptionText?: string
  department: string[]
  offices: string[]
}

export function mapGreenhouseJob(job: GreenhouseJobPayload): ATSJobListing {
  const descriptionText = job.descriptionText ?? ''
  const parsed = parseJobDescription(descriptionText)
  return {
    source: 'Greenhouse',
    companyId: job.companyId,
    companyName: job.companyName,
    jobId: job.sourceJobId,
    title: job.title,
    location: job.location,
    sourceUrl: job.sourceUrl,
    checkedAt: job.checkedAt,
    sourceUpdatedAt: job.sourceUpdatedAt,
    firstPublishedAt: job.firstPublishedAt,
    closingDate: job.closingDate,
    descriptionText,
    descriptionHtml: job.descriptionHtml,
    requiredSkills: parsed.requiredSkills,
    preferredSkills: parsed.preferredSkills,
    qualifications: parsed.qualifications,
    requiredQualifications: parsed.requiredQualifications,
    preferredQualifications: parsed.preferredQualifications,
    responsibilities: parsed.responsibilities,
    experienceLevel: parsed.experienceExpectations.join(', '),
    requiredExperience: parsed.requiredExperienceExpectations,
    preferredExperience: parsed.preferredExperienceExpectations,
    missingDescriptionInformation: parsed.missingInformation,
  }
}

export function filterCompanyOptions(companies: CompanyOption[], search: string): CompanyOption[] {
  const query = search.trim().toLowerCase()
  if (!query) return companies
  return companies.filter((company) =>
    company.name.toLowerCase().includes(query) || company.source.toLowerCase().includes(query),
  )
}

export function getCampusHireCompanyId(job: JobPosting): string {
  const companyId = job.companyId?.trim() ?? ''
  if (companyId && !['tpo-admin', 'campus-placement-office'].includes(companyId.toLowerCase())) return companyId
  const name = job.organizationName?.trim() || job.companyName?.trim() || 'Campus Placement Office'
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
}

export function matchesCampusHireCompany(job: JobPosting, companyId: string): boolean {
  return getCampusHireCompanyId(job) === companyId
}

export function getCompanyOptions(external: ExternalCompany[], campusJobs: JobPosting[]): CompanyOption[] {
  const externalOptions: CompanyOption[] = external.map((company) => ({
    key: `greenhouse:${company.id}`,
    id: company.id,
    name: company.name,
    source: 'Greenhouse',
    careersUrl: company.careersUrl,
  }))
  const campusCompanies = new Map<string, CompanyOption>()
  for (const job of campusJobs) {
    if (job.published !== true || !isCampusHireJobOpen(job)) continue
    const name = job.companyName?.trim() || job.organizationName?.trim()
    if (!name) continue
    const companyId = getCampusHireCompanyId(job)
    const key = `campushire:${companyId}`
    if (!campusCompanies.has(key)) {
      campusCompanies.set(key, { key, id: companyId, name, source: 'CampusHire' })
    }
  }
  return [...externalOptions, ...campusCompanies.values()]
    .sort((left, right) => left.name.localeCompare(right.name) || left.source.localeCompare(right.source))
}

function getDateTimestamp(value: string | undefined, endOfDay = false): number | null {
  if (!value) return null
  const dateOnly = value.slice(0, 10)
  const date = /^\d{4}-\d{2}-\d{2}$/.test(dateOnly)
    ? new Date(`${dateOnly}T${endOfDay ? '23:59:59.999' : '00:00:00'}`)
    : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.getTime()
}

export function isCampusHireJobOpen(job: JobPosting, now = Date.now()): boolean {
  if (job.published !== true || job.status === 'Closed') return false
  const start = getDateTimestamp(job.applicationStartDate)
  const end = getDateTimestamp(job.applicationDeadline, true)
  return (start === null || start <= now) && (end === null || end >= now)
}

export function getCampusHirePublicationStatus(
  job: Pick<JobPosting, 'applicationDeadline'>,
  published: boolean,
  now = Date.now(),
): JobPosting['status'] {
  if (!published) return 'Closed'
  if (!job.applicationDeadline) return 'Open'
  const deadline = getDateTimestamp(job.applicationDeadline, true)
  return deadline !== null && deadline >= now ? 'Open' : 'Closed'
}

export function mapCampusHireJob(job: JobPosting, checkedAt = new Date().toISOString()): ATSJobListing {
  const requirements = [
    ...(job.requiredSkills ?? []).map((skill) => `Required skill: ${skill}`),
    job.minimumCgpa > 0 ? `Minimum CGPA: ${job.minimumCgpa}` : '',
    job.eligibleBranches.length ? `Eligible branches: ${job.eligibleBranches.join(', ')}` : '',
    job.eligibleYears.length ? `Eligible graduation years: ${job.eligibleYears.join(', ')}` : '',
    job.maxActiveBacklogs !== undefined ? `Maximum active backlogs: ${job.maxActiveBacklogs}` : '',
  ].filter(Boolean)
  return {
    source: 'CampusHire',
    companyId: getCampusHireCompanyId(job),
    companyName: job.organizationName?.trim() || job.companyName,
    jobId: job.id,
    title: job.title,
    location: job.location,
    sourceUrl: null,
    checkedAt,
    sourceUpdatedAt: job.createdAt ?? null,
    firstPublishedAt: job.postedAt ?? null,
    closingDate: job.applicationDeadline ?? null,
    descriptionText: [job.description, ...requirements].filter(Boolean).join('\n\n'),
    internalJob: job,
    requiredSkills: job.requiredSkills ?? [],
    preferredSkills: [],
    qualifications: [
      ...(job.minimumCgpa > 0 ? [`Minimum CGPA ${job.minimumCgpa}`] : []),
      ...(job.eligibleBranches.length ? [`Branches: ${job.eligibleBranches.join(', ')}`] : []),
      ...(job.eligibleYears.length ? [`Graduation years: ${job.eligibleYears.join(', ')}`] : []),
      ...(job.maxActiveBacklogs !== undefined ? [`Maximum active backlogs: ${job.maxActiveBacklogs}`] : []),
    ],
    requiredQualifications: [
      ...(job.minimumCgpa > 0 ? [`Minimum CGPA ${job.minimumCgpa}`] : []),
      ...(job.eligibleBranches.length ? [`Branches: ${job.eligibleBranches.join(', ')}`] : []),
      ...(job.eligibleYears.length ? [`Graduation years: ${job.eligibleYears.join(', ')}`] : []),
      ...(job.maxActiveBacklogs !== undefined ? [`Maximum active backlogs: ${job.maxActiveBacklogs}`] : []),
    ],
    preferredQualifications: [],
    responsibilities: [],
    experienceLevel: '',
    requiredExperience: [],
    preferredExperience: [],
    missingDescriptionInformation: [],
  }
}

export function deduplicateJobListings<T extends Pick<ATSJobListing, 'source' | 'companyId' | 'jobId'>>(listings: T[]): T[] {
  const seen = new Set<string>()
  return listings.filter((listing) => {
    const key = `${listing.source}:${listing.companyId}:${listing.jobId}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
