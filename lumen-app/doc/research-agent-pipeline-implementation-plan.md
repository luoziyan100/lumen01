# Research Agent Pipeline Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor Lumen Research into a staged pipeline matching `ResearchPage -> Context Loader -> Retrieval -> Resolved Question -> Planner Pack -> Decision -> Runtime Guard -> Tool Runtime -> Evidence -> Synthesis Pack -> Synthesis -> Writeback`.

**Architecture:** This is an incremental refactor. Preserve current user-facing behavior while extracting named pipeline boundaries and moving branch-specific output shaping behind standard evidence and writeback objects.

**Tech Stack:** React, TypeScript, Node test runner with `--experimental-strip-types`, existing agent modules, existing `paper-preview` PDF resolver, Tauri Rust command layer.

## Current Status

Updated: 2026-05-04

- Tasks 1-5 have been implemented as incremental, behavior-preserving pipeline boundaries.
- `ResearchPage` now applies a `ResearchWritebackPlan` instead of shaping search/current-paper/preview/report artifacts itself.
- `tool-runtime.ts` now owns standard evidence bundle constructors or thin executors for `direct_answer`, `clarify`, `feedback`, `import_to_library`, result-set link replies, `academic_search`, `deep_research`, `local_research`, `paper_detail`, `paper_preview`, and `research_judgment`.
- `academic_search`, `deep_research`, `local_research`, `paper_detail`, `paper_preview`, and `research_judgment` runtime branches now shape synthesis context and returned current-paper/search/report evidence through `ToolEvidenceBundle`.
- Context retrieval now materializes active objects into downstream context, so planner/runtime no longer rely directly on stale page-state `lastSearchResults` when an active result set exists.
- Reference binding now requires explicit paper/result-set anchors or `ResolvedUserQuestion.referencedPapers`; bare “它/这个/那个” cannot automatically bind to persistent `currentPaper`.
- Planner prompt exposure is now gated: historical `currentPaper`, `lastSearchResults`, and `recentSearchResultSets` are hidden for ordinary follow-up questions unless the current turn explicitly references papers/results.
- Remaining work is now follow-up cleanup rather than core architecture: move ordinary answer prompt assembly from `runtime.ts` into `synthesis.ts`, split intent branch handlers into smaller modules after integration tests exist, and add broader model-level integration tests for planner misrouting.

---

### Task 1: Pipeline Type Boundaries

**Files:**
- Modify: `src/agent/types.ts`
- Create: `tests/research-pipeline.test.ts`

- [ ] **Step 1: Write failing type/shape tests**

Create `tests/research-pipeline.test.ts`:

```ts
import assert from 'node:assert/strict'
import test from 'node:test'

import type { ToolEvidenceBundle, ResearchWritebackPlan } from '../src/agent/types.ts'

test('tool evidence bundle is the standard handoff into synthesis', () => {
  const bundle: ToolEvidenceBundle = {
    toolName: 'direct_answer',
    plan: { intent: 'answer', shouldSearch: false, queries: [] },
    toolResults: [],
    evidence: [],
    searchBatches: [],
    searchResults: [],
    warnings: [],
  }

  assert.equal(bundle.toolName, 'direct_answer')
  assert.equal(bundle.plan.intent, 'answer')
})

test('writeback plan keeps assistant note separate from structured artifacts', () => {
  const plan: ResearchWritebackPlan = {
    assistantReply: 'final answer',
    artifacts: [],
  }

  assert.equal(plan.assistantReply, 'final answer')
  assert.deepEqual(plan.artifacts, [])
})
```

- [ ] **Step 2: Run test to verify failure**

Run: `node --experimental-strip-types --test tests/research-pipeline.test.ts`

Expected: FAIL because `ToolEvidenceBundle` and `ResearchWritebackPlan` are not exported.

- [ ] **Step 3: Add minimal exported types**

In `src/agent/types.ts`, add:

```ts
export interface ToolEvidenceBundle {
  toolName: AgentToolName
  plan: SearchPlan
  toolResults: ContextToolResult[]
  evidence: PaperEvidenceNote[]
  searchBatches: SearchBatch[]
  searchResults: SearchResult[]
  searchResultSet?: SearchResultSet
  currentPaper?: SearchResult
  currentPaperEvidenceLevel?: CurrentPaperEvidenceLevel
  deepResearchReport?: DeepResearchReportArtifact
  replyOverride?: string
  warnings: string[]
}

export type ResearchArtifactWriteback =
  | { type: 'search_results'; data: unknown }
  | { type: 'current_paper'; data: unknown }
  | { type: 'paper_preview'; data: unknown }
  | { type: 'deep_research_report'; data: unknown }

export interface ResearchWritebackPlan {
  assistantReply: string
  artifacts: ResearchArtifactWriteback[]
}
```

- [ ] **Step 4: Verify test passes**

Run: `node --experimental-strip-types --test tests/research-pipeline.test.ts`

Expected: PASS.

### Task 2: Context Loader and Retrieval

**Files:**
- Create: `src/agent/context-loader.ts`
- Create: `src/agent/context-retrieval.ts`
- Modify: `tests/research-pipeline.test.ts`

- [ ] **Step 1: Add failing tests for context stages**

Append to `tests/research-pipeline.test.ts`:

```ts
import { loadResearchContext } from '../src/agent/context-loader.ts'
import { retrieveActiveResearchObjects } from '../src/agent/context-retrieval.ts'

test('context loader exposes active objects without compressing them into prose', () => {
  const loaded = loadResearchContext({
    userText: '看 R1-1',
    history: [],
    recentMessages: [],
    context: {
      currentDate: '2026-05-04',
      timezone: 'America/Los_Angeles',
      hasLocalPapers: false,
      localPaperCount: 0,
      activeSearchResultSetId: 'rs-1',
      recentSearchResultSets: [{
        id: 'rs-1',
        label: 'R1',
        query: 'agent memory',
        plan: { intent: 'academic_search', shouldSearch: true, queries: ['agent memory'] },
        results: [],
        createdAt: '2026-05-04T00:00:00.000Z',
      }],
    },
  })

  assert.equal(loaded.userText, '看 R1-1')
  assert.equal(loaded.activeResultSet?.label, 'R1')
})

test('context retrieval returns the active result set first', () => {
  const loaded = loadResearchContext({
    userText: '继续看这个结果集',
    history: [],
    recentMessages: [],
    context: {
      currentDate: '2026-05-04',
      timezone: 'America/Los_Angeles',
      hasLocalPapers: false,
      localPaperCount: 0,
      activeSearchResultSetId: 'rs-2',
      recentSearchResultSets: [
        {
          id: 'rs-1',
          label: 'R1',
          query: 'old',
          plan: { intent: 'academic_search', shouldSearch: true, queries: ['old'] },
          results: [],
          createdAt: '2026-05-04T00:00:00.000Z',
        },
        {
          id: 'rs-2',
          label: 'R2',
          query: 'active',
          plan: { intent: 'academic_search', shouldSearch: true, queries: ['active'] },
          results: [],
          createdAt: '2026-05-04T00:01:00.000Z',
        },
      ],
    },
  })

  const retrieved = retrieveActiveResearchObjects(loaded)
  assert.equal(retrieved.activeResultSet?.label, 'R2')
})
```

- [ ] **Step 2: Run failure**

Run: `node --experimental-strip-types --test tests/research-pipeline.test.ts`

Expected: FAIL because the modules do not exist.

- [ ] **Step 3: Implement context loader**

Create `src/agent/context-loader.ts`:

```ts
/**
 * [INPUT]: 依赖 RunResearchHarnessInput
 * [OUTPUT]: 对外提供 LoadedResearchContext
 * [POS]: agent pipeline 的 Context Loader，显式读取 history、artifacts 和 active objects
 */
import type { RunResearchHarnessInput, SearchResultSet } from './types'

export interface LoadedResearchContext extends RunResearchHarnessInput {
  activeResultSet?: SearchResultSet
}

export function loadResearchContext(input: RunResearchHarnessInput): LoadedResearchContext {
  const sets = input.context.recentSearchResultSets ?? []
  const activeResultSet = sets.find((set) => set.id === input.context.activeSearchResultSetId) ?? sets[0]
  return {
    ...input,
    activeResultSet,
  }
}
```

- [ ] **Step 4: Implement context retrieval**

Create `src/agent/context-retrieval.ts`:

```ts
/**
 * [INPUT]: 依赖 LoadedResearchContext
 * [OUTPUT]: 对外提供结构化对象检索结果
 * [POS]: agent pipeline 的 Context Retrieval，先做轻量结构化对象检索
 */
import type { SearchResult, SearchResultSet } from './types'
import type { LoadedResearchContext } from './context-loader'

export interface RetrievedResearchObjects {
  activeResultSet?: SearchResultSet
  currentPaper?: SearchResult
  recentResultSets: SearchResultSet[]
}

export function retrieveActiveResearchObjects(input: LoadedResearchContext): RetrievedResearchObjects {
  return {
    activeResultSet: input.activeResultSet,
    currentPaper: input.context.currentPaper ?? undefined,
    recentResultSets: input.context.recentSearchResultSets ?? [],
  }
}
```

- [ ] **Step 5: Verify tests**

Run: `node --experimental-strip-types --test tests/research-pipeline.test.ts`

Expected: PASS.

### Task 3: Planner and Synthesis Context Pack Names

**Files:**
- Modify: `src/agent/context-pack.ts`
- Modify: `tests/research-pipeline.test.ts`

- [ ] **Step 1: Add failing tests for explicit pack names**

Append:

```ts
import { buildPlannerContextPack, buildSynthesisContextPack } from '../src/agent/context-pack.ts'

test('planner and synthesis packs are explicit pipeline stages', () => {
  const input = loadResearchContext({
    userText: '找 agent memory 论文',
    history: [],
    recentMessages: [],
    context: {
      currentDate: '2026-05-04',
      timezone: 'America/Los_Angeles',
      hasLocalPapers: false,
      localPaperCount: 0,
    },
  })
  const resolvedQuestion = {
    originalText: input.userText,
    standaloneQuestion: input.userText,
    confidence: 1,
  }
  const decision = { intent: 'academic_search' as const, shouldSearch: true, queries: ['agent memory'] }

  const plannerPack = buildPlannerContextPack(input, resolvedQuestion, decision)
  const synthesisPack = buildSynthesisContextPack(input, resolvedQuestion, decision, { evidence: [] })

  assert.equal(plannerPack.decision.intent, 'academic_search')
  assert.equal(synthesisPack.evidence.length, 0)
})
```

- [ ] **Step 2: Run failure**

Run: `node --experimental-strip-types --test tests/research-pipeline.test.ts`

Expected: FAIL because wrapper functions are not exported.

- [ ] **Step 3: Add wrapper exports**

In `src/agent/context-pack.ts`, add:

```ts
export const buildPlannerContextPack = buildContextPack
export const buildSynthesisContextPack = buildContextPack
```

- [ ] **Step 4: Verify**

Run: `node --experimental-strip-types --test tests/research-pipeline.test.ts`

Expected: PASS.

### Task 4: Writeback Plan Builder

**Files:**
- Create: `src/agent/writeback.ts`
- Modify: `tests/research-pipeline.test.ts`
- Later modify: `src/pages/ResearchPage.tsx`

- [ ] **Step 1: Add failing writeback tests**

Append:

```ts
import { buildResearchWritebackPlan } from '../src/agent/writeback.ts'

test('writeback builder turns agent result into structured artifacts', () => {
  const writeback = buildResearchWritebackPlan({
    reply: 'answer',
    searched: false,
    plan: { intent: 'deep_research', shouldSearch: false, queries: [] },
    trace: {
      id: 'trace-1',
      kind: 'research',
      userText: 'deep read',
      startedAt: '2026-05-04T00:00:00.000Z',
      status: 'succeeded',
      steps: [],
    },
    deepResearchReport: {
      query: 'deep read',
      papers: [],
      createdAt: '2026-05-04T00:00:00.000Z',
    },
  })

  assert.equal(writeback.assistantReply, 'answer')
  assert.equal(writeback.artifacts[0].type, 'deep_research_report')
})
```

- [ ] **Step 2: Run failure**

Run: `node --experimental-strip-types --test tests/research-pipeline.test.ts`

Expected: FAIL because `writeback.ts` does not exist.

- [ ] **Step 3: Implement builder**

Create `src/agent/writeback.ts`:

```ts
/**
 * [INPUT]: 依赖 ResearchAgentResult
 * [OUTPUT]: 对外提供 ResearchWritebackPlan
 * [POS]: agent pipeline 的 State Writeback 规划层，不直接调用 React 或 storage
 */
import type { ResearchAgentResult, ResearchWritebackPlan } from './types'

export function buildResearchWritebackPlan(result: ResearchAgentResult): ResearchWritebackPlan {
  const artifacts: ResearchWritebackPlan['artifacts'] = []
  if (result.searched && result.searchResults?.length) {
    artifacts.push({ type: 'search_results', data: result })
  }
  if (result.currentPaper) {
    artifacts.push({ type: 'current_paper', data: result })
  }
  if (result.paperEvidenceNotes?.length) {
    artifacts.push({ type: 'paper_preview', data: result })
  }
  if (result.deepResearchReport) {
    artifacts.push({ type: 'deep_research_report', data: result })
  }
  return {
    assistantReply: result.reply,
    artifacts,
  }
}
```

- [ ] **Step 4: Verify**

Run: `node --experimental-strip-types --test tests/research-pipeline.test.ts`

Expected: PASS.

### Task 5: First Runtime Integration

**Files:**
- Modify: `src/agent/runtime.ts`
- Modify: `tests/research-pipeline.test.ts`

- [ ] **Step 1: Add pipeline trace test**

Add a test that calls a small exported helper from runtime once created:

```ts
import { getResearchPipelineStageNames } from '../src/agent/runtime.ts'

test('runtime exposes target pipeline stage names', () => {
  assert.deepEqual(getResearchPipelineStageNames(), [
    'context_loader',
    'context_retrieval',
    'question_resolution',
    'planner_context_pack',
    'planner_decision',
    'runtime_guard',
    'tool_runtime',
    'tool_evidence',
    'synthesis_context_pack',
    'synthesis',
    'state_writeback',
    'compression_hook',
  ])
})
```

- [ ] **Step 2: Run failure**

Run: `node --experimental-strip-types --test tests/research-pipeline.test.ts`

Expected: FAIL because helper does not exist.

- [ ] **Step 3: Add helper and use context loader in runtime**

In `src/agent/runtime.ts`, export:

```ts
export function getResearchPipelineStageNames(): string[] {
  return [
    'context_loader',
    'context_retrieval',
    'question_resolution',
    'planner_context_pack',
    'planner_decision',
    'runtime_guard',
    'tool_runtime',
    'tool_evidence',
    'synthesis_context_pack',
    'synthesis',
    'state_writeback',
    'compression_hook',
  ]
}
```

Then import and call `loadResearchContext(input)` at the start of `runResearchHarness`. This first integration should not change runtime behavior yet.

- [ ] **Step 4: Verify**

Run:

```bash
node --experimental-strip-types --test tests/research-pipeline.test.ts
npm run test:research
npm run lint
npm run build
cargo check
```

Expected: all pass.

### Task 6: Continue Branch Migration

**Files:**
- Create: `src/agent/tool-runtime.ts`
- Create: `src/agent/synthesis.ts`
- Modify: `src/agent/runtime.ts`

- [x] **Step 1: Move low-risk branches first**

Move `clarify`, `feedback`, and result-set link formatting into standard tool evidence / replyOverride handling.

Implemented: `createReplyOverrideEvidenceBundle` now handles clarify/feedback/import warning/answer-response style outputs, and `createResultSetLinksEvidenceBundle` owns result-set link formatting plus current-paper metadata.

- [x] **Step 2: Move paper detail and paper preview**

Move `paper_detail` and `paper_preview` branches into `tool-runtime.ts`, returning `ToolEvidenceBundle`.

Implemented: `runPaperDetailTool` and `runPaperPreviewTool` now return `ToolEvidenceBundle`. Runtime keeps paper-reference resolution, then records the tool executor result and passes the bundle into synthesis.

- [x] **Step 3: Move academic search and deep research**

Move search, reflection, preview evidence, deep research report creation, and synthesis dispatch into `tool-runtime.ts` plus `synthesis.ts`.

Implemented for the tool runtime boundary: `runAcademicSearchTool` owns search/reflection/retry/merge orchestration; `previewPapersAsEvidence` owns PDF preview-to-evidence conversion; `createSearchResultSetFromBatches` owns result-set construction; `buildDeepResearchReportArtifact` owns report artifact construction. Runtime still records trace steps and dispatches synthesis.

- [x] **Step 3a: Move local research output shape**

Implemented: `createLocalResearchEvidenceBundle` now owns the `read_local_papers` tool result shape used by `local_research` synthesis context.

- [x] **Step 4: Remove research judgment final-answer shortcut**

Keep research judgment as a planner decision and tool runtime mode that uses PDF evidence before synthesis.

Implemented: research judgment now creates a `deep_research` analysis plan, loads PDF preview evidence through `previewResearchJudgmentPapers`, builds a `ToolEvidenceBundle` through `createResearchJudgmentEvidenceBundle`, and generates the report through `synthesizeResearchJudgmentReport`. The result also returns `paperEvidenceNotes` and `deepResearchReport` for writeback.

- [ ] **Step 5: Full audit**

Run:

```bash
npm run test:research
node --experimental-strip-types --test tests/research-pipeline.test.ts
npm run research:judge -- --prompt-file tests/fixtures/research-judgment-case.txt --tmp-dir /tmp/lumen-research-judgment-pdfs
npm run lint
npm run build
cargo check
```

Expected: all pass, with existing Vite chunk/pdfjs warnings allowed.
