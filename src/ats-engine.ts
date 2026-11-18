export type ATSAnalysisMode = 'general' | 'job'
export type RequirementStatus = 'matched' | 'partial' | 'missing'
export type RequirementCategory = 'skill' | 'qualification' | 'experience'
export type RequirementPriority = 'required' | 'preferred' | 'unspecified'

export interface DetectedSkill {
  name: string
  category: string
  evidence: string
}

export interface ResumeRequirement {
  name: string
  category: RequirementCategory
  priority?: RequirementPriority
  aliases: string[]
}

export interface RequirementResult extends ResumeRequirement {
  status: RequirementStatus
  evidence: string[]
}

export interface ATSAnalysisResult {
  mode: ATSAnalysisMode
  targetRole: string
  candidateLevel: string
  score: number
  scoreBreakdown: Record<string, number>
  scoreWeights: Record<string, number>
  scoreDescriptions: Record<string, string>
  detectedSkills: DetectedSkill[]
  sectionsFound: string[]
  contacts: { email: boolean; phone: boolean; linkedin: boolean }
  requirements: RequirementResult[]
  suggestions: string[]
  readability: { wordCount: number; lineCount: number; bulletCount: number; averageWordsPerLine: number }
}

export interface SkillDefinition {
  name: string
  category: string
  aliases: string[]
}

export const ATS_SKILL_DICTIONARY: SkillDefinition[] = [
  { name: 'Python', category: 'Programming', aliases: ['python'] },
  { name: 'Java', category: 'Programming', aliases: ['java'] },
  { name: 'JavaScript', category: 'Programming', aliases: ['javascript', 'java script', 'js'] },
  { name: 'TypeScript', category: 'Programming', aliases: ['typescript', 'ts'] },
  { name: 'C++', category: 'Programming', aliases: ['c++', 'cpp'] },
  { name: 'C#', category: 'Programming', aliases: ['c#', 'c sharp'] },
  { name: 'C', category: 'Programming', aliases: ['c language'] },
  { name: 'Go', category: 'Programming', aliases: ['golang'] },
  { name: 'Rust', category: 'Programming', aliases: ['rust'] },
  { name: 'PHP', category: 'Programming', aliases: ['php'] },
  { name: 'Ruby', category: 'Programming', aliases: ['ruby'] },
  { name: 'Swift', category: 'Programming', aliases: ['swift'] },
  { name: 'Kotlin', category: 'Programming', aliases: ['kotlin'] },
  { name: 'R', category: 'Programming', aliases: ['r programming'] },
  { name: 'SQL', category: 'Database', aliases: ['sql', 'mysql', 'my sql', 'postgresql', 'postgres', 'sqlite', 'tsql'] },
  { name: 'Oracle Database', category: 'Database', aliases: ['oracle database', 'oracle db'] },
  { name: 'MongoDB', category: 'Database', aliases: ['mongodb', 'mongo db'] },
  { name: 'Redis', category: 'Database', aliases: ['redis'] },
  { name: 'Firebase', category: 'Database', aliases: ['firebase', 'firestore'] },
  { name: 'HTML', category: 'Web', aliases: ['html', 'html5', 'html 5'] },
  { name: 'CSS', category: 'Web', aliases: ['css', 'css3', 'css 3'] },
  { name: 'React', category: 'Web', aliases: ['react', 'reactjs', 'react js'] },
  { name: 'Angular', category: 'Web', aliases: ['angular', 'angularjs'] },
  { name: 'Vue', category: 'Web', aliases: ['vue', 'vuejs'] },
  { name: 'Node.js', category: 'Web', aliases: ['node js', 'nodejs'] },
  { name: 'Next.js', category: 'Web', aliases: ['next js', 'nextjs'] },
  { name: 'Express', category: 'Web', aliases: ['express', 'expressjs'] },
  { name: 'Tailwind CSS', category: 'Web', aliases: ['tailwind css', 'tailwind'] },
  { name: 'REST APIs', category: 'Web', aliases: ['rest api', 'rest apis', 'restful api', 'restful apis'] },
  { name: 'GraphQL', category: 'Web', aliases: ['graphql'] },
  { name: 'AWS', category: 'Cloud', aliases: ['aws', 'amazon web services'] },
  { name: 'Microsoft Azure', category: 'Cloud', aliases: ['azure', 'microsoft azure'] },
  { name: 'Google Cloud', category: 'Cloud', aliases: ['gcp', 'google cloud platform', 'google cloud'] },
  { name: 'Docker', category: 'Cloud', aliases: ['docker', 'containerization'] },
  { name: 'Kubernetes', category: 'Cloud', aliases: ['kubernetes', 'k8s'] },
  { name: 'Terraform', category: 'Cloud', aliases: ['terraform'] },
  { name: 'Linux', category: 'Systems', aliases: ['linux'] },
  { name: 'Git', category: 'Tools', aliases: ['git', 'github', 'gitlab', 'version control'] },
  { name: 'CI/CD', category: 'Tools', aliases: ['ci cd', 'continuous integration', 'continuous deployment'] },
  { name: 'Jenkins', category: 'Tools', aliases: ['jenkins'] },
  { name: 'Selenium', category: 'Testing', aliases: ['selenium'] },
  { name: 'Playwright', category: 'Testing', aliases: ['playwright'] },
  { name: 'Cypress', category: 'Testing', aliases: ['cypress'] },
  { name: 'Jest', category: 'Testing', aliases: ['jest'] },
  { name: 'Test Automation', category: 'Testing', aliases: ['test automation', 'automated testing', 'automation testing'] },
  { name: 'Manual Testing', category: 'Testing', aliases: ['manual testing', 'manual QA'] },
  { name: 'Quality Assurance', category: 'Testing', aliases: ['quality assurance', 'software QA'] },
  { name: 'Data Analysis', category: 'Analytics', aliases: ['data analysis', 'data analytics'] },
  { name: 'Data Visualization', category: 'Analytics', aliases: ['data visualization', 'data visualisation'] },
  { name: 'Power BI', category: 'Analytics', aliases: ['power bi', 'powerbi'] },
  { name: 'Tableau', category: 'Analytics', aliases: ['tableau'] },
  { name: 'Excel', category: 'Analytics', aliases: ['excel', 'microsoft excel', 'spreadsheets'] },
  { name: 'Pandas', category: 'Analytics', aliases: ['pandas'] },
  { name: 'NumPy', category: 'Analytics', aliases: ['numpy'] },
  { name: 'Statistics', category: 'Analytics', aliases: ['statistics', 'statistical analysis'] },
  { name: 'Machine Learning', category: 'Analytics', aliases: ['machine learning', 'ml'] },
  { name: 'OpenCV', category: 'Analytics', aliases: ['opencv', 'open cv'] },
  { name: 'Financial Analysis', category: 'Finance', aliases: ['financial analysis', 'financial modelling', 'financial modeling'] },
  { name: 'Accounting', category: 'Finance', aliases: ['accounting', 'bookkeeping'] },
  { name: 'Budgeting', category: 'Finance', aliases: ['budgeting', 'budget management'] },
  { name: 'Forecasting', category: 'Finance', aliases: ['forecasting', 'financial forecasting'] },
  { name: 'Sales', category: 'Business', aliases: ['sales', 'business development'] },
  { name: 'Negotiation', category: 'Business', aliases: ['negotiation', 'contract negotiation'] },
  { name: 'Marketing', category: 'Business', aliases: ['marketing', 'digital marketing'] },
  { name: 'SEO', category: 'Business', aliases: ['seo', 'search engine optimization', 'search engine optimisation'] },
  { name: 'Content Writing', category: 'Business', aliases: ['content writing', 'copywriting'] },
  { name: 'Market Research', category: 'Business', aliases: ['market research', 'competitive analysis'] },
  { name: 'Human Resources', category: 'Business', aliases: ['human resources', 'hr', 'recruitment', 'talent acquisition'] },
  { name: 'Project Management', category: 'Business', aliases: ['project management', 'project planning'] },
  { name: 'Business Analysis', category: 'Business', aliases: ['business analysis', 'business analyst'] },
  { name: 'Communication', category: 'Interpersonal', aliases: ['communication', 'written communication', 'verbal communication'] },
  { name: 'Leadership', category: 'Interpersonal', aliases: ['leadership', 'team leadership'] },
  { name: 'Teamwork', category: 'Interpersonal', aliases: ['teamwork', 'team collaboration', 'collaboration'] },
  { name: 'Customer Service', category: 'Interpersonal', aliases: ['customer service', 'customer support', 'client support'] },
  { name: 'Stakeholder Management', category: 'Interpersonal', aliases: ['stakeholder management', 'stakeholder engagement'] },
  { name: 'Problem Solving', category: 'Interpersonal', aliases: ['problem solving', 'problem-solving', 'analytical thinking'] },
  { name: 'Presentation', category: 'Interpersonal', aliases: ['presentation skills', 'presentations'] },
  { name: 'Research', category: 'Research', aliases: ['research', 'literature review'] },
  { name: 'Data Structures', category: 'Computer Science', aliases: ['data structures', 'data structure', 'dsa'] },
  { name: 'Algorithms', category: 'Computer Science', aliases: ['algorithms', 'algorithm', 'dsa'] },
  { name: 'Object-Oriented Programming', category: 'Computer Science', aliases: ['oop', 'object oriented programming', 'object-oriented programming'] },
  { name: 'CRUD Operations', category: 'Database', aliases: ['crud operations', 'crud operation', 'crud'] },
  { name: 'Database Joins', category: 'Database', aliases: ['database joins', 'sql joins', 'joins'] },
  { name: 'Subqueries', category: 'Database', aliases: ['subqueries', 'subquery'] },
  { name: 'DBMS', category: 'Database', aliases: ['dbms', 'database management systems'] },
]

export function extendATSKeywordDictionary(definitions: SkillDefinition[]): void {
  for (const definition of definitions) {
    const existing = ATS_SKILL_DICTIONARY.find((skill) => normalizeText(skill.name) === normalizeText(definition.name))
    if (existing) {
      existing.aliases = [...new Set([...existing.aliases, ...definition.aliases])]
    } else {
      ATS_SKILL_DICTIONARY.push({ ...definition, aliases: [...definition.aliases] })
    }
  }
}

export const JOB_ROLE_CATALOGUE: Record<string, string[]> = {
  'Software Engineer': ['Python', 'Java', 'JavaScript', 'C++', 'Data Structures', 'Algorithms', 'Object-Oriented Programming', 'SQL', 'Git', 'REST APIs'],
  'Web Developer': ['HTML', 'CSS', 'JavaScript', 'React', 'Node.js', 'REST APIs', 'Git'],
  'Frontend Developer': ['HTML', 'CSS', 'JavaScript', 'React', 'TypeScript', 'Accessibility', 'Responsive Design'],
  'Backend Developer': ['Python', 'Java', 'Node.js', 'SQL', 'REST APIs', 'Docker', 'Authentication'],
  'Data Analyst': ['SQL', 'Excel', 'Data Analysis', 'Data Visualization', 'Statistics', 'Power BI', 'Tableau'],
  'Data Scientist': ['Python', 'SQL', 'Statistics', 'Pandas', 'NumPy', 'Machine Learning'],
  'Cybersecurity Analyst': ['Cybersecurity', 'Networking', 'Linux', 'Risk Assessment', 'Incident Response'],
  'Cloud Engineer': ['AWS', 'Microsoft Azure', 'Google Cloud', 'Docker', 'Kubernetes', 'Terraform', 'Linux'],
  'QA / Test Engineer': ['Quality Assurance', 'Manual Testing', 'Test Automation', 'Selenium', 'Playwright', 'Cypress'],
  'Business Analyst': ['Business Analysis', 'Requirements Gathering', 'Data Analysis', 'Stakeholder Management', 'Communication'],
  'Marketing Specialist': ['Marketing', 'SEO', 'Content Writing', 'Market Research', 'Data Analysis', 'Communication'],
  'Finance Analyst': ['Financial Analysis', 'Accounting', 'Budgeting', 'Forecasting', 'Excel'],
  'Human Resources': ['Human Resources', 'Recruitment', 'Talent Acquisition', 'Communication', 'Stakeholder Management'],
  'Sales Representative': ['Sales', 'Negotiation', 'Customer Service', 'Communication', 'Business Development'],
  'Project Manager': ['Project Management', 'Leadership', 'Stakeholder Management', 'Communication', 'Risk Assessment'],
  'UX Designer': ['User Research', 'Figma', 'Prototyping', 'Usability Testing', 'Communication'],
  'IT Support Specialist': ['Troubleshooting', 'Customer Service', 'Networking', 'Windows', 'Communication'],
  'Operations Coordinator': ['Project Management', 'Communication', 'Excel', 'Process Improvement', 'Stakeholder Management'],
}

export function addATSJobRole(role: string, requirements: string[]): void {
  const normalizedRole = role.trim()
  if (normalizedRole) JOB_ROLE_CATALOGUE[normalizedRole] = [...new Set(requirements.map((requirement) => requirement.trim()).filter(Boolean))]
}

const ROLE_ALIASES: Record<string, string[]> = {
  'Frontend Developer': ['HTML', 'CSS', 'JavaScript', 'React', 'TypeScript'],
  'Cybersecurity Analyst': ['Security', 'Networking', 'Linux', 'Risk Assessment', 'Incident Response'],
  'Business Analyst': ['Requirements Gathering', 'Process Mapping', 'Stakeholder Management', 'Documentation'],
  'QA / Test Engineer': ['Test Automation', 'Manual Testing', 'Quality Assurance'],
  'UX Designer': ['User Research', 'Usability Testing', 'Figma', 'Prototyping'],
  'IT Support Specialist': ['Troubleshooting', 'Windows', 'Networking', 'Customer Service'],
}

const SECTION_ALIASES: Record<string, string[]> = {
  Objective: ['objective', 'career objective', 'professional objective'],
  Summary: ['summary', 'professional summary', 'executive summary', 'profile', 'about me', 'career profile'],
  Education: ['education', 'academic background', 'academics', 'educational background', 'qualifications'],
  Skills: ['skills', 'technical skills', 'core skills', 'key skills', 'technical competencies', 'core competencies', 'areas of expertise'],
  Projects: ['projects', 'project experience', 'academic projects', 'personal projects', 'selected projects'],
  'Work Experience': ['experience', 'work experience', 'professional experience', 'employment history', 'work history', 'career history'],
  Internships: ['internships', 'internship experience', 'internship'],
  Certifications: ['certifications', 'certificates', 'professional certifications', 'licenses', 'licences', 'ceritifications', 'certfications', 'certifications and licenses'],
  Achievements: ['achievements', 'awards', 'accomplishments', 'honors', 'honours'],
  Leadership: ['leadership', 'leadership experience'],
  Volunteering: ['volunteering', 'volunteer experience', 'community involvement', 'community service'],
  'Extracurricular Activities': ['extracurricular activities', 'extra curricular activities', 'extracurricular', 'extra curricular', 'activities'],
  Publications: ['publications', 'selected publications'],
  Research: ['research', 'research experience', 'research projects'],
  Languages: ['languages', 'language skills'],
  Interests: ['interests', 'hobbies', 'personal interests'],
}

const HEADING_MISSPELLINGS: Record<string, string> = {
  ceritifications: 'certifications',
  certfications: 'certifications',
  certificaitons: 'certifications',
  acheivements: 'achievements',
  achievments: 'achievements',
  experiance: 'experience',
  educaton: 'education',
  skils: 'skills',
  internhsips: 'internships',
}

const QUALIFICATION_PATTERNS = [
  /\b(?:bachelor(?:'s)?|master(?:'s)?|associate(?:'s)?|doctorate|phd|mba|b\.?\s?tech|m\.?\s?tech|b\.?\s?sc|m\.?\s?sc|b\.?\s?com|m\.?\s?com|degree|diploma|certification|licensed|license|licence)\b/gi,
]
const EXPERIENCE_REQUIREMENT_PATTERN = /\b(\d{1,2})\s*\+?\s*(?:years?|yrs?)\s+(?:of\s+)?(?:relevant\s+)?experience\b/gi

export interface ParsedJobDescription {
  requiredSkills: string[]
  preferredSkills: string[]
  unspecifiedSkills: string[]
  qualifications: string[]
  requiredQualifications: string[]
  preferredQualifications: string[]
  unspecifiedQualifications: string[]
  responsibilities: string[]
  experienceExpectations: string[]
  requiredExperienceExpectations: string[]
  preferredExperienceExpectations: string[]
  unspecifiedExperienceExpectations: string[]
  missingInformation: string[]
}

export function normalizeText(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/object[- ]oriented/g, 'object oriented')
    .replace(/[^\p{L}\p{N}+#]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function hasPhrase(normalizedText: string, phrase: string): boolean {
  const normalizedPhrase = normalizeText(phrase)
  if (!normalizedPhrase) return false
  return ` ${normalizedText} `.includes(` ${normalizedPhrase} `)
}

function getHeadingText(line: string): string {
  const cleaned = line
    .replace(/^\s*(?:[•*▪◦‣–—-]+|\d+[.)])\s*/, '')
    .replace(/\s+/g, ' ')
    .trim()
  const delimiter = cleaned.search(/\s(?:\||:|—|–)\s|:/)
  return normalizeText(delimiter > -1 ? cleaned.slice(0, delimiter) : cleaned)
}

export function detectResumeSections(text: string): string[] {
  const aliases = new Map<string, string>()
  for (const [section, names] of Object.entries(SECTION_ALIASES)) {
    for (const name of names) aliases.set(normalizeText(name), section)
  }

  const found = new Set<string>()
  for (const line of text.split(/\r?\n/)) {
    const heading = getHeadingText(line)
    const normalizedHeading = HEADING_MISSPELLINGS[heading] ?? heading
    const section = aliases.get(normalizedHeading)
    if (section) found.add(section)
  }
  return [...found]
}

function findEvidenceLines(text: string, aliases: string[]): string[] {
  const normalizedAliases = aliases.map(normalizeText).filter(Boolean)
  return text.split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && normalizedAliases.some((alias) => hasPhrase(normalizeText(line), alias)))
    .map((line) => line.slice(0, 200))
}

export function detectSkills(text: string): DetectedSkill[] {
  const normalizedText = normalizeText(text)
  const found: DetectedSkill[] = []
  for (const definition of ATS_SKILL_DICTIONARY) {
    const alias = definition.aliases.find((candidate) => hasPhrase(normalizedText, candidate))
    if (alias) {
      found.push({
        name: definition.name,
        category: definition.category,
        evidence: findEvidenceLines(text, [alias])[0] ?? '',
      })
    }
  }
  return found
}

export function extractRecognizedResumeSkills(text: string): string[] {
  return detectSkills(text).map((skill) => skill.name)
}

export function detectContactInformation(text: string): { email: boolean; phone: boolean; linkedin: boolean } {
  const email = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(text)
  const phoneCandidates = text.match(/\+?\d[\d\s().-]{7,}\d/g) ?? []
  const phone = phoneCandidates.some((candidate) => {
    const digitCount = candidate.replace(/\D/g, '').length
    return digitCount >= 10 && digitCount <= 15
  })
  const linkedin = /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/(?:in|pub)\/[a-z0-9%._/-]+/i.test(text)
  return { email, phone, linkedin }
}

export const MAX_RESUME_FILE_SIZE = 10 * 1024 * 1024

export async function validateResumeFile(file: File): Promise<void> {
  const extension = file.name.toLowerCase().split('.').pop()
  if (!extension || !['pdf', 'docx', 'txt'].includes(extension)) {
    throw new Error('Unsupported file type. Upload a PDF, DOCX, or TXT resume.')
  }
  if (file.size === 0) throw new Error('The selected resume file is empty.')
  if (file.size > MAX_RESUME_FILE_SIZE) throw new Error('Resume files must be 10 MB or smaller.')

  const type = file.type.toLowerCase()
  const knownTypes: Record<string, string[]> = {
    pdf: ['application/pdf', 'application/octet-stream', ''],
    docx: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/octet-stream', ''],
    txt: ['text/plain', 'application/octet-stream', ''],
  }
  if (!knownTypes[extension].includes(type)) {
    throw new Error(`The file type does not match its .${extension} extension.`)
  }

  const header = new Uint8Array(await file.slice(0, 8).arrayBuffer())
  if (extension === 'pdf' && new TextDecoder().decode(header.slice(0, 5)) !== '%PDF-') {
    throw new Error('This PDF appears to be corrupted or is not a valid PDF file.')
  }
  if (extension === 'docx' && !(header[0] === 0x50 && header[1] === 0x4b)) {
    throw new Error('This DOCX file appears to be corrupted or is not a valid Word document.')
  }
  const isUtf16Bom = header[0] === 0xff && header[1] === 0xfe || header[0] === 0xfe && header[1] === 0xff
  if (extension === 'txt' && header.includes(0) && !isUtf16Bom) {
    throw new Error('This TXT file contains binary data and cannot be read as plain text.')
  }
}

export function extractRequirementsFromJobDescription(description: string): ResumeRequirement[] {
  const requirements = new Map<string, ResumeRequirement>()
  const lines = getJobDescriptionLines(description)
  for (const skill of detectSkills(description)) {
    const definition = ATS_SKILL_DICTIONARY.find((entry) => entry.name === skill.name)
    if (definition) requirements.set(normalizeText(skill.name), {
      name: skill.name,
      category: 'skill',
      priority: getDescriptionPriority(lines, definition.aliases),
      aliases: definition.aliases,
    })
  }

  for (const pattern of QUALIFICATION_PATTERNS) {
    for (const match of description.matchAll(pattern)) {
      const name = match[0].trim()
      requirements.set(normalizeText(name), {
        name,
        category: 'qualification',
        priority: getDescriptionPriority(lines, [name]),
        aliases: [name],
      })
    }
  }

  EXPERIENCE_REQUIREMENT_PATTERN.lastIndex = 0
  for (const match of description.matchAll(EXPERIENCE_REQUIREMENT_PATTERN)) {
    const name = `${match[1]}+ years experience`
    requirements.set(normalizeText(name), {
      name,
      category: 'experience',
      priority: getDescriptionPriority(lines, [match[0]]),
      aliases: [name, match[0]],
    })
  }

  return [...requirements.values()]
}

interface JobDescriptionLine {
  text: string
  priority: RequirementPriority
  section: 'responsibilities' | 'qualifications' | 'other'
}

function getJobDescriptionLines(description: string): JobDescriptionLine[] {
  const lines: JobDescriptionLine[] = []
  let priority: RequirementPriority = 'unspecified'
  let section: JobDescriptionLine['section'] = 'other'
  for (const rawLine of description.split(/\r?\n/)) {
    const text = rawLine.replace(/^\s*(?:[•*▪◦‣-]+|\d+[.)])\s*/, '').trim()
    const heading = normalizeText(text.replace(/:$/, ''))
    if (!heading) continue

    if (/\b(preferred|nice to have|bonus|desired)\b/.test(heading)) priority = 'preferred'
    else if (/\b(required|minimum|must have|basic qualifications)\b/.test(heading)) priority = 'required'

    if (/\b(responsibilities|what you will do|what you ll do|role duties)\b/.test(heading)) {
      section = 'responsibilities'
      priority = 'unspecified'
      continue
    }
    if (/\b(qualifications|requirements|what you bring|what we re looking for|what you ll bring)\b/.test(heading)) {
      section = 'qualifications'
      if (!/\b(preferred|nice to have|bonus|desired|required|minimum|must have|basic)\b/.test(heading)) priority = 'unspecified'
      continue
    }
    if (/^(required|preferred) (skills|qualifications)$/.test(heading)) {
      section = 'qualifications'
      priority = heading.startsWith('preferred') ? 'preferred' : 'required'
      continue
    }
    if (/^(about|about the role|benefits|what we offer|equal opportunity|company overview)$/.test(heading)) {
      section = 'other'
      priority = 'unspecified'
      continue
    }
    lines.push({ text, priority, section })
  }
  return lines
}

function getDescriptionPriority(lines: JobDescriptionLine[], aliases: string[]): RequirementPriority {
  const matching = lines.filter((line) => aliases.some((alias) => hasPhrase(normalizeText(line.text), alias)))
  if (matching.some((line) => line.priority === 'required')) return 'required'
  if (matching.some((line) => line.priority === 'preferred')) return 'preferred'
  return 'unspecified'
}

export function parseJobDescription(description: string): ParsedJobDescription {
  const lines = getJobDescriptionLines(description)
  const requirements = extractRequirementsFromJobDescription(description)
  const skills = requirements.filter((requirement) => requirement.category === 'skill')
  const qualificationRequirements = requirements.filter((requirement) => requirement.category === 'qualification')
  const experienceRequirements = requirements.filter((requirement) => requirement.category === 'experience')
  const qualifications = qualificationRequirements.map((requirement) => requirement.name)
  const experienceExpectations = experienceRequirements.map((requirement) => requirement.name)
  const responsibilities = lines
    .filter((line) => line.section === 'responsibilities' && line.text.length > 12)
    .map((line) => line.text)
    .slice(0, 20)
  const missingInformation: string[] = []
  if (skills.length === 0) missingInformation.push('No recognizable skills or tools were identified.')
  if (qualifications.length === 0) missingInformation.push('No explicit education or certification requirements were identified.')
  if (experienceExpectations.length === 0) missingInformation.push('No numeric experience expectation was identified.')
  if (responsibilities.length === 0) missingInformation.push('No clearly labeled responsibilities section was identified.')
  return {
    requiredSkills: skills.filter((skill) => skill.priority === 'required').map((skill) => skill.name),
    preferredSkills: skills.filter((skill) => skill.priority === 'preferred').map((skill) => skill.name),
    unspecifiedSkills: skills.filter((skill) => skill.priority === 'unspecified').map((skill) => skill.name),
    qualifications,
    requiredQualifications: qualificationRequirements.filter((item) => item.priority === 'required').map((item) => item.name),
    preferredQualifications: qualificationRequirements.filter((item) => item.priority === 'preferred').map((item) => item.name),
    unspecifiedQualifications: qualificationRequirements.filter((item) => item.priority === 'unspecified').map((item) => item.name),
    responsibilities,
    experienceExpectations,
    requiredExperienceExpectations: experienceRequirements.filter((item) => item.priority === 'required').map((item) => item.name),
    preferredExperienceExpectations: experienceRequirements.filter((item) => item.priority === 'preferred').map((item) => item.name),
    unspecifiedExperienceExpectations: experienceRequirements.filter((item) => item.priority === 'unspecified').map((item) => item.name),
    missingInformation,
  }
}

function getRoleRequirements(role: string): ResumeRequirement[] {
  const names = [...(JOB_ROLE_CATALOGUE[role] ?? []), ...(ROLE_ALIASES[role] ?? [])]
  const requirements = new Map<string, ResumeRequirement>()
  for (const name of names) {
    const normalized = normalizeText(name)
    const definition = ATS_SKILL_DICTIONARY.find((skill) => normalizeText(skill.name) === normalized || skill.aliases.some((alias) => normalizeText(alias) === normalized))
    requirements.set(normalized, {
      name,
      category: 'skill',
      priority: 'required',
      aliases: definition?.aliases ?? [name],
    })
  }
  return [...requirements.values()]
}

function inferCandidateLevel(text: string, sections: string[]): string {
  const normalized = normalizeText(text)
  const yearMatches = [...normalized.matchAll(/\b(\d{1,2})\s+years?\b/g)].map((match) => Number(match[1]))
  if (yearMatches.some((years) => years >= 3) || sections.includes('Work Experience')) return 'Experienced or returning professional'
  if (/\b(fresher|new graduate|recent graduate|final year|student|entry level|entry-level)\b/.test(normalized)) return 'Student or early career'
  if (/\b(career change|career transition|transitioning into|career changer)\b/.test(normalized)) return 'Career transition'
  return 'Not specified'
}

function getRequirementResults(text: string, requirements: ResumeRequirement[]): RequirementResult[] {
  const linesWithSections: Array<{ line: string; section: string }> = []
  let currentSection = ''
  for (const line of text.split(/\r?\n/)) {
    const heading = detectResumeSections(line)[0]
    if (heading) {
      currentSection = heading
      const inlineContent = line.includes(':') ? line.slice(line.indexOf(':') + 1).trim() : ''
      if (inlineContent) linesWithSections.push({ line: inlineContent, section: currentSection })
    } else if (line.trim()) {
      linesWithSections.push({ line: line.trim(), section: currentSection })
    }
  }
  const actualExperience = Math.max(0, ...[...normalizeText(text).matchAll(/\b(\d{1,2})\s+years?\b/g)].map((match) => Number(match[1])))
  return requirements.map((requirement) => {
    const matchingLines = linesWithSections.filter(({ line }) => requirement.aliases.some((alias) => hasPhrase(normalizeText(line), alias)))
    const evidence = matchingLines.map(({ line }) => line.slice(0, 200))
    if (requirement.category === 'experience') {
      const expected = Number(requirement.name.match(/\d+/)?.[0] ?? 0)
      const status: RequirementStatus = actualExperience >= expected ? 'matched' : actualExperience > 0 ? 'partial' : 'missing'
      return { ...requirement, status, evidence: status === 'missing' ? [] : evidence }
    }
    if (evidence.length === 0) return { ...requirement, status: 'missing', evidence: [] }
    if (requirement.category === 'qualification') return { ...requirement, status: 'matched', evidence }

    const demonstrated = matchingLines.some(({ section }) => ['Projects', 'Work Experience', 'Internships', 'Research'].includes(section))
    return { ...requirement, status: demonstrated ? 'matched' : 'partial', evidence }
  })
}

function getReadability(text: string): ATSAnalysisResult['readability'] {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  const words = normalizeText(text).split(' ').filter(Boolean)
  const bulletCount = lines.filter((line) => /^(?:[•*▪◦‣-]|\d+[.)])\s+/.test(line)).length
  return {
    wordCount: words.length,
    lineCount: lines.length,
    bulletCount,
    averageWordsPerLine: lines.length ? Math.round(words.length / lines.length) : 0,
  }
}

function allocateScore(raw: Record<string, number>): { score: number; breakdown: Record<string, number> } {
  const floors = Object.fromEntries(Object.entries(raw).map(([key, value]) => [key, Math.floor(value)]))
  const total = Math.round(Object.values(raw).reduce((sum, value) => sum + value, 0))
  const remainderOrder = Object.keys(raw).sort((a, b) => raw[b] % 1 - raw[a] % 1)
  const remainder = total - Object.values(floors).reduce((sum, value) => sum + value, 0)
  for (const category of remainderOrder.slice(0, remainder)) floors[category] += 1
  return { score: total, breakdown: floors }
}

function getPriorityWeight(requirement: ResumeRequirement): number {
  if (requirement.priority === 'preferred') return 0.35
  if (requirement.priority === 'unspecified') return 0.65
  return 1
}

const GENERAL_WEIGHTS = { structure: 25, contacts: 15, skills: 25, readability: 20, completeness: 15 }
const GENERAL_DESCRIPTIONS = {
  structure: 'Recognized resume sections and clear organization; no particular section is required for every career stage.',
  contacts: 'Detection of email, phone number, and professional LinkedIn URL.',
  skills: 'Distinct skills found in the resume; repeats and aliases count only once.',
  readability: 'Text length per line, bullet use, and scan-friendly formatting indicators.',
  completeness: 'Presence of enough resume content to review; not a measure of candidate quality.',
}
const JOB_WEIGHTS = { requirements: 45, skills: 20, qualifications: 15, evidence: 10, completeness: 10 }
const JOB_DESCRIPTIONS = {
  requirements: 'Matched and partially matched requirements from the job description or selected role.',
  skills: 'Distinct relevant skills evidenced in the resume, counted once each.',
  qualifications: 'Education and certifications required by the provided job description.',
  evidence: 'Supporting project, internship, work, or research evidence for required skills.',
  completeness: 'Resume content available for a fair comparison.',
}

export function analyzeResume(text: string, options: {
  mode: ATSAnalysisMode
  targetRole?: string
  jobDescription?: string
}): ATSAnalysisResult {
  if (!text.trim()) throw new Error('Resume text is empty. Upload a readable PDF, DOCX, or TXT file.')
  if (text.includes('\ufffd')) throw new Error('Resume text contains unreadable characters. Re-save the document as UTF-8 and upload it again.')

  const sectionsFound = detectResumeSections(text)
  const detectedSkills = detectSkills(text)
  const contacts = detectContactInformation(text)
  const readability = getReadability(text)
  const candidateLevel = inferCandidateLevel(text, sectionsFound)
  const targetRole = options.targetRole?.trim() || ''
  const jobDescription = options.jobDescription?.trim() || ''
  const requirements = options.mode === 'job'
    ? jobDescription
      ? extractRequirementsFromJobDescription(jobDescription)
      : getRoleRequirements(targetRole)
    : []
  const requirementResults = getRequirementResults(text, requirements)
  let weights: Record<string, number>
  let descriptions: Record<string, string>
  let raw: Record<string, number>

  if (options.mode === 'general') {
    const structure = Math.min(GENERAL_WEIGHTS.structure, (sectionsFound.length / 5) * GENERAL_WEIGHTS.structure)
    const contactsScore = ((Number(contacts.email) + Number(contacts.phone) + Number(contacts.linkedin)) / 3) * GENERAL_WEIGHTS.contacts
    const skillsScore = Math.min(GENERAL_WEIGHTS.skills, (detectedSkills.length / 6) * GENERAL_WEIGHTS.skills)
    const averageWords = readability.averageWordsPerLine
    const lineReadability = readability.lineCount === 0 ? 0 : averageWords <= 18 ? 20 : Math.max(4, 20 - (averageWords - 18) * 0.7)
    const bulletReadability = readability.bulletCount > 0 || readability.lineCount < 8 ? 0 : 3
    const readabilityScore = Math.max(0, Math.min(GENERAL_WEIGHTS.readability, lineReadability - bulletReadability))
    const completeness = readability.wordCount >= 120 && readability.wordCount <= 1200
      ? 15
      : readability.wordCount >= 50
        ? 9
        : readability.wordCount > 1200
          ? 12
          : 3
    weights = { ...GENERAL_WEIGHTS }
    descriptions = { ...GENERAL_DESCRIPTIONS }
    raw = { structure, contacts: contactsScore, skills: skillsScore, readability: readabilityScore, completeness }
  } else {
    const skillRequirements = requirementResults.filter((requirement) => requirement.category === 'skill')
    const qualificationRequirements = requirementResults.filter((requirement) => requirement.category === 'qualification')
    const requirementWeight = requirementResults.reduce((sum, requirement) => sum + getPriorityWeight(requirement), 0)
    const coverage = requirementResults.length
      ? requirementResults.reduce((sum, requirement) => sum + (requirement.status === 'matched' ? 1 : requirement.status === 'partial' ? 0.5 : 0) * getPriorityWeight(requirement), 0) / requirementWeight
      : 0
    const skillWeight = skillRequirements.reduce((sum, requirement) => sum + getPriorityWeight(requirement), 0)
    const skillMatches = skillRequirements.reduce((sum, requirement) => sum + (requirement.status === 'matched' ? 1 : requirement.status === 'partial' ? 0.5 : 0) * getPriorityWeight(requirement), 0)
    const evidenceMatches = requirementResults.filter((requirement) => requirement.status === 'matched' && requirement.evidence.length > 0).length
    const qualificationWeight = qualificationRequirements.reduce((sum, requirement) => sum + getPriorityWeight(requirement), 0)
    const matchedQualifications = qualificationRequirements.reduce((sum, requirement) => sum + (requirement.status === 'matched' ? 1 : requirement.status === 'partial' ? 0.5 : 0) * getPriorityWeight(requirement), 0)
    const completeness = readability.wordCount >= 120 ? 10 : readability.wordCount >= 50 ? 6 : 2
    weights = { ...JOB_WEIGHTS }
    descriptions = { ...JOB_DESCRIPTIONS }
    if (qualificationRequirements.length === 0) {
      weights = { requirements: 50, skills: 25, qualifications: 0, evidence: 15, completeness: 10 }
    }
    raw = {
      requirements: coverage * weights.requirements,
      skills: skillWeight ? (skillMatches / skillWeight) * weights.skills : 0,
      qualifications: qualificationWeight
        ? (matchedQualifications / qualificationWeight) * weights.qualifications
        : 0,
      evidence: requirementResults.length ? (evidenceMatches / requirementResults.length) * weights.evidence : 0,
      completeness,
    }
  }

  const allocated = allocateScore(raw)
  return {
    mode: options.mode,
    targetRole: options.mode === 'job' ? targetRole || 'Job description' : 'General review',
    candidateLevel,
    score: allocated.score,
    scoreBreakdown: allocated.breakdown,
    scoreWeights: weights,
    scoreDescriptions: descriptions,
    detectedSkills,
    sectionsFound,
    contacts,
    requirements: requirementResults,
    suggestions: generateSuggestions({ text, options, requirements: requirementResults, skills: detectedSkills, sectionsFound, contacts, readability }),
    readability,
  }
}

function generateSuggestions(input: {
  text: string
  options: { mode: ATSAnalysisMode; targetRole?: string; jobDescription?: string }
  requirements: RequirementResult[]
  skills: DetectedSkill[]
  sectionsFound: string[]
  contacts: ATSAnalysisResult['contacts']
  readability: ATSAnalysisResult['readability']
}): string[] {
  const suggestions: string[] = []
  if (!input.contacts.email) suggestions.push('Add a clearly labeled email address so recruiters can contact you.')
  if (!input.contacts.phone) suggestions.push('Add a phone number with country code if you want recruiters to reach you directly.')
  if (!input.contacts.linkedin) suggestions.push('Add a LinkedIn URL if you maintain a professional profile.')

  const hasSkillsSection = input.sectionsFound.includes('Skills')
  if (!hasSkillsSection && input.skills.length > 0) suggestions.push(`Group your demonstrated skills under a clear Skills or Core Competencies heading: ${input.skills.slice(0, 4).map((skill) => skill.name).join(', ')}.`)
  if (input.sectionsFound.length < 3 && input.readability.wordCount > 60) suggestions.push('Use clear, consistent headings to separate the education, skills, and experience or project content you already have.')
  if (input.readability.bulletCount === 0 && input.readability.wordCount > 100) suggestions.push('Consider using concise bullets for accomplishments, with your action and outcome stated where supported by the facts.')

  if (input.options.mode === 'job') {
    const missing = input.requirements.filter((requirement) => requirement.status === 'missing')
    const partial = input.requirements.filter((requirement) => requirement.status === 'partial')
    const role = input.options.targetRole?.trim() || 'the supplied job description'
    if (missing.length > 0) {
      suggestions.push(`The resume does not currently demonstrate these ${role} requirements: ${missing.slice(0, 4).map((requirement) => requirement.name).join(', ')}. Add them only if they reflect your actual background.`)
    }
    if (partial.length > 0) suggestions.push(`Add a concrete project, work, internship, or research example to support: ${partial.slice(0, 3).map((requirement) => requirement.name).join(', ')}.`)
    if (input.requirements.length === 0) suggestions.push('No recognizable requirements were extracted. Add a clearer job description with required skills, qualifications, or experience expectations.')
  }

  return [...new Set(suggestions)].slice(0, 6)
}
