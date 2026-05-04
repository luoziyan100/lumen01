/**
 * [INPUT]: 依赖 agent/types
 * [OUTPUT]: 对外提供 Agent 工具契约清单
 * [POS]: agent 模块的工具 manifest，供 planner/context pack/runtime guard 使用
 */
import type { ToolManifestEntry } from './types'

export const TOOL_MANIFEST: ToolManifestEntry[] = [
  {
    name: 'direct_answer',
    description: '普通问答、日期、能力说明和不需要工具的解释。',
    inputSchemaSummary: '{ userText, history }',
    outputSchemaSummary: '{ reply }',
    network: false,
    writesPermanentLibrary: false,
    temporaryOnly: false,
    allowedWhen: ['普通知识问答', '闲聊', '不需要搜索或读论文'],
    forbiddenWhen: ['明确外部学术搜索', '明确结果集引用', '需要 PDF/evidence 的研究报告'],
  },
  {
    name: 'academic_search',
    description: '搜索外部学术数据库，包括 OpenAlex、arXiv、Semantic Scholar、Crossref。',
    inputSchemaSummary: '{ queries, searchMode, sourceHint, timeRange, categories, feedLimit }',
    outputSchemaSummary: '{ SearchResultSet, SearchResult[] }',
    network: true,
    writesPermanentLibrary: false,
    temporaryOnly: false,
    allowedWhen: ['用户明确要求搜索/找外部论文', '最新/近期/arXiv feed 请求'],
    forbiddenWhen: ['用户引用已有结果集且未要求重新搜索'],
  },
  {
    name: 'paper_detail',
    description: '回答搜索结果中某篇论文的元信息、链接、DOI、摘要等。',
    inputSchemaSummary: '{ paperReference | resolvedQuestion }',
    outputSchemaSummary: '{ metadata, abstract, links }',
    network: false,
    writesPermanentLibrary: false,
    temporaryOnly: false,
    allowedWhen: ['用户询问结果集中某篇论文的元信息或链接'],
    forbiddenWhen: ['用户要求全文方法/实验/结论时，应使用 paper_preview'],
  },
  {
    name: 'paper_preview',
    description: '临时读取开放 PDF/HTML/摘要，解释单篇论文内容。',
    inputSchemaSummary: '{ SearchResult }',
    outputSchemaSummary: '{ PaperEvidenceNote }',
    network: true,
    writesPermanentLibrary: false,
    temporaryOnly: true,
    allowedWhen: ['用户问某篇论文讲什么、方法、结论、局限'],
    forbiddenWhen: ['用户没有指定唯一论文', '用户要求永久保存到文献库'],
  },
  {
    name: 'deep_research',
    description: '对多篇论文做 evidence gate 后综合研究报告。',
    inputSchemaSummary: '{ SearchResult[], evidenceRequirement }',
    outputSchemaSummary: '{ PaperEvidenceNote[], DeepResearchReportArtifact }',
    network: true,
    writesPermanentLibrary: false,
    temporaryOnly: true,
    allowedWhen: ['用户要求研究报告、对比、综述、综合多篇论文'],
    forbiddenWhen: ['已有结果集引用被解析失败时不能猜测论文', '无开放证据时不能声称读过全文'],
  },
  {
    name: 'read_local_papers',
    description: '读取本地文献库或集合中的论文文本。',
    inputSchemaSummary: '{ target, query }',
    outputSchemaSummary: '{ localPaperContext }',
    network: false,
    writesPermanentLibrary: false,
    temporaryOnly: false,
    allowedWhen: ['用户明确要求分析本地文献库、集合、项目或已导入论文'],
    forbiddenWhen: ['明确外部搜索请求'],
  },
  {
    name: 'import_to_library',
    description: '导入或保存论文到永久文献库的受控入口。',
    inputSchemaSummary: '{ paperReference }',
    outputSchemaSummary: '{ importStatus }',
    network: true,
    writesPermanentLibrary: true,
    temporaryOnly: false,
    allowedWhen: ['用户明确说保存、导入、加入文献库、下载到本地'],
    forbiddenWhen: ['普通总结、预览、研究报告'],
  },
  {
    name: 'clarify',
    description: '当引用或意图有歧义时提出一个澄清问题。',
    inputSchemaSummary: '{ ambiguity }',
    outputSchemaSummary: '{ reply }',
    network: false,
    writesPermanentLibrary: false,
    temporaryOnly: false,
    allowedWhen: ['无法确定用户指向哪个结果集或论文'],
    forbiddenWhen: ['已经有确定性对象可执行时'],
  },
  {
    name: 'feedback',
    description: '处理用户对上一轮结果质量或路由错误的反馈。',
    inputSchemaSummary: '{ userText, previousTrace }',
    outputSchemaSummary: '{ acknowledgement }',
    network: false,
    writesPermanentLibrary: false,
    temporaryOnly: false,
    allowedWhen: ['用户评价、纠错、指出搜索不准'],
    forbiddenWhen: ['用户提出新的明确搜索或研究任务'],
  },
]

export function toolManifestForPlanner(): Array<Pick<ToolManifestEntry, 'name' | 'description' | 'allowedWhen' | 'forbiddenWhen'>> {
  return TOOL_MANIFEST.map(({ name, description, allowedWhen, forbiddenWhen }) => ({
    name,
    description,
    allowedWhen,
    forbiddenWhen,
  }))
}
