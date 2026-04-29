/* global React */
const { useState } = React;

/* ==================== Icon (Lucide-style inline) ==================== */
const Icon = ({ name, size = 16, color = "currentColor", strokeWidth = 1.5, style }) => {
  const s = { width: size, height: size, color, ...style };
  const p = { fill: "none", stroke: "currentColor", strokeWidth, strokeLinecap: "round", strokeLinejoin: "round", viewBox: "0 0 24 24" };
  const paths = {
    "file-text": <g><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/></g>,
    "library": <g><path d="M16 6H3v13h13M16 6h5v13h-5M16 6v13"/></g>,
    "book-open": <g><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2V3ZM22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7V3Z"/></g>,
    "sparkles": <g><path d="m12 3 1.5 4 4 1.5-4 1.5L12 14l-1.5-4-4-1.5 4-1.5L12 3ZM19 14l.8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8L19 14Z"/></g>,
    "search": <g><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></g>,
    "graph": <g><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/></g>,
    "tag": <g><path d="M20.6 13.4 13 21l-9-9V3h9l9 9-1.4 1.4Z"/><circle cx="7.5" cy="7.5" r="1"/></g>,
    "folder": <g><path d="M4 7a2 2 0 0 1 2-2h3l2 3h7a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7Z"/></g>,
    "star": <g><path d="m12 3 2.9 6 6.6.6-5 4.4 1.5 6.5L12 17l-6 3.5 1.5-6.5-5-4.4 6.6-.6L12 3Z"/></g>,
    "note": <g><path d="M14 3H4v18h16V9M14 3v6h6M14 3l6 6"/><path d="m18 14-3 3-1-1"/></g>,
    "quote": <g><path d="M7 7h4v4H8a1 1 0 0 0-1 1v3M14 7h4v4h-3a1 1 0 0 0-1 1v3"/></g>,
    "archive": <g><rect x="3" y="4" width="18" height="4" rx="1"/><path d="M5 8v12h14V8M10 13h4"/></g>,
    "settings": <g><circle cx="12" cy="12" r="3"/><path d="M12 3v2M12 19v2M5 12H3M21 12h-2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4"/></g>,
    "x": <g><path d="M6 6l12 12M18 6 6 18"/></g>,
    "more": <g><circle cx="5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/></g>,
    "plus": <g><path d="M12 5v14M5 12h14"/></g>,
    "check": <g><path d="m5 13 4 4L19 7"/></g>,
    "chevron-right": <g><path d="m9 6 6 6-6 6"/></g>,
    "chevron-down": <g><path d="m6 9 6 6 6-6"/></g>,
    "chevron-left": <g><path d="m15 6-6 6 6 6"/></g>,
    "sliders": <g><path d="M4 6h16M7 12h10M10 18h4"/></g>,
    "sort": <g><path d="M4 6h9M4 12h13M4 18h7M17 3v6M20 6l-3 3-3-3"/></g>,
    "arrow-up-right": <g><path d="M7 17 17 7M7 7h10v10"/></g>,
    "send": <g><path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7Z"/></g>,
    "cite": <g><path d="M6 4v6M6 14v6M18 4v6M18 14v6M6 10h12M6 14h12"/></g>,
    "copy": <g><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></g>,
    "download": <g><path d="M12 3v12M6 11l6 6 6-6M4 21h16"/></g>,
    "mic": <g><rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 12a7 7 0 0 0 14 0M12 19v3"/></g>,
    "paper-clip": <g><path d="M21 12 12 21a5 5 0 0 1-7-7l9-9a3.5 3.5 0 0 1 5 5l-9 9a2 2 0 0 1-3-3l8-8"/></g>,
    "eye": <g><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></g>,
    "lumen": <g><path d="M12 3c1.3 3 4.5 5 4.5 8.5S14.5 18 12 18s-4.5-2-4.5-6.5S10.7 6 12 3Z"/><path d="M12 18v3"/></g>,
  };
  return <svg {...s} {...p}>{paths[name] || paths["more"]}</svg>;
};

/* ==================== Button ==================== */
const Button = ({ children, variant = "secondary", size = "base", icon, iconRight, onClick, disabled, style }) => {
  const [hover, setHover] = useState(false);
  const base = {
    display: "inline-flex", alignItems: "center", gap: 6,
    fontFamily: "var(--font-sans)", fontWeight: 500, fontSize: size === "sm" ? 12 : 13,
    padding: size === "sm" ? "6px 10px" : size === "lg" ? "12px 18px" : "9px 14px",
    borderRadius: 4, border: "1px solid transparent", cursor: disabled ? "not-allowed" : "pointer",
    transition: "all 180ms cubic-bezier(.2,.6,.2,1)", whiteSpace: "nowrap",
    opacity: disabled ? 0.4 : 1,
  };
  const variants = {
    primary: { background: hover ? "#A8502F" : "var(--ember)", color: "#fff" },
    secondary: { background: hover ? "var(--sand)" : "var(--vellum)", color: "var(--ink)", borderColor: hover ? "var(--ink-mute)" : "var(--sand)" },
    ghost: { background: hover ? "var(--sand)" : "transparent", color: "var(--ink-soft)" },
    danger: { background: hover ? "var(--danger-bg)" : "transparent", color: "var(--danger)", borderColor: "var(--danger)" },
  };
  return (
    <button style={{ ...base, ...variants[variant], ...style }}
            onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
            onClick={disabled ? undefined : onClick}>
      {icon && <Icon name={icon} size={14} />}
      {children}
      {iconRight && <Icon name={iconRight} size={14} />}
    </button>
  );
};

/* ==================== IconButton ==================== */
const IconButton = ({ name, onClick, size = 28, iconSize = 15, tooltip, active }) => {
  const [hover, setHover] = useState(false);
  return (
    <button onClick={onClick} title={tooltip}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        width: size, height: size, border: "none", borderRadius: 4, cursor: "pointer",
        background: active ? "var(--sand)" : hover ? "var(--sand)" : "transparent",
        color: active ? "var(--ink)" : "var(--ink-soft)",
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        transition: "all 120ms",
      }}>
      <Icon name={name} size={iconSize} />
    </button>
  );
};

/* ==================== Tag ==================== */
const Tag = ({ children, variant = "neutral", dot }) => {
  const variants = {
    neutral: { bg: "var(--paper-deep)", fg: "var(--ink-soft)", br: "var(--sand)" },
    ember: { bg: "var(--ember-tint)", fg: "#8A3F24", br: "transparent" },
    moss: { bg: "var(--moss-tint)", fg: "var(--moss)", br: "transparent" },
    indigo: { bg: "var(--indigo-tint)", fg: "var(--indigo)", br: "transparent" },
  };
  const v = variants[variant];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      fontFamily: "var(--font-sans)", fontWeight: 500, fontSize: 11, lineHeight: 1,
      padding: "4px 9px", borderRadius: 9999,
      background: v.bg, color: v.fg, border: `1px solid ${v.br}`,
    }}>
      {dot && <span style={{ width: 5, height: 5, borderRadius: "50%", background: "currentColor" }} />}
      {children}
    </span>
  );
};

/* ==================== MetaChip (mono data chip) ==================== */
const MetaChip = ({ children }) => (
  <span style={{
    fontFamily: "var(--font-mono)", fontSize: 11, padding: "3px 7px",
    background: "var(--paper-deep)", color: "var(--ink-soft)",
    borderRadius: 4, border: "1px solid var(--sand)",
  }}>{children}</span>
);

/* ==================== Kbd ==================== */
const Kbd = ({ children }) => (
  <span style={{
    fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 500,
    padding: "2px 6px", background: "var(--vellum)", border: "1px solid var(--sand)",
    borderBottomWidth: 2, borderRadius: 4, color: "var(--ink-soft)", lineHeight: 1.2,
  }}>{children}</span>
);

/* ==================== Field (input) ==================== */
const Field = ({ icon, placeholder, value, onChange, width = "100%", kbd, onEnter, autoFocus }) => {
  const [focus, setFocus] = useState(false);
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8, width,
      padding: "10px 12px", background: focus ? "var(--paper)" : "var(--vellum)",
      border: `1px solid ${focus ? "var(--ember)" : "var(--sand)"}`,
      borderRadius: 4,
      boxShadow: focus ? "0 0 0 3px var(--focus-ring)" : "none",
      transition: "all 120ms",
    }}>
      {icon && <Icon name={icon} size={14} color="var(--ink-mute)" />}
      <input
        value={value || ""} onChange={e => onChange && onChange(e.target.value)}
        placeholder={placeholder} autoFocus={autoFocus}
        onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
        onKeyDown={e => e.key === "Enter" && onEnter && onEnter()}
        style={{
          flex: 1, border: "none", outline: "none", background: "transparent",
          fontFamily: "var(--font-sans)", fontSize: 14, color: "var(--ink)",
        }}
      />
      {kbd && <Kbd>{kbd}</Kbd>}
    </div>
  );
};

/* ==================== Avatar ==================== */
const Avatar = ({ name = "Y", size = 24, bg = "var(--indigo)" }) => (
  <div style={{
    width: size, height: size, borderRadius: "50%", background: bg, color: "var(--paper)",
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    fontSize: size * 0.45, fontWeight: 600, fontFamily: "var(--font-sans)",
  }}>{name}</div>
);

/* ==================== Divider ==================== */
const Divider = ({ vertical, style }) => (
  <div style={{
    background: "var(--sand)",
    ...(vertical ? { width: 1, alignSelf: "stretch" } : { height: 1, width: "100%" }),
    ...style,
  }}/>
);

Object.assign(window, { Icon, Button, IconButton, Tag, MetaChip, Kbd, Field, Avatar, Divider });
