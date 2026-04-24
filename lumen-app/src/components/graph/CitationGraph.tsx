/**
 * [INPUT]: 依赖 react-force-graph-2d, services/citations, services/papers
 * [OUTPUT]: 对外提供 CitationGraph 组件
 * [POS]: graph 模块的力导向图可视化组件，被 GraphPage 消费
 */
import { useRef, useCallback, useEffect, useMemo } from 'react'
import ForceGraph2D from 'react-force-graph-2d'
import type { ForceGraphMethods } from 'react-force-graph-2d'
import type { Citation } from '../../services/citations'
import type { Paper } from '../../services/papers'

interface GraphNode {
  id: string
  title: string
  authors: string | null
  year: number | null
  citedByCount: number
  citesCount: number
  x?: number
  y?: number
}

interface GraphLink {
  source: string
  target: string
}

interface CitationGraphProps {
  papers: Paper[]
  citations: Citation[]
  width: number
  height: number
  onNodeClick?: (paperId: string) => void
  onNodeHover?: (node: GraphNode | null, event: MouseEvent) => void
}

export function CitationGraph({
  papers,
  citations,
  width,
  height,
  onNodeClick,
  onNodeHover,
}: CitationGraphProps) {
  const graphRef = useRef<ForceGraphMethods<GraphNode, GraphLink>>(undefined)

  const graphData = useMemo(() => {
    const paperIds = new Set(papers.map((p) => p.id))
    const citedByCount: Record<string, number> = {}
    const citesCount: Record<string, number> = {}

    const links: GraphLink[] = []
    for (const c of citations) {
      if (!paperIds.has(c.citing_id) || !paperIds.has(c.cited_id)) continue
      links.push({ source: c.citing_id, target: c.cited_id })
      citedByCount[c.cited_id] = (citedByCount[c.cited_id] || 0) + 1
      citesCount[c.citing_id] = (citesCount[c.citing_id] || 0) + 1
    }

    const connectedIds = new Set<string>()
    for (const l of links) {
      connectedIds.add(l.source)
      connectedIds.add(l.target)
    }

    const nodes: GraphNode[] = papers
      .filter((p) => connectedIds.has(p.id) || citations.length === 0)
      .map((p) => ({
        id: p.id,
        title: p.title,
        authors: p.authors,
        year: p.year,
        citedByCount: citedByCount[p.id] || 0,
        citesCount: citesCount[p.id] || 0,
      }))

    return { nodes, links }
  }, [papers, citations])

  useEffect(() => {
    if (graphRef.current) {
      graphRef.current.d3Force('charge')?.strength(-120)
      graphRef.current.d3Force('link')?.distance(80)
    }
  }, [graphData])

  const nodeCanvasObject = useCallback(
    (node: GraphNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const degree = node.citedByCount + node.citesCount
      const radius = Math.min(4 + degree * 1.5, 14)
      const fontSize = Math.max(10 / globalScale, 2)

      ctx.beginPath()
      ctx.arc(node.x!, node.y!, radius, 0, 2 * Math.PI)
      const alpha = Math.min(0.4 + degree * 0.12, 1)
      ctx.fillStyle = `rgba(89, 86, 173, ${alpha})`
      ctx.fill()
      ctx.strokeStyle = 'rgba(89, 86, 173, 0.6)'
      ctx.lineWidth = 1
      ctx.stroke()

      if (globalScale > 0.6) {
        const label = node.title.length > 20
          ? node.title.slice(0, 18) + '...'
          : node.title
        ctx.font = `${fontSize}px Inter, system-ui, sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'top'
        ctx.fillStyle = 'rgba(60, 56, 48, 0.75)'
        ctx.fillText(label, node.x!, node.y! + radius + 3)
      }
    },
    [],
  )

  const nodePointerAreaPaint = useCallback(
    (node: GraphNode, color: string, ctx: CanvasRenderingContext2D) => {
      const degree = node.citedByCount + node.citesCount
      const radius = Math.min(4 + degree * 1.5, 14) + 4
      ctx.beginPath()
      ctx.arc(node.x!, node.y!, radius, 0, 2 * Math.PI)
      ctx.fillStyle = color
      ctx.fill()
    },
    [],
  )

  const handleNodeClick = useCallback(
    (node: GraphNode) => {
      onNodeClick?.(node.id)
    },
    [onNodeClick],
  )

  const handleNodeHover = useCallback(
    (node: GraphNode | null, _prev: GraphNode | null, event?: MouseEvent) => {
      onNodeHover?.(node, event!)
    },
    [onNodeHover],
  )

  if (graphData.nodes.length === 0) return null

  return (
    <ForceGraph2D
      ref={graphRef}
      width={width}
      height={height}
      graphData={graphData}
      nodeId="id"
      nodeCanvasObject={nodeCanvasObject}
      nodePointerAreaPaint={nodePointerAreaPaint}
      linkColor={() => 'rgba(196, 189, 175, 0.4)'}
      linkWidth={1}
      linkDirectionalArrowLength={4}
      linkDirectionalArrowRelPos={0.9}
      linkDirectionalArrowColor={() => 'rgba(196, 189, 175, 0.6)'}
      onNodeClick={handleNodeClick}
      onNodeHover={handleNodeHover}
      cooldownTicks={100}
      warmupTicks={50}
      backgroundColor="transparent"
    />
  )
}
