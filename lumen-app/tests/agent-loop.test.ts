import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import { runAgentLoop } from '../src/agent/loop.ts'
import { buildSystemPrompt } from '../src/agent/system-prompt.ts'
import { RESEARCH_TOOLS } from '../src/agent/tools/definitions.ts'
import { executeAcademicSearch, mergeSearchBatches } from '../src/agent/tools/academic-search.ts'
import { executeCitationSearch, executeReferenceSearch } from '../src/agent/tools/citation-search.ts'
import { executeReadPapers } from '../src/agent/tools/read-papers.ts'
import type { AgentMessage, LLMAdapter, LLMResponse, ToolDefinition } from '../src/agent/adapters/types.ts'
import type { PaperPreviewData } from '../src/services/paper-preview.ts'
import type { SearchResult } from '../src/services/search.ts'

function paper(overrides: Partial<SearchResult> = {}): SearchResult {
  return {
    id: 'paper-1',
    title: 'Memory Graphs for Research Agents',
    abstract_text: 'Graph memory helps research agents keep prior evidence connected.',
    authors: [{ name: 'Ada Chen' }],
    year: 2026,
    citation_count: 7,
    open_access_url: 'https://example.org/memory-graphs.pdf',
    open_access_pdf_url: 'https://example.org/memory-graphs.pdf',
    open_access_landing_url: 'https://example.org/memory-graphs',
    source_url: 'https://example.org/memory-graphs',
    source: 'test',
    journal: null,
    doi: '10.1234/memory.graphs',
    published_date: '2026-05-05',
    is_top_journal: false,
    quality_score: 1,
    ...overrides,
  }
}

class FakeAdapter implements LLMAdapter {
  seenToolResult = false
  calls = 0

  async chatWithTools(messages: AgentMessage[], tools: ToolDefinition[]): Promise<LLMResponse> {
    assert.equal(tools.map((tool) => tool.name).includes('search_local_library'), true)
    this.calls += 1
    if (this.calls === 1) {
      return {
        toolCalls: [{ id: 'call-1', name: 'search_local_library', arguments: { query: 'agent memory' } }],
        message: {
          role: 'assistant',
          content: '',
          toolCalls: [{ id: 'call-1', name: 'search_local_library', arguments: { query: 'agent memory' } }],
        },
      }
    }

    this.seenToolResult = messages.some((message) => (
      message.role === 'tool_result'
      && message.toolCallId === 'call-1'
      && message.content.includes('local papers for agent memory')
    ))
    return {
      text: '你的本地库里有 agent memory 相关论文。',
      message: { role: 'assistant', content: '你的本地库里有 agent memory 相关论文。' },
    }
  }
}

class ScriptedAdapter implements LLMAdapter {
  readonly seenMessages: AgentMessage[][] = []
  private readonly responses: LLMResponse[]

  constructor(responses: LLMResponse[]) {
    this.responses = responses
  }

  async chatWithTools(messages: AgentMessage[]): Promise<LLMResponse> {
    this.seenMessages.push(messages)
    const response = this.responses.shift()
    if (!response) throw new Error('No scripted response left')
    return response
  }
}

function toolResponse(id: string, name: string, args: Record<string, unknown>): LLMResponse {
  const toolCall = { id, name, arguments: args }
  return {
    toolCalls: [toolCall],
    message: { role: 'assistant', content: '', toolCalls: [toolCall] },
  }
}

function textResponse(content: string): LLMResponse {
  return {
    text: content,
    message: { role: 'assistant', content },
  }
}

test('scenario E searches local library, appends tool_result history, then returns final text', async () => {
  const adapter = new FakeAdapter()
  const result = await runAgentLoop({
    userText: '我的文献库里有哪些 agent memory 论文？',
    conversationHistory: [],
    context: {
      currentDate: '2026-05-05',
      timezone: 'America/Los_Angeles',
      hasLocalPapers: true,
      localPaperCount: 3,
    },
    loadLocalPaperContext: async (query) => `local papers for ${query}`,
    adapter,
  })

  assert.equal(adapter.calls, 2)
  assert.equal(adapter.seenToolResult, true)
  assert.equal(result.reply, '你的本地库里有 agent memory 相关论文。')
  assert.deepEqual(result.newMessages.map((message) => message.role), ['assistant', 'tool_result', 'assistant'])
  assert.equal(result.trace.status, 'succeeded')
})

test('scenario A searches papers through academic_search and returns a list', async () => {
  const adapter = new ScriptedAdapter([
    toolResponse('search-1', 'academic_search', { query: 'latest LLM papers May 2026' }),
    textResponse('找到 5 篇最新 LLM 论文。'),
  ])

  const result = await runAgentLoop({
    userText: '搜索最新的LLM论文',
    conversationHistory: [],
    context: { currentDate: '2026-05-05', timezone: 'America/Los_Angeles', hasLocalPapers: false, localPaperCount: 0 },
    adapter,
    executeTool: async (toolCall) => {
      assert.deepEqual(toolCall.arguments, { query: 'latest LLM papers May 2026' })
      return { total: 5, results: [{ index: 1, title: 'Paper A' }], called: toolCall.name }
    },
  })

  assert.equal(result.reply, '找到 5 篇最新 LLM 论文。')
  assert.equal(result.newMessages.some((message) => message.role === 'tool_result' && message.content.includes('Paper A')), true)
})

test('scenario B uses conversation history to read the five previously recommended papers', async () => {
  const previousSearch: AgentMessage = {
    role: 'tool_result',
    toolCallId: 'search-old',
    content: JSON.stringify({
      total: 5,
      results: Array.from({ length: 5 }, (_, index) => ({ index: index + 1, title: `Paper ${index + 1}` })),
    }),
  }
  const adapter = new ScriptedAdapter([
    toolResponse('read-1', 'read_papers', {
      papers: Array.from({ length: 5 }, (_, index) => ({ title: `Paper ${index + 1}` })),
    }),
    textResponse('# 研究报告\n\n这 5 篇可以综合为一个研究方向。'),
  ])

  const result = await runAgentLoop({
    userText: '那你把这5篇做一个研究报告吧',
    conversationHistory: [
      { role: 'user', content: '搜索最新的LLM论文' },
      previousSearch,
      { role: 'assistant', content: '推荐这5篇：Paper 1, Paper 2, Paper 3, Paper 4, Paper 5' },
    ],
    context: { currentDate: '2026-05-05', timezone: 'America/Los_Angeles', hasLocalPapers: false, localPaperCount: 0 },
    adapter,
    executeTool: async (toolCall) => ({
      papers: (toolCall.arguments.papers as Array<{ title: string }>).map((item) => ({
        title: item.title,
        evidence_level: 'abstract_only',
        text: `${item.title} evidence`,
      })),
    }),
  })

  assert.match(result.reply, /研究报告/)
  assert.doesNotMatch(result.reply, /没有可用于深度研究的搜索结果/)
  assert.equal(adapter.seenMessages[0].some((message) => message.role === 'tool_result' && message.content.includes('Paper 5')), true)
})

test('scenario C reads the third paper from prior context', async () => {
  const adapter = new ScriptedAdapter([
    toolResponse('read-3', 'read_papers', { papers: [{ title: 'Paper 3' }] }),
    textResponse('第 3 篇主要讨论工具调用延迟。'),
  ])

  const result = await runAgentLoop({
    userText: '第3篇讲的是什么？',
    conversationHistory: [
      { role: 'tool_result', toolCallId: 'search-1', content: JSON.stringify({ results: [{ index: 3, title: 'Paper 3' }] }) },
    ],
    context: { currentDate: '2026-05-05', timezone: 'America/Los_Angeles', hasLocalPapers: false, localPaperCount: 0 },
    adapter,
    executeTool: async () => ({ papers: [{ title: 'Paper 3', evidence_level: 'pdf_text', text: 'tool latency' }] }),
  })

  assert.match(result.reply, /第 3 篇/)
})

test('scenario D ordinary chat returns directly without tools', async () => {
  const adapter = new ScriptedAdapter([textResponse('你好，我是 Lumen 研究助手。')])
  const result = await runAgentLoop({
    userText: '你好，你是谁？',
    conversationHistory: [],
    context: { currentDate: '2026-05-05', timezone: 'America/Los_Angeles', hasLocalPapers: false, localPaperCount: 0 },
    adapter,
  })

  assert.deepEqual(result.newMessages.map((message) => message.role), ['assistant'])
  assert.match(result.reply, /Lumen/)
})

test('research tools expose the five agent tools and avoid R-style anchors', () => {
  assert.deepEqual(RESEARCH_TOOLS.map((tool) => tool.name), [
    'academic_search',
    'read_papers',
    'search_local_library',
    'search_citations',
    'search_references',
  ])
  assert.equal(RESEARCH_TOOLS.some((tool) => /R1|R2|result set|reference binding/i.test(tool.description)), false)
  const searchTool = RESEARCH_TOOLS.find((tool) => tool.name === 'academic_search')
  assert.ok(searchTool)
  assert.deepEqual(searchTool.parameters.required, ['query'])
  assert.deepEqual(Object.keys(searchTool.parameters.properties), ['query'])
  for (const name of ['search_citations', 'search_references']) {
    const tool = RESEARCH_TOOLS.find((entry) => entry.name === name)
    assert.ok(tool)
    assert.deepEqual(tool.parameters.required, ['paper_id'])
    assert.deepEqual(Object.keys(tool.parameters.properties), ['paper_id'])
  }
})

test('system prompt includes citation tools and multi-step guidance', () => {
  const prompt = buildSystemPrompt({
    currentDate: '2026-05-07',
    timezone: 'Asia/Shanghai',
    hasLocalPapers: true,
    localPaperCount: 3,
  })

  assert.match(prompt, /search_citations/)
  assert.match(prompt, /search_references/)
  assert.match(prompt, /多次调用工具/)
  assert.match(prompt, /不匹配.*重新搜索|换.*query/)
  assert.match(prompt, /前向引用链/)
  assert.match(prompt, /后向引用链/)
  assert.match(prompt, /abstract_only|metadata_only/)
  assert.match(prompt, /query 用英文/)
  assert.match(prompt, /日期信息直接写进 query/)
  assert.match(prompt, /搜索结果按日期排序返回/)
  assert.equal(prompt.includes('academic_search 的 ' + ['quer', 'ies'].join('') + ' 用英文'), false)
  assert.doesNotMatch(prompt, /R1|R2|result set|reference binding/i)
})

test('scenario F follows citation chain to build timeline', async () => {
  const adapter = new ScriptedAdapter([
    toolResponse('ref-1', 'search_references', { paper_id: 'DOI:10.1234/target' }),
    toolResponse('read-1', 'read_papers', { papers: [{ title: 'Foundational Paper' }] }),
    textResponse('# 研究脉络\n\n这篇论文基于 Foundational Paper 的工作...'),
  ])

  const result = await runAgentLoop({
    userText: '这篇论文基于什么前置工作？',
    conversationHistory: [
      {
        role: 'tool_result',
        toolCallId: 'search-1',
        content: JSON.stringify({
          results: [{ index: 1, title: 'Target Paper', doi: '10.1234/target' }],
        }),
      },
    ],
    context: { currentDate: '2026-05-07', timezone: 'Asia/Shanghai', hasLocalPapers: false, localPaperCount: 0 },
    adapter,
    executeTool: async (toolCall) => {
      if (toolCall.name === 'search_references') {
        return {
          paper_id: 'DOI:10.1234/target',
          direction: 'references',
          total: 1,
          results: [{ index: 1, title: 'Foundational Paper', year: 2023 }],
        }
      }
      return { papers: [{ title: 'Foundational Paper', evidence_level: 'abstract_only', text: 'This paper...' }] }
    },
  })

  assert.match(result.reply, /研究脉络/)
  assert.equal(adapter.seenMessages.length, 3)
})

test('mergeSearchBatches sorts by published_date before quality_score', () => {
  const olderHighQuality = paper({
    id: 'old-paper',
    title: 'Old High Quality Paper',
    doi: '10.1234/old.high.quality',
    published_date: '2024-01-01',
    quality_score: 100,
  })
  const newerLowerQuality = paper({
    id: 'new-paper',
    title: 'New Lower Quality Paper',
    doi: '10.1234/new.lower.quality',
    published_date: '2026-05-06',
    quality_score: 1,
  })

  const merged = mergeSearchBatches([{ total: 2, results: [olderHighQuality, newerLowerQuality] }], 2)

  assert.deepEqual(merged.map((result) => result.title), [
    'New Lower Quality Paper',
    'Old High Quality Paper',
  ])
})

test('executeAcademicSearch uses one newest query and returns date and journal metadata', async () => {
  const calls: Array<{ query: string; limit: number; options: unknown }> = []
  const result = await executeAcademicSearch(
    { query: 'graph neural networks May 2026' },
    undefined,
    async (query, limit, options) => {
      calls.push({ query, limit, options })
      return {
        total: 1,
        results: [paper({
          title: 'Fresh Graph Paper',
          abstract_text: 'a'.repeat(1300),
          journal: 'NeurIPS',
          published_date: '2026-05-06',
        })],
      }
    },
  )

  assert.deepEqual(calls, [{
    query: 'graph neural networks May 2026',
    limit: 20,
    options: { sortMode: 'newest' },
  }])
  assert.equal(result.results[0].published_date, '2026-05-06')
  assert.equal(result.results[0].journal, 'NeurIPS')
  assert.equal(result.results[0].abstract_snippet?.length, 1200)
})

test('citation tools format citation and reference results with paper ids and direction', async () => {
  const searchResult = paper({
    title: 'Citation Chain Paper',
    abstract_text: 'b'.repeat(1300),
    journal: 'ACL',
    published_date: '2025-04-01',
  })
  const citations = await executeCitationSearch(
    { paper_id: 'DOI:10.1234/target' },
    undefined,
    async () => ({ total: 1, results: [searchResult] }),
  )
  const references = await executeReferenceSearch(
    { paper_id: 'arXiv:2301.00001' },
    undefined,
    async () => ({ total: 1, results: [searchResult] }),
  )

  assert.equal(citations.paper_id, 'DOI:10.1234/target')
  assert.equal(citations.direction, 'citations')
  assert.equal(references.paper_id, 'arXiv:2301.00001')
  assert.equal(references.direction, 'references')
  assert.equal(citations.results[0].journal, 'ACL')
  assert.equal(citations.results[0].published_date, '2025-04-01')
  assert.equal(citations.results[0].abstract_snippet?.length, 1200)
})

test('read_papers resolves fuzzy titles from recent academic_search tool results', async () => {
  const searchPaper = paper()
  const history: AgentMessage[] = [{
    role: 'tool_result',
    toolCallId: 'search-1',
    content: JSON.stringify({
      total: 1,
      results: [{
        index: 1,
        title: searchPaper.title,
        authors: ['Ada Chen'],
        year: 2026,
        doi: searchPaper.doi,
        source: 'test',
        source_url: searchPaper.source_url,
        abstract_snippet: searchPaper.abstract_text,
        open_access_url: searchPaper.open_access_pdf_url,
        citation_count: 7,
      }],
    }),
  }]

  const result = await executeReadPapers({
    papers: [{ title: 'memory graphs research agents' }],
  }, {
    conversationHistory: history,
    previewPaper: async (input): Promise<PaperPreviewData> => ({
      paper: input,
      evidenceLevel: 'pdf_text_preview',
      text: `full text for ${input.title}`,
      cacheHit: false,
      pdfCacheHit: false,
    }),
  })

  assert.equal(result.papers[0].title, searchPaper.title)
  assert.equal(result.papers[0].evidence_level, 'pdf_text')
  assert.match(result.papers[0].text, /full text/)
})

test('loop implementation stays small and free of regex routing', () => {
  const source = readFileSync(new URL('../src/agent/loop.ts', import.meta.url), 'utf8')
  const lines = source.split(/\r?\n/).length
  assert.ok(lines <= 150, `loop.ts must stay <= 150 lines, got ${lines}`)
  assert.doesNotMatch(source, /intent\s*===|plan\.intent|new RegExp|\.match\(|\.test\(|\/\.\*\//)
})
