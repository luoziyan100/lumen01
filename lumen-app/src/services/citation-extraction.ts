/**
 * [INPUT]: 依赖 services/ai, services/files, services/citations, pdfjs-dist
 * [OUTPUT]: 对外提供 extractCitationsForPaper
 * [POS]: services 层的引用提取，用 AI 解析参考文献并匹配库内论文
 */
import { chatWithAI, type ChatMessage } from './ai'
import { loadPdfData } from './files'
import { bulkAddCitations, type CitationEdge } from './citations'
import type { Paper } from './papers'

interface ExtractedRef {
  title: string
  authors?: string
  year?: number
}

async function extractReferencesText(filePath: string): Promise<string> {
  const bytes = await loadPdfData(filePath)
  const blob = new Blob([bytes.buffer as ArrayBuffer], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)

  try {
    const pdfjsLib = await import('pdfjs-dist')
    const doc = await pdfjsLib.getDocument(url).promise
    const totalPages = doc.numPages
    const startPage = Math.max(1, totalPages - 4)
    let text = ''

    for (let i = startPage; i <= totalPages; i++) {
      const page = await doc.getPage(i)
      const content = await page.getTextContent()
      text += content.items.map((item) => ('str' in item ? item.str : '')).join(' ') + '\n'
    }

    return text.slice(0, 8000)
  } finally {
    URL.revokeObjectURL(url)
  }
}

function normalizeTitle(title: string): string {
  return title.toLowerCase().replace(/[^\w\s一-鿿]/g, '').replace(/\s+/g, ' ').trim()
}

function matchPaper(ref: ExtractedRef, papers: Paper[]): Paper | null {
  const refTitle = normalizeTitle(ref.title)
  if (refTitle.length < 5) return null

  for (const p of papers) {
    const pTitle = normalizeTitle(p.title)
    if (pTitle === refTitle) return p
    if (pTitle.length > 10 && refTitle.length > 10) {
      if (pTitle.includes(refTitle) || refTitle.includes(pTitle)) return p
    }
  }

  if (ref.year) {
    for (const p of papers) {
      if (p.year !== ref.year) continue
      const pTitle = normalizeTitle(p.title)
      const words = refTitle.split(' ').filter((w) => w.length > 3)
      const matchCount = words.filter((w) => pTitle.includes(w)).length
      if (words.length > 0 && matchCount / words.length > 0.7) return p
    }
  }

  return null
}

export async function extractCitationsForPaper(
  paper: Paper,
  libraryPapers: Paper[],
  signal?: AbortSignal,
): Promise<{ matched: number; total: number }> {
  const refText = await extractReferencesText(paper.file_path)
  if (refText.trim().length < 100) {
    return { matched: 0, total: 0 }
  }

  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: `你是一个学术引用提取工具。从论文参考文献文本中提取所有引用的论文信息。
返回一个 JSON 数组，每个元素包含: title（字符串）、authors（字符串，可选）、year（数字，可选）。
只返回 JSON 数组，不要其他文字、不要 markdown 代码块标记。如果无法解析某条引用，跳过它。`,
    },
    {
      role: 'user',
      content: `请从以下参考文献文本中提取引用信息：\n\n${refText}`,
    },
  ]

  const reply = await chatWithAI(messages, undefined, signal)

  let refs: ExtractedRef[] = []
  try {
    const cleaned = reply.replace(/^```json?\s*/m, '').replace(/```\s*$/m, '').trim()
    refs = JSON.parse(cleaned)
    if (!Array.isArray(refs)) refs = []
  } catch {
    return { matched: 0, total: 0 }
  }

  const otherPapers = libraryPapers.filter((p) => p.id !== paper.id)
  const edges: CitationEdge[] = []

  for (const ref of refs) {
    if (!ref.title) continue
    const match = matchPaper(ref, otherPapers)
    if (match) {
      edges.push({
        citing_id: paper.id,
        cited_id: match.id,
        context: ref.title,
      })
    }
  }

  if (edges.length > 0) {
    await bulkAddCitations(edges)
  }

  return { matched: edges.length, total: refs.length }
}
