import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const markdownContentSource = readFileSync(`${root}/src/components/common/MarkdownContent.tsx`, 'utf8')
const appCssSource = readFileSync(`${root}/src/index.css`, 'utf8')
const researchPageSource = readFileSync(`${root}/src/pages/ResearchPage.tsx`, 'utf8')
const packageJsonSource = readFileSync(`${root}/package.json`, 'utf8')
const markdownCorpusSource = readFileSync(`${root}/tests/fixtures/markdown-display-corpus.md`, 'utf8')

test('markdown tables render inside their own horizontal scroll wrapper', () => {
  assert.match(markdownContentSource, /const markdownComponents: Components = \{[\s\S]*table\(/)
  assert.match(markdownContentSource, /markdown-table-scroll/)
  assert.match(markdownContentSource, /components=\{markdownComponents\}/)
})

test('markdown table CSS keeps wide tables readable inside message bubbles', () => {
  assert.match(appCssSource, /\.markdown-table-scroll\s*\{[\s\S]*max-width:\s*100%/)
  assert.match(appCssSource, /\.markdown-table-scroll\s*\{[\s\S]*overflow-x:\s*auto/)
  assert.match(appCssSource, /\.markdown-table-scroll\s*>\s*table\s*\{[\s\S]*width:\s*max-content/)
  assert.match(appCssSource, /\.markdown-table-scroll\s*>\s*table\s*\{[\s\S]*min-width:\s*100%/)
  assert.match(appCssSource, /\.markdown-table-scroll\s+th,\s*\.markdown-table-scroll\s+td\s*\{[\s\S]*word-break:\s*normal/)
})

test('research message bubbles can shrink instead of being widened by table content', () => {
  assert.match(researchPageSource, /max-w-\[85%\][^`]*min-w-0/)
})

test('markdown display corpus covers high-risk research answer shapes', () => {
  assert.match(markdownCorpusSource, /\$O\(n \\log n\)\$/)
  assert.match(markdownCorpusSource, /\$\$[\s\S]*\\operatorname\{score\}[\s\S]*\$\$/)
  assert.match(markdownCorpusSource, /\| 论文 \| 研究对象 \| 核心机制 \|/)
  assert.match(markdownCorpusSource, /```ts[\s\S]*function score/)
  assert.match(markdownCorpusSource, /!\[论文图示\]\(https:\/\/example\.com/)
  assert.match(markdownCorpusSource, /- \[x\] 已覆盖任务列表/)
  assert.match(markdownCorpusSource, /~~删除线文本~~/)
  assert.match(markdownCorpusSource, /\[\^note\]/)
  assert.match(markdownCorpusSource, /https:\/\/doi\.org\/10\.1234\/lumen\.research\.agent/)
})

test('markdown renderer enables GFM and KaTeX math plugins', () => {
  assert.match(packageJsonSource, /"remark-math":/)
  assert.match(packageJsonSource, /"rehype-katex":/)
  assert.match(packageJsonSource, /"katex":/)
  assert.match(markdownContentSource, /import remarkMath from 'remark-math'/)
  assert.match(markdownContentSource, /import rehypeKatex from 'rehype-katex'/)
  assert.match(markdownContentSource, /import 'katex\/dist\/katex\.min\.css'/)
  assert.match(markdownContentSource, /remarkPlugins=\{\[remarkGfm,\s*remarkMath\]\}/)
  assert.match(markdownContentSource, /rehypePlugins=\{\[rehypeKatex\]\}/)
})

test('markdown CSS protects formulas, images, links, and task lists from layout overflow', () => {
  assert.match(appCssSource, /\.markdown-body\s*\{[\s\S]*overflow-wrap:\s*anywhere/)
  assert.match(appCssSource, /\.markdown-body img\s*\{[\s\S]*max-width:\s*100%/)
  assert.match(appCssSource, /\.markdown-body \.katex-display\s*\{[\s\S]*overflow-x:\s*auto/)
  assert.match(appCssSource, /\.markdown-body \.katex-display\s*>\s*\.katex\s*\{[\s\S]*white-space:\s*normal/)
  assert.match(appCssSource, /\.markdown-body input\[type="checkbox"\]\s*\{[\s\S]*accent-color:\s*var\(--color-moss\)/)
  assert.match(appCssSource, /\.markdown-body \.footnotes\s*\{[\s\S]*font-size:\s*var\(--t-caption\)/)
  assert.match(appCssSource, /\.markdown-body del\s*\{[\s\S]*color:\s*var\(--color-ink-mute\)/)
})
