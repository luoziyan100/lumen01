/* global console, process */
/**
 * [INPUT]: 依赖 src/agent/research-judgment 和本地 prompt 文件或 stdin
 * [OUTPUT]: 对外提供 Research Judgment CLI 报告输出
 * [POS]: scripts 层的无 GUI 验收入口，用于测试论文系统瓶颈判断能力
 */
import { readFile } from 'node:fs/promises'
import { buildResearchJudgmentReport, extractResearchJudgmentInput } from '../src/agent/research-judgment.ts'
import { enrichPapersWithDownloadedEvidence } from './research-evidence.ts'

function valueAfter(args: string[], flag: string): string | null {
  const index = args.indexOf(flag)
  if (index < 0) return null
  return args[index + 1] ?? null
}

function printHelp(): void {
  console.log(`Usage:
  npm run research:judge -- --prompt-file tests/fixtures/research-judgment-case.txt
  npm run research:judge -- --prompt-file tests/fixtures/research-judgment-case.txt --tmp-dir /tmp/lumen-pdfs
  cat prompt.txt | npm run research:judge

Options:
  --prompt-file <path>  Read the evaluation prompt from a local text file.
  --tmp-dir <path>      Directory for temporary downloaded PDFs. Defaults to OS temp.
  --no-pdf-download    Skip URL downloads and use only supplied abstracts/metadata.
  --help               Show this help message.`)
}

async function readStdin(): Promise<string> {
  if (process.stdin.isTTY) return ''
  process.stdin.setEncoding('utf8')
  let text = ''
  for await (const chunk of process.stdin) text += chunk
  return text
}

async function readPrompt(args: string[]): Promise<string> {
  const promptFile = valueAfter(args, '--prompt-file')
  if (promptFile) return readFile(promptFile, 'utf8')
  return readStdin()
}

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  if (args.includes('--help') || args.includes('-h')) {
    printHelp()
    return
  }

  const prompt = await readPrompt(args)
  if (!prompt.trim()) {
    console.error('No prompt provided. Use --prompt-file <path> or pipe text through stdin.')
    process.exitCode = 2
    return
  }

  const input = extractResearchJudgmentInput(prompt)
  if (!input) {
    console.error('Prompt is not a recognized research judgment case.')
    process.exitCode = 3
    return
  }

  const enriched = args.includes('--no-pdf-download')
    ? input
    : await enrichPapersWithDownloadedEvidence(input, {
      tempDir: valueAfter(args, '--tmp-dir') ?? undefined,
      onProgress: (message) => console.error(`[research:judge] ${message}`),
    })
  const report = buildResearchJudgmentReport(enriched)
  console.log(report)
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
