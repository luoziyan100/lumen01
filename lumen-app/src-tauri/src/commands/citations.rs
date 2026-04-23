// [INPUT]: 依赖 db::DbState, serde, uuid
// [OUTPUT]: 对外提供 citation CRUD 命令
// [POS]: commands 模块的引用关系管理，被 Graph 页面消费

use crate::db::DbState;
use serde::{Deserialize, Serialize};
use tauri::State;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Citation {
    pub id: String,
    pub citing_id: String,
    pub cited_id: String,
    pub context: Option<String>,
    pub created_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CitationEdge {
    pub citing_id: String,
    pub cited_id: String,
    pub context: Option<String>,
}

#[tauri::command]
pub fn add_citation(
    db: State<DbState>,
    citing_id: String,
    cited_id: String,
    context: Option<String>,
) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let id = uuid::Uuid::new_v4().to_string();
    conn.execute(
        "INSERT OR IGNORE INTO citations (id, citing_id, cited_id, context) VALUES (?1, ?2, ?3, ?4)",
        rusqlite::params![id, citing_id, cited_id, context],
    )
    .map_err(|e| format!("添加引用关系失败: {}", e))?;
    Ok(())
}

#[tauri::command]
pub fn bulk_add_citations(db: State<DbState>, items: Vec<CitationEdge>) -> Result<u32, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let mut count = 0u32;
    for item in &items {
        let id = uuid::Uuid::new_v4().to_string();
        let changed = conn
            .execute(
                "INSERT OR IGNORE INTO citations (id, citing_id, cited_id, context) VALUES (?1, ?2, ?3, ?4)",
                rusqlite::params![id, item.citing_id, item.cited_id, item.context],
            )
            .map_err(|e| format!("批量添加引用失败: {}", e))?;
        count += changed as u32;
    }
    Ok(count)
}

#[tauri::command]
pub fn list_citations(db: State<DbState>) -> Result<Vec<Citation>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, citing_id, cited_id, context, created_at FROM citations")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            Ok(Citation {
                id: row.get(0)?,
                citing_id: row.get(1)?,
                cited_id: row.get(2)?,
                context: row.get(3)?,
                created_at: row.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    Ok(rows)
}

#[tauri::command]
pub fn list_paper_citations(db: State<DbState>, paper_id: String) -> Result<Vec<Citation>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT id, citing_id, cited_id, context, created_at FROM citations
             WHERE citing_id = ?1 OR cited_id = ?1",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([&paper_id], |row| {
            Ok(Citation {
                id: row.get(0)?,
                citing_id: row.get(1)?,
                cited_id: row.get(2)?,
                context: row.get(3)?,
                created_at: row.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    Ok(rows)
}

#[tauri::command]
pub fn delete_citation(db: State<DbState>, id: String) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM citations WHERE id = ?1", [&id])
        .map_err(|e| format!("删除引用关系失败: {}", e))?;
    Ok(())
}

#[tauri::command]
pub fn delete_paper_citations(db: State<DbState>, paper_id: String) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "DELETE FROM citations WHERE citing_id = ?1 OR cited_id = ?1",
        [&paper_id],
    )
    .map_err(|e| format!("删除论文引用关系失败: {}", e))?;
    Ok(())
}
