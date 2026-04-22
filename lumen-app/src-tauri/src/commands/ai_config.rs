// [INPUT]: 依赖 db::DbState, serde
// [OUTPUT]: 对外提供 save_ai_config, get_ai_config, list_ai_configs 命令
// [POS]: commands 模块的 AI 配置管理，被设置页面消费

use crate::db::DbState;
use serde::{Deserialize, Serialize};
use tauri::State;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AiConfig {
    pub provider: String,
    pub api_key: Option<String>,
    pub default_model: Option<String>,
    pub is_default: bool,
}

#[derive(Debug, Deserialize)]
pub struct SaveAiConfigInput {
    pub provider: String,
    pub api_key: String,
    pub default_model: Option<String>,
    pub is_default: Option<bool>,
}

#[tauri::command]
pub fn save_ai_config(db: State<DbState>, input: SaveAiConfigInput) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;

    if input.is_default.unwrap_or(false) {
        conn.execute("UPDATE ai_config SET is_default = 0", [])
            .map_err(|e| e.to_string())?;
    }

    conn.execute(
        "INSERT INTO ai_config (provider, api_key, default_model, is_default)
         VALUES (?1, ?2, ?3, ?4)
         ON CONFLICT(provider) DO UPDATE SET
           api_key = excluded.api_key,
           default_model = excluded.default_model,
           is_default = excluded.is_default",
        rusqlite::params![
            input.provider,
            input.api_key,
            input.default_model,
            input.is_default.unwrap_or(false) as i32,
        ],
    )
    .map_err(|e| format!("保存 AI 配置失败: {}", e))?;

    Ok(())
}

#[tauri::command]
pub fn get_ai_config(db: State<DbState>, provider: Option<String>) -> Result<Option<AiConfig>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;

    let query = match &provider {
        Some(_) => "SELECT provider, api_key, default_model, is_default FROM ai_config WHERE provider = ?1",
        None => "SELECT provider, api_key, default_model, is_default FROM ai_config WHERE is_default = 1",
    };

    let result = match &provider {
        Some(p) => conn.query_row(query, [p], map_row),
        None => conn.query_row(query, [], map_row),
    };

    match result {
        Ok(config) => Ok(Some(config)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(format!("查询 AI 配置失败: {}", e)),
    }
}

fn map_row(row: &rusqlite::Row) -> rusqlite::Result<AiConfig> {
    Ok(AiConfig {
        provider: row.get(0)?,
        api_key: row.get(1)?,
        default_model: row.get(2)?,
        is_default: row.get::<_, i32>(3)? != 0,
    })
}
