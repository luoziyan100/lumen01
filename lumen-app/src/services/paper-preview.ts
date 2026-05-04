/**
 * [INPUT]: 依赖 services/search、services/tauri、pdfjs-dist
 * [OUTPUT]: 对外提供外部搜索结果论文的临时预览文本抽取与缓存
 * [POS]: services 层的 paper preview 临时缓存，不导入文献库
 */
import * as pdfjsLib from 'pdfjs-dist'
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import type { SearchResult } from './search'
import { hasTauriInvoke, invokeTauri } from './tauri'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl

export type PreviewEvidenceLevel = 'metadata_only' | 'abstract_only' | 'pdf_text_preview'

export interface PaperPreviewData {
  paper: SearchResult
  evidenceLevel: PreviewEvidenceLevel
  text: string
  cacheHit: boolean
  pdfCacheHit: boolean
  pdfResolution?: PdfResolutionResult
  message?: string
}

export interface PdfResolutionAttempt {
  source: 'direct' | 'unpaywall' | 'openalex' | 'semantic_scholar' | 'crossref' | 'arxiv' | 'landing_page' | 'web_search'
  status: 'skipped' | 'candidate_found' | 'verified_pdf' | 'not_found' | 'blocked' | 'failed'
  url?: string
  reason?: string
}

export interface PdfResolutionResult {
  pdfUrl: string | null
  landingUrl?: string | null
  source?: string
  license?: string | null
  attempts: PdfResolutionAttempt[]
  bytes?: Uint8Array
  pdfCacheHit?: boolean
}

interface PdfFetchResponse {
  bytes: number[]
  cache_hit: boolean
}

interface PublicHtmlResponse {
  url: string
  content_type?: string | null
  html: string
}

interface TextCacheRecord {
  key: string
  createdAt: number
  lastAccessedAt: number
  expiresAt: number
  paperTitle: string
  sourceUrl: string
  openAccessUrl: string
  text: string
}

const TEXT_CACHE_KEY = 'lumen.paperPreview.textCache.v1'
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000
const MAX_TEXT_CACHE_CHARS = 2_000_000
const MAX_PREVIEW_CHARS = 28_000
const UNPAYWALL_EMAIL = 'zluo5820@gmail.com'
const BLOCKED_SOURCE_PATTERNS = [
  'sci-hub',
  'libgen',
  'librarygenesis',
  'z-lib',
  'zlibrary',
  'annas-archive',
]

function stableHash(value: string): string {
  let hash = 2166136261
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i)
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24)
  }
  return (hash >>> 0).toString(16)
}

function previewCacheKey(paper: SearchResult): string {
  return stableHash([
    paper.doi,
    directPdfUrl(paper),
    paper.open_access_landing_url,
    paper.source_url,
    paper.id,
    paper.title,
  ].filter(Boolean).join('|'))
}

function directPdfUrl(paper: SearchResult): string | null {
  return paper.open_access_pdf_url ?? paper.open_access_url ?? null
}

function blockedUrl(url: string): boolean {
  const lower = url.toLowerCase()
  return BLOCKED_SOURCE_PATTERNS.some((blocked) => lower.includes(blocked))
}

function normalizeDoi(doi: string | null): string | null {
  const normalized = doi
    ?.trim()
    .replace(/^https?:\/\/doi\.org\//i, '')
    .replace(/^doi:/i, '')
  return normalized || null
}

function uniqueUrls(urls: Array<string | null | undefined>): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of urls) {
    const value = raw?.trim()
    if (!value || seen.has(value) || blockedUrl(value)) continue
    if (!/^https?:\/\//i.test(value)) continue
    seen.add(value)
    out.push(value)
  }
  return out
}

function absoluteUrl(value: string, baseUrl: string): string | null {
  try {
    return new URL(value, baseUrl).toString()
  } catch {
    return null
  }
}

function arxivPdfFromUrl(url: string | null | undefined): string | null {
  if (!url) return null
  const match = url.match(/arxiv\.org\/(?:abs|pdf)\/([^?#\s]+)/i)
  if (!match) return null
  const id = match[1].replace(/\.pdf$/i, '')
  return `https://arxiv.org/pdf/${id}`
}

function attemptSummary(result: PdfResolutionResult): string {
  const lines = result.attempts
    .filter((attempt) => attempt.status !== 'skipped')
    .slice(-10)
    .map((attempt) => {
      const url = attempt.url ? ` ${attempt.url}` : ''
      const reason = attempt.reason ? `：${attempt.reason}` : ''
      return `${attempt.source}/${attempt.status}${url}${reason}`
    })
  return lines.length > 0 ? lines.join('；') : '未找到可尝试的开放 PDF 来源'
}

function readTextCache(): TextCacheRecord[] {
  if (typeof localStorage === 'undefined') return []
  try {
    const raw = localStorage.getItem(TEXT_CACHE_KEY)
    if (!raw) return []
    const records = JSON.parse(raw) as TextCacheRecord[]
    const now = Date.now()
    return Array.isArray(records)
      ? records.filter((record) => record.expiresAt > now && typeof record.text === 'string')
      : []
  } catch {
    return []
  }
}

function writeTextCache(records: TextCacheRecord[]): void {
  if (typeof localStorage === 'undefined') return
  const now = Date.now()
  const fresh = records
    .filter((record) => record.expiresAt > now)
    .sort((a, b) => b.lastAccessedAt - a.lastAccessedAt)

  const kept: TextCacheRecord[] = []
  let totalChars = 0
  for (const record of fresh) {
    if (totalChars + record.text.length > MAX_TEXT_CACHE_CHARS) continue
    kept.push(record)
    totalChars += record.text.length
  }

  try {
    localStorage.setItem(TEXT_CACHE_KEY, JSON.stringify(kept))
  } catch {
    localStorage.removeItem(TEXT_CACHE_KEY)
  }
}

function getCachedText(key: string): string | null {
  const records = readTextCache()
  const record = records.find((entry) => entry.key === key)
  if (!record) {
    writeTextCache(records)
    return null
  }
  record.lastAccessedAt = Date.now()
  writeTextCache(records)
  return record.text
}

function setCachedText(key: string, paper: SearchResult, text: string): void {
  const now = Date.now()
  const records = readTextCache().filter((record) => record.key !== key)
  records.unshift({
    key,
    createdAt: now,
    lastAccessedAt: now,
    expiresAt: now + CACHE_TTL_MS,
    paperTitle: paper.title,
    sourceUrl: paper.source_url,
    openAccessUrl: directPdfUrl(paper) ?? '',
    text,
  })
  writeTextCache(records)
}

async function fetchPdfBytes(url: string, signal?: AbortSignal): Promise<{ bytes: Uint8Array; cacheHit: boolean }> {
  if (hasTauriInvoke()) {
    const response = await invokeTauri<PdfFetchResponse>('fetch_open_pdf', { url })
    return {
      bytes: new Uint8Array(response.bytes),
      cacheHit: response.cache_hit,
    }
  }

  const res = await fetch(`/api/paper-preview/pdf?url=${encodeURIComponent(url)}`, { signal })
  if (!res.ok) {
    throw new Error(await res.text().catch(() => `HTTP ${res.status}`))
  }
  return {
    bytes: new Uint8Array(await res.arrayBuffer()),
    cacheHit: false,
  }
}

async function fetchPublicHtml(url: string, signal?: AbortSignal): Promise<PublicHtmlResponse> {
  if (blockedUrl(url)) throw new Error('blocked_source')
  if (hasTauriInvoke()) {
    return invokeTauri<PublicHtmlResponse>('fetch_public_html', { url })
  }

  const res = await fetch(`/api/paper-preview/html?url=${encodeURIComponent(url)}`, { signal })
  if (!res.ok) {
    throw new Error(await res.text().catch(() => `HTTP ${res.status}`))
  }
  return res.json() as Promise<PublicHtmlResponse>
}

async function fetchPublicJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetchPublicHtml(url, signal)
  return JSON.parse(response.html) as T
}

async function verifyPdfCandidate(
  attempts: PdfResolutionAttempt[],
  source: PdfResolutionAttempt['source'],
  url: string | null | undefined,
  signal?: AbortSignal,
): Promise<PdfResolutionResult | null> {
  if (!url) {
    attempts.push({ source, status: 'skipped', reason: 'empty candidate' })
    return null
  }
  if (blockedUrl(url)) {
    attempts.push({ source, status: 'blocked', url, reason: 'blocked source' })
    return null
  }

  attempts.push({ source, status: 'candidate_found', url })
  try {
    const { bytes, cacheHit } = await fetchPdfBytes(url, signal)
    attempts.push({ source, status: 'verified_pdf', url })
    return {
      pdfUrl: url,
      source,
      attempts,
      bytes,
      pdfCacheHit: cacheHit,
    }
  } catch (error) {
    attempts.push({
      source,
      status: 'failed',
      url,
      reason: error instanceof Error ? error.message : String(error),
    })
    return null
  }
}

async function extractPdfText(bytes: Uint8Array): Promise<string> {
  const data = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
  const doc = await pdfjsLib.getDocument({ data }).promise
  const maxPages = Math.min(doc.numPages, 18)
  const pages: string[] = []

  for (let pageNum = 1; pageNum <= maxPages; pageNum += 1) {
    const page = await doc.getPage(pageNum)
    const content = await page.getTextContent()
    const pageText = content.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()
    if (pageText) pages.push(`[page ${pageNum}]\n${pageText}`)
    if (pages.join('\n\n').length > MAX_PREVIEW_CHARS * 1.3) break
  }

  return buildPreviewText(pages.join('\n\n'))
}

function buildPreviewText(text: string): string {
  const normalized = text.replace(/\s+/g, ' ').trim()
  if (normalized.length <= MAX_PREVIEW_CHARS) return normalized

  const lower = normalized.toLowerCase()
  const sectionMarkers = [
    'abstract',
    'introduction',
    'method',
    'methods',
    'experiment',
    'experiments',
    'results',
    'discussion',
    'limitations',
    'conclusion',
  ]
  const excerpts: string[] = []
  for (const marker of sectionMarkers) {
    const index = lower.indexOf(marker)
    if (index >= 0) {
      excerpts.push(normalized.slice(Math.max(0, index - 120), Math.min(normalized.length, index + 3200)))
    }
  }

  const firstPages = normalized.slice(0, 8000)
  const combined = [firstPages, ...excerpts].join('\n\n---\n\n')
  return combined.length > MAX_PREVIEW_CHARS ? combined.slice(0, MAX_PREVIEW_CHARS) : combined
}

function extractPdfLinksFromHtml(html: string, finalUrl: string): string[] {
  const candidates: Array<string | null> = []

  for (const match of html.matchAll(/<meta[^>]+(?:name|property)=["'](?:citation_pdf_url|dc\.identifier|og:url)["'][^>]+content=["']([^"']+)["'][^>]*>/gi)) {
    candidates.push(absoluteUrl(match[1], finalUrl))
  }
  for (const match of html.matchAll(/<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["'](?:citation_pdf_url|dc\.identifier|og:url)["'][^>]*>/gi)) {
    candidates.push(absoluteUrl(match[1], finalUrl))
  }
  for (const match of html.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>/gi)) {
    const href = match[1]
    if (/pdf|download|fulltext|article-pdf/i.test(href)) {
      candidates.push(absoluteUrl(href, finalUrl))
    }
  }
  for (const match of html.matchAll(/"(?:contentUrl|url|downloadUrl)"\s*:\s*"([^"]+)"/gi)) {
    const unescaped = match[1].replace(/\\\//g, '/')
    if (/pdf|download|fulltext|article-pdf/i.test(unescaped)) {
      candidates.push(absoluteUrl(unescaped, finalUrl))
    }
  }

  const osfMatch = finalUrl.match(/osf\.io\/(?:preprints\/[^/]+\/)?([a-z0-9]+)/i)
  if (osfMatch) candidates.push(`https://osf.io/${osfMatch[1]}/download`)

  const arxivPdf = arxivPdfFromUrl(finalUrl)
  if (arxivPdf) candidates.push(arxivPdf)

  return uniqueUrls(candidates)
}

async function resolveFromLandingPage(
  attempts: PdfResolutionAttempt[],
  landingUrl: string | null | undefined,
  signal?: AbortSignal,
): Promise<PdfResolutionResult | null> {
  if (!landingUrl) return null
  if (blockedUrl(landingUrl)) {
    attempts.push({ source: 'landing_page', status: 'blocked', url: landingUrl, reason: 'blocked landing source' })
    return null
  }

  try {
    const response = await fetchPublicHtml(landingUrl, signal)
    attempts.push({ source: 'landing_page', status: 'candidate_found', url: response.url, reason: 'landing page fetched' })
    const pdfCandidates = extractPdfLinksFromHtml(response.html, response.url)
    if (pdfCandidates.length === 0) {
      attempts.push({ source: 'landing_page', status: 'not_found', url: response.url, reason: 'no PDF link in HTML metadata or anchors' })
      return null
    }

    for (const candidate of pdfCandidates.slice(0, 8)) {
      const resolved = await verifyPdfCandidate(attempts, 'landing_page', candidate, signal)
      if (resolved) return { ...resolved, landingUrl: response.url }
    }
  } catch (error) {
    attempts.push({
      source: 'landing_page',
      status: 'failed',
      url: landingUrl,
      reason: error instanceof Error ? error.message : String(error),
    })
  }

  return null
}

interface UnpaywallLocation {
  url_for_pdf?: string | null
  url?: string | null
  url_for_landing_page?: string | null
  license?: string | null
}

interface UnpaywallResponse {
  best_oa_location?: UnpaywallLocation | null
  oa_locations?: UnpaywallLocation[]
}

async function resolveFromUnpaywall(
  attempts: PdfResolutionAttempt[],
  doi: string | null,
  signal?: AbortSignal,
): Promise<PdfResolutionResult | null> {
  if (!doi) return null
  try {
    const data = await fetchPublicJson<UnpaywallResponse>(
      `https://api.unpaywall.org/v2/${encodeURIComponent(doi)}?email=${encodeURIComponent(UNPAYWALL_EMAIL)}`,
      signal,
    )
    const locations = [data.best_oa_location, ...(data.oa_locations ?? [])].filter(Boolean) as UnpaywallLocation[]
    if (locations.length === 0) {
      attempts.push({ source: 'unpaywall', status: 'not_found', reason: 'no oa_locations' })
      return null
    }
    for (const location of locations) {
      const resolved = await verifyPdfCandidate(attempts, 'unpaywall', location.url_for_pdf, signal)
      if (resolved) return { ...resolved, license: location.license ?? null, landingUrl: location.url_for_landing_page ?? location.url ?? null }
    }
    for (const location of locations) {
      const resolved = await resolveFromLandingPage(attempts, location.url_for_landing_page ?? location.url, signal)
      if (resolved) return { ...resolved, source: 'unpaywall', license: location.license ?? null }
    }
  } catch (error) {
    attempts.push({ source: 'unpaywall', status: 'failed', reason: error instanceof Error ? error.message : String(error) })
  }
  return null
}

interface OpenAlexLocation {
  pdf_url?: string | null
  landing_page_url?: string | null
  license?: string | null
}

interface OpenAlexWorkDetail {
  open_access?: { oa_url?: string | null; oa_status?: string | null }
  primary_location?: OpenAlexLocation | null
  best_oa_location?: OpenAlexLocation | null
  locations?: OpenAlexLocation[]
}

async function fetchOpenAlexWork(paper: SearchResult, doi: string | null, signal?: AbortSignal): Promise<OpenAlexWorkDetail | null> {
  const openAlexId = [paper.id, paper.source_url].find((value) => value?.includes('openalex.org/'))
  const detailUrl = openAlexId
    ? openAlexId.replace('https://openalex.org/', 'https://api.openalex.org/')
    : doi
      ? `https://api.openalex.org/works/doi:${encodeURIComponent(doi)}`
      : null
  if (detailUrl) {
    try {
      return await fetchPublicJson<OpenAlexWorkDetail>(detailUrl, signal)
    } catch {
      // Fall through to title search.
    }
  }

  try {
    const url = `https://api.openalex.org/works?search=${encodeURIComponent(paper.title)}&per_page=1&mailto=${encodeURIComponent(UNPAYWALL_EMAIL)}`
    const data = await fetchPublicJson<{ results?: OpenAlexWorkDetail[] }>(url, signal)
    return data.results?.[0] ?? null
  } catch {
    return null
  }
}

async function resolveFromOpenAlex(
  attempts: PdfResolutionAttempt[],
  paper: SearchResult,
  doi: string | null,
  signal?: AbortSignal,
): Promise<PdfResolutionResult | null> {
  try {
    const work = await fetchOpenAlexWork(paper, doi, signal)
    if (!work) {
      attempts.push({ source: 'openalex', status: 'not_found', reason: 'work detail not found' })
      return null
    }

    const locations = [work.primary_location, work.best_oa_location, ...(work.locations ?? [])].filter(Boolean) as OpenAlexLocation[]
    for (const location of locations) {
      const resolved = await verifyPdfCandidate(attempts, 'openalex', location.pdf_url, signal)
      if (resolved) return { ...resolved, license: location.license ?? null, landingUrl: location.landing_page_url ?? work.open_access?.oa_url ?? null }
    }
    for (const landing of uniqueUrls([work.open_access?.oa_url, ...locations.map((location) => location.landing_page_url)])) {
      const resolved = await resolveFromLandingPage(attempts, landing, signal)
      if (resolved) return { ...resolved, source: 'openalex' }
    }
  } catch (error) {
    attempts.push({ source: 'openalex', status: 'failed', reason: error instanceof Error ? error.message : String(error) })
  }
  return null
}

interface SemanticScholarDetail {
  openAccessPdf?: { url?: string | null } | null
  url?: string | null
}

async function resolveFromSemanticScholar(
  attempts: PdfResolutionAttempt[],
  paper: SearchResult,
  doi: string | null,
  signal?: AbortSignal,
): Promise<PdfResolutionResult | null> {
  const id = doi ? `DOI:${doi}` : paper.source === 'Semantic Scholar' && paper.id ? paper.id : null
  if (!id) return null
  try {
    const data = await fetchPublicJson<SemanticScholarDetail>(
      `https://api.semanticscholar.org/graph/v1/paper/${encodeURIComponent(id)}?fields=openAccessPdf,url`,
      signal,
    )
    const resolved = await verifyPdfCandidate(attempts, 'semantic_scholar', data.openAccessPdf?.url, signal)
    if (resolved) return { ...resolved, landingUrl: data.url ?? null }
    return resolveFromLandingPage(attempts, data.url, signal)
  } catch (error) {
    attempts.push({ source: 'semantic_scholar', status: 'failed', reason: error instanceof Error ? error.message : String(error) })
  }
  return null
}

interface CrossrefWorkResponse {
  message?: {
    link?: Array<{ URL?: string; 'content-type'?: string }>
    URL?: string
  }
}

async function resolveFromCrossref(
  attempts: PdfResolutionAttempt[],
  doi: string | null,
  signal?: AbortSignal,
): Promise<PdfResolutionResult | null> {
  if (!doi) return null
  try {
    const data = await fetchPublicJson<CrossrefWorkResponse>(
      `https://api.crossref.org/works/${encodeURIComponent(doi)}`,
      signal,
    )
    for (const link of data.message?.link ?? []) {
      const resolved = await verifyPdfCandidate(attempts, 'crossref', link.URL, signal)
      if (resolved) return resolved
    }
    return resolveFromLandingPage(attempts, data.message?.URL, signal)
  } catch (error) {
    attempts.push({ source: 'crossref', status: 'failed', reason: error instanceof Error ? error.message : String(error) })
  }
  return null
}

export async function resolveOpenPdf(paper: SearchResult, signal?: AbortSignal): Promise<PdfResolutionResult> {
  const attempts: PdfResolutionAttempt[] = []
  const doi = normalizeDoi(paper.doi)

  const direct = await verifyPdfCandidate(attempts, 'direct', directPdfUrl(paper), signal)
  if (direct) return direct

  for (const arxiv of uniqueUrls([
    arxivPdfFromUrl(paper.id),
    arxivPdfFromUrl(paper.source_url),
    arxivPdfFromUrl(paper.open_access_landing_url),
  ])) {
    const resolved = await verifyPdfCandidate(attempts, 'arxiv', arxiv, signal)
    if (resolved) return resolved
  }

  const semantic = await resolveFromSemanticScholar(attempts, paper, doi, signal)
  if (semantic) return semantic

  const openAlex = await resolveFromOpenAlex(attempts, paper, doi, signal)
  if (openAlex) return openAlex

  const unpaywall = await resolveFromUnpaywall(attempts, doi, signal)
  if (unpaywall) return unpaywall

  const crossref = await resolveFromCrossref(attempts, doi, signal)
  if (crossref) return crossref

  for (const landing of uniqueUrls([paper.open_access_landing_url, paper.source_url])) {
    const resolved = await resolveFromLandingPage(attempts, landing, signal)
    if (resolved) return resolved
  }

  attempts.push({ source: 'web_search', status: 'skipped', reason: 'web search provider not configured in this stage' })
  return {
    pdfUrl: null,
    landingUrl: paper.open_access_landing_url ?? paper.source_url,
    attempts,
  }
}

export function formatPaperDetailContext(paper: SearchResult): string {
  const authors = paper.authors.map((author) => author.name).join(', ') || 'Unknown authors'
  return `标题：${paper.title}
作者：${authors}
日期：${paper.published_date ?? paper.year ?? '未知'}
来源：${paper.source}${paper.journal ? ` / ${paper.journal}` : ''}
引用数：${paper.citation_count}
DOI：${paper.doi ?? '无'}
来源链接：${paper.source_url || '无'}
开放 PDF：${directPdfUrl(paper) ?? '无'}
开放页面：${paper.open_access_landing_url ?? '无'}
摘要：${paper.abstract_text ?? '无摘要'}`
}

export async function previewSearchResultPaper(
  paper: SearchResult,
  signal?: AbortSignal,
): Promise<PaperPreviewData> {
  const detailText = formatPaperDetailContext(paper)
  const key = previewCacheKey(paper)
  const cached = getCachedText(key)
  if (cached) {
    return {
      paper,
      evidenceLevel: 'pdf_text_preview',
      text: cached,
      cacheHit: true,
      pdfCacheHit: true,
    }
  }

  const resolution = await resolveOpenPdf(paper, signal)
  const pdfUrl = resolution.pdfUrl
  if (!pdfUrl) {
    return {
      paper,
      evidenceLevel: paper.abstract_text ? 'abstract_only' : 'metadata_only',
      text: detailText,
      cacheHit: false,
      pdfCacheHit: false,
      pdfResolution: resolution,
      message: `未找到可验证的公开开放 PDF，只能基于元信息和摘要回答。Resolver 尝试：${attemptSummary(resolution)}`,
    }
  }

  try {
    const bytes = resolution.bytes ?? (await fetchPdfBytes(pdfUrl, signal)).bytes
    const cacheHit = resolution.pdfCacheHit ?? false
    const text = await extractPdfText(bytes)
    const previewText = `论文元信息：
${detailText}

PDF Resolver：
来源：${resolution.source ?? 'unknown'}
PDF URL：${pdfUrl}
Landing URL：${resolution.landingUrl ?? '无'}
License：${resolution.license ?? '未知'}
尝试记录：${attemptSummary(resolution)}

开放 PDF 临时文本片段：
${text}`
    setCachedText(key, paper, previewText)
    return {
      paper,
      evidenceLevel: 'pdf_text_preview',
      text: previewText,
      cacheHit: false,
      pdfCacheHit: cacheHit,
      pdfResolution: resolution,
    }
  } catch (error) {
    return {
      paper,
      evidenceLevel: paper.abstract_text ? 'abstract_only' : 'metadata_only',
      text: detailText,
      cacheHit: false,
      pdfCacheHit: false,
      pdfResolution: resolution,
      message: `开放 PDF 临时读取失败：${error instanceof Error ? error.message : String(error)}。Resolver 尝试：${attemptSummary(resolution)}`,
    }
  }
}
