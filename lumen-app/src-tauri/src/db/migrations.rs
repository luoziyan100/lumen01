// [INPUT]: 依赖 rusqlite::Connection
// [OUTPUT]: 对外提供 run 函数
// [POS]: db 模块的迁移执行器，被 mod.rs 的 init_db 调用

use rusqlite::{Connection, Result};

/// 执行所有数据库迁移
pub fn run(conn: &Connection) -> Result<()> {
    // 迁移版本追踪表
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS _migrations (
            version INTEGER PRIMARY KEY,
            applied_at TEXT DEFAULT (datetime('now'))
        );"
    )?;

    let current: i32 = conn
        .query_row(
            "SELECT COALESCE(MAX(version), 0) FROM _migrations",
            [],
            |row| row.get(0),
        )
        .unwrap_or(0);

    if current < 1 {
        v1_core_tables(conn)?;
        conn.execute("INSERT INTO _migrations (version) VALUES (1)", [])?;
        log::info!("迁移 v1: 核心表创建完成");
    }

    if current < 2 {
        v2_collections(conn)?;
        conn.execute("INSERT INTO _migrations (version) VALUES (2)", [])?;
        log::info!("迁移 v2: Collections 表创建完成");
    }

    if current < 3 {
        v3_research(conn)?;
        conn.execute("INSERT INTO _migrations (version) VALUES (3)", [])?;
        log::info!("迁移 v3: Research 表创建完成");
    }

    if current < 4 {
        v4_research_notes_role(conn)?;
        conn.execute("INSERT INTO _migrations (version) VALUES (4)", [])?;
        log::info!("迁移 v4: research_notes 增加 role 列");
    }

    if current < 5 {
        v5_citations(conn)?;
        conn.execute("INSERT INTO _migrations (version) VALUES (5)", [])?;
        log::info!("迁移 v5: citations 引用关系表创建完成");
    }

    Ok(())
}

/// v5: 引用关系 — 论文间的引用边
fn v5_citations(conn: &Connection) -> Result<()> {
    conn.execute_batch("
        CREATE TABLE citations (
            id         TEXT PRIMARY KEY,
            citing_id  TEXT NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
            cited_id   TEXT NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
            context    TEXT,
            created_at TEXT DEFAULT (datetime('now')),
            UNIQUE(citing_id, cited_id)
        );

        CREATE INDEX idx_citations_citing ON citations(citing_id);
        CREATE INDEX idx_citations_cited  ON citations(cited_id);
    ")
}

/// v4: 给 research_notes 增加 role 列，用于区分 user/assistant 消息
fn v4_research_notes_role(conn: &Connection) -> Result<()> {
    conn.execute_batch("
        ALTER TABLE research_notes ADD COLUMN role TEXT DEFAULT 'user';
    ")
}

/// v1: 核心表 — papers, tags, paper_tags, annotations, ai_config
fn v1_core_tables(conn: &Connection) -> Result<()> {
    conn.execute_batch("
        -- 论文
        CREATE TABLE papers (
            id          TEXT PRIMARY KEY,
            title       TEXT NOT NULL,
            authors     TEXT,
            year        INTEGER,
            abstract_   TEXT,
            doi         TEXT,
            arxiv_id    TEXT,
            file_path   TEXT NOT NULL,
            file_hash   TEXT,
            page_count  INTEGER,
            added_at    TEXT DEFAULT (datetime('now')),
            updated_at  TEXT DEFAULT (datetime('now')),
            metadata    TEXT
        );

        -- 标签
        CREATE TABLE tags (
            id    TEXT PRIMARY KEY,
            name  TEXT NOT NULL UNIQUE,
            color TEXT
        );

        -- 论文-标签关联
        CREATE TABLE paper_tags (
            paper_id TEXT REFERENCES papers(id) ON DELETE CASCADE,
            tag_id   TEXT REFERENCES tags(id) ON DELETE CASCADE,
            PRIMARY KEY (paper_id, tag_id)
        );

        -- 标注和笔记
        CREATE TABLE annotations (
            id         TEXT PRIMARY KEY,
            paper_id   TEXT NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
            type       TEXT NOT NULL,
            content    TEXT,
            quote      TEXT,
            page       INTEGER,
            position   TEXT,
            created_at TEXT DEFAULT (datetime('now'))
        );

        -- AI 设置
        CREATE TABLE ai_config (
            provider      TEXT PRIMARY KEY,
            api_key       TEXT,
            default_model TEXT,
            is_default    INTEGER DEFAULT 0
        );

        -- 索引
        CREATE INDEX idx_papers_title ON papers(title);
        CREATE INDEX idx_papers_year ON papers(year);
        CREATE INDEX idx_annotations_paper ON annotations(paper_id);
    ")
}

/// v2: Collections — 论文集合及关联
fn v2_collections(conn: &Connection) -> Result<()> {
    conn.execute_batch("
        CREATE TABLE collections (
            id          TEXT PRIMARY KEY,
            name        TEXT NOT NULL,
            description TEXT,
            color       TEXT,
            created_at  TEXT DEFAULT (datetime('now')),
            updated_at  TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE collection_papers (
            collection_id TEXT REFERENCES collections(id) ON DELETE CASCADE,
            paper_id      TEXT REFERENCES papers(id) ON DELETE CASCADE,
            added_at      TEXT DEFAULT (datetime('now')),
            PRIMARY KEY (collection_id, paper_id)
        );

        CREATE INDEX idx_collection_papers_coll ON collection_papers(collection_id);
        CREATE INDEX idx_collection_papers_paper ON collection_papers(paper_id);
    ")
}

/// v3: Research — 研究项目、关联论文、研究笔记
fn v3_research(conn: &Connection) -> Result<()> {
    conn.execute_batch("
        CREATE TABLE research_projects (
            id          TEXT PRIMARY KEY,
            name        TEXT NOT NULL,
            question    TEXT,
            status      TEXT DEFAULT 'active',
            report      TEXT,
            created_at  TEXT DEFAULT (datetime('now')),
            updated_at  TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE research_papers (
            project_id TEXT REFERENCES research_projects(id) ON DELETE CASCADE,
            paper_id   TEXT REFERENCES papers(id) ON DELETE CASCADE,
            added_at   TEXT DEFAULT (datetime('now')),
            PRIMARY KEY (project_id, paper_id)
        );

        CREATE TABLE research_notes (
            id         TEXT PRIMARY KEY,
            project_id TEXT NOT NULL REFERENCES research_projects(id) ON DELETE CASCADE,
            content    TEXT NOT NULL,
            created_at TEXT DEFAULT (datetime('now'))
        );

        CREATE INDEX idx_research_papers_proj ON research_papers(project_id);
        CREATE INDEX idx_research_notes_proj ON research_notes(project_id);
    ")
}
