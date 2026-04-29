use serde::{Deserialize, Serialize};
use quick_xml::events::Event;
use quick_xml::Reader;
use std::collections::HashSet;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SearchAuthor {
    pub name: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SearchResult {
    pub id: String,
    pub title: String,
    pub abstract_text: Option<String>,
    pub authors: Vec<SearchAuthor>,
    pub year: Option<i32>,
    pub citation_count: i32,
    pub open_access_url: Option<String>,
    pub source_url: String,
    pub source: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SearchResponse {
    pub total: i32,
    pub results: Vec<SearchResult>,
}

// ---- OpenAlex ----

#[derive(Debug, Deserialize)]
struct OpenAlexWork {
    id: Option<String>,
    title: Option<String>,
    #[serde(default)]
    authorships: Vec<OpenAlexAuthorship>,
    publication_year: Option<i32>,
    cited_by_count: Option<i32>,
    open_access: Option<OpenAlexOpenAccess>,
    #[serde(default)]
    abstract_inverted_index: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
struct OpenAlexAuthorship {
    author: Option<OpenAlexAuthor>,
}

#[derive(Debug, Deserialize)]
struct OpenAlexAuthor {
    display_name: Option<String>,
}

#[derive(Debug, Deserialize)]
struct OpenAlexOpenAccess {
    oa_url: Option<String>,
}

#[derive(Debug, Deserialize)]
struct OpenAlexResponse {
    meta: Option<OpenAlexMeta>,
    results: Option<Vec<OpenAlexWork>>,
}

#[derive(Debug, Deserialize)]
struct OpenAlexMeta {
    count: Option<i32>,
}

fn reconstruct_abstract(inverted_index: &serde_json::Value) -> Option<String> {
    let obj = inverted_index.as_object()?;
    let mut words: Vec<(i64, &str)> = Vec::new();
    for (word, positions) in obj {
        if let Some(arr) = positions.as_array() {
            for pos in arr {
                if let Some(idx) = pos.as_i64() {
                    words.push((idx, word.as_str()));
                }
            }
        }
    }
    words.sort_by_key(|(idx, _)| *idx);
    let text: Vec<&str> = words.iter().map(|(_, w)| *w).collect();
    if text.is_empty() { None } else { Some(text.join(" ")) }
}

async fn search_openalex(client: &reqwest::Client, query: &str, limit: i32) -> Vec<SearchResult> {
    let url = format!(
        "https://api.openalex.org/works?search={}&per_page={}&sort=relevance_score:desc&mailto=zluo5820@gmail.com",
        urlencoding::encode(query),
        limit
    );

    let resp = match client
        .get(&url)
        .header("User-Agent", "Lumen/0.1 (mailto:zluo5820@gmail.com)")
        .send()
        .await
    {
        Ok(r) => r,
        Err(e) => { log::warn!("OpenAlex 请求失败: {}", e); return vec![]; }
    };

    if !resp.status().is_success() {
        log::warn!("OpenAlex 状态码: {}", resp.status());
        return vec![];
    }

    let body = match resp.text().await {
        Ok(b) => b,
        Err(e) => { log::warn!("OpenAlex 读取失败: {}", e); return vec![]; }
    };

    let data: OpenAlexResponse = match serde_json::from_str(&body) {
        Ok(d) => d,
        Err(e) => { log::warn!("OpenAlex 解析失败: {}", e); return vec![]; }
    };

    let works = data.results.unwrap_or_default();
    log::info!("OpenAlex: {} results", works.len());

    works
        .into_iter()
        .filter_map(|w| {
            let title = w.title?;
            let id = w.id.unwrap_or_default();
            let source_url = id.clone();
            let authors = w.authorships.into_iter()
                .filter_map(|a| a.author.and_then(|au| au.display_name).map(|name| SearchAuthor { name }))
                .collect();
            let abstract_text = w.abstract_inverted_index.as_ref().and_then(reconstruct_abstract);
            let open_access_url = w.open_access.and_then(|oa| oa.oa_url);
            Some(SearchResult {
                id, title, abstract_text, authors,
                year: w.publication_year,
                citation_count: w.cited_by_count.unwrap_or(0),
                open_access_url, source_url,
                source: "OpenAlex".to_string(),
            })
        })
        .collect()
}

// ---- arXiv ----

async fn search_arxiv(client: &reqwest::Client, query: &str, limit: i32) -> Vec<SearchResult> {
    let url = format!(
        "http://export.arxiv.org/api/query?search_query=all:{}&start=0&max_results={}&sortBy=relevance",
        urlencoding::encode(query),
        limit
    );

    let resp = match client.get(&url).send().await {
        Ok(r) => r,
        Err(e) => { log::warn!("arXiv 请求失败: {}", e); return vec![]; }
    };

    let body = match resp.text().await {
        Ok(b) => b,
        Err(e) => { log::warn!("arXiv 读取失败: {}", e); return vec![]; }
    };

    parse_arxiv_xml(&body)
}

fn parse_arxiv_xml(xml: &str) -> Vec<SearchResult> {
    let mut reader = Reader::from_str(xml);
    let mut results = Vec::new();
    let mut buf = Vec::new();

    let mut in_entry = false;
    let mut current_tag = String::new();
    let mut title = String::new();
    let mut summary = String::new();
    let mut arxiv_id = String::new();
    let mut pdf_url: Option<String> = None;
    let mut authors: Vec<SearchAuthor> = Vec::new();
    let mut published = String::new();
    let mut in_author = false;

    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(ref e)) => {
                let tag = String::from_utf8_lossy(e.name().as_ref()).to_string();
                if tag == "entry" {
                    in_entry = true;
                    title.clear();
                    summary.clear();
                    arxiv_id.clear();
                    pdf_url = None;
                    authors.clear();
                    published.clear();
                } else if in_entry {
                    current_tag = tag.clone();
                    if tag == "author" {
                        in_author = true;
                    }
                    if tag == "link" {
                        let mut href = String::new();
                        let mut link_title = String::new();
                        for attr in e.attributes().flatten() {
                            let key = String::from_utf8_lossy(attr.key.as_ref()).to_string();
                            let val = String::from_utf8_lossy(&attr.value).to_string();
                            if key == "href" { href = val.clone(); }
                            if key == "title" { link_title = val; }
                        }
                        if link_title == "pdf" {
                            pdf_url = Some(href);
                        } else if arxiv_id.is_empty() && href.contains("arxiv.org/abs/") {
                            arxiv_id = href.clone();
                        }
                    }
                }
            }
            Ok(Event::Empty(ref e)) => {
                if in_entry {
                    let tag = String::from_utf8_lossy(e.name().as_ref()).to_string();
                    if tag == "link" {
                        let mut href = String::new();
                        let mut link_title = String::new();
                        for attr in e.attributes().flatten() {
                            let key = String::from_utf8_lossy(attr.key.as_ref()).to_string();
                            let val = String::from_utf8_lossy(&attr.value).to_string();
                            if key == "href" { href = val.clone(); }
                            if key == "title" { link_title = val; }
                        }
                        if link_title == "pdf" {
                            pdf_url = Some(href);
                        } else if arxiv_id.is_empty() && href.contains("arxiv.org/abs/") {
                            arxiv_id = href.clone();
                        }
                    }
                }
            }
            Ok(Event::Text(ref e)) => {
                if in_entry {
                    let text = e.unescape().unwrap_or_default().to_string();
                    if in_author && current_tag == "name" {
                        authors.push(SearchAuthor { name: text.trim().to_string() });
                    } else if current_tag == "title" {
                        title.push_str(text.trim());
                    } else if current_tag == "summary" {
                        summary.push_str(text.trim());
                    } else if current_tag == "published" {
                        published.push_str(text.trim());
                    } else if current_tag == "id" && arxiv_id.is_empty() {
                        arxiv_id = text.trim().to_string();
                    }
                }
            }
            Ok(Event::End(ref e)) => {
                let tag = String::from_utf8_lossy(e.name().as_ref()).to_string();
                if tag == "entry" {
                    in_entry = false;
                    if !title.is_empty() {
                        let clean_title = title.replace('\n', " ").split_whitespace().collect::<Vec<_>>().join(" ");
                        let clean_summary = summary.replace('\n', " ").split_whitespace().collect::<Vec<_>>().join(" ");
                        let year = published.get(..4).and_then(|y| y.parse::<i32>().ok());
                        results.push(SearchResult {
                            id: arxiv_id.clone(),
                            title: clean_title,
                            abstract_text: if clean_summary.is_empty() { None } else { Some(clean_summary) },
                            authors: authors.clone(),
                            year,
                            citation_count: 0,
                            open_access_url: pdf_url.clone(),
                            source_url: arxiv_id.clone(),
                            source: "arXiv".to_string(),
                        });
                    }
                } else if tag == "author" {
                    in_author = false;
                }
                current_tag.clear();
            }
            Ok(Event::Eof) => break,
            Err(e) => { log::warn!("arXiv XML 解析错误: {}", e); break; }
            _ => {}
        }
        buf.clear();
    }

    log::info!("arXiv: {} results", results.len());
    results
}

// ---- Combined search ----

#[tauri::command]
pub async fn search_papers(query: String, limit: Option<i32>) -> Result<SearchResponse, String> {
    let per_source = (limit.unwrap_or(8) / 2).max(3).min(15);
    let client = reqwest::Client::new();

    let (openalex_results, arxiv_results) = tokio::join!(
        search_openalex(&client, &query, per_source),
        search_arxiv(&client, &query, per_source),
    );

    let mut seen_titles: HashSet<String> = HashSet::new();
    let mut results: Vec<SearchResult> = Vec::new();

    for r in openalex_results.into_iter().chain(arxiv_results.into_iter()) {
        let key = r.title.to_lowercase();
        if seen_titles.contains(&key) { continue; }
        seen_titles.insert(key);
        results.push(r);
    }

    let total = results.len() as i32;
    log::info!("合并搜索: query={}, total={}", query, total);

    Ok(SearchResponse { total, results })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn init_log() {
        let _ = env_logger::builder().is_test(true).try_init();
    }

    // ---- OpenAlex ----

    #[tokio::test]
    async fn openalex_returns_results() {
        init_log();
        let client = reqwest::Client::new();
        let results = search_openalex(&client, "transformer attention mechanism", 5).await;
        assert!(!results.is_empty(), "OpenAlex 应返回结果");
        for r in &results {
            assert!(!r.title.is_empty());
            assert_eq!(r.source, "OpenAlex");
            assert!(!r.source_url.is_empty());
        }
    }

    #[tokio::test]
    async fn openalex_has_metadata() {
        init_log();
        let client = reqwest::Client::new();
        let results = search_openalex(&client, "deep learning", 3).await;
        assert!(!results.is_empty());
        let has_authors = results.iter().any(|r| !r.authors.is_empty());
        let has_year = results.iter().any(|r| r.year.is_some());
        assert!(has_authors, "至少一篇论文应有作者");
        assert!(has_year, "至少一篇论文应有年份");
    }

    #[tokio::test]
    async fn openalex_gibberish_returns_empty_or_few() {
        init_log();
        let client = reqwest::Client::new();
        let results = search_openalex(&client, "zzzxxxxqqqq99999", 5).await;
        assert!(results.len() <= 1, "乱码查询不应返回多条结果");
    }

    // ---- arXiv ----

    #[tokio::test]
    async fn arxiv_returns_results() {
        init_log();
        let client = reqwest::Client::new();
        let results = search_arxiv(&client, "large language models", 5).await;
        assert!(!results.is_empty(), "arXiv 应返回结果");
        for r in &results {
            assert!(!r.title.is_empty());
            assert_eq!(r.source, "arXiv");
            assert!(r.source_url.contains("arxiv.org") || r.id.contains("arxiv.org"),
                    "arXiv 结果 URL 应包含 arxiv.org: {}", r.source_url);
        }
    }

    #[tokio::test]
    async fn arxiv_has_abstracts() {
        init_log();
        let client = reqwest::Client::new();
        let results = search_arxiv(&client, "neural network", 3).await;
        assert!(!results.is_empty());
        let has_abstract = results.iter().any(|r| r.abstract_text.is_some());
        assert!(has_abstract, "至少一篇 arXiv 论文应有摘要");
    }

    // ---- XML 解析 ----

    #[test]
    fn parse_arxiv_xml_basic() {
        let xml = r#"<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <id>http://arxiv.org/abs/2301.00001v1</id>
    <title>Test Paper Title</title>
    <summary>This is a test abstract.</summary>
    <published>2023-01-01T00:00:00Z</published>
    <author><name>Alice</name></author>
    <author><name>Bob</name></author>
    <link href="http://arxiv.org/abs/2301.00001v1" rel="alternate" type="text/html"/>
    <link href="http://arxiv.org/pdf/2301.00001v1" title="pdf" rel="related"/>
  </entry>
</feed>"#;
        let results = parse_arxiv_xml(xml);
        assert_eq!(results.len(), 1);
        let r = &results[0];
        assert_eq!(r.title, "Test Paper Title");
        assert_eq!(r.abstract_text.as_deref(), Some("This is a test abstract."));
        assert_eq!(r.year, Some(2023));
        assert_eq!(r.authors.len(), 2);
        assert_eq!(r.authors[0].name, "Alice");
        assert_eq!(r.open_access_url.as_deref(), Some("http://arxiv.org/pdf/2301.00001v1"));
        assert_eq!(r.source, "arXiv");
    }

    #[test]
    fn parse_arxiv_xml_empty_feed() {
        let xml = r#"<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
</feed>"#;
        let results = parse_arxiv_xml(xml);
        assert!(results.is_empty());
    }

    // ---- 合并搜索 ----

    #[tokio::test]
    async fn combined_search_returns_results() {
        init_log();
        let client = reqwest::Client::new();
        let per_source = 4;
        let (openalex, arxiv) = tokio::join!(
            search_openalex(&client, "reinforcement learning", per_source),
            search_arxiv(&client, "reinforcement learning", per_source),
        );
        let total = openalex.len() + arxiv.len();
        assert!(total > 0, "合并搜索应返回结果");
        let has_openalex = openalex.iter().any(|r| r.source == "OpenAlex");
        let has_arxiv = arxiv.iter().any(|r| r.source == "arXiv");
        assert!(has_openalex || has_arxiv, "至少一个数据源应返回结果");
    }

    #[test]
    fn reconstruct_abstract_works() {
        let json = serde_json::json!({
            "hello": [0],
            "world": [1],
            "!": [2]
        });
        let result = reconstruct_abstract(&json);
        assert_eq!(result, Some("hello world !".to_string()));
    }

    #[test]
    fn reconstruct_abstract_empty() {
        let json = serde_json::json!({});
        let result = reconstruct_abstract(&json);
        assert_eq!(result, None);
    }
}
