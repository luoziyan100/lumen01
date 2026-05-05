# Lumen Codex Communication Index

这个目录用于不同 Codex 窗口之间交接。请先看本索引，再决定读哪份文档。

## 目录结构

```text
doc/communication/
  README.md
  active/   # 当前待实施任务，只放未完成 brief
  review/   # 已实现，等待 review 的完成记录
  done/     # 已 review / 已确认完成的记录
  archive/  # 背景材料、旧 brief、被 superseded 的方案
```

## 当前实施入口

当前没有未完成 active brief。

最新完成的实现记录是：

`review/2026-05-05.02b.done.notes.agent-loop-integration.md`

用途：Agent Loop + Tool Use 已替代正则管道架构，解决“这5篇做报告”等自然语言引用消解失败的根本问题。

对应 active brief 已归档为：

`archive/2026-05-05.02.active.brief.agent-loop-tool-use-refactor.md`

上一份 active brief 已归档为：

`archive/2026-05-05.01.active.brief.openai-codex-oauth-model-proxy.md`

用途：OpenAI GPT / OpenClaw `openai-codex` OAuth dev 模型通道。已完成归档。

再上一份 active brief 已归档为：

`archive/2026-05-03.08.active.brief.reference-binding-crud-fix.md`

用途：用明确 CRUD 指令修复 reference binding 和 ContextPack 裁剪问题。已被 `.05.02` Agent Loop 重构 supersede——正则修补不解决根本问题。

上一份 active review brief 是：

`archive/2026-05-03.07.superseded.brief.agent-context-pack-request-changes.md`

用途：PR review 要求整改 Agent Context Pack 实现中的 P0/P1 问题。该 brief 自身把 currentPaper 写成了错误锚点，已由 `.08` 取代，不应继续按 `.07` 实施。

被 review 的 active brief 是：

`archive/2026-05-03.06.superseded.brief.agent-context-pack-tool-runtime.md`

用途：把 Lumen 从“每轮 workflow 式执行”升级成“带对象记忆、指代消解、工具契约和 Context Pack 的研究 Agent”。当前实现已写 completion notes，但 review 结论是 Request Changes。

上一份 active brief 是：

`archive/2026-05-03.05.superseded.brief.search-intent-regression-guard.md`

用途：修复“上周 AI 论文”被 planner/direct_answer/local_research 吞掉，导致 Search Agent 没有真正执行搜索的问题。若该 brief 已完成，请实施窗口补写对应 review notes 后再归档。

上一阶段完成记录是：

`review/2026-05-03.04.done.notes.result-set-memory-artifact-retrieval.md`

用途：Result Set Memory 与 Artifact Retrieval 完成记录，供 review 窗口检查。

再上一阶段完成记录是：

`review/2026-05-03.03.done.notes.search-modes-arxiv-recent-feed.md`

用途：Search Modes / arXiv recent AI feed 完成记录，供 review 窗口检查。

更早阶段完成记录是：

`review/2026-05-03.02.done.notes.web-discovery-pdf-resolver.md`

用途：Web Discovery / PDF Resolver 完成记录，供 review 窗口检查。

## 当前文档说明

| 文件 | 状态 | 给谁看 | 用途 |
| --- | --- | --- | --- |
| `review/2026-05-05.02b.done.notes.agent-loop-integration.md` | DONE | Review/Owner | Agent Loop + Tool Use 集成完成记录，含 A-E 场景验证 |
| `review/2026-05-05.02a.done.notes.agent-adapter-layer.md` | DONE | Review/Owner | LLM Adapter Layer 完成记录，含 Claude/OpenAI/ReAct message format 测试 |
| `archive/2026-05-05.02.active.brief.agent-loop-tool-use-refactor.md` | DONE | 归档 | Agent Loop + Tool Use 原 brief，已完成 |
| `archive/2026-05-05.01.active.brief.openai-codex-oauth-model-proxy.md` | DONE | 归档 | OpenAI GPT / OpenClaw OAuth dev 模型通道，已完成 |
| `archive/2026-05-03.08.active.brief.reference-binding-crud-fix.md` | ARCHIVED | Future Codex | 明确 CRUD 修复：强锚点 regex、stale currentPaper、deep_research fallback、ContextPack 裁剪 |
| `review/2026-05-03.04.done.notes.result-set-memory-artifact-retrieval.md` | DONE | Review/Owner | Result Set Memory、Artifact Retrieval、跨轮结果集引用完成记录，等待 review |
| `review/2026-05-03.03.done.notes.search-modes-arxiv-recent-feed.md` | DONE | Review/Owner | Search Modes、arXiv recent AI feed、分类 + 日期枚举搜索完成记录，等待 review |
| `review/2026-05-03.02.done.notes.web-discovery-pdf-resolver.md` | DONE | Review/Owner | Web Discovery、PDF Resolver、合法开放 PDF 查找与降级说明完成记录，等待 review |
| `review/2026-05-03.01.done.notes.evidence-gate-deep-research.md` | DONE | Review/Owner | Evidence Gate、search-to-PDF evidence pipeline、deep research 编排完成记录，等待 review |
| `review/2026-05-02.03.done.notes.research-context-pdf-url-thinking.md` | DONE | Review/Owner | 研究结构化上下文、PDF URL 语义、动态 Thinking 状态完成记录，等待 review |
| `review/2026-05-02.01.done.notes.paper-preview-temp-cache.md` | DONE | Review/Owner | 第三阶段 Paper Preview、临时缓存、显式导入边界完成记录，等待 review |
| `review/2026-05-01.02.done.notes.agent-search-routing.md` | DONE | Review/Owner | 第二阶段 Agent 搜索路由改造完成记录，等待 review |
| `done/2026-05-01-implementation-notes.md` | DONE | Review/Owner | 第一阶段实现窗口的完成记录 |
| `done/2026-05-01-review-notes.md` | REVIEWED | Future Codex | 第一阶段 review 记录 |
| `archive/2026-05-03.07.superseded.brief.agent-context-pack-request-changes.md` | SUPERSEDED | Future Codex | 被 `.08` 取代；不要继续按 `.07` 实施，尤其不要把 currentPaper 当作裸“它”的充分锚点 |
| `archive/2026-05-03.06.superseded.brief.agent-context-pack-tool-runtime.md` | SUPERSEDED | Future Codex | Agent Context Pack 原 brief，实现后仍有 reference binding 问题，继续看 `.08` |
| `archive/2026-05-03.05.superseded.brief.search-intent-regression-guard.md` | SUPERSEDED | Future Codex | Search Intent Regression 原 brief，已由完成记录和后续 Agent Context Pack brief 接续 |
| `archive/2026-05-03.04.superseded.brief.result-set-memory-artifact-retrieval.md` | SUPERSEDED | Future Codex | Result Set Memory 原 brief，已由完成记录和 2026-05-03.05 Search Intent Regression brief 接续 |
| `archive/2026-05-03.03.superseded.brief.search-modes-arxiv-recent-feed.md` | SUPERSEDED | Future Codex | Search Modes 原 brief，已由完成记录和 2026-05-03.04 Result Set Memory brief 接续 |
| `archive/2026-05-03.02.superseded.brief.web-discovery-pdf-resolver.md` | SUPERSEDED | Future Codex | Web Discovery / PDF Resolver 原 brief，已由 2026-05-03.03 Search Modes brief 接续 |
| `archive/2026-05-03.01.superseded.brief.evidence-gate-deep-research.md` | SUPERSEDED | Future Codex | Evidence Gate 原 brief，已由 2026-05-03.02 Web Discovery / PDF Resolver brief 接续 |
| `archive/2026-05-02.03.superseded.brief.research-context-pdf-url-thinking.md` | SUPERSEDED | Future Codex | 研究上下文、PDF URL、Thinking 原 brief，已由 2026-05-03.01 Evidence Gate brief 接续 |
| `archive/2026-05-02.02.superseded.brief.paper-preview-url-fix-thinking-indicator.md` | SUPERSEDED | Future Codex | PDF URL 与 Thinking 原 brief，已被 2026-05-02.03 加入 P0 上下文修复后取代 |
| `archive/2026-05-02.01.superseded.brief.paper-preview-temp-cache.md` | SUPERSEDED | Future Codex | 第三阶段 Paper Preview 原始 brief，已由 2026-05-02.02 修复 brief 接续 |
| `archive/2026-05-01-agent-search-routing-implementation-brief.md` | SUPERSEDED | Future Codex | 第二阶段任务原始 brief，已由完成记录取代 |
| `archive/2026-05-01-agent-harness-implementation-guide.md` | BACKGROUND | Future Codex | 第一阶段 harness 拆分的原始交接说明 |

如果只给另一个 Codex 一个文件，优先给最新的 `review/` 完成记录；只有存在未完成任务时才给 `active/` 里的 `ACTIVE` brief。

## 命名规范

后续新文档放入对应状态文件夹，并统一使用：

```text
YYYY-MM-DD.<seq>.<status>.<kind>.<topic>.md
```

字段说明：
- `seq`：当天序号，两位数，例如 `01`、`02`。
- `status`：`active`、`background`、`done`、`reviewed`、`superseded`。
- `kind`：`brief`、`guide`、`notes`、`review`、`decision`、`index`。
- `topic`：短横线连接的主题，例如 `agent-search-routing`。

示例：

```text
active/2026-05-03.05.active.brief.search-intent-regression-guard.md
review/2026-05-01.02.done.notes.agent-search-routing.md
done/2026-05-01.04.reviewed.review.agent-harness-phase1.md
```

## 文档头部规范

每份 communication 文档开头必须包含：

```text
Status: ACTIVE | BACKGROUND | DONE | REVIEWED | SUPERSEDED
Audience: implementer | reviewer | owner | future-codex
Action: read-and-implement | reference-only | review-only | archive
Supersedes: 文件名或 none
Next: 下一步动作
```

## 使用规则

- `active/` 同一时间尽量只保留一份任务 brief，避免两个 Codex 窗口执行不同方案。
- 新 brief 产生后，要在本 README 的“当前实施入口”更新指向。
- 实施完成后，实施窗口把完成记录写入 `review/`。
- Review 完成后，把对应 `active/` 任务和 `review/` 记录移动到 `done/` 或 `archive/`。
- 被新方案取代的旧 brief 移动到 `archive/`，并把状态改成 `SUPERSEDED`。
- 稳定下来的长期架构文档，不继续放在 `communication`，应整理到 `doc/architecture/`。
