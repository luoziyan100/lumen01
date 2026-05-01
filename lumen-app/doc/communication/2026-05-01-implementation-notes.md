# Lumen Agent Harness 第一阶段实施记录

日期：2026-05-01
实现窗口：Codex
对应任务：`2026-05-01-agent-harness-implementation-guide.md` 第一阶段

## 1. 本次提交前 checkpoint

开始 harness refactor 前，已先提交当前搜索 Agent / 学术搜索 / dev proxy / browser fallback 改动：

```text
bd9122a feat: add academic search agent
```

根目录下的 `lumen-architecture.html` 仍保持未跟踪状态，未纳入该 checkpoint 或本次 refactor。

## 2. 已完成改动

把原本集中在 `lumen-app/src/services/research-agent.ts` 的 Research Agent 逻辑拆到新的 `lumen-app/src/agent/` 目录：

```text
lumen-app/src/agent/
├── types.ts
├── prompts.ts
├── guides.ts
├── tools.ts
├── sensors.ts
├── traces.ts
└── runtime.ts
```

职责划分如下：

- `types.ts`：定义 `AgentRun`、`AgentStep`、`SearchPlan`、`SearchReflection`、`ToolResult`、`SensorResult`、`ResearchAgentResult` 等共享类型。
- `prompts.ts`：集中放置 planner、reflection、synthesis prompt 和 prompt 构造函数。
- `guides.ts`：迁移 planner 逻辑，包括 `planResearchAction`、`extractJsonObject`、`normalizePlan`、`compactRecentMessages`。
- `tools.ts`：包装学术搜索工具，包括 `academicSearchTool`、`runAcademicSearches`、`mergeSearchBatches`、`formatSearchBatches`。
- `sensors.ts`：迁移搜索结果反思逻辑，并新增 `detectAnswerRisks` 启发式输出检测。
- `traces.ts`：新增内存级 trace 结构生成与步骤记录工具，第一阶段只随返回值带出，不持久化。
- `runtime.ts`：新增 `runResearchHarness()`，统一编排 guide、tool、sensor、model synthesis。

保留了旧入口：

```text
lumen-app/src/services/research-agent.ts
```

现在该文件只做兼容导出：

```ts
export { runResearchHarness as runResearchAgent } from '../agent/runtime'
export type { ResearchAgentResult } from '../agent/types'
```

因此 `lumen-app/src/pages/ResearchPage.tsx` 无需改 import，用户可见行为应保持基本不变。

## 3. 行为边界

本次只做第一阶段结构拆分：

- 没有改 Research LUI 交互。
- 没有新增数据库表。
- 没有持久化 `AgentRun` / `AgentStep`。
- 没有引入 LangChain / LangGraph / Agents SDK。
- 没有扩大模型可调用工具范围；工具执行仍由 TypeScript runtime 控制。

`runResearchHarness()` 现在会返回 `trace` 字段，但当前页面只消费 `reply`，所以 trace 暂时不展示。

## 4. 验证

已运行：

```text
npm run build
cargo check
```

结果：

- `npm run build` 通过。
- `cargo check` 通过。
- Vite 仍提示已有 chunk size warning 和 pdfjs dynamic import warning，这两个是既有构建提示，不是本次 refactor 新增失败。

## 5. 后续建议

下一步可以进入第二阶段前的轻量检查：

- 用 in-app browser 再跑一次实际 Research 搜索链路，确认 HMR 后运行时无问题。
- 给 `detectAnswerRisks` 增加更具体的 source coverage 检查。
- 如果要进入第二阶段，再新增 Rust 表与 commands，持久化 `agent_runs` / `agent_steps` / `agent_feedback`。
