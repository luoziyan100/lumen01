/**
 * [INPUT]: 依赖 react-markdown, remark-gfm
 * [OUTPUT]: 对外提供 MarkdownContent 组件
 * [POS]: common 模块的 Markdown 渲染组件，被 AiPanel 和 ResearchPage 消费
 */
import ReactMarkdown, { type Components } from 'react-markdown'
import rehypeKatex from 'rehype-katex'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import 'katex/dist/katex.min.css'

interface MarkdownContentProps {
  content: string
}

const markdownComponents: Components = {
  table(props) {
    const { node, ...tableProps } = props
    void node

    return (
      <div className="markdown-table-scroll" role="region" aria-label="Markdown 表格" tabIndex={0}>
        <table {...tableProps} />
      </div>
    )
  },
}

export function MarkdownContent({ content }: MarkdownContentProps) {
  return (
    <div className="markdown-body">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={markdownComponents}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
