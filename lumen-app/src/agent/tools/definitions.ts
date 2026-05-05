import type { ToolDefinition } from '../adapters/types.ts'

export const RESEARCH_TOOLS: ToolDefinition[] = [
  {
    name: 'academic_search',
    description: '搜索外部学术论文数据库（OpenAlex、arXiv、Semantic Scholar、Crossref）。当用户要求搜索、推荐、查找论文时调用。返回论文列表（标题、作者、摘要、DOI、链接）。',
    parameters: {
      type: 'object',
      properties: {
        queries: {
          type: 'array',
          items: { type: 'string' },
          description: '1-3 条英文学术检索 query',
        },
        time_range: {
          type: 'object',
          properties: {
            from_date: { type: 'string', description: 'YYYY-MM-DD' },
            to_date: { type: 'string', description: 'YYYY-MM-DD' },
          },
        },
        sort: {
          type: 'string',
          enum: ['relevance', 'newest', 'balanced'],
          description: '排序模式',
        },
        mode: {
          type: 'string',
          enum: ['keyword', 'paper_lookup', 'arxiv_feed'],
          description: '搜索模式。keyword=关键词搜索, paper_lookup=查找特定论文, arxiv_feed=arXiv分类feed',
        },
        arxiv_categories: {
          type: 'array',
          items: { type: 'string' },
          description: 'arXiv 分类列表，如 ["cs.AI","cs.LG"]。仅 arxiv_feed 模式需要。',
        },
        limit: {
          type: 'number',
          description: '返回论文数量，默认 10',
        },
      },
      required: ['queries'],
    },
  },
  {
    name: 'read_papers',
    description: '临时读取论文全文（开放 PDF）或摘要。用于深度分析、总结、对比论文。每次最多读 5 篇。读取是临时的，不会导入用户文献库。',
    parameters: {
      type: 'object',
      properties: {
        papers: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              doi: { type: 'string' },
              url: { type: 'string', description: '开放获取 PDF 或 landing page URL' },
            },
            required: ['title'],
          },
          description: '要读取的论文列表，最多 5 篇',
          maxItems: 5,
        },
      },
      required: ['papers'],
    },
  },
  {
    name: 'search_local_library',
    description: '搜索用户本地文献库中已导入的论文。当用户问“我的库里有没有...”“我之前导入的那篇...”时调用。',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: '搜索关键词' },
      },
      required: ['query'],
    },
  },
]
