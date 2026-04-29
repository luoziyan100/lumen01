/* global React, Icon, Button, IconButton, Tag, MetaChip, Field */
const { useState: useLibState } = React;

const PAPERS = [
  { id: 1, title: "Attention Is All You Need", authors: "Vaswani, Shazeer, Parmar, et al.", venue: "NeurIPS 2017", year: 2017, arxiv: "1706.03762", tags: ["Transformer","Attention"], status: "read", cited: 89432, note: "Foundational architecture", color: "var(--ember)" },
  { id: 2, title: "An Image Is Worth 16×16 Words: Transformers for Image Recognition at Scale", authors: "Dosovitskiy, Beyer, Kolesnikov, et al.", venue: "ICLR 2021", year: 2021, arxiv: "2010.11929", tags: ["ViT","Vision"], status: "reading", cited: 28104 },
  { id: 3, title: "Denoising Diffusion Probabilistic Models", authors: "Ho, Jain, Abbeel", venue: "NeurIPS 2020", year: 2020, arxiv: "2006.11239", tags: ["Diffusion"], status: "unread", cited: 14528 },
  { id: 4, title: "LoRA: Low-Rank Adaptation of Large Language Models", authors: "Hu, Shen, Wallis, et al.", venue: "ICLR 2022", year: 2022, arxiv: "2106.09685", tags: ["Fine-tune","PEFT"], status: "read", cited: 6214, note: "Widely used in practice" },
  { id: 5, title: "Mixtral of Experts", authors: "Jiang, Sablayrolles, Roux, et al.", venue: "arXiv 2024", year: 2024, arxiv: "2401.04088", tags: ["MoE","Routing"], status: "reading", cited: 812, note: "Comparing to switch-transformer" },
  { id: 6, title: "Direct Preference Optimization: Your Language Model Is Secretly a Reward Model", authors: "Rafailov, Sharma, Mitchell, et al.", venue: "NeurIPS 2023", year: 2023, arxiv: "2305.18290", tags: ["RLHF","Alignment"], status: "read", cited: 3204 },
  { id: 7, title: "Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks", authors: "Lewis, Perez, Piktus, et al.", venue: "NeurIPS 2020", year: 2020, arxiv: "2005.11401", tags: ["RAG","Retrieval"], status: "unread", cited: 5428 },
  { id: 8, title: "Scaling Laws for Neural Language Models", authors: "Kaplan, McCandlish, Henighan, et al.", venue: "arXiv 2020", year: 2020, arxiv: "2001.08361", tags: ["Scaling"], status: "read", cited: 7188 },
];

const STATUS_MAP = {
  read:     { label: "Read", variant: "moss", dot: true },
  reading:  { label: "Reading", variant: "ember", dot: true },
  unread:   { label: "Unread", variant: "neutral", dot: true },
};

const PaperRow = ({ paper, selected, onClick, dense }) => {
  const [hover, setHover] = useLibState(false);
  const st = STATUS_MAP[paper.status];
  return (
    <div onClick={onClick}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        display: "grid",
        gridTemplateColumns: "24px 1fr 180px 100px 90px 32px",
        gap: 16, alignItems: "center",
        padding: dense ? "10px 20px" : "14px 20px",
        background: selected ? "var(--ember-tint)" : hover ? "var(--vellum)" : "transparent",
        borderLeft: `2px solid ${selected ? "var(--ember)" : "transparent"}`,
        cursor: "pointer", transition: "background 120ms",
        borderBottom: "1px solid var(--sand)",
      }}>
      <Icon name="file-text" size={15} color="var(--ink-mute)" />
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: "var(--ink)", letterSpacing: "-0.005em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {paper.title}
        </div>
        <div style={{ fontSize: 12, color: "var(--ink-mute)", marginTop: 3, display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flex: 1 }}>{paper.authors}</span>
          {paper.note && <span style={{ color: "var(--ember)", fontStyle: "italic", fontFamily: "var(--font-serif)" }}>— {paper.note}</span>}
        </div>
      </div>
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
        {paper.tags.map(t => <Tag key={t}>{t}</Tag>)}
      </div>
      <div style={{ fontSize: 12, color: "var(--ink-soft)" }}>
        <div>{paper.venue}</div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-mute)", marginTop: 2 }}>{paper.arxiv}</div>
      </div>
      <div><Tag variant={st.variant} dot={st.dot}>{st.label}</Tag></div>
      <IconButton name="more" />
    </div>
  );
};

const Library = () => {
  const [selected, setSelected] = useLibState(1);
  const [query, setQuery] = useLibState("");
  const [dense, setDense] = useLibState(false);
  const [tab, setTab] = useLibState("all");

  const filtered = PAPERS.filter(p => {
    if (tab === "reading" && p.status !== "reading") return false;
    if (tab === "unread" && p.status !== "unread") return false;
    if (query && !p.title.toLowerCase().includes(query.toLowerCase()) && !p.authors.toLowerCase().includes(query.toLowerCase())) return false;
    return true;
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {/* Header */}
      <div style={{ padding: "24px 32px 16px", borderBottom: "1px solid var(--sand)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 500, letterSpacing: "-0.01em" }}>Library</h1>
            <div style={{ fontSize: 13, color: "var(--ink-soft)", marginTop: 4, fontFamily: "var(--font-serif)" }}>
              148 papers · 2.4 GB · last archived 3h ago
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Button variant="secondary" icon="plus">Import PDF</Button>
            <Button variant="primary" icon="sparkles">Start research</Button>
          </div>
        </div>

        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <div style={{ flex: 1, maxWidth: 520 }}>
            <Field icon="search" placeholder="Search library · keyword, semantic, or DOI" value={query} onChange={setQuery} kbd="⌘K" />
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            <Button variant="ghost" size="sm" icon="sliders">Filter</Button>
            <Button variant="ghost" size="sm" icon="sort">Recent</Button>
            <IconButton name={dense ? "library" : "book-open"} onClick={() => setDense(!dense)} tooltip="密度" />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 2, padding: "0 24px", borderBottom: "1px solid var(--sand)", background: "var(--paper)" }}>
        {[
          ["all","All · 148"],
          ["reading","Reading · 2"],
          ["unread","Unread · 47"],
          ["starred","Starred · 12"],
        ].map(([k,l]) => (
          <button key={k} onClick={() => setTab(k)} style={{
            padding: "12px 14px", background: "transparent", border: "none",
            fontFamily: "var(--font-sans)", fontSize: 13, color: tab===k ? "var(--ink)" : "var(--ink-mute)",
            fontWeight: tab===k ? 500 : 400, cursor: "pointer",
            borderBottom: `2px solid ${tab===k ? "var(--ember)" : "transparent"}`,
            marginBottom: -1,
          }}>{l}</button>
        ))}
      </div>

      {/* List */}
      <div style={{ flex: 1, overflow: "auto" }}>
        <div style={{
          display: "grid",
          gridTemplateColumns: "24px 1fr 180px 100px 90px 32px",
          gap: 16, padding: "10px 20px", fontSize: 10, fontWeight: 600,
          letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--ink-mute)",
          borderBottom: "1px solid var(--sand)", background: "var(--paper-deep)",
        }}>
          <span></span><span>Title</span><span>Tags</span><span>Source</span><span>Status</span><span></span>
        </div>
        {filtered.map(p => (
          <PaperRow key={p.id} paper={p} dense={dense}
            selected={selected === p.id}
            onClick={() => setSelected(p.id)} />
        ))}
      </div>
    </div>
  );
};

Object.assign(window, { Library });
