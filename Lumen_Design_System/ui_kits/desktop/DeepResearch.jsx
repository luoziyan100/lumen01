/* global React, Icon, Button, IconButton, Tag, MetaChip, Field, Avatar */
const { useState: useDRState } = React;

const DeepResearch = () => {
  const [input, setInput] = useDRState("");

  return (
    <div style={{ display: "flex", height: "100%", overflow: "hidden" }}>
      {/* Main thread */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        {/* Header */}
        <div style={{ padding: "18px 32px", borderBottom: "1px solid var(--sand)", display: "flex", alignItems: "center", gap: 12 }}>
          <Icon name="sparkles" size={18} color="var(--ember)" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 500, letterSpacing: "-0.005em" }}>MoE routing strategies compared</div>
            <div style={{ fontSize: 11, color: "var(--ink-mute)", marginTop: 2 }}>
              12 papers read · in progress · started 14:08
            </div>
          </div>
          <Button variant="ghost" size="sm" icon="archive">Archive</Button>
          <IconButton name="more" />
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflow: "auto" }}>
          <div style={{ maxWidth: 780, margin: "0 auto", padding: "32px", display: "flex", flexDirection: "column", gap: 28 }}>

            {/* User message */}
            <div style={{ display: "flex", gap: 14 }}>
              <Avatar name="Y" size={28} bg="var(--indigo)" />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-soft)", marginBottom: 6 }}>You · 14:08</div>
                <div style={{ fontSize: 15, fontFamily: "var(--font-serif)", lineHeight: 1.75, color: "var(--ink)" }}>
                  对比 Mixtral、Switch Transformer、DeepSeek-MoE 三种路由策略的差异，重点说清负载均衡损失的设计。
                </div>
              </div>
            </div>

            {/* Thinking / working strip */}
            <div style={{ background: "var(--vellum)", border: "1px solid var(--sand)", borderRadius: 8, padding: "14px 16px", fontSize: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, color: "var(--ember)", fontWeight: 500 }}>
                <Icon name="sparkles" size={13} />
                <span>Researching</span>
                <span style={{ marginLeft: "auto", fontFamily: "var(--font-mono)", color: "var(--ink-mute)" }}>00:42</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, color: "var(--ink-soft)" }}>
                <div style={{ display: "flex", gap: 8 }}><Icon name="check" size={12} color="var(--moss)" /> Searched library for “MoE routing” · 8 matches</div>
                <div style={{ display: "flex", gap: 8 }}><Icon name="check" size={12} color="var(--moss)" /> Read Mixtral of Experts · full text</div>
                <div style={{ display: "flex", gap: 8 }}><Icon name="check" size={12} color="var(--moss)" /> Read Switch Transformer · full text</div>
                <div style={{ display: "flex", gap: 8, color: "var(--ember)" }}>
                  <span style={{ width: 12, height: 12, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--ember)", animation: "pulse 1.2s infinite" }} />
                  </span>
                  Reading DeepSeek-MoE · page 5 of 12
                </div>
                <div style={{ color: "var(--ink-faint)", paddingLeft: 20 }}>Comparing load-balancing losses…</div>
              </div>
            </div>

            {/* Assistant reply */}
            <div style={{ display: "flex", gap: 14 }}>
              <div style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--paper)", border: "1px solid var(--sand)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icon name="sparkles" size={14} color="var(--ember)" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: "var(--ember)", marginBottom: 6 }}>Lumen · Deep research</div>
                <div style={{ fontSize: 15, fontFamily: "var(--font-serif)", lineHeight: 1.75, color: "var(--ink)" }}>
                  <p style={{ marginBottom: 14 }}>
                    三种策略在 <b>Top-K 选择</b>与<b>负载均衡损失</b>上有明显分歧：
                  </p>
                  <p style={{ marginBottom: 14 }}>
                    <b>Switch Transformer</b><sup style={{ color: "var(--ember)", fontFamily: "var(--font-sans)", fontSize: 10, marginLeft: 2 }}>[1]</sup> 采用 Top-1 路由，用一个辅助损失 <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, background: "var(--paper-deep)", padding: "0 5px", borderRadius: 3 }}>L_aux = α · N · Σ fᵢ · Pᵢ</span> 鼓励专家间均匀分配。简洁，但在稀疏场景下训练不稳。
                  </p>
                  <p style={{ marginBottom: 14 }}>
                    <b>Mixtral</b><sup style={{ color: "var(--ember)", fontFamily: "var(--font-sans)", fontSize: 10, marginLeft: 2 }}>[2]</sup> 回到 Top-2 路由，放弃显式辅助损失，靠容量因子 + softmax 温度软性均衡。实际部署中更稳定。
                  </p>
                  <p>
                    <b>DeepSeek-MoE</b><sup style={{ color: "var(--ember)", fontFamily: "var(--font-sans)", fontSize: 10, marginLeft: 2 }}>[3]</sup> 引入细粒度专家 + 共享专家，损失项拆成设备级与专家级两部分 —— 在大规模分布式训练中更友好。
                  </p>
                </div>

                {/* Sources */}
                <div style={{ marginTop: 18, padding: 14, background: "var(--paper-deep)", border: "1px solid var(--sand)", borderRadius: 8 }}>
                  <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--ink-mute)", marginBottom: 10 }}>Sources</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {[
                      ["[1]","Switch Transformers: Scaling to Trillion Parameter Models with Simple and Efficient Sparsity","Fedus et al. · JMLR 2022"],
                      ["[2]","Mixtral of Experts","Jiang et al. · arXiv 2024"],
                      ["[3]","DeepSeekMoE: Towards Ultimate Expert Specialization","Dai et al. · ACL 2024"],
                    ].map(([n,t,a], i) => (
                      <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ember)", fontWeight: 600, minWidth: 20 }}>{n}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 500, color: "var(--ink)" }}>{t}</div>
                          <div style={{ fontSize: 11, color: "var(--ink-mute)", marginTop: 1 }}>{a}</div>
                        </div>
                        <IconButton name="arrow-up-right" size={24} iconSize={12} />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: "flex", gap: 6, marginTop: 14 }}>
                  <Button variant="ghost" size="sm" icon="copy">Copy</Button>
                  <Button variant="ghost" size="sm" icon="note">Save as note</Button>
                  <Button variant="ghost" size="sm" icon="graph">Show in graph</Button>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Composer */}
        <div style={{ padding: "14px 32px 20px", borderTop: "1px solid var(--sand)", background: "var(--paper)" }}>
          <div style={{ maxWidth: 780, margin: "0 auto", background: "var(--vellum)", border: `1px solid ${input ? "var(--ember)" : "var(--sand)"}`, borderRadius: 8, padding: "10px 12px", display: "flex", gap: 10, alignItems: "flex-end" }}>
            <IconButton name="paper-clip" />
            <textarea
              value={input} onChange={e => setInput(e.target.value)}
              placeholder="Ask a follow-up, refine, or pivot…"
              style={{
                flex: 1, border: "none", outline: "none", background: "transparent", resize: "none",
                fontFamily: "var(--font-sans)", fontSize: 14, lineHeight: 1.5,
                minHeight: 24, maxHeight: 120, paddingTop: 6, color: "var(--ink)",
              }}
              rows={1}
            />
            <Button variant="primary" size="sm" icon="send" disabled={!input}>Send</Button>
          </div>
          <div style={{ maxWidth: 780, margin: "8px auto 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", gap: 14, fontSize: 11, color: "var(--ink-mute)" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Icon name="library" size={11} /> Scope · Entire library</span>
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Icon name="sparkles" size={11} /> Depth · Full text</span>
            </div>
            <div style={{ fontSize: 11, color: "var(--ink-mute)", fontFamily: "var(--font-mono)" }}>⌘↵ to send</div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes pulse { 0%,100% { opacity: 1 } 50% { opacity: .3 } }
      `}</style>
    </div>
  );
};

Object.assign(window, { DeepResearch });
