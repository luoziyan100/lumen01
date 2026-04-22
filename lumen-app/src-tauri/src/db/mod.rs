// [INPUT]: 依赖 rusqlite, tauri::AppHandle
// [OUTPUT]: 对外提供 init_db, get_db 函数
// [POS]: db 模块入口，管理 SQLite 连接和迁移

use rusqlite::Connection;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{AppHandle, Manager};

mod migrations;

pub struct DbState(pub Mutex<Connection>);

/// 初始化数据库：创建文件 + 执行迁移
pub fn init_db(app: &AppHandle) -> Result<DbState, String> {
    let app_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("无法获取应用数据目录: {}", e))?;

    std::fs::create_dir_all(&app_dir)
        .map_err(|e| format!("无法创建数据目录: {}", e))?;

    let db_path: PathBuf = app_dir.join("lumen.db");
    log::info!("数据库路径: {:?}", db_path);

    let conn = Connection::open(&db_path)
        .map_err(|e| format!("无法打开数据库: {}", e))?;

    // 启用 WAL 模式和外键约束
    conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;")
        .map_err(|e| format!("PRAGMA 设置失败: {}", e))?;

    migrations::run(&conn).map_err(|e| format!("数据库迁移失败: {}", e))?;

    Ok(DbState(Mutex::new(conn)))
}
