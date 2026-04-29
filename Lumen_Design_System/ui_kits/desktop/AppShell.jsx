/* global React, Icon, IconButton, Avatar */
const { useState: useStateShell } = React;

const AppShell = ({ active, setActive, children, counts = {} }) => {
  const [collapsed, setCollapsed] = useStateShell(false);

  const NavItem = ({ id, icon, label, badge }) => {
    const isActive = active === id;
    const [hover, setHover] = useStateShell(false);
    return (
      <button
        onClick={() => setActive(id)}
        onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
        style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: collapsed ? "8px" : "8px 10px",
          justifyContent: collapsed ? "center" : "flex-start",
          width: "100%", border: "none", borderRadius: 6,
          background: isActive ? "var(--sand)" : hover ? "rgba(232,223,209,0.5)" : "transparent",
          color: isActive ? "var(--ink)" : "var(--ink-soft)",
          fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: isActive ? 500 : 400,
          cursor: "pointer", transition: "all 120ms", textAlign: "left",
          position: "relative",
        }}
      >
        <Icon name={icon} size={16} />
        {!collapsed && <>
          <span style={{ flex: 1 }}>{label}</span>
          {badge != null && <span style={{
            fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-mute)",
          }}>{badge}</span>}
        </>}
      </button>
    );
  };

  const FolderItem = ({ name, count, color }) => {
    const [hover, setHover] = useStateShell(false);
    return (
      <div onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
        style={{
          display: "flex", alignItems: "center", gap: 8, padding: "6px 10px",
          borderRadius: 4, cursor: "pointer",
          background: hover ? "rgba(232,223,209,0.5)" : "transparent",
          fontFamily: "var(--font-sans)", fontSize: 13, color: "var(--ink-soft)",
        }}>
        <span style={{ width: 8, height: 8, borderRadius: 2, background: color }} />
        <span style={{ flex: 1 }}>{name}</span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-faint)" }}>{count}</span>
      </div>
    );
  };

  return (
    <div style={{
      width: "100%", height: "100%", display: "flex", flexDirection: "column",
      background: "var(--paper)", color: "var(--ink)", fontFamily: "var(--font-sans)",
      overflow: "hidden",
    }}>
      {/* Titlebar */}
      <div style={{
        height: 40, display: "flex", alignItems: "center",
        padding: "0 12px 0 84px",
        borderBottom: "1px solid var(--sand)",
        WebkitAppRegion: "drag", userSelect: "none",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--ink-soft)" }}>
          <span style={{ fontSize: 12, fontWeight: 500 }}>Lumen</span>
          <span style={{ color: "var(--ink-faint)" }}>›</span>
          <span style={{ fontSize: 12 }}>{{library:"Library", reader:"Reader", research:"Research", graph:"Graph"}[active]}</span>
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", alignItems: "center", gap: 4, WebkitAppRegion: "no-drag" }}>
          <IconButton name="search" tooltip="搜索 ⌘K" />
          <IconButton name="settings" tooltip="设置" />
          <Avatar name="Y" size={22} />
        </div>
      </div>

      {/* Main */}
      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        {/* Sidebar */}
        <aside style={{
          width: collapsed ? 56 : 240, flexShrink: 0,
          borderRight: "1px solid var(--sand)",
          background: "var(--paper-deep)",
          display: "flex", flexDirection: "column",
          transition: "width 180ms cubic-bezier(.2,.6,.2,1)",
        }}>
          <div style={{ padding: collapsed ? "12px 8px" : "12px", display: "flex", flexDirection: "column", gap: 2 }}>
            <NavItem id="library" icon="library" label="Library" badge={counts.library || 148} />
            <NavItem id="reader" icon="book-open" label="Reader" />
            <NavItem id="research" icon="sparkles" label="Research" badge={counts.research || 3} />
            <NavItem id="graph" icon="graph" label="Graph" />
          </div>

          {!collapsed && <>
            <div style={{ padding: "6px 18px", marginTop: 14 }}>
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--ink-mute)" }}>Collections</div>
            </div>
            <div style={{ padding: "0 10px", display: "flex", flexDirection: "column", gap: 1 }}>
              <FolderItem name="Attention · 2024" count={24} color="#B85C3B" />
              <FolderItem name="Diffusion survey" count={17} color="#3A4A5E" />
              <FolderItem name="RLHF & alignment" count={31} color="#5F6B4A" />
              <FolderItem name="Sparse training" count={9} color="#8C8278" />
            </div>

            <div style={{ padding: "6px 18px", marginTop: 14 }}>
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--ink-mute)" }}>Recent research</div>
            </div>
            <div style={{ padding: "0 10px", display: "flex", flexDirection: "column", gap: 1 }}>
              <FolderItem name="MoE routing strategies" count="·" color="var(--ember)" />
              <FolderItem name="Long-context benchmark" count="·" color="var(--ember)" />
            </div>
          </>}

          <div style={{ flex: 1 }} />

          <div style={{
            borderTop: "1px solid var(--sand)", padding: collapsed ? 8 : 12,
            display: "flex", alignItems: "center", gap: 10,
          }}>
            <img src="../../assets/logo/mark.svg" width={22} height={22} />
            {!collapsed && <>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: "var(--ink)" }}>Local library</div>
                <div style={{ fontSize: 11, color: "var(--ink-mute)", fontFamily: "var(--font-mono)" }}>~/Lumen · 2.4 GB</div>
              </div>
              <IconButton name={collapsed ? "chevron-right" : "chevron-left"} onClick={() => setCollapsed(!collapsed)} />
            </>}
          </div>
        </aside>

        {/* Main content */}
        <main style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {children}
        </main>
      </div>
    </div>
  );
};

Object.assign(window, { AppShell });
