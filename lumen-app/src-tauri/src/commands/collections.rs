// [INPUT]: 依赖 db::DbState, serde, uuid
// [OUTPUT]: 对外提供 create_collection, list_collections, update_collection, delete_collection, add_paper_to_collection, remove_paper_from_collection, list_collection_papers 命令
// [POS]: commands 模块的 Collections CRUD，被前端 Sidebar 和 Library 消费

use crate::db::DbState;
use serde::{Deserialize, Serialize};
use tauri::State;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Collection {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub color: Option<String>,
    pub paper_count: i32,
    pub created_at: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateCollectionInput {
    pub name: String,
    pub description: Option<String>,
    pub color: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateCollectionInput {
    pub name: Option<String>,
    pub description: Option<String>,
    pub color: Option<String>,
}

#[tauri::command]
pub fn create_collection(db: State<DbState>, input: CreateCollectionInput) -> Result<Collection, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let id = uuid::Uuid::new_v4().to_string();

    conn.execute(
        "INSERT INTO collections (id, name, description, color) VALUES (?1, ?2, ?3, ?4)",
        rusqlite::params![id, input.name, input.description, input.color],
    )
    .map_err(|e| format!("创建集合失败: {}", e))?;

    Ok(Collection {
        id,
        name: input.name,
        description: input.description,
        color: input.color,
        paper_count: 0,
        created_at: None,
    })
}

#[tauri::command]
pub fn list_collections(db: State<DbState>) -> Result<Vec<Collection>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare(
            "SELECT c.id, c.name, c.description, c.color, c.created_at,
                    COUNT(cp.paper_id) as paper_count
             FROM collections c
             LEFT JOIN collection_papers cp ON c.id = cp.collection_id
             GROUP BY c.id
             ORDER BY c.created_at DESC",
        )
        .map_err(|e| e.to_string())?;

    let collections = stmt
        .query_map([], |row| {
            Ok(Collection {
                id: row.get(0)?,
                name: row.get(1)?,
                description: row.get(2)?,
                color: row.get(3)?,
                created_at: row.get(4)?,
                paper_count: row.get(5)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(collections)
}

#[tauri::command]
pub fn update_collection(db: State<DbState>, id: String, input: UpdateCollectionInput) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;

    if let Some(name) = &input.name {
        conn.execute("UPDATE collections SET name = ?1, updated_at = datetime('now') WHERE id = ?2", rusqlite::params![name, id])
            .map_err(|e| e.to_string())?;
    }
    if let Some(desc) = &input.description {
        conn.execute("UPDATE collections SET description = ?1, updated_at = datetime('now') WHERE id = ?2", rusqlite::params![desc, id])
            .map_err(|e| e.to_string())?;
    }
    if let Some(color) = &input.color {
        conn.execute("UPDATE collections SET color = ?1, updated_at = datetime('now') WHERE id = ?2", rusqlite::params![color, id])
            .map_err(|e| e.to_string())?;
    }

    Ok(())
}

#[tauri::command]
pub fn delete_collection(db: State<DbState>, id: String) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM collections WHERE id = ?1", [&id])
        .map_err(|e| format!("删除集合失败: {}", e))?;
    Ok(())
}

#[tauri::command]
pub fn add_paper_to_collection(db: State<DbState>, collection_id: String, paper_id: String) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT OR IGNORE INTO collection_papers (collection_id, paper_id) VALUES (?1, ?2)",
        rusqlite::params![collection_id, paper_id],
    )
    .map_err(|e| format!("添加论文到集合失败: {}", e))?;
    Ok(())
}

#[tauri::command]
pub fn remove_paper_from_collection(db: State<DbState>, collection_id: String, paper_id: String) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "DELETE FROM collection_papers WHERE collection_id = ?1 AND paper_id = ?2",
        rusqlite::params![collection_id, paper_id],
    )
    .map_err(|e| format!("从集合移除论文失败: {}", e))?;
    Ok(())
}

#[tauri::command]
pub fn list_collection_papers(db: State<DbState>, collection_id: String) -> Result<Vec<String>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT paper_id FROM collection_papers WHERE collection_id = ?1 ORDER BY added_at DESC")
        .map_err(|e| e.to_string())?;

    let ids = stmt
        .query_map([&collection_id], |row| row.get::<_, String>(0))
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(ids)
}
