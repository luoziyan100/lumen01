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
│   ├── store/                  # 状态管理
│   └── styles/                 # 对接 Lumen Design System
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
| Phase 2 | 精读能力 | 高亮标注 · 五问精读 · 术语卡片 · 多模型 · Collections |
| Phase 3 | 跨论文深度研究 | Research 模块完整功能 · 研究报告导出 |
| Phase 4 | 知识图谱与打磨 | Graph · 引用关系 · Token 统计 · Zotero 导入 |

当前阶段：**Phase 1**

### Phase 1 实施步骤

```
1. 脚手架    → Tauri v2 + React + TypeScript + Tailwind，接入设计系统 CSS 变量
2. 窗口外壳  → AppShell（标题栏 + Sidebar + 主内容区）
3. PDF 渲染  → 主内容区跑通 pdf.js，能打开本地 PDF
4. 数据层    → Rust 端 SQLite 建表，Tauri commands 暴露 CRUD
5. 文献导入  → 拖入 PDF → Rust 提取元数据 → 存库 → Library 列表展示
6. AI 面板   → 右侧面板，先接通一个 provider，能基于论文内容对话
7. 划词翻译  → 选中文本 → AI 翻译 → 浮层展示
```

### Phase 1 验收标准

1. 打开 Lumen → 设置 → 输入 API Key
2. 拖入一篇英文 PDF
3. 自动提取标题、作者等元数据
4. Reader 中正常阅读 PDF
5. 选中一段英文 → 看到中文翻译
6. 右侧 AI 面板 → 基于论文提问 → 得到准确回答
7. 关闭重开 → 数据都在

## 编码规范

- 交互语言：中文
- 注释语言：中文 + ASCII 风格分块
- 每文件不超过 800 行
- 每层目录不超过 8 个文件，超出则拆分子目录
- 函数短小只做一件事，超过 20 行反思设计
- 优先消除特殊情况，而非增加 if/else
- 先写最简单能运行的实现，再考虑扩展
