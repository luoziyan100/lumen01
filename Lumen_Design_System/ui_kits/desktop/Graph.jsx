/* global React, Icon, Button, IconButton, Tag, MetaChip */
const { useState: useGraphState } = React;

const Graph = () => {
  const [selected, setSelected] = useGraphState(1);

  const nodes = [
    { id: 1, x: 420, y: 280, r: 36, label: "Attention Is\nAll You Need", year: "2017", color: "var(--ember)", primary: true },
    { id: 2, x: 260, y: 180, r: 22, label: "BERT", year: "2018", color: "var(--indigo)" },
    { id: 3, x: 580, y: 160, r: 22, label: "GPT-2", year: "2019", color: "var(--indigo)" },
    { id: 4, x: 200, y: 340, r: 18, label: "Seq2Seq", year: "2014", color: "var(--ink-mute)" },
    { id: 5, x: 300, y: 440, r: 18, label: "Bahdanau\nAttention", year: "2015", color: "var(--ink-mute)" },
    { id: 6, x: 620, y: 400, r: 26, label: "ViT", year: "2020", color: "var(--indigo)" },
    { id: 7, x: 760, y: 260, r: 22, label: "GPT-3", year: "2020", color: "var(--indigo)" },
    { id: 8, x: 480, y: 500, r: 20, label: "T5", year: "2019", color: "var(--indigo)" },
    { id: 9, x: 820, y: 440, r: 20, label: "Mixtral", year: "2024", color: "var(--moss)" },
    { id: 10, x: 150, y: 240, r: 16, label: "ELMo", year: "2018", color: "var(--ink-mute)" },
    { id: 11, x: 700, y: 520, r: 18, label: "LoRA", year: "2022", color: "var(--moss)" },
  ];

  const edges = [
    [4, 1], [5, 1], [10, 2],
    [1, 2], [1, 3], [1, 6], [1, 7], [1, 8],
    [3, 7], [6, 9], [8, 11], [7, 9],
  ];

  const find = id => nodes.find(n => n.id === id);

  return (
    <div style={{ display: "flex", height: "100%", overflow: "hidden" }}>
      {/* Graph canvas */}
      <div style={{ flex: 1, minWidth: 0, position: "relative", background: "var(--paper)", overflow: "hidden" }}>
        {/* Subtle paper grain */}
        <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(circle at 1px 1px, rgba(42,36,30,.035) 0.5px, transparent 0.5px)", backgroundSize: "16px 16px", pointerEvents: "none" }} />

        {/* Toolbar */}
        <div style={{ position: "absolute", top: 16, left: 20, right: 20, display: "flex", alignItems: "center", gap: 10, zIndex: 2 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--paper)", border: "1px solid var(--sand)", borderRadius: 6, padding: "6px 10px", fontSize: 12, color: "var(--ink-soft)" }}>
            <Icon name="graph" size={13} /> 以 <b style={{ color: "var(--ink)" }}>Attention Is All You Need</b> 为中心 · 2 跳
          </div>
          <div style={{ flex: 1 }} />
          <div style={{ display: "flex", gap: 4, background: "var(--paper)", border: "1px solid var(--sand)", borderRadius: 6, padding: 2 }}>
            <Button variant="ghost" size="sm">引用</Button>
            <Button variant="ghost" size="sm" style={{ background: "var(--sand)" }}>被引</Button>
            <Button variant="ghost" size="sm">共被引</Button>
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            <IconButton name="plus" />
            <IconButton name="sliders" />
          </div>
        </div>

        {/* Legend */}
        <div style={{ position: "absolute", bottom: 20, left: 20, display: "flex", gap: 14, background: "var(--paper)", border: "1px solid var(--sand)", borderRadius: 6, padding: "8px 14px", fontSize: 11, color: "var(--ink-soft)", zIndex: 2 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: "50%", background: "var(--ember)" }} /> 中心</span>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: "50%", background: "var(--indigo)" }} /> 被引</span>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: "50%", background: "var(--moss)" }} /> 在库中</span>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: "50%", background: "var(--ink-mute)" }} /> 未归档</span>
        </div>

        {/* SVG graph */}
        <svg viewBox="0 0 960 640" style={{ width: "100%", height: "100%", position: "absolute", inset: 0 }}>
          {edges.map(([a, b], i) => {
            const na = find(a), nb = find(b);
            const active = a === selected || b === selected;
            return <line key={i} x1={na.x} y1={na.y} x2={nb.x} y2={nb.y}
              stroke={active ? "var(--ember)" : "#D9CEBB"} strokeWidth={active ? 1.5 : 1} opacity={active ? 0.9 : 0.55} />;
          })}
          {nodes.map(n => {
            const isSel = n.id === selected;
            return (
              <g key={n.id} onClick={() => setSelected(n.id)} style={{ cursor: "pointer" }}>
                <circle cx={n.x} cy={n.y} r={n.r + (isSel ? 4 : 0)}
                  fill={n.color} opacity={isSel ? 1 : 0.88}
                  stroke={isSel ? "var(--paper)" : "transparent"} strokeWidth={isSel ? 3 : 0} />
                {isSel && <circle cx={n.x} cy={n.y} r={n.r + 8} fill="none" stroke={n.color} strokeWidth={1.5} opacity={0.4} />}
                <text x={n.x} y={n.y + n.r + 16} textAnchor="middle"
                  fontFamily="Inter Tight, sans-serif" fontSize={n.primary ? 13 : 11}
                  fontWeight={n.primary ? 600 : 500} fill="var(--ink)">
                  {n.label.split("\n").map((l, i) => <tspan key={i} x={n.x} dy={i === 0 ? 0 : 13}>{l}</tspan>)}
                </text>
                <text x={n.x} y={n.y + n.r + (n.primary ? 46 : 30)} textAnchor="middle"
                  fontFamily="JetBrains Mono, monospace" fontSize={10} fill="var(--ink-mute)">{n.year}</text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Detail panel */}
      <aside style={{ width: 340, flexShrink: 0, borderLeft: "1px solid var(--sand)", background: "var(--paper-deep)", overflow: "auto" }}>
        <div style={{ padding: "20px 20px 16px", borderBottom: "1px solid var(--sand)" }}>
          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--ink-mute)", marginBottom: 8 }}>选中节点</div>
          <div style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.3, letterSpacing: "-0.005em", marginBottom: 8 }}>
            {(find(selected)?.label || "").replace(/\n/g, " ")}
          </div>
          <div style={{ fontSize: 12, color: "var(--ink-soft)", marginBottom: 12 }}>
            {selected === 1 ? "Vaswani et al." : "—"} · {find(selected)?.year}
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
            <Tag variant="ember" dot>中心节点</Tag>
            <Tag variant="neutral">被引 89,432</Tag>
          </div>
          <Button variant="secondary" size="sm" icon="book-open" style={{ width: "100%", justifyContent: "center" }}>打开论文</Button>
        </div>

        <div style={{ padding: "16px 20px" }}>
          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--ink-mute)", marginBottom: 10 }}>最相关的被引 · 11</div>
          {[
            ["BERT", "Devlin et al.", "2018"],
            ["GPT-2", "Radford et al.", "2019"],
            ["GPT-3", "Brown et al.", "2020"],
            ["ViT", "Dosovitskiy et al.", "2020"],
            ["T5", "Raffel et al.", "2019"],
            ["Mixtral", "Jiang et al.", "2024"],
          ].map(([t, a, y], i) => (
            <div key={i} style={{ padding: "8px 0", borderBottom: i < 5 ? "1px solid var(--sand)" : "none", display: "flex", gap: 10, alignItems: "center", cursor: "pointer" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: "var(--ink)" }}>{t}</div>
                <div style={{ fontSize: 11, color: "var(--ink-mute)", marginTop: 1 }}>{a} · {y}</div>
              </div>
              <Icon name="chevron-right" size={13} color="var(--ink-mute)" />
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
};

Object.assign(window, { Graph });
