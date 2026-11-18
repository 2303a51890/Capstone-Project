import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { validateResumeFile } from './ats-engine'

export * from './ats-engine'

function normalizeExtractedText(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/[\u00a0\u2007\u202f]/g, ' ')
    .replace(/[\t ]+/g, ' ')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
    .split('\n')
    .map((line) => line.trim())
    .filter((line, index, lines) => line.length > 0 || (index > 0 && lines[index - 1].length > 0))
    .join('\n')
    .trim()
}

export async function extractResumeText(file: File): Promise<string> {
  await validateResumeFile(file)
  const extension = file.name.toLowerCase().split('.').pop()

  if (extension === 'txt') {
    const bytes = new Uint8Array(await file.arrayBuffer())
    let decodedText: string
    if (bytes[0] === 0xff && bytes[1] === 0xfe) {
      decodedText = new TextDecoder('utf-16le').decode(bytes.slice(2))
    } else if (bytes[0] === 0xfe && bytes[1] === 0xff) {
      decodedText = new TextDecoder('utf-16be').decode(bytes.slice(2))
    } else {
      try {
        decodedText = new TextDecoder('utf-8', { fatal: true }).decode(bytes).replace(/^\uFEFF/, '')
      } catch {
        throw new Error('The TXT file is not valid UTF-8. Save it as UTF-8 or UTF-16 and try again.')
      }
    }
    const text = normalizeExtractedText(decodedText)
    if (!text || text.includes('\ufffd')) {
      throw new Error('The TXT file is empty or contains unreadable text. Save it as UTF-8 and try again.')
    }
    return text
  }

  if (extension === 'docx') {
    try {
      const { default: mammoth } = await import('mammoth')
      const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })
      const text = normalizeExtractedText(result.value)
      if (!text) throw new Error('No readable text was found.')
      return text
    } catch (error) {
      throw new Error(`Could not read this DOCX file. It may be corrupted or password-protected. ${error instanceof Error ? error.message : ''}`.trim())
    }
  }

  try {
    const pdfjs = await import('pdfjs-dist')
    pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl
    const document = await pdfjs.getDocument({
      data: new Uint8Array(await file.arrayBuffer()),
    }).promise
    const pages: string[] = []

    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber)
      const content = await page.getTextContent()
      const text = content.items.map((item) => {
        if (!('str' in item)) return ''
        return `${item.str}${item.hasEOL ? '\n' : ' '}`
      }).join('')
      pages.push(text)
    }

    const text = normalizeExtractedText(pages.join('\n'))
    if (!text) {
      throw new Error('No selectable text was found. This may be a scanned/image-only PDF; run OCR on the PDF or upload a text-based copy.')
    }
    return text
  } catch (error) {
    const errorName = error && typeof error === 'object' && 'name' in error ? String(error.name) : ''
    const message = error instanceof Error ? error.message : ''
    if (errorName === 'PasswordException' || /password/i.test(message)) {
      throw new Error('This PDF is password-protected. Remove its password and upload it again.')
    }
    if (message.includes('No selectable text')) throw error
    throw new Error(`Could not read this PDF. It may be corrupted, password-protected, or scanned without selectable text. ${message}`.trim())
  }
}
