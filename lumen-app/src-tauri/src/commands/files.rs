// [INPUT]: 依赖 std::fs, tauri::AppHandle
// [OUTPUT]: 对外提供 import_pdf, read_pdf_file 命令
// [POS]: commands 模块的文件操作，处理 PDF 导入和读取

use std::path::PathBuf;
use tauri::{AppHandle, Manager};

/// 将 PDF 从原始路径复制到应用数据目录，返回存储后的绝对路径
#[tauri::command]
pub fn import_pdf(app: AppHandle, source_path: String) -> Result<String, String> {
    let source = PathBuf::from(&source_path);
    if !source.exists() {
        return Err(format!("文件不存在: {}", source_path));
    }

    let app_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;
    let papers_dir = app_dir.join("papers");
    std::fs::create_dir_all(&papers_dir)
        .map_err(|e| format!("无法创建论文目录: {}", e))?;

    let file_name = source
        .file_name()
        .ok_or("无法获取文件名")?
        .to_string_lossy()
        .to_string();

    // 避免文件名冲突：如果已存在，加时间戳后缀
    let mut dest = papers_dir.join(&file_name);
    if dest.exists() {
        let stem = source.file_stem().unwrap_or_default().to_string_lossy();
        let ts = chrono::Local::now().format("%Y%m%d%H%M%S");
        dest = papers_dir.join(format!("{}_{}.pdf", stem, ts));
    }

    std::fs::copy(&source, &dest)
        .map_err(|e| format!("复制文件失败: {}", e))?;

    let dest_str = dest.to_string_lossy().to_string();
    log::info!("PDF 已导入: {}", dest_str);
    Ok(dest_str)
}

/// 读取 PDF 文件内容，返回字节数组
#[tauri::command]
pub fn read_pdf_file(file_path: String) -> Result<Vec<u8>, String> {
    std::fs::read(&file_path)
        .map_err(|e| format!("读取文件失败: {} - {}", file_path, e))
}
