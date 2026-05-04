# Lumen Agent Harness 实施交接说明

日期：2026-05-01
撰写者：Codex（GPT-5，本窗口）
接收者：后续负责实现的 Codex 窗口
目标：把 Lumen 现有 Research Agent 从“单个研究编排器”升级为可观察、可评测、可迭代的 Harness Engineering 系统。

Status: BACKGROUND
Audience: implementer
Action: reference-only
Supersedes: none
Next: 第一阶段已实施；当前实施请优先读 `active/2026-05-02.01.active.brief.paper-preview-temp-cache.md`。

## 0. 我是谁，以及为什么写这份文档

我是当前对话窗口里的 Codex。由于不同 Codex 窗口之间不能直接共享运行时上下文，也不能彼此发消息，所以我们用项目内文档作为交接媒介。

请把本文件视为“工程任务说明 + 架构意图 + 实施边界”。实现窗口应该先阅读本文件，再阅读当前代码，不要只凭本文直接改代码。本文描述的是方向和约束，代码仍然以仓库当前状态为准。

## 1. 当前判断

Lumen 现在已经有 Agent 雏形：

- `src/pages/ResearchPage.tsx`：Research LUI 聊天入口，负责收集论文库、collections、历史消息、图片输入、PDF 文本上下文，并保存研究会话。
- `src/services/research-agent.ts`：当前 Agent 编排器，包含规划、搜索、反思、综合回答。
- `src/services/ai.ts`：多模型适配层，支持 OpenAI / DeepSeek / Claude / Custom，并处理图片格式和中断。
- `src/services/search.ts` + `src-tauri/src/commands/search.rs`：学术搜索工具，连接 OpenAlex / arXiv / Semantic Scholar / Crossref。
- `src/services/citation-extraction.ts`：引用提取流程，读 PDF 参考文献，用 AI 解析 JSON，再写入 citation edges。

这套系统现在更像一个 workflow-agent，而不是完整 harness。它已经有 Guides 的一部分，也有一个初级 Sensor（搜索结果反思），但缺少统一的运行时、工具注册、trace、质量检测、失败样本沉淀、eval 回归和规则写回。

## 2. Harness Engineering 在 Lumen 里的定义

不要把 harness 理解成某个框架。这里的 harness 是围绕模型的一套工程控制层：

```text
Agent = Model + Harness

Model:
  负责推理、生成、改写 query、判断结果、综合回答。

Harness:
  负责输入整理、上下文注入、工具权限、执行编排、输出检测、错误记录、反馈闭环。
```

Lumen 的目标不是“多加几个 Agent 名字”，而是让每一次研究回答都有可追踪的执行过程，让每一次失败都能变成规则、样本或测试。

## 3. 建议目标架构

建议新增 `src/agent/` 目录，先做一个轻量 harness，不引入重框架。

```text
src/agent/
├── types.ts          # AgentRun / AgentStep / ToolCall / GuideResult / SensorResult 等类型
├── runtime.ts        # runResearchHarness() 统一入口
├── guides.ts         # 输入校验、意图规划、上下文注入、格式约束、工具策略
├── tools.ts          # 工具注册表：search / readPdf / saveNote / citations 等
├── sensors.ts        # 搜索质量、输出格式、引用真实性、幻觉风险等检测
├── traces.ts         # 本地 trace 事件生成与保存接口
├── feedback.ts       # 用户反馈、错误归因、规则建议
└── prompts.ts        # planner / reflector / synthesizer / citation verifier prompt
```

迁移原则：

- 不要一次性推翻 `research-agent.ts`。
- 先把现有逻辑搬进 harness 结构，保持行为不变。
- 再逐步加 trace、sensor、feedback。
- 保持 Research 的 LUI 风格，不要改回复杂表单/项目管理 GUI。

## 4. 第一阶段实施任务

第一阶段目标：把当前 `research-agent.ts` 拆成 harness 结构，但尽量不改变用户可见行为。

建议步骤：

1. 新增 `src/agent/types.ts`

建议包含：

```ts
export type ResearchIntent =
  | 'academic_search'
  | 'local_research'
  | 'answer'
  | 'feedback'
  | 'clarify'

export interface AgentRun {
  id: string
  kind: 'research'
  userText: string
  startedAt: string
  finishedAt?: string
  status: 'running' | 'succeeded' | 'failed' | 'cancelled'
  steps: AgentStep[]
}

export interface AgentStep {
  id: string
  type: 'guide' | 'model' | 'tool' | 'sensor' | 'output'
  name: string
  startedAt: string
  finishedAt?: string
  input?: unknown
  output?: unknown
  error?: string
}

export interface SearchPlan {
  intent: ResearchIntent
  shouldSearch: boolean
  queries: string[]
  response?: string
  reason?: string
}

export interface SearchReflection {
  status: 'sufficient' | 'retry' | 'not_found'
  revisedQueries: string[]
  reason?: string
}
```

2. 新增 `src/agent/prompts.ts`

把 `research-agent.ts` 里三段 prompt 拆出来：

- planner prompt
- reflection prompt
- synthesis prompt

要求：prompt 文本不要散落在 runtime 中。后续要做 feedback loop 时，prompt 是最常被规则写回的地方。

3. 新增 `src/agent/guides.ts`

先迁移：

- `planResearchAction`
- `normalizePlan`
- `extractJsonObject`
- `compactRecentMessages`

后续这里会加入输入校验、工具策略和上下文预算。

4. 新增 `src/agent/sensors.ts`

先迁移：

- `reflectOnSearchResults`
- `normalizeReflection`

再新增一个很轻的输出检测函数：

```ts
export function detectAnswerRisks(answer: string): SensorResult[]
```

第一版只做简单启发式即可，例如：

- 回答里出现“根据搜索结果”但没有任何 DOI / 链接 / 标题列表。
- 回答里声明找到论文，但搜索结果为空。
- Markdown 为空或太短。

5. 新增 `src/agent/tools.ts`

先包装已有工具：

- `academicSearchTool(query, limit)`
- `readPdfContextTool(papers, userText, collections)`
- `saveResearchNoteTool(projectId, role, content)` 可暂缓，因为当前保存仍在 `ResearchPage`。

不要一开始引入复杂 tool-call 协议。第一版可以是普通 TypeScript 函数，但要统一返回结构：

```ts
export interface ToolResult<T> {
  ok: boolean
  data?: T
  error?: string
}
```

6. 新增 `src/agent/runtime.ts`

创建 `runResearchHarness()`，它应该替代或包裹当前 `runResearchAgent()`。

第一版流程保持现状：

```text
start trace
  -> guide: plan action
  -> if feedback: return response
  -> if clarify: return response
  -> if no search: direct chatWithAI(history)
  -> if search:
       tool: run academic searches
       sensor: reflect on results
       if retry: tool: run revised searches
       model: synthesize answer
       sensor: detect answer risks
return reply + plan + reflection + trace
```

`ResearchPage` 第一阶段可以只消费 `reply`，先不展示 trace。

7. 保留兼容导出

为了减少改动面，可以让 `src/services/research-agent.ts` 临时变成 compatibility wrapper：

```ts
export { runResearchHarness as runResearchAgent } from '../agent/runtime'
export type { ResearchAgentResult } from '../agent/types'
```

如果相对路径不合适，实现窗口按实际目录调整。

## 5. 第二阶段实施任务

第二阶段目标：让 harness 可观察。

建议新增后端表：

```sql
CREATE TABLE agent_runs (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  user_text TEXT NOT NULL,
  status TEXT NOT NULL,
  started_at TEXT DEFAULT (datetime('now')),
  finished_at TEXT,
  summary TEXT,
  metadata TEXT
);

CREATE TABLE agent_steps (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES agent_runs(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  started_at TEXT DEFAULT (datetime('now')),
  finished_at TEXT,
  input TEXT,
  output TEXT,
  error TEXT
);

CREATE TABLE agent_feedback (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES agent_runs(id) ON DELETE CASCADE,
  rating TEXT,
  comment TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
```

对应 Rust commands 可以放在：

```text
src-tauri/src/commands/agent.rs
```

前端 service：

```text
src/services/agent-traces.ts
```

第一版不用把所有 input/output 完整存大文本，可以截断或存摘要，避免 SQLite 被超长 PDF 上下文撑爆。

## 6. 第三阶段实施任务

第三阶段目标：建立 Feedback Loop。

建议新增：

```text
src/agent/evals/
├── cases.ts          # 固定回归样例
├── runner.ts         # 本地 eval runner
└── scoring.ts        # 简单规则评分
```

先不要追求自动大规模评测。可以从 10 个真实失败 case 开始：

- 用户反馈“搜索不准”
- 用户问集合，Agent 没识别 collection
- 回答声称读过论文但没有引用本地论文
- 外部搜索结果为空却强行推荐论文
- 图片输入时模型不支持多模态却没有提示

每个 case 最少包含：

```ts
{
  id: string
  input: string
  expectedIntent: ResearchIntent
  shouldSearch: boolean
  mustMention?: string[]
  mustNotMention?: string[]
}
```

## 7. 重要工程边界

- 不要把 Research 改成复杂 GUI。用户明确偏好 LUI 聊天窗口。
- 不要引入 LangChain / LangGraph / OpenAI Agents SDK / Claude Agent SDK 作为第一步依赖。先把本地 harness 抽象跑通。
- 不要把所有东西都叫 Agent。当前可以有 Research Harness、Search Planner、Search Reflector、Answer Synthesizer，但它们本质是 harness 内部步骤。
- 不要让模型直接决定任意工具调用。第一版工具路径仍由 TypeScript 控制，模型只输出结构化计划。
- 不要把 API Key 发送到不明第三方。当前 `ai.ts` 已经区分 Tauri 环境和 dev proxy，实现时要保持这个边界。
- 不要一次性改 Graph / Citation / Research 全部体验。先从 Research Harness 入手。

## 8. 文档沟通规范

后续多个 Codex 窗口协作时，建议使用：

```text
lumen-app/doc/communication/
├── 2026-05-01-agent-harness-implementation-guide.md
├── 2026-05-01-implementation-notes.md
├── 2026-05-01-review-notes.md
└── 2026-05-01-open-questions.md
```

建议规则：

- 每个窗口开始工作前，先读 `doc/communication` 最新文件。
- 每个窗口结束前，写一份 `implementation-notes` 或 `review-notes`，说明改了什么、没做什么、风险是什么。
- 文件名带日期；同一天多份可以加序号，例如 `2026-05-01-02-review-notes.md`。
- 文档里引用真实文件路径和函数名，不写“上面那个文件”这类上下文依赖表达。
- 不要把聊天里的所有内容原样贴进文档，只沉淀决策、任务、风险和结果。

## 9. 文档版本管理建议

短期建议：文档跟随主仓库同一个 git。

理由：

- 这些文档描述的是代码当前状态和下一步实施计划，应该和代码变更一起 review。
- 如果文档单独一个 git，很容易出现“代码已经改了，文档仓库没更新”的漂移。
- 当前 Lumen 还处于快速演化期，主仓库内版本化最简单。

中期可以考虑在主仓库里建立文档分区：

```text
lumen-app/doc/
├── architecture/      # 稳定架构文档
├── communication/     # Codex 窗口交接
├── decisions/         # ADR 架构决策记录
├── evals/             # Agent 评测说明与样例
└── archive/           # 过期交接文档归档
```

长期只有在以下情况出现时，才建议拆单独 git：

- 文档会服务多个项目，而不是只服务 Lumen。
- 文档需要独立发布成网站、手册或知识库。
- 文档有独立权限边界，例如公开文档和私有代码分离。
- 文档版本节奏与代码明显不同。

如果拆出去，也建议保留主仓库里的关键索引文档，并用 submodule/subtree 或固定链接指向文档仓库。否则协作窗口很容易找不到最新上下文。

## 10. 推荐提交节奏

建议每个阶段单独提交：

1. `docs: add agent harness implementation guide`
2. `refactor: extract research agent harness modules`
3. `feat: add agent run traces`
4. `feat: add agent feedback records`
5. `test: add research harness eval cases`

每个提交都应该能构建通过。第一阶段完成后至少运行：

```text
npm run build
cargo check
```

如果测试/构建因环境或网络失败，请在 implementation notes 里写明失败原因。

## 11. 给实现窗口的第一条任务

请从第一阶段开始，不要跳到数据库 trace。

任务描述：

```text
把 src/services/research-agent.ts 拆成 src/agent/ 下的 harness 模块。
保持 ResearchPage 的用户可见行为基本不变。
新增类型、prompts、guides、sensors、tools、runtime。
让原 runResearchAgent 继续可用，作为兼容导出。
完成后运行 npm run build 和 cargo check。
最后在 lumen-app/doc/communication 写 implementation notes。
```

最重要的完成标准：

- Research 聊天仍能回答。
- 需要外部搜索时仍能搜索、反思、重试、综合。
- 不需要搜索时仍能基于本地上下文回答。
- 文件职责比现在更清晰。
- 后续可以自然加 trace 和 feedback。
