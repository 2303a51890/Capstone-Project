export interface ExternalJobCompany {
  id: string
  name: string
  provider: 'Greenhouse'
  careersUrl: string
}

export interface GreenhouseJobListing {
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

export interface GreenhouseJobRecord {
  id?: string | number
  internal_job_id?: string | number | null
  title?: string
  location?: { name?: string }
  absolute_url?: string
  updated_at?: string
  first_published?: string
  application_deadline?: string | null
  content?: string
  departments?: Array<{ name?: string }>
  offices?: Array<{ name?: string; location?: string }>
}

export class JobSourceError extends Error {
  readonly code: 'unavailable' | 'resource-exhausted' | 'not-found'

  constructor(code: 'unavailable' | 'resource-exhausted' | 'not-found', message: string) {
    super(message)
    this.code = code
    this.name = 'JobSourceError'
  }
}

export async function fetchGreenhouseJson(
  url: string,
  fetcher: typeof fetch = fetch,
): Promise<unknown> {
  let response: Response
  try {
    response = await fetcher(url, {
      headers: {Accept: 'application/json'},
      signal: AbortSignal.timeout(12_000),
    })
  } catch (error) {
    const message = error instanceof Error && error.name === 'TimeoutError'
      ? 'The careers source took too long to respond. Please retry.'
      : 'The careers source is temporarily unavailable. Please retry.'
    throw new JobSourceError('unavailable', message)
  }

  if (response.status === 429) {
    throw new JobSourceError('resource-exhausted', 'The careers source is rate-limiting requests. Wait briefly and retry.')
  }
  if (response.status === 404) {
    throw new JobSourceError('not-found', 'The company careers board or job is no longer available from this source.')
  }
  if (!response.ok) {
    throw new JobSourceError('unavailable', `The careers source returned status ${response.status}. Please retry later.`)
  }

  try {
    return await response.json()
  } catch {
    throw new JobSourceError('unavailable', 'The careers source returned an unreadable response.')
  }
}

export const GREENHOUSE_COMPANIES: ExternalJobCompany[] = [
  { id: 'stripe', name: 'Stripe', provider: 'Greenhouse', careersUrl: 'https://stripe.com/jobs' },
  { id: 'gitlab', name: 'GitLab', provider: 'Greenhouse', careersUrl: 'https://about.gitlab.com/jobs/' },
  { id: 'figma', name: 'Figma', provider: 'Greenhouse', careersUrl: 'https://www.figma.com/careers/' },
  { id: 'datadog', name: 'Datadog', provider: 'Greenhouse', careersUrl: 'https://careers.datadoghq.com/' },
  { id: 'coinbase', name: 'Coinbase', provider: 'Greenhouse', careersUrl: 'https://www.coinbase.com/careers' },
  { id: 'airbnb', name: 'Airbnb', provider: 'Greenhouse', careersUrl: 'https://careers.airbnb.com/' },
]

function decodeHtmlEntities(value: string): string {
  let decoded = value
  for (let pass = 0; pass < 3; pass += 1) {
    decoded = decoded
      .replace(/&nbsp;|&#160;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;|&apos;/gi, "'")
      .replace(/&#(\d+);/g, (_match, code: string) => String.fromCodePoint(Number(code)))
      .replace(/&#x([\da-f]+);/gi, (_match, code: string) => String.fromCodePoint(parseInt(code, 16)))
  }
  return decoded
}

export function greenhouseHtmlToText(value: string): string {
  const html = decodeHtmlEntities(value)
  return html
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\s*li\b[^>]*>/gi, '\n- ')
    .replace(/<\/(?:p|div|h[1-6]|ul|ol|li|tr)\s*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .split('\n')
    .map((line) => decodeHtmlEntities(line).replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n')
    .trim()
}

function safeSourceUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null
  try {
    const url = new URL(value)
    return url.protocol === 'https:' ? url.toString() : null
  } catch {
    return null
  }
}

export function normalizeGreenhouseJob(
  company: ExternalJobCompany,
  job: GreenhouseJobRecord,
  checkedAt: string,
  includeDescription = false,
): GreenhouseJobListing | null {
  const jobId = job.id === undefined || job.id === null ? '' : String(job.id)
  const title = typeof job.title === 'string' ? job.title.trim() : ''
  const sourceUrl = safeSourceUrl(job.absolute_url)
  if (!jobId || !title || !sourceUrl || job.internal_job_id === null) return null

  const closingDate = typeof job.application_deadline === 'string' && job.application_deadline.trim()
    ? job.application_deadline
    : null
  if (closingDate) {
    const deadline = Date.parse(closingDate)
    const checked = Date.parse(checkedAt)
    if (Number.isFinite(deadline) && Number.isFinite(checked) && deadline < checked) return null
  }

  const descriptionHtml = includeDescription && typeof job.content === 'string' ? job.content : undefined
  return {
    provider: 'Greenhouse',
    companyId: company.id,
    companyName: company.name,
    sourceJobId: jobId,
    title,
    location: job.location?.name?.trim() ?? '',
    sourceUrl,
    checkedAt,
    sourceUpdatedAt: typeof job.updated_at === 'string' ? job.updated_at : null,
    firstPublishedAt: typeof job.first_published === 'string' ? job.first_published : null,
    closingDate,
    ...(descriptionHtml !== undefined ? {
      descriptionHtml,
      descriptionText: greenhouseHtmlToText(descriptionHtml),
    } : {}),
    department: (job.departments ?? []).map((entry) => entry.name?.trim() ?? '').filter(Boolean),
    offices: (job.offices ?? []).map((entry) => entry.name?.trim() || entry.location?.trim() || '').filter(Boolean),
  }
}

export function normalizeGreenhouseJobs(
  company: ExternalJobCompany,
  jobs: GreenhouseJobRecord[],
  checkedAt: string,
): GreenhouseJobListing[] {
  const seen = new Set<string>()
  const normalized: GreenhouseJobListing[] = []
  for (const job of jobs) {
    const listing = normalizeGreenhouseJob(company, job, checkedAt)
    if (!listing || seen.has(listing.sourceJobId)) continue
    seen.add(listing.sourceJobId)
    normalized.push(listing)
  }
  return normalized.sort((left, right) => left.title.localeCompare(right.title))
}
