/* global React, Icon, Button, IconButton, Tag, MetaChip, Field, Divider */
const { useState: useReaderState } = React;

const Reader = () => {
  const [tab, setTab] = useReaderState("summary");
  const [highlighted, setHighlighted] = useReaderState(null);

  return (
    <div style={{ display: "flex", height: "100%", overflow: "hidden" }}>
      {/* Left: PDF viewer */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", borderRight: "1px solid var(--sand)", background: "var(--paper-deep)" }}>
        {/* Toolbar */}
        <div style={{ height: 48, padding: "0 20px", borderBottom: "1px solid var(--sand)", display: "flex", alignItems: "center", gap: 10, background: "var(--paper)" }}>
          <IconButton name="chevron-left" />
          <IconButton name="chevron-right" />
          <Divider vertical style={{ height: 20, alignSelf: "center" }} />
          <div style={{ fontSize: 13, color: "var(--ink-soft)" }}>
            <span style={{ fontFamily: "var(--font-mono)" }}>3</span>
            <span style={{ color: "var(--ink-mute)" }}> / 11</span>
          </div>
          <div style={{ flex: 1 }} />
          <IconButton name="search" tooltip="Find in document" />
          <IconButton name="note" tooltip="Notes" />
          <IconButton name="download" tooltip="Export" />
          <IconButton name="more" />
        </div>

        {/* PDF page mock */}
        <div style={{ flex: 1, overflow: "auto", padding: "32px 48px", display: "flex", justifyContent: "center" }}>
          <div style={{
            width: 620, background: "#FFFEFB", border: "1px solid var(--sand)",
            boxShadow: "0 2px 8px rgba(42,36,30,.06), 0 1px 2px rgba(42,36,30,.04)",
            padding: "52px 60px", fontFamily: "var(--font-serif)",
            color: "var(--ink)", fontSize: 11, lineHeight: 1.7,
          }}>
            <div style={{ textAlign: "center", marginBottom: 28 }}>
              <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8, letterSpacing: "-0.005em" }}>Attention Is All You Need</div>
              <div style={{ fontSize: 9, color: "var(--ink-soft)", marginBottom: 4 }}>
                Ashish Vaswani, Noam Shazeer, Niki Parmar, Jakob Uszkoreit,<br/>
                Llion Jones, Aidan N. Gomez, Łukasz Kaiser, Illia Polosukhin
              </div>
              <div style={{ fontSize: 9, color: "var(--ink-mute)", fontStyle: "italic" }}>Google Brain · Google Research · University of Toronto</div>
            </div>

            <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 10, letterSpacing: "-0.005em" }}>Abstract</div>
            <p style={{ marginBottom: 14, textAlign: "justify", textIndent: 18 }}>
              The dominant sequence transduction models are based on complex recurrent or convolutional neural networks that include an encoder and a decoder. The best performing models also connect the encoder and decoder through an <span style={{ background: highlighted === 1 ? "var(--ember-tint)" : "transparent", padding: "0 2px", cursor: "pointer", borderBottom: highlighted === 1 ? "1px solid var(--ember)" : "none" }} onClick={() => setHighlighted(1)}>attention mechanism</span>.
            </p>
            <p style={{ marginBottom: 14, textAlign: "justify", textIndent: 18 }}>
              We propose a new simple network architecture, the <span style={{ background: "var(--moss-tint)", padding: "0 2px", fontStyle: "italic" }}>Transformer</span>, based solely on attention mechanisms, dispensing with recurrence and convolutions entirely. Experiments on two machine translation tasks show these models to be superior in quality while being more parallelizable and requiring significantly less time to train.
            </p>

            <div style={{ fontSize: 11, fontWeight: 600, marginTop: 22, marginBottom: 10 }}>1 Introduction</div>
            <p style={{ marginBottom: 12, textAlign: "justify", textIndent: 18, color: "var(--ink-soft)" }}>
              Recurrent neural networks, long short-term memory and gated recurrent neural networks in particular, have been firmly established as state of the art approaches in sequence modeling and transduction problems such as language modeling and machine translation…
            </p>
            <p style={{ marginBottom: 12, textAlign: "justify", textIndent: 18, color: "var(--ink-soft)" }}>
              Recurrent models typically factor computation along the symbol positions of the input and output sequences. Aligning the positions to steps in computation time, they generate a sequence of hidden states <span style={{ fontFamily: "var(--font-mono)", fontSize: 10 }}>hₜ</span>, as a function of the previous hidden state…
            </p>
          </div>
        </div>
      </div>

      {/* Right: Sidebar */}
      <aside style={{ width: 380, flexShrink: 0, display: "flex", flexDirection: "column", background: "var(--paper)" }}>
        <div style={{ padding: "16px 18px 12px", borderBottom: "1px solid var(--sand)" }}>
          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--ink-mute)", marginBottom: 6 }}>Paper</div>
          <div style={{ fontSize: 15, fontWeight: 500, lineHeight: 1.35, letterSpacing: "-0.005em", marginBottom: 8 }}>
            Attention Is All You Need
          </div>
          <div style={{ fontSize: 12, color: "var(--ink-soft)", marginBottom: 10 }}>Vaswani et al. · NeurIPS 2017</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <MetaChip>arXiv:1706.03762</MetaChip>
            <MetaChip>89,432 cites</MetaChip>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", borderBottom: "1px solid var(--sand)" }}>
          {[["summary","Summary"],["notes","Notes · 4"],["cites","Cites · 23"]].map(([k,l]) => (
            <button key={k} onClick={() => setTab(k)} style={{
              flex: 1, padding: "10px 0", background: "transparent", border: "none",
              fontFamily: "var(--font-sans)", fontSize: 12,
              color: tab===k ? "var(--ink)" : "var(--ink-mute)",
              fontWeight: tab===k ? 500 : 400, cursor: "pointer",
              borderBottom: `2px solid ${tab===k ? "var(--ember)" : "transparent"}`,
              marginBottom: -1,
            }}>{l}</button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: "auto", padding: "16px 18px" }}>
          {tab === "summary" && <>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12, color: "var(--ember)", fontSize: 11, fontWeight: 500 }}>
              <Icon name="sparkles" size={12} /> Summary by Lumen · generated 2 min ago
            </div>
            <div style={{ fontFamily: "var(--font-serif)", fontSize: 14, lineHeight: 1.7, color: "var(--ink)" }}>
              <p style={{ marginBottom: 12 }}>
                The authors propose the <b>Transformer</b>, a sequence transduction model based entirely on attention—no recurrence, no convolution. Key contributions:
              </p>
              <ul style={{ paddingLeft: 18, marginBottom: 12, color: "var(--ink-soft)" }}>
                <li style={{ marginBottom: 8 }}>Scaled dot-product attention + multi-head attention</li>
                <li style={{ marginBottom: 8 }}>Positional encoding for sequence representation</li>
                <li style={{ marginBottom: 8 }}>Parallel training, materially faster than RNN / LSTM</li>
              </ul>
              <p style={{ color: "var(--ink-soft)" }}>
                Reaches SOTA on WMT 2014 EN → DE and EN → FR with BLEU 28.4 and 41.8 respectively.
              </p>
            </div>

            <div style={{ marginTop: 20, padding: 14, background: "var(--vellum)", border: "1px solid var(--sand)", borderRadius: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--ink-mute)", marginBottom: 8 }}>Ask Lumen</div>
              <Field placeholder="About this paper…" kbd="↵" />
            </div>
          </>}

          {tab === "notes" && <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {[
              { pg: 3, text: "Is h=8 heads optimal? The MQA / GQA evolution is worth contrasting.", t: "Today 14:03" },
              { pg: 5, text: "Sin/cos positional encoding chosen for extrapolation, not learned.", t: "Today 11:28" },
              { pg: 7, text: "Training: 8 × P100 × 12h for base. On modern hardware ≈ 20 min.", t: "Yesterday" },
            ].map((n, i) => (
              <div key={i} style={{ background: "var(--vellum)", border: "1px solid var(--sand)", borderLeft: "2px solid var(--ember)", padding: "10px 12px", borderRadius: 6 }}>
                <div style={{ fontSize: 10, color: "var(--ink-mute)", fontFamily: "var(--font-mono)", marginBottom: 4 }}>p.{n.pg} · {n.t}</div>
                <div style={{ fontSize: 13, lineHeight: 1.5, color: "var(--ink)", fontFamily: "var(--font-serif)" }}>{n.text}</div>
              </div>
            ))}
          </div>}

          {tab === "cites" && <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              { t: "Long Short-Term Memory", a: "Hochreiter & Schmidhuber · 1997" },
              { t: "Neural Machine Translation by Jointly Learning to Align and Translate", a: "Bahdanau et al. · ICLR 2015" },
              { t: "Sequence to Sequence Learning with Neural Networks", a: "Sutskever et al. · NeurIPS 2014" },
              { t: "Layer Normalization", a: "Ba, Kiros, Hinton · arXiv 2016" },
              { t: "Adam: A Method for Stochastic Optimization", a: "Kingma & Ba · ICLR 2015" },
            ].map((c, i) => (
              <div key={i} style={{ padding: "10px 12px", borderRadius: 6, background: "transparent", border: "1px solid var(--sand)", cursor: "pointer" }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: "var(--ink)", marginBottom: 3 }}>{c.t}</div>
                <div style={{ fontSize: 11, color: "var(--ink-mute)" }}>{c.a}</div>
              </div>
            ))}
          </div>}
        </div>
      </aside>
    </div>
  );
};

Object.assign(window, { Reader });
