# Iconography — Lumen

Lumen 的图标系统遵循与品牌一致的**克制细线美学**：统一细线、圆端圆角、1.5px 线宽、24×24 viewBox。

## 选择：Lucide

我们采用 **[Lucide](https://lucide.dev)** 作为 Lumen 的图标库。理由：
- 细线 (1.5px stroke)、开源、CC0 无许可证负担
- 与 Inter Tight 的几何感气质一致
- 覆盖研究工具所需：文档、书签、标签、搜索、图谱节点、聊天、文件夹、引用等
- CDN 可用，无需打包

> ⚠️ **替代说明**：用户未提供自有图标库。Lucide 是基于设计直觉的就近替代。如品牌后续有自有 icon set，请提供并替换。

## 使用方式

**推荐（生产）**：安装 `lucide` 包，按需导入 SVG。

**原型 / 设计稿**：通过 CDN 脚本全局注入，用 `<i data-lucide="book-open">` 占位。
```html
<script src="https://unpkg.com/lucide@latest/dist/umd/lucide.min.js"></script>
<script>lucide.createIcons();</script>
```

## 约定

- **尺寸**：14 / 16 / 18 / 20 / 24px，优先 16 与 18
- **线宽**：1.5px（Lucide 默认 2px 我们稍微改细，通过 `stroke-width="1.5"`）
- **颜色**：继承 `currentColor`；默认 `--ink-soft`，hover `--ink`
- **对齐**：与文字基线对齐 `vertical-align: -2px`
- **间距**：图标 + 文字使用 8px gap

## Lumen 常用图标映射

| 功能 | Lucide 名 |
|---|---|
| 文献 / 论文 | `file-text` |
| 文献库 | `library` 或 `book-open` |
| 深度研究 | `sparkles` |
| 搜索 | `search` |
| 引文图谱 | `share-2` |
| 标签 | `tag` |
| 收藏夹 / 文件夹 | `folder` |
| 星标 | `star` |
| 笔记 | `notebook-pen` |
| 引用 | `quote` |
| 归档 | `archive` |
| 设置 | `settings-2` |
| 关闭 | `x` |
| 更多 | `more-horizontal` |
| 菜单 | `menu` |
| 添加 | `plus` |
| 过滤 | `sliders-horizontal` |
| 排序 | `arrow-down-up` |
| 加载中 | `loader` |
| 校验 / 成功 | `check` |
| 链接外部 | `arrow-up-right` |
| AI 光标 / 生成 | `sparkle` |
| 拖拽入 | `file-plus-2` |
| 展开 / 折叠 | `chevron-right` / `chevron-down` |

## Emoji & Unicode

**几乎不使用 emoji。** 整个 UI 中 emoji 出现为 0。

允许的 Unicode 辅助符号（用作元信息分隔、引文标记等，但不作为按钮图标）：
- `·` middle dot — 元信息分隔
- `•` bullet — 列表
- `›` single right chevron — 面包屑
- `—` em dash — 强调停顿
- `…` ellipsis — 省略 / 加载
- `↗` north-east arrow — 外部链接
- `◇` white diamond — 脚注 / 注释
- `§` section — 章节引用

## 禁用

- ❌ emoji 图标（🎉 ✨ 📚 等）
- ❌ 粗线风图标 (Feather Bold, Material Bold)
- ❌ 填充式风格（Phosphor Fill, Material Filled，除非明确用于 active 状态）
- ❌ 多色渐变图标
- ❌ 卡通插画图标
