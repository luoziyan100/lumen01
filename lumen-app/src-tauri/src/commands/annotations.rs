// [INPUT]: 依赖 db::DbState, serde, uuid
// [OUTPUT]: 对外提供 create_annotation, list_annotations, delete_annotation 命令
// [POS]: commands 模块的标注 CRUD，被 Reader 的高亮标注功能消费

use crate::db::DbState;
use serde::{Deserialize, Serialize};
use tauri::State;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Annotation {
    pub id: String,
    pub paper_id: String,
    #[serde(rename = "type")]
    pub ann_type: String,
    pub content: Option<String>,
    pub quote: Option<String>,
    pub page: Option<i32>,
    pub position: Option<String>,
    pub created_at: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateAnnotationInput {
    pub paper_id: String,
    #[serde(rename = "type")]
    pub ann_type: String,
    pub content: Option<String>,
    pub quote: Option<String>,
    pub page: Option<i32>,
    pub position: Option<String>,
}

#[tauri::command]
pub fn create_annotation(db: State<DbState>, input: CreateAnnotationInput) -> Result<Annotation, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let id = uuid::Uuid::new_v4().to_string();

    conn.execute(
        "INSERT INTO annotations (id, paper_id, type, content, quote, page, position)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        rusqlite::params![id, input.paper_id, input.ann_type, input.content, input.quote, input.page, input.position],
    )
    .map_err(|e| format!("创建标注失败: {}", e))?;

    Ok(Annotation {
        id,
        paper_id: input.paper_id,
        ann_type: input.ann_type,
        content: input.content,
        quote: input.quote,
        page: input.page,
        position: input.position,
        created_at: None,
    })
}

#[tauri::command]
pub fn list_annotations(db: State<DbState>, paper_id: String) -> Result<Vec<Annotation>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare(
            "SELECT id, paper_id, type, content, quote, page, position, created_at
             FROM annotations WHERE paper_id = ?1 ORDER BY created_at ASC",
        )
        .map_err(|e| e.to_string())?;

    let annotations = stmt
        .query_map([&paper_id], |row| {
            Ok(Annotation {
                id: row.get(0)?,
                paper_id: row.get(1)?,
                ann_type: row.get(2)?,
                content: row.get(3)?,
                quote: row.get(4)?,
                page: row.get(5)?,
                position: row.get(6)?,
                created_at: row.get(7)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(annotations)
}

#[tauri::command]
pub fn delete_annotation(db: State<DbState>, id: String) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM annotations WHERE id = ?1", [&id])
        .map_err(|e| format!("删除标注失败: {}", e))?;
    Ok(())
}
