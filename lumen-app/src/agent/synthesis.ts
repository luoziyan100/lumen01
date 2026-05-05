/**
 * [INPUT]: 依赖 resolved question、SearchPlan、ToolEvidenceBundle
 * [OUTPUT]: 对外提供 synthesis 阶段输入对象
 * [POS]: agent pipeline 的 Synthesis 层边界，后续集中管理最终回答生成
 */
import { buildResearchJudgmentReport, type ResearchJudgmentReportInput } from './research-judgment.ts'
import type { ResolvedUserQuestion, RunResearchHarnessInput, SearchPlan, ToolEvidenceBundle } from './types.ts'

export interface SynthesisInput {
  input: RunResearchHarnessInput
  resolvedQuestion: ResolvedUserQuestion
  decision: SearchPlan
  toolEvidence: ToolEvidenceBundle
}

export function buildSynthesisInput(
  input: RunResearchHarnessInput,
  resolvedQuestion: ResolvedUserQuestion,
  decision: SearchPlan,
  toolEvidence: ToolEvidenceBundle,
): SynthesisInput {
  return {
    input,
    resolvedQuestion,
    decision,
    toolEvidence,
  }
}

export function synthesizeResearchJudgmentReport(
  reportInput: ResearchJudgmentReportInput,
  toolEvidence: ToolEvidenceBundle,
): string {
  return buildResearchJudgmentReport({
    ...reportInput,
    papers: reportInput.papers.map((paper, index) => {
      const note = toolEvidence.evidence[index]
      if (!note) return paper
      return {
        ...paper,
        abstractText: paper.abstractText ?? note.paper.abstract_text,
        fullText: note.evidenceLevel === 'pdf_text_preview' ? note.text : null,
        evidenceSource: note.evidenceSource,
        pdfUrl: note.pdfUrl ?? paper.pdfUrl ?? paper.url,
        pdfTempPath: note.pdfTempPath ?? null,
        evidenceError: note.warning ?? null,
      }
    }),
  })
}
