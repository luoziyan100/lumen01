# Lumen Design System

> 一盏为研究者而设的灯。A workspace for deep research, paper archival, and knowledge graphing.

Lumen 是一款面向独立研究者与知识工作者的**桌面端**论文研究应用。它把"读论文"、"做研究"、"建档案"三件事放在同一个安静的工作空间里：AI 代理帮你深度阅读、语义检索、自动归档，并沿着引用关系编织知识图谱。

UI 语言：**简体中文为主**（英文作为元数据与专有名词保留，例如 DOI、arXiv、引文标题等）。

---

## Product Context

**产品形态**：桌面应用（macOS / Windows，Electron 类应用，窗口化布局）
**目标用户**：独立研究者、知识工作者、学术从业者
**核心功能**：
1. **Library / 文献库** — 本地文献归档、标签、收藏夹、阅读状态
2. **Paper Reader / 阅读器** — PDF 原文 + 侧边栏（AI 摘要、笔记、引文）
3. **Deep Research / 深度研究** — 以对话形式驱动 AI agent 读论文、比较、综述
4. **Graph / 引文图谱** — 沿引用/被引/主题关系浏览知识网络
5. **Semantic Search / 语义搜索** — 跨全库按语义检索片段

**英文内部代号**：Lumen（光；也取"luminous / illuminate"之意）
**中文命名**：流明 / Lumen（界面中保留英文名）

---

## Sources

This is a **net-new** design system. No codebase, Figma, or screenshots were provided.
All visual decisions in this system are original, based on direction provided by the user:
- Aesthetic: Minimal / sharp / modern + Soft / calm / focus mode
- Color mood: Warm paper tones (cream, ink, sepia)
- Typography: Sans display + serif body (reading-first)
- Density: Balanced
- Theme: Light-first (dark mode to come later)
- Audience: Independent researchers / knowledge workers
- Language: 简体中文 (Simplified Chinese) UI

If/when real assets appear (logo, Figma, codebase), re-run the design system update with them attached.

---

## Brand Voice (short)

纸墨书房的安静感，配上工具的克制与精准。不喧哗、不拟人、不煽情。
Quiet like a paper library, precise like a tool. Never performative, never emoji-heavy, never "AI-hyped."

See `CONTENT_FUNDAMENTALS` section below for specifics.

---

## Index / 文件清单

```
.
├── README.md                    ← you are here
├── SKILL.md                     ← Agent skill entry point
├── colors_and_type.css          ← CSS variables (colors, type, spacing)
├── fonts/                       ← webfonts used in UI
├── assets/                      ← logos, icons, imagery, illustrations
│   ├── logo/                    ← Lumen marks (wordmark, monogram, icon)
│   ├── icons/                   ← UI icons (SVG set)
│   └── imagery/                 ← texture & background imagery
├── preview/                     ← design-system card previews (for DS tab)
│   ├── type-*.html
│   ├── color-*.html
│   ├── spacing-*.html
│   ├── components-*.html
│   └── brand-*.html
└── ui_kits/
    └── desktop/                 ← Lumen desktop app UI kit
        ├── index.html           ← interactive click-thru
        ├── README.md
        ├── AppShell.jsx         ← window chrome + sidebar
        ├── Library.jsx
        ├── Reader.jsx
        ├── DeepResearch.jsx
        ├── Graph.jsx
        └── components/*.jsx     ← buttons, fields, cards, etc.
```

---

## CONTENT FUNDAMENTALS

### Voice & Tone / 语气

Lumen 的声音来自**安静书桌旁的同行者**：理性、克制、略带书卷气。它从不卖弄 AI，也不对用户说"加油 / 太棒了"这类情绪话术。

**三个基本原则**：
1. **精确优先于热情** — 宁可说"已归档 12 篇"，不说"已完美归档！🎉"
2. **名词先于动词** — 界面标签更像书签与卡片，而非按钮与行动号召
3. **短句、中文为主、英文为补** — 专有名词、元数据保留英文原貌

### 人称 / Pronouns

- 用户 → "你"（不使用"您"，保持平视而非仰视）
- 产品 → 不自称 "我"；必要时用 "Lumen"
- AI Agent → 以功能名称出场（例：**深度研究**、**摘要**、**发现引文**），而非"助手"或"小 L"

### 大小写 / Casing

- **英文标题**：Sentence case（例："Deep research", 不是 "Deep Research"）
- **中文标题**：简洁的短语，避免完整句子（例："深度研究"、"引文图谱"）
- **元数据**：保留原貌（arXiv:2309.01234, DOI:10.1038/..., Nature, NeurIPS 2024）
- **按钮**：动词短语优先（"归档"、"打开"、"继续阅读"）

### Emoji

**几乎不使用 emoji。** 整个 UI 中 emoji 出现不超过 0 次。
元信息用 Unicode 几何符号辅助（· • › — … ↗ ◇），不使用 ✨🚀🎉 等情绪 emoji。

### 示例文案 / Copy Examples

**空状态**：
> 你的文献库还是空的。拖入一份 PDF，或从 arXiv 粘贴链接开始。

**归档确认**：
> 已归档到 "注意力机制 · 2024"

**AI 摘要提示**：
> 正在阅读全文 · 约 40 秒

**错误**：
> 没能打开这份文件。文件可能已损坏或格式不支持。

**深度研究启动**：
> 告诉 Lumen 你在研究什么。它会从你的文献库中寻找相关论文，阅读、对比、回答。

**搜索占位**：
> 搜索全库 · 关键词、语义、或粘贴 DOI

### 不要这样写 ✗

- ✗ "嗨！我是 Lumen 小助手，今天想研究什么呀？😊"
- ✗ "太棒了！已经成功归档 🎉"
- ✗ "AI 智能推荐"、"一键生成"、"秒速"（营销话术）
- ✗ 长句祈使语气："请您点击此按钮以继续操作"

### 这样写 ✓

- ✓ "告诉 Lumen 你在研究什么。"
- ✓ "已归档 · 撤销"
- ✓ "按语义检索全库"
- ✓ "继续"

---

## VISUAL FOUNDATIONS

### 色彩 / Colors

**基底色系**：温暖的纸张色（warm paper tones）—— 米白、象牙、灰墨、棕褐。不是纯白，不是冷灰。

**主色板**：
- 纸 `--paper` `#FAF7F2` — 主背景（略带暖黄的米白）
- 羊皮 `--vellum` `#F3EDE3` — 卡片 / 次级面板
- 浅沙 `--sand` `#E8DFD1` — 分隔、hover 轻染色
- 墨 `--ink` `#2A241E` — 主文本（深棕黑，非纯黑）
- 淡墨 `--ink-soft` `#5A524A` — 正文副本
- 远墨 `--ink-mute` `#8C8278` — 占位、次级元信息
- 沉 `--ember` `#B85C3B` — 强调色（锈红/砖红，唯一的暖强调）
- 苔 `--moss` `#5F6B4A` — 次强调（橄榄绿，用于状态 / success）
- 藏青 `--indigo` `#3A4A5E` — 链接、引用、知识图谱节点

**语义色**：仅三档 —— success (moss)、warning (ember 变浅)、error (深赤 `#A33A2E`)。不使用蓝紫色渐变或彩虹色。

**vibe 关键词**：纸 / 墨 / 光 / 茶 / 砖。不使用霓虹、不使用饱和蓝、不使用紫色。

### 字体 / Typography

**Display / UI Sans（展示与界面）**：**Inter Tight** —— 现代、几何、紧凑；中文搭配 **思源黑体 Source Han Sans / Noto Sans SC**
**Body / Reading Serif（正文阅读）**：**Source Serif 4** —— 温暖、开放；中文搭配 **思源宋体 Source Han Serif / Noto Serif SC**
**Mono（元数据 / 代码）**：**JetBrains Mono**

> ⚠️ **字体替代说明**：用户未提供品牌字体。以上均为 Google Fonts 近似替代，已收录到 `fonts/` 并通过 `colors_and_type.css` 按 webfont 加载。如品牌确定后有指定字体，请提供字体文件，我们将替换。

**字阶（桌面端 14" ~ 16" 屏幕）**：
| 名称 | 尺寸 | 行高 | 字重 | 用途 |
|---|---|---|---|---|
| display-xl | 40 / 48 | 1.1 | 500 | 首屏大标题（慎用） |
| display-lg | 28 / 34 | 1.15 | 500 | 页面主标题 |
| display-md | 22 / 28 | 1.25 | 500 | 区块标题 |
| display-sm | 17 / 22 | 1.3 | 500 | 卡片标题 |
| body-lg | 16 / 26 | 1.6 | 400 | 阅读正文（serif） |
| body | 14 / 20 | 1.5 | 400 | UI 正文 |
| body-sm | 13 / 18 | 1.4 | 400 | 次级 |
| caption | 12 / 16 | 1.35 | 500 | 元数据 / 标签 |
| mono | 12 / 16 | 1.4 | 400 | DOI / 代码 |

**正文阅读字体 always use serif**（以提升论文阅读舒适度），UI chrome 使用 sans。

### 间距 / Spacing

4px baseline grid。常用刻度：**4 / 8 / 12 / 16 / 20 / 24 / 32 / 40 / 48 / 64**。
- 控件内边距：8 / 12
- 卡片内边距：16 / 20 / 24
- 区块之间：32 / 40
- 大区块之间（页面级）：48 / 64

### 背景 / Backgrounds

- 主背景是**纸色 `--paper`**，**不使用图片背景、不使用渐变**
- 允许**极轻的纸张纹理**（noise 1–2% opacity），用 CSS `background-image` 贴 SVG
- 卡片是 `--vellum` + 1px `--sand` 边框，**没有阴影**（或仅极轻 0 1px 0 sand）
- 全局**不使用 blur 玻璃拟态**（不符合纸的材质直觉）
- 唯一允许的"光效"：`--ember` 微光辉（仅用于 Lumen logo 与 focus ring）

### 阴影 / Shadows

**极度克制**。系统只有四档：
| Token | 值 | 场景 |
|---|---|---|
| `--shadow-0` | `none` | 默认 |
| `--shadow-1` | `0 1px 0 rgba(42,36,30,0.06)` | hairline 卡片下沿 |
| `--shadow-2` | `0 2px 8px rgba(42,36,30,0.06), 0 1px 2px rgba(42,36,30,0.04)` | 浮层 / popover |
| `--shadow-3` | `0 12px 32px rgba(42,36,30,0.10), 0 2px 8px rgba(42,36,30,0.06)` | modal / 右键菜单 |

不使用 inner shadow。不使用彩色 shadow。

### 边框与圆角 / Borders & Radii

- 边框：`1px solid var(--sand)`；hover 时加深到 `--ink-mute`
- 圆角：
  - `--radius-sm` 4px（按钮、输入框）
  - `--radius-md` 8px（卡片、菜单）
  - `--radius-lg` 12px（modal、大面板）
  - `--radius-full` 9999px（tag / 头像）
- **不使用超大圆角**（> 16px），**不使用尖角**（<= 0px，除极细分隔线）

### 动效 / Motion

气质是**安静、短促、线性偏缓**。不要反弹、不要过冲、不要 3D。

- Duration：`fast` 120ms · `base` 180ms · `slow` 280ms · `reader` 400ms（阅读器内专用）
- Easing：`cubic-bezier(0.2, 0.6, 0.2, 1)`（出入场）；`cubic-bezier(0.4, 0, 0.2, 1)`（状态切换）
- **不使用** spring bounce、overshoot
- 页面切换 = fade + 6px Y 位移
- Popover = fade + 4px Y 位移
- Modal = fade + scale(0.98 → 1)

### Hover / Press

- **Hover**：背景染 `--sand`（约 10% 暗于 vellum），文字色不变；链接下加 `--ember` 下划线
- **Press / Active**：背景再加深 4–6%，**不使用 scale down**
- **Focus**：2px 实色 outline = `--ember @ 40%` + 2px offset；不用浏览器默认 outline
- **Disabled**：透明度 40%，cursor: not-allowed

### 透明度 / 模糊

- 蒙层背景 `rgba(42,36,30,0.32)`（墨色 + 低透明）
- **不对卡片使用 backdrop-filter blur**；唯一例外是 modal 蒙层可选 `backdrop-filter: blur(2px)`
- 文本淡出（如引文长摘）可用 linear-gradient mask，不用透明度叠加图像

### 图像 / Imagery

- 整体色调：**暖调、偏哑光、低饱和**
- 如果有照片，加 1–2% sepia + 轻柔 grain；不使用高饱和彩色照片
- **不使用 AI 生图风格渐变**（不使用 blob、不使用 aurora）
- 允许细线描插画（类似《Scientific American》早期插图），风格 = **细线 + 单色（ink）+ 纸底**

### 布局规则 / Layout

- 桌面窗口**最小宽度 1120px**，推荐 1280–1600px
- 左侧 sidebar 固定 **240px**（可折叠到 56px）
- 主内容区 max-width：
  - 列表/看板视图：无上限
  - 阅读 / 文章：**720px**（保证阅读舒适）
  - 深度研究聊天：**780px**
- 顶部 titlebar 高度 **40px**（含窗口控制）；无独立全局导航栏（导航在 sidebar）

### Cards

卡片是 Lumen 的主要容器。
- 背景 `--vellum`
- 1px `--sand` 边框
- `--radius-md` 8px
- padding 16–24px
- hover：边框变 `--ink-mute`，背景不变
- selected：边框变 `--ember`，左侧 2px `--ember` 实心条
- **不使用左侧彩条 + 圆角组合**（避免 AI slop trope）——选中态的 2px 实心条是**整张卡片选中**的明确信号，不是装饰

### Fixed Elements

- 窗口标题栏：拖拽区；左上留出 macOS 交通灯空间 78px
- sidebar：固定，内部滚动
- Reader：PDF 面板固定，侧栏（笔记 / AI）独立滚动；两栏分隔条可拖拽
```
