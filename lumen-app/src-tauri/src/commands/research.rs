// [INPUT]: 依赖 db::DbState, serde, uuid
// [OUTPUT]: 对外提供 research CRUD 命令
// [POS]: commands 模块的研究项目管理，被 Research 页面消费

use crate::db::DbState;
use serde::{Deserialize, Serialize};
use tauri::State;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ResearchProject {
    pub id: String,
    pub name: String,
    pub question: Option<String>,
    pub status: Option<String>,
    pub report: Option<String>,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
    pub paper_count: Option<i32>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ResearchPaper {
    pub paper_id: String,
    pub title: String,
    pub authors: Option<String>,
    pub file_path: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ResearchNote {
    pub id: String,
    pub project_id: String,
    pub role: Option<String>,
    pub content: String,
    pub created_at: Option<String>,
}

#[tauri::command]
pub fn create_research_project(db: State<DbState>, name: String) -> Result<ResearchProject, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let id = uuid::Uuid::new_v4().to_string();

    conn.execute(
        "INSERT INTO research_projects (id, name) VALUES (?1, ?2)",
        rusqlite::params![id, name],
    )
    .map_err(|e| format!("创建研究项目失败: {}", e))?;

    Ok(ResearchProject {
        id,
        name,
        question: None,
        status: Some("active".into()),
        report: None,
        created_at: None,
        updated_at: None,
        paper_count: Some(0),
    })
}

#[tauri::command]
pub fn list_research_projects(db: State<DbState>) -> Result<Vec<ResearchProject>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare(
            "SELECT rp.id, rp.name, rp.question, rp.status, rp.report, rp.created_at, rp.updated_at,
                    (SELECT COUNT(*) FROM research_papers WHERE project_id = rp.id) as paper_count
             FROM research_projects rp ORDER BY rp.updated_at DESC",
        )
        .map_err(|e| e.to_string())?;

    let projects = stmt
        .query_map([], |row| {
            Ok(ResearchProject {
                id: row.get(0)?,
                name: row.get(1)?,
                question: row.get(2)?,
                status: row.get(3)?,
                report: row.get(4)?,
                created_at: row.get(5)?,
                updated_at: row.get(6)?,
                paper_count: row.get(7)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(projects)
}

#[tauri::command]
pub fn get_research_project(db: State<DbState>, id: String) -> Result<ResearchProject, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;

    conn.query_row(
        "SELECT rp.id, rp.name, rp.question, rp.status, rp.report, rp.created_at, rp.updated_at,
                (SELECT COUNT(*) FROM research_papers WHERE project_id = rp.id) as paper_count
         FROM research_projects rp WHERE rp.id = ?1",
        [&id],
        |row| {
            Ok(ResearchProject {
                id: row.get(0)?,
                name: row.get(1)?,
                question: row.get(2)?,
                status: row.get(3)?,
                report: row.get(4)?,
                created_at: row.get(5)?,
                updated_at: row.get(6)?,
                paper_count: row.get(7)?,
            })
        },
    )
    .map_err(|e| format!("获取研究项目失败: {}", e))
}

#[tauri::command]
pub fn update_research_project(
    db: State<DbState>,
    id: String,
    question: Option<String>,
    report: Option<String>,
) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;

    conn.execute(
        "UPDATE research_projects SET question = COALESCE(?2, question), report = COALESCE(?3, report), updated_at = datetime('now') WHERE id = ?1",
        rusqlite::params![id, question, report],
    )
    .map_err(|e| format!("更新研究项目失败: {}", e))?;

    Ok(())
}

#[tauri::command]
pub fn delete_research_project(db: State<DbState>, id: String) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM research_projects WHERE id = ?1", [&id])
        .map_err(|e| format!("删除研究项目失败: {}", e))?;
    Ok(())
}

#[tauri::command]
pub fn add_paper_to_research(db: State<DbState>, project_id: String, paper_id: String) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT OR IGNORE INTO research_papers (project_id, paper_id) VALUES (?1, ?2)",
        rusqlite::params![project_id, paper_id],
    )
    .map_err(|e| format!("添加论文到研究项目失败: {}", e))?;

    conn.execute(
        "UPDATE research_projects SET updated_at = datetime('now') WHERE id = ?1",
        [&project_id],
    )
    .map_err(|_| "更新时间失败".to_string())?;

    Ok(())
}

#[tauri::command]
pub fn remove_paper_from_research(db: State<DbState>, project_id: String, paper_id: String) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "DELETE FROM research_papers WHERE project_id = ?1 AND paper_id = ?2",
        rusqlite::params![project_id, paper_id],
    )
    .map_err(|e| format!("从研究项目移除论文失败: {}", e))?;
    Ok(())
}

#[tauri::command]
pub fn list_research_papers(db: State<DbState>, project_id: String) -> Result<Vec<ResearchPaper>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare(
            "SELECT p.id, p.title, p.authors, p.file_path
             FROM papers p
             INNER JOIN research_papers rp ON rp.paper_id = p.id
             WHERE rp.project_id = ?1
             ORDER BY rp.added_at ASC",
        )
        .map_err(|e| e.to_string())?;

    let papers = stmt
        .query_map([&project_id], |row| {
            Ok(ResearchPaper {
                paper_id: row.get(0)?,
                title: row.get(1)?,
                authors: row.get(2)?,
                file_path: row.get(3)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(papers)
}

#[tauri::command]
pub fn save_research_report(db: State<DbState>, project_id: String, report: String) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE research_projects SET report = ?2, updated_at = datetime('now') WHERE id = ?1",
        rusqlite::params![project_id, report],
    )
    .map_err(|e| format!("保存报告失败: {}", e))?;
    Ok(())
}

#[tauri::command]
pub fn add_research_note(
    db: State<DbState>,
    project_id: String,
    role: String,
    content: String,
) -> Result<ResearchNote, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let id = uuid::Uuid::new_v4().to_string();

    conn.execute(
        "INSERT INTO research_notes (id, project_id, role, content) VALUES (?1, ?2, ?3, ?4)",
        rusqlite::params![id, project_id, role, content],
    )
    .map_err(|e| format!("保存研究笔记失败: {}", e))?;

    conn.execute(
        "UPDATE research_projects SET updated_at = datetime('now') WHERE id = ?1",
        [&project_id],
    )
    .map_err(|_| "更新时间失败".to_string())?;

    Ok(ResearchNote {
        id,
        project_id,
        role: Some(role),
        content,
        created_at: None,
    })
}

#[tauri::command]
pub fn list_research_notes(db: State<DbState>, project_id: String) -> Result<Vec<ResearchNote>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare(
            "SELECT id, project_id, role, content, created_at
             FROM research_notes
             WHERE project_id = ?1
             ORDER BY created_at ASC",
        )
        .map_err(|e| e.to_string())?;

    let notes = stmt
        .query_map([&project_id], |row| {
            Ok(ResearchNote {
                id: row.get(0)?,
                project_id: row.get(1)?,
                role: row.get(2)?,
                content: row.get(3)?,
                created_at: row.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(notes)
}
