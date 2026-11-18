import assert from 'node:assert/strict'
import test from 'node:test'
import {
  GREENHOUSE_COMPANIES,
  fetchGreenhouseJson,
  greenhouseHtmlToText,
  JobSourceError,
  normalizeGreenhouseJob,
  normalizeGreenhouseJobs,
} from '../functions/src/job-source.ts'
import {
  filterCompanyOptions,
  getCampusHireCompanyId,
  getCampusHirePublicationStatus,
  getCompanyOptions,
  isCampusHireJobOpen,
  matchesCampusHireCompany,
  mapCampusHireJob,
} from '../src/job-data.ts'

const checkedAt = '2026-10-09T12:00:00.000Z'
const company = GREENHOUSE_COMPANIES.find((entry) => entry.id === 'stripe')

assert.ok(company, 'Stripe must be in the verified provider catalogue')

test('company catalogue contains only the verified Greenhouse boards', () => {
  assert.deepEqual(GREENHOUSE_COMPANIES.map((entry) => entry.id), ['stripe', 'gitlab', 'figma', 'datadog', 'coinbase', 'airbnb'])
  assert.ok(GREENHOUSE_COMPANIES.every((entry) => entry.provider === 'Greenhouse' && entry.careersUrl.startsWith('https://')))
})

test('current Greenhouse records preserve source identifiers and real vacancy metadata', () => {
  const mapped = normalizeGreenhouseJob(company, {
    id: 123,
    internal_job_id: 456,
    title: 'Product Analyst',
    location: { name: 'Remote, United States' },
    absolute_url: 'https://boards.greenhouse.io/stripe/jobs/123',
    updated_at: '2026-10-08T10:00:00Z',
    application_deadline: '2026-10-31T23:59:00Z',
    content: '<h2>Responsibilities</h2><ul><li>Analyze data &amp; report findings</li></ul>',
  }, checkedAt, true)
  assert.ok(mapped)
  assert.equal(mapped.sourceJobId, '123')
  assert.equal(mapped.location, 'Remote, United States')
  assert.equal(mapped.closingDate, '2026-10-31T23:59:00Z')
  assert.equal(mapped.descriptionText, 'Responsibilities\n- Analyze data & report findings')
  assert.equal(mapped.checkedAt, checkedAt)
})

test('deduplication, prospect exclusion, expired jobs, and unsafe source URLs are enforced', () => {
  const records = [
    { id: 1, internal_job_id: 11, title: 'A', absolute_url: 'https://boards.greenhouse.io/stripe/jobs/1' },
    { id: '1', internal_job_id: 11, title: 'A duplicate', absolute_url: 'https://boards.greenhouse.io/stripe/jobs/1' },
    { id: 2, internal_job_id: null, title: 'General interest', absolute_url: 'https://boards.greenhouse.io/stripe/jobs/2' },
    { id: 3, internal_job_id: 33, title: 'Expired', absolute_url: 'https://boards.greenhouse.io/stripe/jobs/3', application_deadline: '2026-10-01T00:00:00Z' },
    { id: 4, internal_job_id: 44, title: 'Unsafe', absolute_url: 'http://boards.greenhouse.io/stripe/jobs/4' },
  ]
  const listings = normalizeGreenhouseJobs(company, records, checkedAt)
  assert.deepEqual(listings.map((listing) => listing.sourceJobId), ['1'])
})

test('HTML job content becomes readable text without losing its source HTML', () => {
  const html = '&amp;lt;p&amp;gt;Required skills&amp;lt;/p&amp;gt;&amp;lt;ul&amp;gt;&amp;lt;li&amp;gt;SQL&amp;lt;/li&amp;gt;&amp;lt;/ul&amp;gt;'
  assert.equal(greenhouseHtmlToText(html), 'Required skills\n- SQL')
})

test('company search keeps external and CampusHire sources distinct and hides closed internal postings', () => {
  const campusJob = {
    id: 'campus-1', companyId: 'org-1', companyName: 'Stripe', title: 'Campus Intern',
    description: 'Build data tools.', location: 'Remote', type: 'Internship', salary: 'Paid',
    minimumCgpa: 7, minCGPA: 7, eligibleBranches: ['CSE'], eligibleYears: [2027],
    postedAt: '2026-10-01T00:00:00Z', applicationStartDate: '2026-10-01', applicationDeadline: '2099-11-01',
    requiredSkills: ['SQL'], maxActiveBacklogs: 0, published: true, status: 'Open',
  }
  const closedJob = { ...campusJob, id: 'campus-2', status: 'Closed' }
  const options = getCompanyOptions([company], [campusJob, closedJob])
  assert.deepEqual(options.map((option) => option.source), ['CampusHire', 'Greenhouse'])
  assert.deepEqual(filterCompanyOptions(options, 'green'), [options.find((option) => option.source === 'Greenhouse')])
  assert.equal(isCampusHireJobOpen(closedJob), false)
  const listing = mapCampusHireJob(campusJob, checkedAt)
  assert.equal(listing.source, 'CampusHire')
  assert.equal(listing.sourceUrl, null)
  assert.ok(listing.descriptionText.includes('Minimum CGPA: 7'))
})

test('publication status closes unpublished or expired opportunities and supports republishing', () => {
  const now = new Date('2026-11-08T12:00:00.000Z').getTime()
  const opportunity = { applicationDeadline: '2026-11-30' }

  assert.equal(getCampusHirePublicationStatus(opportunity, false, now), 'Closed')
  assert.equal(getCampusHirePublicationStatus(opportunity, true, now), 'Open')
  assert.equal(getCampusHirePublicationStatus({ applicationDeadline: '2026-10-31' }, true, now), 'Closed')
  assert.equal(getCampusHirePublicationStatus({}, true, now), 'Open')
})

test('TPO opportunities sharing the generic company ID stay grouped by their actual organizations', () => {
  const makeInternalJob = (id, companyName) => ({
    id, companyId: 'tpo-admin', companyName, title: `${companyName} role`, description: 'Role description',
    location: 'On site', type: 'Placement', salary: 'As posted', minimumCgpa: 0, minCGPA: 0,
    eligibleBranches: [], eligibleYears: [], postedAt: checkedAt, requiredSkills: [],
    published: true, status: 'Open',
  })
  const alpha = makeInternalJob('internal-1', 'Alpha Ltd')
  const beta = makeInternalJob('internal-2', 'Beta Ltd')
  assert.notEqual(getCampusHireCompanyId(alpha), getCampusHireCompanyId(beta))
  assert.equal(matchesCampusHireCompany(alpha, getCampusHireCompanyId(alpha)), true)
  assert.equal(matchesCampusHireCompany(beta, getCampusHireCompanyId(alpha)), false)
  const options = getCompanyOptions([], [alpha, beta])
  assert.deepEqual(options.map((option) => option.name), ['Alpha Ltd', 'Beta Ltd'])
})

test('job-source request reports rate limits, missing boards, outages, network errors, and malformed JSON', async () => {
  const response = (status, json = async () => ({})) => ({ ok: status >= 200 && status < 300, status, json })
  assert.deepEqual(await fetchGreenhouseJson('https://example.test/jobs', async () => response(200, async () => ({ jobs: [] }))), { jobs: [] })
  await assert.rejects(fetchGreenhouseJson('https://example.test/jobs', async () => response(429)), (error) => error instanceof JobSourceError && error.code === 'resource-exhausted')
  await assert.rejects(fetchGreenhouseJson('https://example.test/jobs', async () => response(404)), (error) => error instanceof JobSourceError && error.code === 'not-found')
  await assert.rejects(fetchGreenhouseJson('https://example.test/jobs', async () => response(503)), (error) => error instanceof JobSourceError && error.code === 'unavailable')
  await assert.rejects(fetchGreenhouseJson('https://example.test/jobs', async () => { throw new TypeError('offline') }), /temporarily unavailable/i)
  await assert.rejects(fetchGreenhouseJson('https://example.test/jobs', async () => response(200, async () => { throw new SyntaxError('bad json') })), /unreadable response/i)
})
