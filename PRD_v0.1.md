# Lumen — 产品需求文档（PRD）

**版本**: v1.0
**作者**: Yan
**日期**: 2026年4月
**状态**: 初稿

---

## 一、产品定义

### 一句话描述
Lumen 是一款面向独立研究者的桌面论文研究工具，将论文管理、AI辅助精读、跨论文深度研究整合在一个应用中。

### 要解决的问题
| 现有工具 | 能做什么 | 不能做什么 |
|---------|---------|-----------|
| Zotero | 论文管理、引用、标注 | 没有AI能力，不能做智能分析和跨论文研究 |
| UPDF | PDF翻译、阅读 | 翻译质量差，年费400元，不支持AI对话 |
| 沉浸式翻译 | 网页双语对照 | 只能翻译，不能做笔记、不能管理文献库 |
| Gemini Deep Research | 全网深度研究 | 不能基于用户自己的论文库做研究 |
| Claude / GPT | 单篇论文问答 | 没有文献管理，不能跨论文持续积累 |

### Lumen要做的事
把上面五个工具的核心能力合进一个应用：**管理论文 + AI精读 + 跨论文深度研究 + 产出研究报告**。

### 目标用户
独立研究者、跨学科学习者、没有学术机构支持但在做严肃研究的人。英语不是母语，需要AI辅助翻译和理解。

---

## 二、技术选型

| 层 | 选择 | 理由 |
|----|------|------|
| 框架 | Tauri v2 | 比Electron轻10倍+，性能好，原生体验 |
| 前端 | React + TypeScript | 生态成熟，AI能帮写 |
| 样式 | Tailwind CSS | 与设计系统对接方便 |
| 后端 | Rust (Tauri内置) | 文件操作、PDF解析等性能敏感任务 |
| 本地数据库 | SQLite (via rusqlite) | 论文元数据、笔记、研究记录 |
| PDF渲染 | pdf.js | 浏览器端PDF渲染，成熟可靠 |
| AI接入 | 多模型适配层 | 统一接口，用户自选模型 |
| 设计系统 | Lumen Design System | 已有，路径：/Users/zihao/Workspace/Projects/Lumen_Design_System |

---

## 三、核心功能模块

### 模块1：Library（文献库）

**功能**：管理用户的所有论文。

| 功能点 | 描述 | 优先级 |
|--------|------|--------|
| 导入论文 | 支持拖入PDF、从URL导入、从arXiv ID导入 | P0 |
| 自动提取元数据 | 从PDF中提取标题、作者、年份、摘要（用AI辅助） | P0 |
| 标签和分类 | 用户自定义标签，支持多级分类 | P0 |
| 搜索 | 全文搜索 + 元数据搜索 | P0 |
| Collections | 按研究主题组织论文集合（如截图中的"Attention · 2024"） | P1 |
| Zotero导入 | 从Zotero导出的文件中批量导入 | P1 |
| 引用关系图 | 可视化论文之间的引用关系 | P2 |

### 模块2：Reader（阅读器）

**功能**：PDF阅读 + AI辅助理解。

| 功能点 | 描述 | 优先级 |
|--------|------|--------|
| PDF渲染 | 基于pdf.js的高质量PDF显示 | P0 |
| 双语对照 | 选中段落即时翻译，原文/译文并排显示 | P0 |
| AI问答 | 右侧面板，基于当前论文与AI对话 | P0 |
| 划词翻译 | 选中词句即时翻译和解释 | P0 |
| 高亮标注 | 高亮文本 + 添加笔记 | P0 |
| 术语卡片 | 遇到专业术语，AI自动生成解释卡片，可保存 | P1 |
| 五问精读 | 一键执行"五问精读Prompt"，生成结构化笔记 | P1 |
| 公式解读 | 选中数学公式，AI解释其含义和直觉 | P2 |

**五问精读Prompt**（内置模板）：
```
请帮我精读这篇论文，回答以下5个问题，用中文回答：
1.【一句话总结】这篇论文在说什么？
2.【核心框架】论文的主要论点/框架是什么？
3.【开放问题】论文提出了哪些未解决的问题？
4.【对我的用处】这篇论文对我正在研究的问题"___"有什么直接可用的东西？
5.【它的盲区】这篇论文没做到什么？
```

### 模块3：Research（深度研究）

**功能**：跨多篇论文的AI辅助研究，产出研究报告。

这是Lumen区别于所有现有工具的核心功能。

| 功能点 | 描述 | 优先级 |
|--------|------|--------|
| 创建研究项目 | 给研究项目命名，选择要纳入的论文 | P0 |
| 研究问题设定 | 用户输入研究问题，AI基于选中论文做深度分析 | P0 |
| 跨论文分析 | AI阅读多篇论文，提取、对比、综合观点 | P0 |
| 研究报告生成 | 基于分析结果，生成带引用的研究报告（Markdown/PDF） | P0 |
| 对照表 | 自动/手动构建跨论文的概念对照表 | P1 |
| 研究笔记 | 在研究过程中随时记录想法和判断 | P1 |
| 增量更新 | 往研究项目中添加新论文后，AI更新分析 | P2 |

**Research工作流**：
```
用户创建研究项目
  → 选择论文（从Library中选）
  → 输入研究问题
  → AI逐篇读取论文内容
  → AI生成跨论文综合分析
  → 用户审阅、修改、追问
  → 导出研究报告
```

### 模块4：Graph（知识图谱）

**功能**：可视化论文之间和概念之间的关系。

| 功能点 | 描述 | 优先级 |
|--------|------|--------|
| 论文关系图 | 基于引用关系和AI分析的论文网络图 | P2 |
| 概念关系图 | 跨论文的核心概念及其关系 | P2 |
| 交互浏览 | 点击节点跳转到对应论文或笔记 | P2 |

Graph模块优先级较低，第一版可以不做。

### 模块5：AI引擎适配层

**功能**：统一接口对接多个AI模型。

| 功能点 | 描述 | 优先级 |
|--------|------|--------|
| 模型配置 | 用户在设置中输入API Key，选择默认模型 | P0 |
| 多模型支持 | Claude、GPT、DeepSeek、Gemini、Kimi等 | P0 |
| 统一接口 | 封装统一的调用接口，上层功能不关心底层是哪个模型 | P0 |
| 模型切换 | 在任何AI功能中可以临时切换模型 | P1 |
| Token用量统计 | 记录各模型的调用量和花费 | P2 |

**统一接口设计**：
```typescript
interface AIProvider {
  id: string;                    // "claude" | "openai" | "deepseek" | "gemini" | "kimi"
  name: string;                  // 显示名称
  models: Model[];               // 可用模型列表
  chat(messages: Message[], options?: ChatOptions): AsyncIterable<string>;
  estimateTokens(text: string): number;
}

interface ChatOptions {
  model?: string;                // 指定模型
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
}
```

**各模型API端点**：
| 模型 | API基础URL | 协议 |
|------|-----------|------|
| Claude | api.anthropic.com/v1/messages | Anthropic Messages API |
| GPT | api.openai.com/v1/chat/completions | OpenAI Chat API |
| DeepSeek | api.deepseek.com/v1/chat/completions | OpenAI兼容 |
| Gemini | generativelanguage.googleapis.com | Google AI API |
| Kimi | api.moonshot.cn/v1/chat/completions | OpenAI兼容 |

---

## 四、数据模型

### 核心实体

```sql
-- 论文
CREATE TABLE papers (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  authors TEXT,              -- JSON数组
  year INTEGER,
  abstract TEXT,
  doi TEXT,
  arxiv_id TEXT,
  file_path TEXT NOT NULL,   -- 本地PDF路径
  added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  metadata TEXT              -- JSON，其他元数据
);

-- 标签
CREATE TABLE tags (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT
);

-- 论文-标签关联
CREATE TABLE paper_tags (
  paper_id TEXT REFERENCES papers(id),
  tag_id TEXT REFERENCES tags(id),
  PRIMARY KEY (paper_id, tag_id)
);

-- Collections
CREATE TABLE collections (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 标注和笔记
CREATE TABLE annotations (
  id TEXT PRIMARY KEY,
  paper_id TEXT REFERENCES papers(id),
  type TEXT NOT NULL,         -- "highlight" | "note" | "term"
  content TEXT,               -- 用户笔记内容
  quote TEXT,                 -- 原文引用
  page INTEGER,
  position TEXT,              -- JSON，PDF中的位置信息
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 研究项目
CREATE TABLE research_projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  question TEXT,              -- 研究问题
  status TEXT DEFAULT 'active',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME
);

-- 研究项目-论文关联
CREATE TABLE research_papers (
  project_id TEXT REFERENCES research_projects(id),
  paper_id TEXT REFERENCES papers(id),
  PRIMARY KEY (project_id, paper_id)
);

-- 研究笔记和AI分析结果
CREATE TABLE research_notes (
  id TEXT PRIMARY KEY,
  project_id TEXT REFERENCES research_projects(id),
  type TEXT NOT NULL,         -- "ai_analysis" | "user_note" | "comparison_table"
  content TEXT NOT NULL,      -- Markdown内容
  model_used TEXT,            -- 使用的AI模型
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- AI设置
CREATE TABLE ai_config (
  provider TEXT PRIMARY KEY,
  api_key TEXT,               -- 加密存储
  default_model TEXT,
  is_default BOOLEAN DEFAULT FALSE
);
```

---

## 五、用户界面结构

### 整体布局
```
┌─────────────────────────────────────────────────────┐
│ 顶部工具栏（搜索、设置、模型切换）                      │
├──────────┬──────────────────────┬────────────────────┤
│          │                      │                    │
│  左侧栏   │     主内容区域        │    右侧AI面板      │
│          │                      │                    │
│ Library  │  PDF阅读器            │  AI对话            │
│ Reader   │  或                   │  翻译结果          │
│ Research │  研究报告              │  精读笔记          │
│ Graph    │  或                   │  研究分析          │
│          │  知识图谱              │                    │
│ ──────── │                      │                    │
│ Collections                     │                    │
│          │                      │                    │
└──────────┴──────────────────────┴────────────────────┘
```

### 已有设计资源
- 设计系统路径：`/Users/zihao/Workspace/Projects/Lumen_Design_System`
- 设计稿预览：Claude Design项目（含桌面端UI Kit）
- 配色、字体、组件规范已定义

---

## 六、开发分期

### Phase 1：最小可用版（4-6周）
**目标**：能导入论文 + 能读PDF + 能和AI对话

交付物：
- Library：导入PDF、提取元数据、标签分类、搜索
- Reader：PDF渲染、划词翻译、段落翻译
- AI面板：基于当前论文与AI对话（单模型先跑通，推荐先接Claude或DeepSeek）
- 设置：API Key配置

不做：Research模块、Graph模块、多模型切换、五问精读、对照表

### Phase 2：精读能力（3-4周）
**目标**：能高效精读一篇论文并产出结构化笔记

交付物：
- Reader增强：高亮标注、笔记
- 五问精读：一键生成结构化笔记
- 术语卡片
- 多模型支持：可在设置中配置多个模型并切换
- Collections

### Phase 3：深度研究（4-6周）
**目标**：能跨多篇论文做AI辅助的深度研究

交付物：
- Research模块完整功能
- 创建研究项目、选择论文、设定研究问题
- AI跨论文综合分析
- 对照表
- 研究报告导出（Markdown/PDF）

### Phase 4：知识图谱和打磨（持续）
- Graph模块
- 引用关系可视化
- Token用量统计
- 性能优化
- Zotero导入

---

## 七、关键技术决策

### PDF文本提取方案
论文PDF的文本提取质量直接决定AI分析的质量。

**方案**：Rust端用pdf-extract或lopdf提取文本，如果质量不好（扫描件等），fallback到OCR。前端用pdf.js渲染显示。

### AI长文本处理
一篇论文通常有8000-30000个token。Research模块跨多篇论文分析时，可能超出单次API调用的上下文窗口。

**方案**：
1. 单篇论文：直接放入上下文（大多数模型支持128K+）
2. 多篇论文：按论文分批处理，每篇提取核心内容后合并分析
3. 超长研究：实现简单的分块 + 总结 + 再分析的pipeline

### 翻译实现
**方案**：调用用户配置的AI模型做翻译，不依赖第三方翻译API。用专门的翻译Prompt保证学术术语准确性。

翻译Prompt模板：
```
你是一个学术论文翻译助手。请将以下英文学术文本翻译为中文。
要求：
1. 专业术语保持准确，首次出现时在中文后括号标注英文原文
2. 保持学术语气
3. 不要遗漏任何信息
4. 数学公式和变量名保持原文

原文：
{text}
```

### 本地存储 vs 云端
**决策**：全部本地存储。论文PDF、数据库、笔记全部存在用户本地。AI调用通过用户自己的API Key直接请求各模型API。不做任何云端服务。

理由：隐私、无服务器成本、离线可用（除AI功能外）。

---

## 八、文件结构

```
lumen/
├── src-tauri/                 # Rust后端
│   ├── src/
│   │   ├── main.rs
│   │   ├── commands/          # Tauri命令
│   │   │   ├── papers.rs      # 论文CRUD
│   │   │   ├── pdf.rs         # PDF文本提取
│   │   │   └── fs.rs          # 文件操作
│   │   ├── db/                # 数据库
│   │   │   ├── mod.rs
│   │   │   └── migrations/
│   │   └── lib.rs
│   ├── Cargo.toml
│   └── tauri.conf.json
├── src/                       # React前端
│   ├── components/
│   │   ├── layout/            # 整体布局
│   │   ├── library/           # Library模块组件
│   │   ├── reader/            # Reader模块组件
│   │   ├── research/          # Research模块组件
│   │   ├── ai/                # AI面板组件
│   │   └── common/            # 通用组件
│   ├── hooks/
│   │   ├── useAI.ts           # AI调用hook
│   │   ├── usePapers.ts       # 论文数据hook
│   │   └── useTranslate.ts    # 翻译hook
│   ├── services/
│   │   ├── ai/
│   │   │   ├── provider.ts    # AI Provider统一接口
│   │   │   ├── claude.ts      # Claude适配
│   │   │   ├── openai.ts      # OpenAI适配（GPT/DeepSeek/Kimi共用）
│   │   │   └── gemini.ts      # Gemini适配
│   │   ├── pdf.ts             # PDF相关服务
│   │   └── db.ts              # 数据库服务
│   ├── store/                 # 状态管理
│   ├── styles/                # 样式（对接Lumen Design System）
│   ├── App.tsx
│   └── main.tsx
├── package.json
└── README.md
```

---

## 九、验收标准（Phase 1）

Phase 1完成时，用户应该能做到以下流程：

1. 打开Lumen，进入设置，输入一个AI模型的API Key
2. 拖入一篇英文PDF论文
3. Lumen自动提取论文标题、作者等元数据
4. 在Reader中打开论文，正常阅读PDF
5. 选中一段英文，看到中文翻译
6. 在右侧AI面板中，基于这篇论文向AI提问，得到准确的回答
7. 关闭应用后重新打开，论文和所有数据都在

如果以上7步都能走通，Phase 1就算完成。