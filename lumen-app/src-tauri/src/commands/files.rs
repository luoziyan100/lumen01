// [INPUT]: 依赖 std::fs, tauri::AppHandle
// [OUTPUT]: 对外提供 import_pdf, read_pdf_file 命令
// [POS]: commands 模块的文件操作，处理 PDF 导入和读取

use serde::Serialize;
use std::path::{Path, PathBuf};
use std::time::{Duration, SystemTime};
use tauri::{AppHandle, Manager};

#[derive(Debug, Serialize)]
pub struct PdfFetchResponse {
    pub bytes: Vec<u8>,
    pub cache_hit: bool,
}

#[derive(Debug, Serialize)]
pub struct PublicHtmlResponse {
    pub url: String,
    pub content_type: Option<String>,
    pub html: String,
}

const MAX_PREVIEW_PDF_BYTES: u64 = 50 * 1024 * 1024;
const MAX_PUBLIC_HTML_BYTES: u64 = 2 * 1024 * 1024;
const PREVIEW_CACHE_TTL: Duration = Duration::from_secs(7 * 24 * 60 * 60);
const BLOCKED_PUBLIC_HOSTS: &[&str] = &[
    "sci-hub",
    "libgen",
    "librarygenesis",
    "z-lib",
    "zlibrary",
    "annas-archive",
];

/// 将 PDF 从原始路径复制到应用数据目录，返回存储后的绝对路径
#[tauri::command]
pub fn import_pdf(app: AppHandle, source_path: String) -> Result<String, String> {
    let source = PathBuf::from(&source_path);
    if !source.exists() {
        return Err(format!("文件不存在: {}", source_path));
    }

    let app_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let papers_dir = app_dir.join("papers");
    std::fs::create_dir_all(&papers_dir).map_err(|e| format!("无法创建论文目录: {}", e))?;

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

    std::fs::copy(&source, &dest).map_err(|e| format!("复制文件失败: {}", e))?;

    let dest_str = dest.to_string_lossy().to_string();
    log::info!("PDF 已导入: {}", dest_str);
    Ok(dest_str)
}

/// 读取 PDF 文件内容，返回字节数组
#[tauri::command]
pub fn read_pdf_file(file_path: String) -> Result<Vec<u8>, String> {
    std::fs::read(&file_path).map_err(|e| format!("读取文件失败: {} - {}", file_path, e))
}

fn stable_hash(value: &str) -> String {
    let mut hash: u64 = 0xcbf29ce484222325;
    for byte in value.as_bytes() {
        hash ^= *byte as u64;
        hash = hash.wrapping_mul(0x100000001b3);
    }
    format!("{:016x}", hash)
}

fn cleanup_preview_cache(cache_dir: &Path) {
    let Ok(entries) = std::fs::read_dir(cache_dir) else {
        return;
    };
    let now = SystemTime::now();
    for entry in entries.flatten() {
        let Ok(metadata) = entry.metadata() else {
            continue;
        };
        let Ok(modified) = metadata.modified() else {
            continue;
        };
        if now.duration_since(modified).unwrap_or_default() > PREVIEW_CACHE_TTL {
            let _ = std::fs::remove_file(entry.path());
        }
    }
}

fn validate_pdf_bytes(_url: &str, _content_type: Option<&str>, bytes: &[u8]) -> Result<(), String> {
    let sample_len = bytes.len().min(1024);
    let looks_like_pdf = bytes[..sample_len]
        .windows(4)
        .any(|window| window == b"%PDF");

    if looks_like_pdf {
        Ok(())
    } else {
        Err("响应不像开放 PDF，已拒绝临时读取".to_string())
    }
}

fn blocked_public_url(url: &str) -> bool {
    let lower = url.to_ascii_lowercase();
    BLOCKED_PUBLIC_HOSTS
        .iter()
        .any(|blocked| lower.contains(blocked))
}

/// 下载开放 PDF 到应用缓存目录，只用于临时预览，不加入文献库
#[tauri::command]
pub async fn fetch_open_pdf(app: AppHandle, url: String) -> Result<PdfFetchResponse, String> {
    if !(url.starts_with("https://") || url.starts_with("http://")) {
        return Err("只允许读取 http/https 开放 PDF URL".to_string());
    }
    if blocked_public_url(&url) {
        return Err("该来源在公开 PDF 获取 blocklist 中，已拒绝访问".to_string());
    }

    let cache_dir = app
        .path()
        .app_cache_dir()
        .map_err(|e| e.to_string())?
        .join("paper-preview")
        .join("pdf");
    std::fs::create_dir_all(&cache_dir).map_err(|e| format!("无法创建临时缓存目录: {}", e))?;
    cleanup_preview_cache(&cache_dir);

    let cache_path = cache_dir.join(format!("{}.pdf", stable_hash(&url)));
    if let Ok(metadata) = std::fs::metadata(&cache_path) {
        let fresh = metadata
            .modified()
            .ok()
            .and_then(|modified| SystemTime::now().duration_since(modified).ok())
            .map(|age| age <= PREVIEW_CACHE_TTL)
            .unwrap_or(false);
        if fresh && metadata.len() <= MAX_PREVIEW_PDF_BYTES {
            let bytes =
                std::fs::read(&cache_path).map_err(|e| format!("读取临时 PDF 缓存失败: {}", e))?;
            return Ok(PdfFetchResponse {
                bytes,
                cache_hit: true,
            });
        }
    }

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(25))
        .user_agent("Lumen/0.1 paper-preview")
        .build()
        .map_err(|e| format!("创建 HTTP 客户端失败: {}", e))?;
    let response = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("下载开放 PDF 失败: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("开放 PDF 下载失败: HTTP {}", response.status()));
    }

    if let Some(length) = response.content_length() {
        if length > MAX_PREVIEW_PDF_BYTES {
            return Err("开放 PDF 超过 50MB 临时预览限制".to_string());
        }
    }

    let content_type = response
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .map(ToOwned::to_owned);
    let bytes = response
        .bytes()
        .await
        .map_err(|e| format!("读取开放 PDF 响应失败: {}", e))?;
    if bytes.len() as u64 > MAX_PREVIEW_PDF_BYTES {
        return Err("开放 PDF 超过 50MB 临时预览限制".to_string());
    }
    validate_pdf_bytes(&url, content_type.as_deref(), &bytes)?;

    std::fs::write(&cache_path, &bytes).map_err(|e| format!("写入临时 PDF 缓存失败: {}", e))?;

    Ok(PdfFetchResponse {
        bytes: bytes.to_vec(),
        cache_hit: false,
    })
}

/// 抓取公开 landing page / API 文本，只用于合法开放 PDF resolver，不执行 JS
#[tauri::command]
pub async fn fetch_public_html(url: String) -> Result<PublicHtmlResponse, String> {
    if !(url.starts_with("https://") || url.starts_with("http://")) {
        return Err("只允许读取 http/https 公开页面".to_string());
    }
    if blocked_public_url(&url) {
        return Err("该来源在公开页面获取 blocklist 中，已拒绝访问".to_string());
    }

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(15))
        .user_agent("Lumen/0.1 pdf-resolver")
        .redirect(reqwest::redirect::Policy::limited(5))
        .build()
        .map_err(|e| format!("创建 HTTP 客户端失败: {}", e))?;
    let response = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("读取公开页面失败: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("公开页面读取失败: HTTP {}", response.status()));
    }
    if let Some(length) = response.content_length() {
        if length > MAX_PUBLIC_HTML_BYTES {
            return Err("公开页面超过 2MB resolver 限制".to_string());
        }
    }

    let final_url = response.url().to_string();
    if blocked_public_url(&final_url) {
        return Err("跳转后的来源在 blocklist 中，已拒绝访问".to_string());
    }
    let content_type = response
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .map(ToOwned::to_owned);
    let bytes = response
        .bytes()
        .await
        .map_err(|e| format!("读取公开页面响应失败: {}", e))?;
    if bytes.len() as u64 > MAX_PUBLIC_HTML_BYTES {
        return Err("公开页面超过 2MB resolver 限制".to_string());
    }

    Ok(PublicHtmlResponse {
        url: final_url,
        content_type,
        html: String::from_utf8_lossy(&bytes).to_string(),
    })
}
