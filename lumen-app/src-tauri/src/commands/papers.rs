// [INPUT]: 依赖 db::DbState, serde, uuid
// [OUTPUT]: 对外提供 add_paper, list_papers, get_paper, delete_paper 命令
// [POS]: commands 模块的论文 CRUD，被 Tauri 注册为前端可调用命令

use crate::db::DbState;
use serde::{Deserialize, Serialize};
use tauri::State;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Paper {
    pub id: String,
    pub title: String,
    pub authors: Option<String>,
    pub year: Option<i32>,
    pub abstract_: Option<String>,
    pub doi: Option<String>,
    pub arxiv_id: Option<String>,
    pub file_path: String,
    pub page_count: Option<i32>,
    pub added_at: Option<String>,
    pub metadata: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct AddPaperInput {
    pub title: String,
    pub authors: Option<String>,
    pub year: Option<i32>,
    pub abstract_: Option<String>,
    pub doi: Option<String>,
    pub arxiv_id: Option<String>,
    pub file_path: String,
    pub page_count: Option<i32>,
}

#[tauri::command]
pub fn add_paper(db: State<DbState>, input: AddPaperInput) -> Result<Paper, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let id = uuid::Uuid::new_v4().to_string();

    conn.execute(
        "INSERT INTO papers (id, title, authors, year, abstract_, doi, arxiv_id, file_path, page_count)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        rusqlite::params![
            id,
            input.title,
            input.authors,
            input.year,
            input.abstract_,
            input.doi,
            input.arxiv_id,
            input.file_path,
            input.page_count,
        ],
    ).map_err(|e| format!("插入论文失败: {}", e))?;

    get_paper_by_id(&conn, &id)
}

#[tauri::command]
pub fn list_papers(db: State<DbState>) -> Result<Vec<Paper>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare(
            "SELECT id, title, authors, year, abstract_, doi, arxiv_id, file_path, page_count, added_at, metadata
             FROM papers ORDER BY added_at DESC"
        )
        .map_err(|e| e.to_string())?;

    let papers = stmt
        .query_map([], |row| {
            Ok(Paper {
                id: row.get(0)?,
                title: row.get(1)?,
                authors: row.get(2)?,
                year: row.get(3)?,
                abstract_: row.get(4)?,
                doi: row.get(5)?,
                arxiv_id: row.get(6)?,
                file_path: row.get(7)?,
                page_count: row.get(8)?,
                added_at: row.get(9)?,
                metadata: row.get(10)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(papers)
}

#[tauri::command]
pub fn get_paper(db: State<DbState>, id: String) -> Result<Paper, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    get_paper_by_id(&conn, &id)
}

#[tauri::command]
pub fn delete_paper(db: State<DbState>, id: String) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM papers WHERE id = ?1", [&id])
        .map_err(|e| format!("删除论文失败: {}", e))?;
    Ok(())
}

fn get_paper_by_id(conn: &rusqlite::Connection, id: &str) -> Result<Paper, String> {
    conn.query_row(
        "SELECT id, title, authors, year, abstract_, doi, arxiv_id, file_path, page_count, added_at, metadata
         FROM papers WHERE id = ?1",
        [id],
        |row| {
            Ok(Paper {
                id: row.get(0)?,
                title: row.get(1)?,
                authors: row.get(2)?,
                year: row.get(3)?,
                abstract_: row.get(4)?,
                doi: row.get(5)?,
                arxiv_id: row.get(6)?,
                file_path: row.get(7)?,
                page_count: row.get(8)?,
                added_at: row.get(9)?,
                metadata: row.get(10)?,
            })
        },
    ).map_err(|e| format!("查询论文失败: {}", e))
}
