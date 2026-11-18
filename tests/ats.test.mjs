import assert from 'node:assert/strict'
import test from 'node:test'
import {
  JOB_ROLE_CATALOGUE,
  addATSJobRole,
  analyzeResume,
  detectContactInformation,
  detectResumeSections,
  detectSkills,
  extractRequirementsFromJobDescription,
  extendATSKeywordDictionary,
  parseJobDescription,
  validateResumeFile,
} from '../src/ats-engine.ts'

function makeFile(contents, name = 'resume.txt', type = 'text/plain') {
  return new File([contents], name, { type })
}

function assertScoreIsConsistent(analysis) {
  assert.equal(Object.values(analysis.scoreBreakdown).reduce((sum, value) => sum + value, 0), analysis.score)
}

test('1. fresher software resume is analyzed from its own content', () => {
  const resume = `OBJECTIVE\nFinal-year computer science student seeking an entry-level software role.\nEDUCATION\nBSc Computer Science, 2026.\nSKILLS\nPython, JavaScript, React, Git.\nPROJECTS\nBuilt a React project with JavaScript and Python.`
  const result = analyzeResume(resume, { mode: 'job', targetRole: 'Software Engineer' })
  assert.equal(result.candidateLevel, 'Student or early career')
  assert.ok(result.detectedSkills.some((skill) => skill.name === 'Python'))
  assert.ok(result.requirements.some((item) => item.name === 'Python' && item.status !== 'missing'))
  assertScoreIsConsistent(result)
})

test('2. experienced professional requirements use work evidence', () => {
  const resume = `SUMMARY\nSenior engineer with 8 years experience.\nSKILLS\nJava, AWS, Docker.\nWORK EXPERIENCE\nLed teams and delivered Java services with AWS and Docker.`
  const result = analyzeResume(resume, { mode: 'job', targetRole: 'Cloud Engineer' })
  assert.equal(result.candidateLevel, 'Experienced or returning professional')
  assert.ok(result.requirements.some((item) => item.name === 'AWS' && item.status === 'matched'))
  assertScoreIsConsistent(result)
})

test('3. data analyst job description requirements override unrelated role defaults', () => {
  const resume = `EDUCATION\nBachelor of Science in Economics.\nSKILLS\nExcel, Power BI, communication.\nPROJECTS\nCreated a Power BI sales dashboard.`
  const description = 'Required: Excel, Power BI, SQL, and 2 years experience. Bachelor degree preferred.'
  const extracted = extractRequirementsFromJobDescription(description)
  const result = analyzeResume(resume, { mode: 'job', targetRole: 'Data Analyst', jobDescription: description })
  assert.ok(extracted.some((item) => item.name === 'SQL'))
  assert.ok(result.requirements.some((item) => item.name === 'SQL' && item.status === 'missing'))
  assert.ok(result.requirements.some((item) => item.name === 'Power BI' && item.status !== 'missing'))
  assert.ok(!result.requirements.some((item) => item.name === 'Python'))
  assertScoreIsConsistent(result)
})

test('4. web development and software engineering require different skills', () => {
  const resume = `SKILLS\nJavaScript, HTML5, CSS3.\nPROJECTS\nCreated static web pages.`
  const software = analyzeResume(resume, { mode: 'job', targetRole: 'Software Engineer' })
  const web = analyzeResume(resume, { mode: 'job', targetRole: 'Web Developer' })
  assert.ok(!software.requirements.some((item) => item.name === 'React'))
  assert.ok(web.requirements.some((item) => item.name === 'React' && item.status === 'missing'))
  assert.ok(detectSkills('JavaScript').every((skill) => skill.name !== 'Java'))
})

test('5. non-technical business resume detects business and interpersonal skills', () => {
  const resume = `PROFILE\nCustomer-focused sales professional.\nSKILLS\nNegotiation, communication, customer service, sales, market research.\nACHIEVEMENTS\nExceeded quarterly sales targets.`
  const result = analyzeResume(resume, { mode: 'job', targetRole: 'Sales Representative' })
  assert.ok(result.detectedSkills.some((skill) => skill.name === 'Negotiation'))
  assert.ok(result.detectedSkills.some((skill) => skill.name === 'Customer Service'))
  assert.ok(result.requirements.some((item) => item.name === 'Sales' && item.status !== 'missing'))
  assert.ok(JOB_ROLE_CATALOGUE['Marketing Specialist'])
  assertScoreIsConsistent(result)
})

test('6. career changers are not assigned a false experience level', () => {
  const resume = `SUMMARY\nCareer transition into business analysis after nonprofit program coordination.\nSKILLS\nStakeholder management, communication, Excel.\nVOLUNTEERING\nCoordinated a community education program.`
  const result = analyzeResume(resume, { mode: 'general' })
  assert.equal(result.candidateLevel, 'Career transition')
  assert.ok(result.sectionsFound.includes('Volunteering'))
  assertScoreIsConsistent(result)
})

test('7. unusual headings, bullets, and common heading misspellings normalize safely', () => {
  const resume = `• OBJECTIVE\n1. EDUCATION:\nTECHNICAL SKILLS\nPROJECT EXPERIENCE\nEXTRA-CURRICULAR ACTIVITIES\nCERITIFICATIONS\nPUBLICATIONS\nRESEARCH\nLANGUAGES\nINTERESTS`
  assert.deepEqual(detectResumeSections(resume), [
    'Objective', 'Education', 'Skills', 'Projects', 'Extracurricular Activities',
    'Certifications', 'Publications', 'Research', 'Languages', 'Interests',
  ])
})

test('8. missing contact details are reported without inventing them', () => {
  const resume = `PROFILE\nOperations candidate.\nSKILLS\nExcel and customer service.`
  const result = analyzeResume(resume, { mode: 'general' })
  assert.deepEqual(result.contacts, { email: false, phone: false, linkedin: false })
  assert.ok(result.suggestions.some((suggestion) => suggestion.includes('email address')))
  assertScoreIsConsistent(result)
})

test('9. empty, corrupted, unsupported, and unreadable files fail with clear errors', async () => {
  await assert.rejects(validateResumeFile(makeFile('', 'empty.txt')), /empty/i)
  await assert.rejects(validateResumeFile(makeFile('not a pdf', 'broken.pdf', 'application/pdf')), /corrupted/i)
  await assert.rejects(validateResumeFile(makeFile('binary', 'resume.doc')), /Unsupported file type/i)
  assert.throws(() => analyzeResume('', { mode: 'general' }), /empty/i)
  assert.throws(() => analyzeResume('text with � replacement character', { mode: 'general' }), /unreadable/i)
})

test('10. same role produces candidate-specific and repeatable results', () => {
  const resumeA = `SKILLS\nPython, SQL, Excel, Power BI.\nPROJECTS\nBuilt a sales dashboard with SQL and Power BI.`
  const resumeB = `SKILLS\nCommunication, negotiation, sales.\nACHIEVEMENTS\nManaged a sales pipeline and exceeded targets.`
  const firstA = analyzeResume(resumeA, { mode: 'job', targetRole: 'Data Analyst' })
  const secondA = analyzeResume(resumeA, { mode: 'job', targetRole: 'Data Analyst' })
  const resultB = analyzeResume(resumeB, { mode: 'job', targetRole: 'Data Analyst' })
  assert.deepEqual(firstA, secondA)
  assert.notDeepEqual(firstA.requirements, resultB.requirements)
  assert.notEqual(firstA.score, resultB.score)
  assertScoreIsConsistent(firstA)
  assertScoreIsConsistent(resultB)
})

test('duplicate mentions and aliases do not multiply skill score', () => {
  const oneMention = `SKILLS\nJavaScript.\nPROJECTS\nBuilt with JavaScript.`
  const manyMentions = `SKILLS\nJavaScript, JS, JavaScript, js.\nPROJECTS\nBuilt with JavaScript JavaScript JS.`
  const a = analyzeResume(oneMention, { mode: 'general' })
  const b = analyzeResume(manyMentions, { mode: 'general' })
  assert.equal(a.scoreBreakdown.skills, b.scoreBreakdown.skills)
  const skillsOnly = analyzeResume('SKILLS\nJavaScript\nJavaScript\nJS', { mode: 'job', targetRole: 'Web Developer' })
  assert.equal(skillsOnly.requirements.find((requirement) => requirement.name === 'JavaScript')?.status, 'partial')
})

test('Java and JavaScript are distinct complete-phrase requirements', () => {
  const result = analyzeResume('SKILLS\nJavaScript', { mode: 'job', targetRole: 'Software Engineer' })
  assert.ok(result.requirements.some((item) => item.name === 'Java' && item.status === 'missing'))
  assert.ok(result.requirements.some((item) => item.name === 'JavaScript' && item.status !== 'missing'))
})

test('keyword and role catalogues can be extended without changing the scoring engine', () => {
  extendATSKeywordDictionary([{ name: 'Customer Relationship Management', category: 'Business Tools', aliases: ['crm platform', 'customer relationship management'] }])
  addATSJobRole('CRM Specialist', ['Customer Relationship Management'])
  const result = analyzeResume('SKILLS\nCRM platform', { mode: 'job', targetRole: 'CRM Specialist' })
  assert.ok(result.detectedSkills.some((skill) => skill.name === 'Customer Relationship Management'))
  assert.ok(result.requirements.some((item) => item.name === 'Customer Relationship Management' && item.status !== 'missing'))
  assertScoreIsConsistent(result)
  delete JOB_ROLE_CATALOGUE['CRM Specialist']
})

test('job descriptions retain explicit required and preferred distinctions', () => {
  const details = parseJobDescription(`Responsibilities:\n- Build and maintain reporting dashboards.\nRequired Qualifications:\n- Bachelor's degree\n- SQL and Tableau required\nPreferred Qualifications:\n- Python experience preferred\n- 3+ years of experience is a plus.`)
  assert.ok(details.requiredSkills.includes('SQL'))
  assert.ok(details.requiredSkills.includes('Tableau'))
  assert.ok(details.preferredSkills.includes('Python'))
  assert.ok(details.qualifications.some((item) => /bachelor/i.test(item)))
  assert.ok(details.responsibilities.some((item) => item.includes('reporting dashboards')))
  assert.ok(details.experienceExpectations.includes('3+ years experience'))
})
