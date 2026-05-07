import type { ToolDefinition } from '../adapters/types.ts'

export const RESEARCH_TOOLS: ToolDefinition[] = [
  {
    name: 'academic_search',
    description: '搜索学术论文数据库（OpenAlex、arXiv、Semantic Scholar、Crossref）。返回论文列表。',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: '英文学术搜索词。把日期、领域、关键词都写进来。',
        },
      },
      required: ['query'],
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
  {
    name: 'search_citations',
    description: '查询谁引用了指定论文（前向引用链）。用于了解一篇论文的影响力和后续工作。',
    parameters: {
      type: 'object',
      properties: {
        paper_id: {
          type: 'string',
          description: '论文标识符。支持 Semantic Scholar ID、DOI（如 "DOI:10.1234/example"）或 arXiv ID（如 "arXiv:2301.00001"）。',
        },
      },
      required: ['paper_id'],
    },
  },
  {
    name: 'search_references',
    description: '查询指定论文引用了哪些文献（后向引用链）。用于了解一篇论文的理论基础和前置工作。',
    parameters: {
      type: 'object',
      properties: {
        paper_id: {
          type: 'string',
          description: '论文标识符。支持 Semantic Scholar ID、DOI（如 "DOI:10.1234/example"）或 arXiv ID（如 "arXiv:2301.00001"）。',
        },
      },
      required: ['paper_id'],
    },
  },
]
