# Lumen — 独立研究者的论文研究工具

Tauri v2 + React + TypeScript + Tailwind CSS + Rust + SQLite + pdf.js

---

## 分形文档协议

代码是机器相，文档是语义相，两相必须同构。
任一相变化，必须在另一相显现，否则视为未完成。

### 三层结构

| 层级 | 位置 | 职责 | 何时更新 |
|------|------|------|----------|
| L1 | `/CLAUDE.md` | 项目宪法 · 全局地图 · 技术栈 | 架构变更 / 顶级模块增删 |
| L2 | `/{module}/CLAUDE.md` | 局部地图 · 成员清单 · 暴露接口 | 文件增删 / 重命名 / 接口变更 |
| L3 | 业务文件头部注释 | INPUT / OUTPUT / POS 契约 | 依赖变更 / 导出变更 / 职责变更 |

分形自相似性：L1 是 L2 的折叠，L2 是 L3 的折叠，L3 是代码逻辑的折叠。

### L3 头部格式

```typescript
/**
 * [INPUT]: 依赖 {模块/文件} 的 {具体能力}
 * [OUTPUT]: 对外提供 {导出的函数/组件/类型/常量}
 * [POS]: {所属模块} 的 {角色定位}，{与兄弟文件的关系}
 */
```

仅业务文件需要 L3（配置文件、样式文件、测试文件不需要）。
每个开发阶段结束时统一检查文档同构，不在每次单文件修改时回环。

---

## 产品定位

面向独立研究者的桌面论文研究应用。把论文管理、AI 辅助精读、跨论文深度研究整合在一个本地优先的安静工作空间里。

详见 `PRD_v0.1.md`。（/Users/zihao/Workspace/Projects/lumen/PRD_v0.1.md）

## 架构

```
lumen/
├── src-tauri/                  # Rust 后端（Tauri v2）
│   └── src/
│       ├── commands/           # Tauri 命令：papers / pdf / fs
│       ├── db/                 # SQLite：rusqlite + migrations
│       └── main.rs
├── src/                        # React + TypeScript 前端
│   ├── components/
│   │   ├── layout/             # AppShell · Sidebar · Titlebar
│   │   ├── library/            # Library 模块
│   │   ├── reader/             # Reader 模块
│   │   ├── research/           # Research 模块（Phase 3）
│   │   ├── ai/                 # AI 面板
│   │   └── common/             # 通用组件
│   ├── hooks/                  # useAI · usePapers · useTranslate
│   ├── services/
│   │   ├── ai/                 # AI Provider 适配层
│   │   ├── pdf.ts              # PDF 服务
│   │   └── db.ts               # 数据库服务
│   ├── agent/                  # Research Harness：规划、工具、证据、研究判断、运行时 trace
│   ├── store/                  # 状态管理
│   └── styles/                 # 对接 Lumen Design System
├── doc/                        # 项目文档：通信交接、评分标准、长期规范
├── CLAUDE.md                   # ← 你在这里（L1 项目宪法）
└── PRD_v0.1.md                 # 产品需求文档
```

## 技术栈

| 层 | 选择 | 理由 |
|----|------|------|
| 框架 | Tauri v2 | 轻量原生桌面，Rust 后端 |
| 前端 | React 19 + TypeScript | 生态成熟 |
| 样式 | Tailwind CSS v4 | 与设计系统 CSS 变量对接 |
| 后端 | Rust（Tauri 内置） | 文件操作、PDF 解析等性能敏感任务 |
| 本地数据库 | SQLite via rusqlite | 论文元数据、笔记、研究记录 |
| PDF 渲染 | pdf.js | 浏览器端 PDF 渲染 |
| AI 接入 | 多模型适配层 | 统一接口，用户自选模型 |

## 设计系统

**路径**：`/Users/zihao/Workspace/Projects/Lumen_Design_System`

核心约束——所有 UI 代码必须遵守：

1. **颜色**：只使用 `colors_and_type.css` 中的 CSS 变量（`--paper` `--vellum` `--sand` `--ink` `--ember` `--moss` `--indigo`）。禁止硬编码颜色。
2. **字体**：UI 用 Inter Tight + 思源黑体，正文阅读用 Source Serif 4 + 思源宋体，元数据用 JetBrains Mono。
3. **圆角**：sm 4px / md 8px / lg 12px / full 9999px。不超过 16px。
4. **阴影**：4 档（none / hairline / popover / modal）。不使用 inner shadow，不使用彩色 shadow。
5. **动效**：安静、短促、线性偏缓。禁止 spring bounce、overshoot、3D。Duration：fast 120ms / base 180ms / slow 280ms。
6. **Hover**：背景染 `--sand`，不使用 scale。Press：背景加深 4-6%，不使用 scale down。
7. **文案**：简体中文为主，精确优先于热情，不使用 emoji，不使用 AI 营销话术。详见设计系统 README.md 的 CONTENT FUNDAMENTALS。

## 数据架构

全部本地存储。论文 PDF、SQLite 数据库、笔记全部存在用户本地。AI 调用通过用户自己的 API Key 直接请求各模型 API。不做任何云端服务。

核心实体：papers / tags / paper_tags / collections / annotations / research_projects / research_papers / research_notes / ai_config

详见 PRD 第四节数据模型。

## 开发分期

| 阶段 | 目标 | 交付物 |
|------|------|--------|
| Phase 1 | 能导入论文 + 读 PDF + AI 对话 | Library · Reader · AI 面板 · 设置 |
| Phase 2 | 精读能力 | 高亮标注 · 十问精读 · 术语卡片 · 多模型 · Collections |
| Phase 3 | 跨论文深度研究 | Research 模块完整功能 · 研究报告导出 |
| Phase 4 | 知识图谱与打磨 | Graph · 引用关系 · Token 统计 · Zotero 导入 |

当前阶段：**Phase 3 已基本完成，准备进入 Phase 4**

---

## 当前进度（2026-04-24 更新）

### 已完成

**Phase 1 — 全部完成**
- 脚手架：Tauri v2 + React + TypeScript + Tailwind，设计系统 CSS 变量已接入
- 窗口外壳：AppShell（自定义标题栏 + Sidebar + 主内容区）
- PDF 渲染：pdf.js v4.10.38（v5 与 Tauri WebKit 不兼容，不要升级）
- 数据层：Rust 端 SQLite（rusqlite），3 次 migration（v1 核心表，v2 collections，v3 research）
- 文献导入：拖入 PDF → Rust 提取元数据 → 复制到应用目录 → 存库 → Library 列表
- AI 面板：右侧面板，支持 OpenAI / DeepSeek / Claude / 自定义端点
- 划词翻译：选中文本 → AI 翻译 → 浮层展示

**Phase 2 — 大部分完成**
- 高亮标注：局部高亮（文本节点拆分 + mark 包裹）、跨行高亮（空格归一化匹配）、临时选中高亮（overlay div + getClientRects，因为 WebKit 的 ::selection 在 mouseup 后消失）、持久化标注（annotations 表）
- 十问精读：基于罗振宇「阅读十问」，一键发送 10 个深度问题给 AI（从最初的五问升级）
- 术语卡片：选中术语 → AI 生成 JSON {term, definition, detail} → 可保存为 annotation
- 多模型支持：OpenAI / DeepSeek / Claude / 自定义，统一 chatWithAI 接口
- Collections：文献集合管理
- 图片粘贴：聊天中 Ctrl+V 粘贴图片，支持 OpenAI 和 Anthropic 多模态格式
- 停止生成：AbortController 中断 AI 请求，加载中显示停止按钮

**Phase 3 — 基础完成**
- 深度研究 LUI 聊天界面（纯对话式，不是项目管理 GUI）
- 后端：research_projects / research_papers / research_notes 三表 + 完整 CRUD 命令
- 论文内容提取：pdfjs 提取文本（前 15 页，每篇 max 6000 字符）
- 系统提示词包含用户文献库列表
- Markdown 导出研究报告
- Research Judgment：可识别“论文集合 + 系统瓶颈 + Lumen 借鉴排序”类评测输入，输出选题判断而不是论文摘要列表；提供 `npm run research:judge -- --prompt-file <path>` CLI 验收入口
- Research Report Scoring：评分标准沉淀在 `lumen-app/doc/research-report-scoring-criteria.md`，每次评分如调整标准或发现新扣分模式，应更新该文档并追加记录

### 尚未完成

- **术语列表管理**：术语卡片可以保存，但没有统一的术语浏览/管理界面（Phase 2 时主动跳过）
- **研究项目持久化**：后端 CRUD 已就绪，但前端 ResearchPage 目前是单次会话聊天，未接入项目保存/历史
- **Phase 4 全部功能**：知识图谱 Graph 页面（目前是占位）、引用关系、Token 统计、Zotero 导入

### 关键设计决策（新会话必读）

1. **Research 用 LUI 而非 GUI**：用户明确要求「深度研究不是项目，是聊天窗口」，认为 LUI 是未来。不要把 Research 改回表单/项目管理的 GUI 风格。
2. **PDF 渲染用 pdfjs v4**：v5 的 ESM 加载方式在 Tauri WebKit 下不工作，锁定 v4.10.38。
3. **临时高亮用 overlay div**：WebKit 中 `::selection` 在 mouseup 后消失，DOM 操作方案（surroundContents、text node split）都不可靠。最终方案是 `range.getClientRects()` 生成绝对定位的 overlay div，`pointer-events: none`。
4. **全部本地，无云端**：所有数据本地存储，AI 通过用户自己的 API Key 直连各厂商 API。
5. **中文为主**：界面文案、注释、交互全部简体中文。

### 文件清单

```
src/pages/          — LibraryPage, ReaderPage, ResearchPage, GraphPage, SettingsPage, CollectionPage
src/components/ai/  — AiPanel（聊天面板，支持图片粘贴 + 停止生成）
src/components/reader/ — PdfViewer, SelectionToolbar, TranslatePopover, TermCard
src/agent/          — Research Harness：guides / tools / sensors / prompts / runtime / research-judgment
src/services/       — ai.ts, ai-config.ts, papers.ts, files.ts, annotations.ts, collections.ts, research.ts
src-tauri/src/commands/ — papers, pdf, fs, research
src-tauri/src/db/   — migrations.rs (v1-v3)
```

## 编码规范

- 交互语言：中文
- 注释语言：中文 + ASCII 风格分块
- 每文件不超过 800 行
- 每层目录不超过 8 个文件，超出则拆分子目录
- 函数短小只做一件事，超过 20 行反思设计
- 优先消除特殊情况，而非增加 if/else
- 先写最简单能运行的实现，再考虑扩展
