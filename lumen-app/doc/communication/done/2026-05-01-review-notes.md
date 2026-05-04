# Lumen Agent Harness 第一阶段 Review Notes

日期：2026-05-01
Review 窗口：Codex（GPT-5，本窗口）
被 review 提交：`578ec19 refactor: extract research agent harness modules`

Status: REVIEWED
Audience: implementer | reviewer | owner
Action: reference-only
Supersedes: none
Next: 取消 trace 状态问题已在第二阶段完成记录中标为已修；当前实施入口是 `active/2026-05-02.01.active.brief.paper-preview-temp-cache.md`。

## 总体结论

第一阶段拆分方向是对的，`src/agent/` 的模块边界基本符合交接文档：

- `types.ts` 统一了 harness 类型。
- `prompts.ts` 集中了 planner / reflector / synthesizer prompt。
- `guides.ts` 承接规划与 JSON 归一化。
- `tools.ts` 包装学术搜索工具。
- `sensors.ts` 承接搜索反思，并新增回答风险检测。
- `traces.ts` 提供内存 trace。
- `runtime.ts` 统一编排 runResearchHarness。
- `services/research-agent.ts` 保留兼容导出，没有要求 `ResearchPage` 改 import。

验证结果：

```text
npm run build 通过
cargo check 通过
```

Vite 仍有 chunk size 和 pdfjs dynamic import warning，属于既有构建提示，不是本次 harness refactor 的阻塞问题。

## 发现的问题

### P3：取消搜索时 trace 可能被标记为 failed 而不是 cancelled

位置：

- `src/agent/tools.ts:64`
- `src/agent/runtime.ts:103`
- `src/agent/traces.ts:77`

当前 `runAcademicSearches()` 在发现 `signal.aborted` 时返回：

```ts
return { ok: false, error: 'aborted' }
```

随后 `runtime.ts` 会把这个结果转成：

```ts
throw new Error(searchResult.error ?? '学术搜索失败')
```

但 `failAgentRun()` 只用大小写敏感的：

```ts
String(error).includes('Aborted')
```

判断取消状态。因此这一路会被标记成 `failed`，而不是 `cancelled`。

当前页面层 `ResearchPage` 会通过 `controller.signal.aborted` 吃掉错误，所以用户界面大概率不会出错。但第二阶段如果要持久化 `agent_runs`，取消操作会污染失败统计。

建议修复：

```ts
// tools.ts
if (signal?.aborted) {
  throw new DOMException('Aborted', 'AbortError')
}
```

或者：

```ts
// traces.ts
const message = String(error).toLowerCase()
run.status = message.includes('abort') ? 'cancelled' : 'failed'
```

更完整的做法是让 `searchPapers()` 和 Rust/dev proxy 搜索路径也接受 `AbortSignal`，让正在进行中的 fetch 能被真正中断，而不仅是在每个 query 之间检查。

## 非阻塞建议

- `trace` 现在已经作为 `ResearchAgentResult.trace` 返回，但页面还不展示，这是符合第一阶段范围的。
- `detectAnswerRisks()` 目前只是启发式检测。后续可以增强 source coverage，例如检查搜索结果里的 title / DOI 是否真的出现在最终回答中。
- 后续进入第二阶段前，建议先补一次真实 Research 搜索链路的手动验证：有 API Key、能搜索、能重试、能停止。

## 工作区注意

当前根目录仍有未跟踪文件：

```text
lumen-architecture.html
```

这是之前生成的架构图 HTML，不属于 harness refactor 提交内容。是否纳入版本管理由项目 owner 决定。
