/**
 * [INPUT]: 依赖论文 URL、本地临时目录、pdfjs-dist
 * [OUTPUT]: 下载开放 PDF 到临时文件并抽取正文证据，供 research judgment CLI 使用
 * [POS]: scripts 层的 PDF 证据装载器，不导入文献库，不持久保存到用户文献库
 */
import { mkdir, readFile, stat } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { promisify } from 'node:util'
import type { PaperJudgmentInput, ResearchJudgmentReportInput } from '../src/agent/research-judgment.ts'

export interface PdfDownloadResult {
  path: string
  bytes: number
  cacheHit: boolean
}

export interface ResearchEvidenceOptions {
  tempDir?: string
  maxPdfChars?: number
  downloadPdf?: (pdfUrl: string, pdfPath: string) => Promise<PdfDownloadResult>
  extractPdfText?: (pdfPath: string, maxChars: number) => Promise<string>
  onProgress?: (message: string) => void
}

const DEFAULT_MAX_PDF_CHARS = 80_000
const execFileAsync = promisify(execFile)

function stableHash(value: string): string {
  let hash = 2166136261
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i)
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24)
  }
  return (hash >>> 0).toString(16)
}

function cleanUrl(value: string): string {
  return value.trim().replace(/[)\]，。,.]+$/g, '')
}

export function pdfUrlForPaperUrl(rawUrl: string | null | undefined): string | null {
  if (!rawUrl) return null
  const url = cleanUrl(rawUrl)
  const arxiv = url.match(/arxiv\.org\/(?:abs|pdf)\/([^?#\s]+)/i)
  if (arxiv) {
    const id = arxiv[1].replace(/\.pdf$/i, '')
    return `https://arxiv.org/pdf/${id}`
  }
  if (/\.pdf(?:[?#].*)?$/i.test(url)) return url
  return null
}

function pdfPathForUrl(pdfUrl: string, tempDir: string): string {
  const urlName = basename(new URL(pdfUrl).pathname).replace(/[^a-z0-9._-]+/gi, '_')
  const name = urlName && urlName !== 'pdf' ? urlName.replace(/\.pdf$/i, '') : stableHash(pdfUrl)
  return join(tempDir, `${stableHash(pdfUrl)}-${name}.pdf`)
}

async function existingFileSize(path: string): Promise<number | null> {
  try {
    const result = await stat(path)
    return result.isFile() && result.size > 0 ? result.size : null
  } catch {
    return null
  }
}

export async function downloadPdfToFile(pdfUrl: string, pdfPath: string): Promise<PdfDownloadResult> {
  const existing = await existingFileSize(pdfPath)
  if (existing) return { path: pdfPath, bytes: existing, cacheHit: true }

  await execFileAsync('curl', [
    '-L',
    '--fail',
    '--show-error',
    '--silent',
    '--max-time',
    '60',
    '--connect-timeout',
    '15',
    '-A',
    'Lumen research judgment CLI (temporary PDF evidence loader)',
    '-H',
    'Accept: application/pdf,*/*;q=0.8',
    '-o',
    pdfPath,
    pdfUrl,
  ], { maxBuffer: 20_000 })

  const bytes = await readFile(pdfPath)
  if (bytes.byteLength < 1000) throw new Error(`PDF download too small: ${bytes.byteLength} bytes`)
  const header = new TextDecoder().decode(bytes.slice(0, 4))
  if (header !== '%PDF') throw new Error(`downloaded file is not a PDF: ${header}`)
  return { path: pdfPath, bytes: bytes.byteLength, cacheHit: false }
}

export async function extractPdfTextFromFile(pdfPath: string, maxChars = DEFAULT_MAX_PDF_CHARS): Promise<string> {
  const bytes = new Uint8Array(await readFile(pdfPath))
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const loadingTask = pdfjs.getDocument({
    data: bytes,
    disableFontFace: true,
    useSystemFonts: true,
  })
  const doc = await loadingTask.promise
  let text = ''

  for (let pageNumber = 1; pageNumber <= doc.numPages && text.length < maxChars; pageNumber += 1) {
    const page = await doc.getPage(pageNumber)
    const content = await page.getTextContent()
    const pageText = content.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()
    if (pageText) text += `${pageText}\n\n`
  }

  return text.slice(0, maxChars).trim()
}

async function enrichOnePaper(
  paper: PaperJudgmentInput,
  options: Required<Pick<ResearchEvidenceOptions, 'maxPdfChars' | 'downloadPdf' | 'extractPdfText'>> & {
    tempDir: string
    onProgress?: (message: string) => void
  },
): Promise<PaperJudgmentInput> {
  const pdfUrl = pdfUrlForPaperUrl(paper.pdfUrl ?? paper.url)
  if (!pdfUrl) {
    return {
      ...paper,
      evidenceSource: paper.abstractText?.trim() ? 'abstract' : 'metadata',
    }
  }

  const pdfPath = pdfPathForUrl(pdfUrl, options.tempDir)
  try {
    options.onProgress?.(`下载 PDF：${paper.title} -> ${pdfPath}`)
    const download = await options.downloadPdf(pdfUrl, pdfPath)
    options.onProgress?.(`抽取 PDF 文本：${download.path}${download.cacheHit ? ' (cache hit)' : ''}`)
    const fullText = await options.extractPdfText(download.path, options.maxPdfChars)
    if (fullText.trim().length < 500) throw new Error(`extracted PDF text too short: ${fullText.trim().length} chars`)

    return {
      ...paper,
      fullText,
      evidenceSource: 'pdf_text',
      pdfUrl,
      pdfTempPath: download.path,
      evidenceError: null,
    }
  } catch (error) {
    options.onProgress?.(`PDF 证据失败：${paper.title}：${error instanceof Error ? error.message : String(error)}`)
    return {
      ...paper,
      evidenceSource: 'download_failed',
      pdfUrl,
      pdfTempPath: pdfPath,
      evidenceError: error instanceof Error ? error.message : String(error),
    }
  }
}

export async function enrichPapersWithDownloadedEvidence(
  input: ResearchJudgmentReportInput,
  options: ResearchEvidenceOptions = {},
): Promise<ResearchJudgmentReportInput> {
  const tempDir = options.tempDir ?? join(tmpdir(), 'lumen-research-judgment')
  const maxPdfChars = options.maxPdfChars ?? DEFAULT_MAX_PDF_CHARS
  const downloadPdf = options.downloadPdf ?? downloadPdfToFile
  const extractPdfText = options.extractPdfText ?? extractPdfTextFromFile

  await mkdir(tempDir, { recursive: true })
  const papers: PaperJudgmentInput[] = []
  for (const paper of input.papers) {
    papers.push(await enrichOnePaper(paper, {
      tempDir,
      maxPdfChars,
      downloadPdf,
      extractPdfText,
      onProgress: options.onProgress,
    }))
  }

  return {
    ...input,
    papers,
  }
}
