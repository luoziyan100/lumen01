# Markdown 显示回归样本

这是一段中文、English terms、超长 DOI 和 URL 混排的正文：https://doi.org/10.1234/lumen.research.agent.markdown.display.contract.with.a.very.long.identifier.2026.0000000001

行内公式应该渲染为数学排版：$O(n \log n)$、$\alpha + \beta = \gamma$。

块级公式应该保留横向滚动能力：

$$
\operatorname{score}(q, d) = \frac{\sum_{i=1}^{n} w_i \cdot \operatorname{sim}(q_i, d_i)}{\sqrt{\sum_{i=1}^{n} w_i^2} + \lambda}
$$

| 论文 | 研究对象 | 核心机制 | 关键指标或发现 | 为什么归类 | Lumen 可迁移性 |
|------|----------|----------|----------------|------------|----------------|
| SpecEyes: Accelerating Agentic Multimodal LLMs via Speculative Perception and Planning | 多模态 agent 推理链路 | speculative planner, cognitive gating, heterogeneous parallel funnel | 1.1-3.35x speedup while preserving evidence coverage | 工具调用和感知循环导致 agentic depth | 可迁移到研究流水线的早停和并行调度 |
| GSEM: Graph-based Self-Evolving Memory for Experience Augmented Clinical Reasoning | 长期经验记忆 | condition, strategy, polarity, quality Q_i, inter-experience edge W_ij | MedR-Bench / MedAgentsBench accuracy lift | 经验结构化、检索、校准和复用 | 可迁移到 Lumen 的 evidence memory |

```ts
function score(query: string, document: string): number {
  return query.length + document.length
}
```

![论文图示](https://example.com/assets/research-agent-architecture-with-a-very-long-file-name-that-should-not-break-layout.png)

- [x] 已覆盖任务列表
- [ ] 未完成项也要显示

~~删除线文本~~ 用于检查 GFM 删除线样式。

脚注引用需要保持可读。[^note]

[^note]: 这是脚注内容。
