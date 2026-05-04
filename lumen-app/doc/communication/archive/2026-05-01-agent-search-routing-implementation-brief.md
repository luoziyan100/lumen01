# Lumen Agent 搜索与模型路由改造 Brief

日期：2026-05-01  
作者：Codex，本窗口只负责 review、诊断和方案设计；不直接修改产品代码。请另一个 Codex 窗口按本文实施。  
范围：Research Agent / Harness、AI Provider 路由、学术搜索时效性、简单问题响应速度。

Status: SUPERSEDED  
Audience: implementer | reviewer | future-codex  
Action: reference-only  
Supersedes: none  
Next: 第二阶段已实施并记录在 `review/2026-05-01.02.done.notes.agent-search-routing.md`；当前新实施入口是 `active/2026-05-02.01.active.brief.paper-preview-temp-cache.md`。

## 1. 当前问题

### P1：简单问题会进入重型论文分析链路

用户问“今年是哪一年”这类简单问题时，页面会显示“正在阅读论文并分析...”，响应非常慢。

当前触发点在 `src/pages/ResearchPage.tsx`：第一条消息 `messages.length === 0` 会被当成 `isFirstOrResearchQuery`，只要本地有 papers，就先执行 `extractPaperContent(text)`。这导致任何首轮问题都会读 PDF/论文上下文，再进入 Agent。

影响：
- 简单常识/时间类问题延迟很高。
- 大量无关 paperContext 被塞进 prompt，浪费 token，也让后续 planner 更容易误判。
- UI 状态会误导用户，以为系统正在做论文分析。

### P1：搜索“这周 AI 论文”返回旧论文

当前 Agent 只把“这周/最近”改写进自然语言 query，没有把相对时间转换成结构化日期范围。后端搜索也没有使用各数据源的日期过滤和最新排序。

当前代码表现：
- `src/agent/types.ts` 的 `SearchPlan` 只有 `queries`，没有 `timeRange`、`sortMode`、`recencyIntent`。
- `src/agent/prompts.ts` 的 planner prompt 没有当前日期，也没有要求把“本周/最近7天/今年”等解析为日期。
- `src-tauri/src/commands/search.rs`：
  - OpenAlex 使用 `sort=relevance_score:desc`。
  - Semantic Scholar 使用 `/paper/search`，没有 `year` / `publicationDateOrYear` / `sort`。
  - Crossref 只过滤 `type:journal-article`，没有 `from-pub-date` / `until-pub-date` / `sort=published`。
  - arXiv 使用 `sortBy=relevance`。
  - 最终排序强烈偏向顶刊和引用数，recency 分很弱。
- `vite.config.ts` 的 dev fallback 搜索逻辑和 Rust 后端同样偏 relevance/citation，也需要同步改。

影响：
- “本周”“最新”“recent”不会真正约束 API 结果。
- 高引用旧论文天然胜出，尤其 OpenAlex / Crossref / Semantic Scholar。
- 反射器只能看结果是否相关，无法弥补工具层没有日期过滤的问题。

### P2：所有 Agent LLM 步骤共用一个模型

`src/services/ai.ts` 当前 `chatWithAI(messages, provider?, signal?)` 只取配置里的 `default_model`。Planner、reflector、risk sensor、direct answer、synthesizer 都走同一个模型。

影响：
- 简单问题、query 改写、JSON planner 没必要用 Pro/thinking。
- 复杂论文综合如果走 Flash，质量可能不足。
- 用户希望的 DeepSeek 两模型分工暂时无法表达。

### P3：取消搜索的 trace 状态可能被记成 failed

之前 review 已记录：`src/agent/tools.ts` 在 `signal.aborted` 时返回小写 `aborted`，runtime 抛 `Error('aborted')`，但 `failAgentRun()` 只识别大写 `Aborted`。未来持久化 `agent_runs` 后，用户点停止可能污染失败统计。

这不是当前最影响体验的问题，但实现时建议顺手修。

## 2. 设计目标

本次不是简单“修一个 query”，而是把 Lumen 的 Research Agent 往 Harness Engineering 落一层：

- Input Router / Planner 层先判断用户输入类型，再决定下一步动作。
- Guide 层负责意图识别、相对时间解析、工具调用计划。
- Tool 层接收结构化搜索参数，而不是只接收自然语言 query。
- Sensor 层评估结果是否满足“时间约束 + 主题约束”。
- Model policy 层按任务角色路由 Flash / Pro。
- Trace 层记录每一步的计划、工具参数、结果数量、重试原因，后面才能做闭环改进。

重要修正：不要把“是否需要读论文”继续写死在 `ResearchPage.tsx`。这会让系统越来越像 workflow，而不是 agent。正确方向是让 planner 基于用户输入、当前会话状态、可用工具和职责说明，选择下一步：
- `direct_answer`：普通问答、时间日期、闲聊、能力说明。
- `read_local_papers`：用户明确要求分析本地论文库、某篇论文、某个项目/集合。
- `academic_search`：用户要求找外部论文、最新论文、验证文献、补充研究材料。
- `clarify`：输入不足以判断需要哪个工具。
- `feedback`：用户评价上一轮结果或要求调整策略。

Claude Code 这类系统的关键不是“更长的 prompt”，而是 prompt + tool affordance + runtime contract 三件事一起成立：模型知道自己是谁、能调用什么工具、什么时候不该调用工具；runtime 也必须尊重这个判断，而不是页面层提前把 PDF 全塞进去。

`doc/prompt/claude_code/2.1.112.md` 已更新为完整得多的 914 行 prompt。它对 Lumen 的启发是：Agent 能力不是只靠模型推理，而是由系统提示词、动态工具清单、权限模式、上下文注入、记忆机制、子 Agent/Skill 调度、输出节奏共同组成的 Harness。Lumen 目前缺少的正是这个“运行契约”。

Claude Code prompt 中值得借鉴的结构：
- 角色声明：一开始明确 “You are a Claude agent... interactive agent... helps users with software engineering tasks”。Lumen 也要明确“你是研究 Agent 调度器，不是普通聊天模型”。
- 当前上下文：注入 `currentDate`，并提醒“可能相关，也可能不相关”。Lumen 需要注入当前日期、时区、当前项目、论文库状态、是否有选中论文。
- 动态工具清单：用 system-reminder 暴露 deferred tools，并要求先 ToolSearch 加载 schema。Lumen 可以暴露 `read_local_papers`、`academic_search`、`answer_directly`、`ask_clarifying_question` 等工具及调用条件。
- 技能/子 Agent：Claude Code 把 Skill 和 Agent 作为可选择能力，并写清什么时候用、什么时候不用。Lumen 可以把“文献搜索”“本地论文阅读”“综述生成”“引用检查”拆成可路由能力。
- 权限与风险边界：Claude Code 明确区分可逆本地操作和高风险操作。Lumen 也要区分低成本直接回答、读本地论文、联网搜索、长期记忆/状态写入。
- 记忆与状态：Claude Code 有 memory 类型和何时保存/何时验证的规则。Lumen 后续需要把用户反馈、搜索失败原因、成功 query 模板写回 trace/feedback，而不是只在本轮对话里消失。
- 输出契约：Claude Code 对用户可见输出、工具不可见结果、工作中更新、最终摘要都有约束。Lumen 也需要回答格式、搜索说明、引用展示、不确定性说明等输出协议。

## 3. 推荐实现方案

### 3.0 Agent Input Router，而不是页面层 workflow

建议新增一个明确的 planner 输出 schema，让模型第一步只做“输入判断 + 动作选择”，不要直接长篇回答：

```ts
type AgentAction =
  | 'direct_answer'
  | 'read_local_papers'
  | 'academic_search'
  | 'clarify'
  | 'feedback'

interface AgentPlan {
  action: AgentAction
  reason: string
  response?: string
  localPaperRequest?: {
    target?: 'current_library' | 'selected_paper' | 'project' | 'collection'
    query?: string
  }
  searchRequest?: {
    queries: string[]
    recencyIntent?: 'none' | 'latest' | 'this_week' | 'recent_days' | 'this_year' | 'custom_range'
    timeRange?: {
      fromDate?: string
      untilDate?: string
    }
    sortMode?: 'relevance' | 'newest' | 'balanced'
  }
}
```

Planner system prompt 应明确告诉模型：
- 你是 Lumen 的研究 Agent 调度器，不是普通聊天模型。
- 你的职责是判断用户当前要不要调用工具。
- 你可以选择直接回答、读取本地论文、搜索外部论文、追问澄清或处理反馈。
- 不要因为有本地论文库就自动读取论文。
- 不要因为用户说“这周/最近/最新”就只在 query 里写 recent；必须产出日期范围。
- 如果用户只是问当前年份、日期、你是谁、能做什么，选择 `direct_answer`。

Planner user prompt 应注入一个结构化 context packet，而不是只给最近对话：
```ts
interface AgentInputContext {
  currentDate: string
  timezone: string
  hasLocalPapers: boolean
  localPaperCount: number
  activeProjectName?: string
  selectedPaperTitle?: string
  recentMessages: Array<{ role: string; content: string }>
  availableTools: Array<{
    name: 'direct_answer' | 'read_local_papers' | 'academic_search' | 'clarify' | 'feedback'
    whenToUse: string
    cost: 'low' | 'medium' | 'high'
  }>
}
```

关键点：把“可用工具 + 工具成本 + 当前状态”交给模型判断，而不是页面层提前替模型判断。

Runtime 应按 `AgentPlan.action` 调用对应工具：
- `direct_answer`：直接轻量回答，必要时用 Flash。
- `read_local_papers`：这一步才调用 `extractPaperContent()` 或新的 local paper reader tool。
- `academic_search`：调用外部学术搜索工具，并传入结构化 `searchRequest`。
- `clarify` / `feedback`：不调用搜索或读论文。

这比单纯加正则更 Agent 化：规则只约束输出契约，真正的工具选择交给模型。

### 3.1 简单问题 Fast Path

这一节不要理解为“继续加一堆正则，把 Agent 写死”。更准确的设计是：先由 Agent Input Router / Planner 决定 `direct_answer`；只有极少数确定性问题可以本地短路，作为性能保护。

建议规则：
- `今年是哪一年`、`现在是哪一年`、`今天几号`、`现在几点`：本地直接回答，基于 `new Date()` 和本地时区。
- `你是谁`、`你能做什么`：本地或 Flash 快速回答。
- 不涉及本地论文、外部搜索、复杂分析的问题：不要调用 `extractPaperContent()`。

关键改动点：
- `src/pages/ResearchPage.tsx`：去掉 `messages.length === 0 ||` 这个首轮强制读论文条件。
- 只有用户明确说“分析/总结/对比/阅读/这篇论文/这个集合/我的论文库/文献”等，才构造 paperContext。
- 更理想的结构：先让 harness planner 判定 `action=read_local_papers` 后再读本地论文；建议优先朝这个方向做，而不是继续扩展页面层正则。

验收：
- 问“今年是哪一年”应在 1 秒级返回“今年是 2026 年。”，不出现“正在阅读论文并分析...”。
- 首轮问普通闲聊/时间问题，不应读 PDF。
- 问“帮我总结当前论文库里关于 attention 的论文”仍应读取本地论文上下文。

### 3.2 DeepSeek Flash / Pro 模型路由

DeepSeek 官方文档显示目前 API 可用 `deepseek-v4-flash` 和 `deepseek-v4-pro`，OpenAI 兼容 base URL 是 `https://api.deepseek.com`，Anthropic 兼容 base URL 是 `https://api.deepseek.com/anthropic`。Flash 适合快速、低成本步骤；Pro 适合复杂综合和高价值推理。

建议新增 Agent role：
- `planner`：`deepseek-v4-flash`，non-thinking，低温，短输出，最好启用 JSON 输出。
- `reflector`：`deepseek-v4-flash`，non-thinking，短输出。
- `risk_sensor`：优先不用 LLM；如果必须用，Flash。
- `simple_direct_answer`：本地规则或 Flash。
- `synthesizer`：`deepseek-v4-pro`，必要时 thinking。
- `local_paper_analysis`：`deepseek-v4-pro`，尤其有长 PDF 上下文时。

建议接口形态：
```ts
type AgentModelRole =
  | 'planner'
  | 'reflector'
  | 'synthesizer'
  | 'simple_answer'
  | 'local_paper_analysis'

interface ChatOptions {
  provider?: string
  model?: string
  endpoint?: string
  temperature?: number
  maxTokens?: number
  responseFormat?: 'json' | 'text'
  signal?: AbortSignal
}
```

兼容性建议：
- 不要破坏现有 `chatWithAI(messages, provider?, signal?)` 调用。
- 可以新增 `chatWithAI(messages, options)` overload，或新增 `chatWithAgentModel(messages, role, signal)` 包装层。
- 如果用户 provider 是 DeepSeek，则按 role 自动覆盖模型：
  - fast roles -> `deepseek-v4-flash`
  - deep roles -> `deepseek-v4-pro`
- 如果 provider 不是 DeepSeek，则保留用户配置的 default model。
- custom provider 继续支持 `URL|model`，但后续可扩展为设置页的 fast/deep 两个模型字段。

验收：
- Planner / reflector 请求体中的 model 是 `deepseek-v4-flash`。
- 综合搜索结果的 synthesizer 请求体中的 model 是 `deepseek-v4-pro`。
- 非 DeepSeek Provider 不受影响。

### 3.3 SearchPlan 增加结构化时效字段

建议把 `SearchPlan` 扩展为：
```ts
interface SearchPlan {
  intent: ResearchIntent
  shouldSearch: boolean
  queries: string[]
  response?: string
  reason?: string
  recencyIntent?: 'none' | 'latest' | 'this_week' | 'recent_days' | 'this_year' | 'custom_range'
  timeRange?: {
    fromDate?: string
    untilDate?: string
  }
  sortMode?: 'relevance' | 'newest' | 'balanced'
}
```

Prompt 要注入当前日期和时区，例如：
- 当前日期：`2026-05-01`
- 当前时区：`Asia/Shanghai`

相对时间解析规则：
- “本周/这周”：按本地日历周，`fromDate=2026-04-27`，`untilDate=2026-05-01`。
- “最近7天”：`fromDate=2026-04-24`，`untilDate=2026-05-01`。
- “今年/2026年”：`fromDate=2026-01-01`，`untilDate=2026-05-01`。
- “最新/近期”但没给具体范围：默认最近 30 天；如果结果太少，再放宽到今年。

Planner 规则：
- 用户明确要“最新、本周、最近、今年、刚发、new papers、latest papers”时，`sortMode='newest'`。
- 不要只把 `recent` 写进 query；必须填 `timeRange`。
- 搜索 query 仍然用英文 scholarly query，例如 `artificial intelligence large language models`.

验收：
- “搜索这周的 AI 论文”生成 `timeRange.fromDate=2026-04-27`、`untilDate=2026-05-01`、`sortMode='newest'`。
- “最近7天的 AI agent paper”生成 `fromDate=2026-04-24`。
- Planner JSON 解析失败时，normalize 逻辑要给安全 fallback。

### 3.4 搜索工具接收 SearchOptions

前端 service 建议从：
```ts
searchPapers(query: string, limit = 8)
```

扩展为：
```ts
interface SearchOptions {
  fromDate?: string
  untilDate?: string
  sortMode?: 'relevance' | 'newest' | 'balanced'
}

searchPapers(query: string, limit = 8, options?: SearchOptions)
```

`agent/tools.ts` 不应只传 query；应把 `plan.timeRange` 和 `plan.sortMode` 传入每个 query。

Rust Tauri command 建议改为：
```rust
pub struct SearchOptions {
    pub from_date: Option<String>,
    pub until_date: Option<String>,
    pub sort_mode: Option<String>,
}

pub async fn search_papers(
    query: String,
    limit: Option<i32>,
    options: Option<SearchOptions>,
) -> Result<SearchResponse, String>
```

dev fallback `vite.config.ts` 也必须同步支持这些 query params，否则浏览器 dev 和 Tauri app 行为会不一致。

### 3.5 各搜索源的日期过滤与排序

OpenAlex：
- 新论文优先：`sort=publication_date:desc,relevance_score:desc` 或 `publication_year:desc,relevance_score:desc`。
- 有日期范围时加 filter：`from_publication_date:YYYY-MM-DD` / `to_publication_date:YYYY-MM-DD`。
- 当前代码只用 `sort=relevance_score:desc`，需要改。

Semantic Scholar：
- 优先考虑 `/graph/v1/paper/search/bulk`，因为官方教程说明 bulk search 支持 `sort`、`publicationDateOrYear`、`year`。
- 新论文优先：`sort=publicationDate:desc`。
- 日期范围：`publicationDateOrYear=YYYY-MM-DD:YYYY-MM-DD`；仅年份可用 `year=2026-`。
- 如果继续用 `/paper/search`，要确认该 endpoint 是否支持相同参数；否则改成 bulk。

Crossref：
- 日期范围：`filter=type:journal-article,from-pub-date:YYYY-MM-DD,until-pub-date:YYYY-MM-DD`。
- 新论文优先：`sort=published&order=desc`。
- Crossref 日期元数据有时只有年/月，注意它可能把不完整日期解释为最早可能日期。

arXiv：
- 新论文优先：`sortBy=submittedDate&sortOrder=descending`。
- arXiv API 对日期范围过滤不如其他源直观，建议先用 submittedDate 排序，再在本地解析 `published` 后过滤 `fromDate/untilDate`。
- 对 AI 论文可考虑在 planner query 里加入分类词，但不要硬编码只搜 `cs.AI`，否则会漏掉 `cs.LG`、`cs.CL`、`stat.ML`。

合并排序：
- 如果 `sortMode='newest'`，最终 merge 排序应优先 date/year，其次 relevance，再其次 citation/journal。
- 当前 `quality_score` 中 citation/top journal 权重太高，recency_score 太弱；需要按模式切换 scoring，而不是一个分数打天下。
- `balanced` 可以保留当前质量逻辑，但给近两年结果更高权重。

验收：
- 搜索“这周 AI 论文”时，工具请求实际带上日期范围和 newest 排序。
- 返回列表优先显示 2026 年或具体日期最新的论文；如果本周结果为空，回答中明确说“本周未检到足够结果，已放宽到最近30天/今年”。
- 不能再把 2014-2025 的经典高引论文排在“本周”问题顶部。

### 3.6 Sensor 也要检查时间约束

`reflectOnSearchResults()` 目前主要判断相关性。建议增加：
- 如果 `plan.timeRange` 存在，统计结果中落在范围内的比例。
- 如果没有任何结果满足时间范围，`status='retry'`，并建议：
  - 切换 newest sort。
  - 放宽范围到最近 30 天或今年。
  - 加入 arXiv-oriented query。
- 如果结果满足主题但不满足时间，回答必须显式说明。

验收：
- 反射器不能只说“有 12 条结果所以 sufficient”；它要看日期是否满足。
- trace 里能看到 retry 原因是 `time_range_mismatch` 或类似字段。

### 3.7 取消状态修复

建议顺手修：
- 在 `runAcademicSearches()` 中如果 `signal.aborted`，抛 `new DOMException('Aborted', 'AbortError')`。
- 或者把 `failAgentRun()` 的 abort 判断改成大小写不敏感，并识别 `AbortError`。
- 更完整：`searchPapers()` 支持 `AbortSignal`，让 dev fetch / Tauri invoke 也能中断。

验收：
- 用户点停止后 trace status 是 `cancelled`，不是 `failed`。

## 4. 推荐实施顺序

1. 先修 Fast Path 和 `ResearchPage.tsx` 的首轮强制读论文问题。这个能最快改善“简单问题很慢”。
2. 再做模型路由。先支持 DeepSeek fast/deep role override，保持其他 provider 兼容。
3. 扩展 `SearchPlan` 和 planner prompt，加入日期/排序字段。
4. 扩展 `searchPapers()`、Rust command、dev fallback，打通 `SearchOptions`。
5. 改各搜索源 URL 参数和最终排序模式。
6. 加 time-aware sensor 和 trace 字段。
7. 补测试与人工验收案例。

## 5. 测试建议

单元/集成测试：
- planner：`这周的 AI 论文` -> `this_week` + `2026-04-27..2026-05-01` + `newest`。
- planner：`最近7天 diffusion paper` -> `2026-04-24..2026-05-01`。
- planner：`推荐几篇 transformer 经典论文` -> `sortMode='relevance'`，不要强行日期过滤。
- search URL builder：OpenAlex / Semantic Scholar / Crossref / arXiv 的 URL 参数符合上面的规则。
- ranking：`sortMode='newest'` 时，2026 低引用论文应排在 2020 高引用论文前面。
- abort：取消后 trace 是 `cancelled`。

人工验收：
- “今年是哪一年”快速回答，不读论文。
- “你是谁”快速回答，不读论文。
- “搜索这周的 AI 论文”返回最新论文；如果无结果，说明放宽策略。
- “搜索 2024 年 RAG survey”仍能按 2024 年筛选。
- “帮我总结我论文库里的 attention 论文”仍能读本地论文。

## 6. 文档与版本管理建议

当前 `doc/communication` 作为 Codex 窗口之间的交接区是合适的。建议先不要单独建一个 git 仓库，原因：
- 文档和代码强耦合，应该跟随同一个 commit，便于追溯“哪次代码改动依据哪份 brief”。
- 单独 repo 会增加同步成本，反而容易让实现和文档脱节。
- 如果担心 doc 噪音，可以在主仓库里建立规范：`doc/communication/YYYY-MM-DD-topic.md` 记录协作过程，`doc/architecture/` 放稳定架构文档。

建议约定：
- 每个 Codex 窗口实施前先读最新 communication brief。
- 实施完成后写一份 implementation notes。
- review 后写 review notes。
- 真正稳定下来的设计，再整理进 `doc/architecture` 或 README。
- 提交时把相关 doc 和代码放在同一个 commit 或相邻 commit。

## 7. 参考资料

- DeepSeek V4 发布说明：`https://api-docs.deepseek.com/news/news260424`
- DeepSeek 模型与价格：`https://api-docs.deepseek.com/quick_start/pricing`
- OpenAlex sort：`https://developers.openalex.org/guides/sort`
- Semantic Scholar API tutorial：`https://www.semanticscholar.org/product/api/tutorial`
- Crossref filters：`https://www.crossref.org/documentation/retrieve-metadata/rest-api/rest-api-filters/`
- Crossref REST API sort/order：`https://github.com/CrossRef/rest-api-doc`
- arXiv API sort 参数可参考官方 user manual；若页面不可访问，可用 `arxiv.py` 文档交叉确认 `submittedDate` / `lastUpdatedDate` / `relevance` 与 `ascending` / `descending`。
