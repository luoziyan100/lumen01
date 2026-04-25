/**
 * [INPUT]: 依赖 react-markdown, remark-gfm
 * [OUTPUT]: 对外提供 MarkdownContent 组件
 * [POS]: common 模块的 Markdown 渲染组件，被 AiPanel 和 ResearchPage 消费
 */
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface MarkdownContentProps {
  content: string
}

export function MarkdownContent({ content }: MarkdownContentProps) {
  return (
    <div className="markdown-body">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  )
}
