use quick_xml::events::Event;
use quick_xml::Reader;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::time::Duration;

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
    pub open_access_pdf_url: Option<String>,
    pub open_access_landing_url: Option<String>,
    pub source_url: String,
    pub source: String,
    pub journal: Option<String>,
    pub doi: Option<String>,
    pub published_date: Option<String>,
    pub is_top_journal: bool,
    pub quality_score: f32,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct SearchOptions {
    pub from_date: Option<String>,
    pub until_date: Option<String>,
    pub sort_mode: Option<String>,
    pub search_mode: Option<String>,
    pub source_hint: Option<String>,
    pub category_preset: Option<String>,
    pub arxiv_categories: Option<Vec<String>>,
    pub feed_limit: Option<i32>,
    pub include_total_count: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchResponse {
    pub total: i32,
    pub results: Vec<SearchResult>,
    pub mode: Option<String>,
    pub total_available: Option<i32>,
    pub fetched: Option<i32>,
    pub categories: Option<Vec<String>>,
    pub from_date: Option<String>,
    pub until_date: Option<String>,
}

struct JournalMarker {
    name: &'static str,
    tier: i32,
}

// Curated ranking signals for "start here" academic search. This is not meant
// to be an exhaustive impact-factor list; it keeps high-signal general science,
// cognitive science, psychology, and neuroscience venues near the top.
const TOP_JOURNALS: &[JournalMarker] = &[
    JournalMarker {
        name: "Nature",
        tier: 3,
    },
    JournalMarker {
        name: "Science",
        tier: 3,
    },
    JournalMarker {
        name: "Cell",
        tier: 3,
    },
    JournalMarker {
        name: "Proceedings of the National Academy of Sciences",
        tier: 3,
    },
    JournalMarker {
        name: "PNAS",
        tier: 3,
    },
    JournalMarker {
        name: "Nature Neuroscience",
        tier: 3,
    },
    JournalMarker {
        name: "Nature Reviews Neuroscience",
        tier: 3,
    },
    JournalMarker {
        name: "Nature Human Behaviour",
        tier: 3,
    },
    JournalMarker {
        name: "Nature Methods",
        tier: 3,
    },
    JournalMarker {
        name: "Nature Communications",
        tier: 3,
    },
    JournalMarker {
        name: "Science Advances",
        tier: 3,
    },
    JournalMarker {
        name: "Neuron",
        tier: 3,
    },
    JournalMarker {
        name: "Trends in Cognitive Sciences",
        tier: 3,
    },
    JournalMarker {
        name: "Trends in Neurosciences",
        tier: 3,
    },
    JournalMarker {
        name: "Annual Review of Psychology",
        tier: 3,
    },
    JournalMarker {
        name: "Annual Review of Neuroscience",
        tier: 3,
    },
    JournalMarker {
        name: "Psychological Review",
        tier: 3,
    },
    JournalMarker {
        name: "The Lancet Neurology",
        tier: 3,
    },
    JournalMarker {
        name: "Brain",
        tier: 2,
    },
    JournalMarker {
        name: "Journal of Neuroscience",
        tier: 2,
    },
    JournalMarker {
        name: "Cerebral Cortex",
        tier: 2,
    },
    JournalMarker {
        name: "NeuroImage",
        tier: 2,
    },
    JournalMarker {
        name: "Human Brain Mapping",
        tier: 2,
    },
    JournalMarker {
        name: "Neuroscience and Biobehavioral Reviews",
        tier: 2,
    },
    JournalMarker {
        name: "Neuroscience & Biobehavioral Reviews",
        tier: 2,
    },
    JournalMarker {
        name: "Biological Psychiatry",
        tier: 2,
    },
    JournalMarker {
        name: "Molecular Psychiatry",
        tier: 2,
    },
    JournalMarker {
        name: "Current Biology",
        tier: 2,
    },
    JournalMarker {
        name: "eLife",
        tier: 2,
    },
    JournalMarker {
        name: "PLOS Biology",
        tier: 2,
    },
    JournalMarker {
        name: "Cognition",
        tier: 2,
    },
    JournalMarker {
        name: "Cognitive Psychology",
        tier: 2,
    },
    JournalMarker {
        name: "Cognitive Science",
        tier: 2,
    },
    JournalMarker {
        name: "Journal of Cognitive Neuroscience",
        tier: 2,
    },
    JournalMarker {
        name: "Developmental Cognitive Neuroscience",
        tier: 2,
    },
    JournalMarker {
        name: "Psychological Science",
        tier: 2,
    },
    JournalMarker {
        name: "Journal of Experimental Psychology: General",
        tier: 2,
    },
    JournalMarker {
        name: "Psychonomic Bulletin & Review",
        tier: 2,
    },
    JournalMarker {
        name: "Memory & Cognition",
        tier: 2,
    },
    JournalMarker {
        name: "Attention, Perception, & Psychophysics",
        tier: 2,
    },
    JournalMarker {
        name: "Neuropsychologia",
        tier: 2,
    },
    JournalMarker {
        name: "Social Cognitive and Affective Neuroscience",
        tier: 2,
    },
    JournalMarker {
        name: "Communications Biology",
        tier: 1,
    },
    JournalMarker {
        name: "Communications Psychology",
        tier: 1,
    },
    JournalMarker {
        name: "Nature Mental Health",
        tier: 1,
    },
    JournalMarker {
        name: "Scientific Reports",
        tier: 1,
    },
    JournalMarker {
        name: "PLOS ONE",
        tier: 1,
    },
    JournalMarker {
        name: "Royal Society Open Science",
        tier: 1,
    },
    JournalMarker {
        name: "Frontiers in Human Neuroscience",
        tier: 1,
    },
    JournalMarker {
        name: "Frontiers in Neuroscience",
        tier: 1,
    },
    JournalMarker {
        name: "Brain and Cognition",
        tier: 1,
    },
    JournalMarker {
        name: "Consciousness and Cognition",
        tier: 1,
    },
    JournalMarker {
        name: "Cognitive Neuropsychology",
        tier: 1,
    },
    JournalMarker {
        name: "Hippocampus",
        tier: 1,
    },
    JournalMarker {
        name: "npj Science of Learning",
        tier: 1,
    },
];

fn normalize_key(value: &str) -> String {
    value
        .to_lowercase()
        .chars()
        .map(|c| if c.is_alphanumeric() { c } else { ' ' })
        .collect::<String>()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

fn normalize_doi(value: &str) -> String {
    value
        .trim()
        .to_lowercase()
        .trim_start_matches("https://doi.org/")
        .trim_start_matches("http://doi.org/")
        .trim_start_matches("doi:")
        .to_string()
}

fn is_iso_date(value: &str) -> bool {
    let bytes = value.as_bytes();
    bytes.len() == 10
        && bytes[4] == b'-'
        && bytes[7] == b'-'
        && bytes
            .iter()
            .enumerate()
            .all(|(idx, ch)| idx == 4 || idx == 7 || ch.is_ascii_digit())
}

fn normalize_search_options(options: Option<SearchOptions>) -> SearchOptions {
    let mut options = options.unwrap_or_default();
    options.from_date = options.from_date.filter(|date| is_iso_date(date));
    options.until_date = options.until_date.filter(|date| is_iso_date(date));
    options.sort_mode = match options.sort_mode.as_deref() {
        Some("newest") => Some("newest".to_string()),
        Some("balanced") => Some("balanced".to_string()),
        _ => Some("relevance".to_string()),
    };
    options.search_mode = match options.search_mode.as_deref() {
        Some("paper_lookup") => Some("paper_lookup".to_string()),
        Some("recent_ai_feed") => Some("recent_ai_feed".to_string()),
        Some("arxiv_category_feed") => Some("arxiv_category_feed".to_string()),
        _ => Some("keyword_search".to_string()),
    };
    options.source_hint = match options.source_hint.as_deref() {
        Some("arxiv") => Some("arxiv".to_string()),
        Some("openalex") => Some("openalex".to_string()),
        Some("semantic_scholar") => Some("semantic_scholar".to_string()),
        Some("crossref") => Some("crossref".to_string()),
        _ => Some("all".to_string()),
    };
    options.category_preset = match options.category_preset.as_deref() {
        Some("llm") => Some("llm".to_string()),
        Some("vision") => Some("vision".to_string()),
        Some("robotics") => Some("robotics".to_string()),
        Some("custom") => Some("custom".to_string()),
        Some("ai") => Some("ai".to_string()),
        _ => None,
    };
    options.arxiv_categories = options.arxiv_categories.map(|categories| {
        categories
            .into_iter()
            .filter(|category| {
                let parts: Vec<&str> = category.split('.').collect();
                parts.len() == 2
                    && !parts[0].is_empty()
                    && parts[1].len() == 2
                    && parts[1].chars().all(|ch| ch.is_ascii_alphabetic())
            })
            .take(12)
            .collect()
    });
    options.feed_limit = options.feed_limit.map(|limit| limit.clamp(1, 200));
    options
}

fn is_newest_sort(options: &SearchOptions) -> bool {
    options.sort_mode.as_deref() == Some("newest")
}

fn date_from_year(year: Option<i32>) -> Option<String> {
    year.map(|year| format!("{:04}-01-01", year))
}

fn compact_date_for_arxiv(date: &str, end_of_day: bool) -> String {
    let y = date.get(0..4).unwrap_or("1970");
    let m = date.get(5..7).unwrap_or("01");
    let d = date.get(8..10).unwrap_or("01");
    format!("{}{}{}{}", y, m, d, if end_of_day { "2359" } else { "0000" })
}

fn default_arxiv_categories(preset: Option<&str>) -> Vec<String> {
    let values: &[&str] = match preset {
        Some("llm") => &["cs.CL", "cs.AI", "cs.LG"],
        Some("vision") => &["cs.CV", "eess.IV", "cs.LG"],
        Some("robotics") => &["cs.RO", "cs.AI", "cs.LG"],
        _ => &["cs.AI", "cs.LG", "cs.CL", "cs.CV", "cs.RO", "stat.ML"],
    };
    values.iter().map(|value| value.to_string()).collect()
}

fn arxiv_categories_for_options(options: &SearchOptions) -> Vec<String> {
    let explicit = options
        .arxiv_categories
        .clone()
        .filter(|categories| !categories.is_empty());
    explicit.unwrap_or_else(|| default_arxiv_categories(options.category_preset.as_deref()))
}

fn publication_date_for(result: &SearchResult) -> Option<String> {
    result
        .published_date
        .clone()
        .or_else(|| date_from_year(result.year))
}

fn publication_date_key(result: &SearchResult) -> i32 {
    publication_date_for(result)
        .and_then(|date| {
            let year = date.get(0..4)?.parse::<i32>().ok()?;
            let month = date.get(5..7)?.parse::<i32>().ok()?;
            let day = date.get(8..10)?.parse::<i32>().ok()?;
            Some(year * 10_000 + month * 100 + day)
        })
        .unwrap_or(0)
}

fn within_date_range(result: &SearchResult, options: &SearchOptions) -> bool {
    if options.from_date.is_none() && options.until_date.is_none() {
        return true;
    }
    let Some(date) = publication_date_for(result) else {
        return false;
    };
    if let Some(from_date) = &options.from_date {
        if &date < from_date {
            return false;
        }
    }
    if let Some(until_date) = &options.until_date {
        if &date > until_date {
            return false;
        }
    }
    true
}

fn marker_matches(journal: &str, marker: &str) -> bool {
    if marker.split_whitespace().count() == 1 {
        journal == marker
    } else {
        journal == marker
            || journal.starts_with(&format!("{} ", marker))
            || journal.ends_with(&format!(" {}", marker))
            || journal.contains(&format!(" {} ", marker))
    }
}

fn journal_tier(journal: Option<&str>) -> i32 {
    let Some(journal) = journal else { return 0 };
    let normalized = normalize_key(journal);
    TOP_JOURNALS
        .iter()
        .filter(|m| marker_matches(&normalized, &normalize_key(m.name)))
        .map(|m| m.tier)
        .max()
        .unwrap_or(0)
}

fn strip_markup(input: &str) -> String {
    let mut out = String::new();
    let mut in_tag = false;
    for c in input.chars() {
        match c {
            '<' => in_tag = true,
            '>' => in_tag = false,
            _ if !in_tag => out.push(c),
            _ => {}
        }
    }
    out.replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

fn query_tokens(query: &str) -> Vec<String> {
    const STOP_WORDS: &[&str] = &[
        "and", "the", "for", "with", "this", "that", "paper", "article", "study",
    ];

    normalize_key(query)
        .split_whitespace()
        .filter(|token| token.len() > 2 && !STOP_WORDS.contains(token))
        .map(ToOwned::to_owned)
        .collect()
}

fn relevance_score(result: &SearchResult, tokens: &[String]) -> f32 {
    if tokens.is_empty() {
        return 0.0;
    }

    let title = normalize_key(&result.title);
    let author_names = result
        .authors
        .iter()
        .map(|author| author.name.as_str())
        .collect::<Vec<_>>()
        .join(" ");
    let authors = normalize_key(&author_names);
    let haystack = format!("{} {}", title, authors);

    let mut matched = 0;
    let mut title_matches = 0;
    let mut author_matches = 0;
    for token in tokens {
        if haystack.contains(token) {
            matched += 1;
            if title.contains(token) {
                title_matches += 1;
            }
            if authors.contains(token) {
                author_matches += 1;
            }
        }
    }

    if matched == 0 {
        return 0.0;
    }

    (((matched as f32 / tokens.len() as f32) * 60.0)
        + title_matches as f32 * 4.0
        + author_matches as f32 * 5.0)
        .min(85.0)
}

fn annotate_result(
    mut result: SearchResult,
    tokens: &[String],
    options: &SearchOptions,
) -> SearchResult {
    if let Some(doi) = &result.doi {
        result.doi = Some(normalize_doi(doi));
    }
    if result.published_date.is_none() {
        result.published_date = date_from_year(result.year);
    }
    let tier = journal_tier(result.journal.as_deref());
    result.is_top_journal = tier > 0;

    let citation_score = ((result.citation_count.max(0) as f32) + 1.0).ln() * 8.0;
    let tier_score = match tier {
        3 => 55.0,
        2 => 35.0,
        1 => 20.0,
        _ => 0.0,
    };
    let search_score = relevance_score(&result, tokens);
    let recency_score = result
        .year
        .map(|year| ((year - 2000).clamp(0, 35) as f32) * 0.25)
        .unwrap_or(0.0);
    let newest_score = ((publication_date_key(&result) - 2_000_0101).max(0) as f32) / 650.0;
    let metadata_score = if result.abstract_text.is_some() {
        3.0
    } else {
        0.0
    } + if result.open_access_pdf_url.is_some() || result.open_access_url.is_some() {
        2.0
    } else {
        0.0
    } + if result.doi.is_some() { 2.0 } else { 0.0 };

    result.quality_score = if is_newest_sort(options) {
        newest_score
            + search_score * 0.45
            + tier_score * 0.2
            + citation_score * 0.15
            + metadata_score
    } else {
        search_score + tier_score + citation_score + recency_score + metadata_score
    };
    result
}

fn result_key(result: &SearchResult) -> String {
    if let Some(doi) = &result.doi {
        let doi = normalize_doi(doi);
        if !doi.is_empty() {
            return format!("doi:{}", doi);
        }
    }
    format!("title:{}", normalize_key(&result.title))
}

fn merge_result(existing: &mut SearchResult, candidate: SearchResult) {
    if existing.abstract_text.is_none() {
        existing.abstract_text = candidate.abstract_text.clone();
    }
    if existing.open_access_url.is_none() {
        existing.open_access_url = candidate.open_access_url.clone();
    }
    if existing.open_access_pdf_url.is_none() {
        existing.open_access_pdf_url = candidate.open_access_pdf_url.clone();
    }
    if existing.open_access_landing_url.is_none() {
        existing.open_access_landing_url = candidate.open_access_landing_url.clone();
    }
    if existing.journal.is_none() {
        existing.journal = candidate.journal.clone();
    }
    if existing.doi.is_none() {
        existing.doi = candidate.doi.clone();
    }
    if existing.published_date.is_none() {
        existing.published_date = candidate.published_date.clone();
    }
    if candidate.citation_count > existing.citation_count {
        existing.citation_count = candidate.citation_count;
    }
    if candidate.is_top_journal {
        existing.is_top_journal = true;
    }
    if candidate.quality_score > existing.quality_score {
        existing.quality_score = candidate.quality_score;
    }
    if !existing.source.contains(&candidate.source) {
        existing.source = format!("{} / {}", existing.source, candidate.source);
    }
}

// ---- OpenAlex ----

#[derive(Debug, Deserialize)]
struct OpenAlexWork {
    id: Option<String>,
    title: Option<String>,
    doi: Option<String>,
    #[serde(default)]
    authorships: Vec<OpenAlexAuthorship>,
    publication_year: Option<i32>,
    publication_date: Option<String>,
    cited_by_count: Option<i32>,
    open_access: Option<OpenAlexOpenAccess>,
    primary_location: Option<OpenAlexLocation>,
    best_oa_location: Option<OpenAlexLocation>,
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
struct OpenAlexLocation {
    landing_page_url: Option<String>,
    pdf_url: Option<String>,
    source: Option<OpenAlexSource>,
}

#[derive(Debug, Deserialize)]
struct OpenAlexSource {
    display_name: Option<String>,
}

#[derive(Debug, Deserialize)]
struct OpenAlexResponse {
    results: Option<Vec<OpenAlexWork>>,
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
    if text.is_empty() {
        None
    } else {
        Some(text.join(" "))
    }
}

async fn search_openalex(
    client: &reqwest::Client,
    query: &str,
    limit: i32,
    options: &SearchOptions,
) -> Vec<SearchResult> {
    let sort = if is_newest_sort(options) {
        "publication_date:desc"
    } else {
        "relevance_score:desc"
    };
    let mut url = format!(
        "https://api.openalex.org/works?search={}&per_page={}&sort={}&mailto=zluo5820@gmail.com",
        urlencoding::encode(query),
        limit,
        urlencoding::encode(sort)
    );
    let mut filters = Vec::new();
    if let Some(from_date) = &options.from_date {
        filters.push(format!("from_publication_date:{}", from_date));
    }
    if let Some(until_date) = &options.until_date {
        filters.push(format!("to_publication_date:{}", until_date));
    }
    if !filters.is_empty() {
        url.push_str("&filter=");
        url.push_str(&urlencoding::encode(&filters.join(",")));
    }

    let resp = match client
        .get(&url)
        .header("User-Agent", "Lumen/0.1 (mailto:zluo5820@gmail.com)")
        .send()
        .await
    {
        Ok(r) => r,
        Err(e) => {
            log::warn!("OpenAlex 请求失败: {}", e);
            return vec![];
        }
    };

    if !resp.status().is_success() {
        log::warn!("OpenAlex 状态码: {}", resp.status());
        return vec![];
    }

    let body = match resp.text().await {
        Ok(b) => b,
        Err(e) => {
            log::warn!("OpenAlex 读取失败: {}", e);
            return vec![];
        }
    };

    let data: OpenAlexResponse = match serde_json::from_str(&body) {
        Ok(d) => d,
        Err(e) => {
            log::warn!("OpenAlex 解析失败: {}", e);
            return vec![];
        }
    };

    let works = data.results.unwrap_or_default();
    log::info!("OpenAlex: {} results", works.len());

    works
        .into_iter()
        .filter_map(|w| {
            let title = w.title?;
            let id = w.id.unwrap_or_default();
            let primary_landing_url = w
                .primary_location
                .as_ref()
                .and_then(|l| l.landing_page_url.clone());
            let primary_pdf_url = w
                .primary_location
                .as_ref()
                .and_then(|l| l.pdf_url.clone());
            let best_oa_pdf_url = w
                .best_oa_location
                .as_ref()
                .and_then(|l| l.pdf_url.clone());
            let best_oa_landing_url = w
                .best_oa_location
                .as_ref()
                .and_then(|l| l.landing_page_url.clone());
            let oa_url = w.open_access.as_ref().and_then(|oa| oa.oa_url.clone());
            let open_access_pdf_url = primary_pdf_url.or(best_oa_pdf_url);
            let open_access_landing_url = oa_url
                .clone()
                .or(best_oa_landing_url)
                .or(primary_landing_url.clone());
            let source_url = primary_landing_url
                .clone()
                .or(oa_url)
                .unwrap_or_else(|| id.clone());
            let authors = w
                .authorships
                .into_iter()
                .filter_map(|a| {
                    a.author
                        .and_then(|au| au.display_name)
                        .map(|name| SearchAuthor { name })
                })
                .collect();
            let abstract_text = w
                .abstract_inverted_index
                .as_ref()
                .and_then(reconstruct_abstract);
            let journal = w
                .primary_location
                .as_ref()
                .and_then(|l| l.source.as_ref())
                .and_then(|s| s.display_name.clone())
                .or_else(|| {
                    w.best_oa_location
                        .as_ref()
                        .and_then(|l| l.source.as_ref())
                        .and_then(|s| s.display_name.clone())
                });
            Some(SearchResult {
                id,
                title,
                abstract_text,
                authors,
                year: w.publication_year,
                citation_count: w.cited_by_count.unwrap_or(0),
                open_access_url: open_access_pdf_url.clone(),
                open_access_pdf_url,
                open_access_landing_url,
                source_url,
                source: "OpenAlex".to_string(),
                journal,
                doi: w.doi,
                published_date: w
                    .publication_date
                    .or_else(|| date_from_year(w.publication_year)),
                is_top_journal: false,
                quality_score: 0.0,
            })
        })
        .collect()
}

// ---- Semantic Scholar ----

#[derive(Debug, Deserialize)]
struct SemanticScholarResponse {
    #[serde(default)]
    data: Vec<SemanticScholarPaper>,
}

#[derive(Debug, Deserialize)]
struct SemanticScholarPaper {
    #[serde(rename = "paperId")]
    paper_id: Option<String>,
    title: Option<String>,
    #[serde(rename = "abstract")]
    abstract_text: Option<String>,
    year: Option<i32>,
    #[serde(rename = "publicationDate")]
    publication_date: Option<String>,
    #[serde(rename = "citationCount")]
    citation_count: Option<i32>,
    url: Option<String>,
    #[serde(rename = "openAccessPdf")]
    open_access_pdf: Option<SemanticScholarPdf>,
    #[serde(default)]
    authors: Vec<SemanticScholarAuthor>,
    venue: Option<String>,
    journal: Option<SemanticScholarJournal>,
    #[serde(rename = "externalIds")]
    external_ids: Option<HashMap<String, String>>,
}

#[derive(Debug, Deserialize)]
struct SemanticScholarPdf {
    url: Option<String>,
}

#[derive(Debug, Deserialize)]
struct SemanticScholarAuthor {
    name: Option<String>,
}

#[derive(Debug, Deserialize)]
struct SemanticScholarJournal {
    name: Option<String>,
}

async fn search_semantic_scholar(
    client: &reqwest::Client,
    query: &str,
    limit: i32,
    options: &SearchOptions,
) -> Vec<SearchResult> {
    let fields = "paperId,title,abstract,year,publicationDate,citationCount,authors,url,openAccessPdf,venue,journal,externalIds";
    let mut url = format!(
        "https://api.semanticscholar.org/graph/v1/paper/search/bulk?query={}&limit={}&fields={}",
        urlencoding::encode(query),
        limit,
        urlencoding::encode(fields)
    );
    if options.from_date.is_some() || options.until_date.is_some() {
        let range = format!(
            "{}:{}",
            options.from_date.as_deref().unwrap_or(""),
            options.until_date.as_deref().unwrap_or("")
        );
        url.push_str("&publicationDateOrYear=");
        url.push_str(&urlencoding::encode(&range));
    }
    if is_newest_sort(options) {
        url.push_str("&sort=publicationDate%3Adesc");
    }

    let mut req = client.get(&url);
    if let Ok(api_key) = std::env::var("SEMANTIC_SCHOLAR_API_KEY") {
        if !api_key.trim().is_empty() {
            req = req.header("x-api-key", api_key);
        }
    }

    let resp = match req.send().await {
        Ok(r) => r,
        Err(e) => {
            log::warn!("Semantic Scholar 请求失败: {}", e);
            return vec![];
        }
    };

    if !resp.status().is_success() {
        log::warn!("Semantic Scholar 状态码: {}", resp.status());
        return vec![];
    }

    let data = match resp.json::<SemanticScholarResponse>().await {
        Ok(d) => d,
        Err(e) => {
            log::warn!("Semantic Scholar 解析失败: {}", e);
            return vec![];
        }
    };

    log::info!("Semantic Scholar: {} results", data.data.len());

    data.data
        .into_iter()
        .filter_map(|p| {
            let title = p.title?;
            let id = p.paper_id.unwrap_or_default();
            let source_url = p.url.clone().unwrap_or_else(|| {
                if id.is_empty() {
                    String::new()
                } else {
                    format!("https://www.semanticscholar.org/paper/{}", id)
                }
            });
            let authors = p
                .authors
                .into_iter()
                .filter_map(|a| a.name.map(|name| SearchAuthor { name }))
                .collect();
            let doi = p
                .external_ids
                .as_ref()
                .and_then(|ids| ids.get("DOI").cloned());
            let journal = p.journal.and_then(|j| j.name).or(p.venue);
            let open_access_pdf_url = p.open_access_pdf.and_then(|pdf| pdf.url);
            Some(SearchResult {
                id,
                title,
                abstract_text: p.abstract_text,
                authors,
                year: p.year,
                citation_count: p.citation_count.unwrap_or(0),
                open_access_url: open_access_pdf_url.clone(),
                open_access_pdf_url,
                open_access_landing_url: if source_url.is_empty() {
                    None
                } else {
                    Some(source_url.clone())
                },
                source_url,
                source: "Semantic Scholar".to_string(),
                journal,
                doi,
                published_date: p.publication_date.or_else(|| date_from_year(p.year)),
                is_top_journal: false,
                quality_score: 0.0,
            })
        })
        .collect()
}

// ---- Crossref ----

#[derive(Debug, Deserialize)]
struct CrossrefResponse {
    message: CrossrefMessage,
}

#[derive(Debug, Deserialize)]
struct CrossrefMessage {
    #[serde(default)]
    items: Vec<CrossrefWork>,
}

#[derive(Debug, Deserialize)]
struct CrossrefWork {
    #[serde(rename = "DOI")]
    doi: Option<String>,
    #[serde(default)]
    title: Vec<String>,
    #[serde(default)]
    author: Vec<CrossrefAuthor>,
    #[serde(rename = "container-title", default)]
    container_title: Vec<String>,
    #[serde(rename = "is-referenced-by-count")]
    is_referenced_by_count: Option<i32>,
    #[serde(rename = "URL")]
    url: Option<String>,
    #[serde(rename = "published-print")]
    published_print: Option<CrossrefDate>,
    #[serde(rename = "published-online")]
    published_online: Option<CrossrefDate>,
    published: Option<CrossrefDate>,
    abstract_text: Option<String>,
}

#[derive(Debug, Deserialize)]
struct CrossrefAuthor {
    given: Option<String>,
    family: Option<String>,
    name: Option<String>,
}

#[derive(Debug, Deserialize)]
struct CrossrefDate {
    #[serde(rename = "date-parts")]
    date_parts: Vec<Vec<i32>>,
}

fn crossref_published_date(work: &CrossrefWork) -> Option<String> {
    work.published_print
        .as_ref()
        .or(work.published_online.as_ref())
        .or(work.published.as_ref())
        .and_then(|date| date.date_parts.first())
        .and_then(|parts| {
            let year = *parts.first()?;
            let month = parts.get(1).copied().unwrap_or(1);
            let day = parts.get(2).copied().unwrap_or(1);
            Some(format!("{:04}-{:02}-{:02}", year, month, day))
        })
}

fn crossref_year(work: &CrossrefWork) -> Option<i32> {
    crossref_published_date(work).and_then(|date| date.get(0..4)?.parse::<i32>().ok())
}

fn crossref_authors(authors: Vec<CrossrefAuthor>) -> Vec<SearchAuthor> {
    authors
        .into_iter()
        .filter_map(|a| {
            let name = match (a.given, a.family, a.name) {
                (Some(given), Some(family), _) => format!("{} {}", given, family),
                (_, Some(family), _) => family,
                (_, _, Some(name)) => name,
                _ => return None,
            };
            Some(SearchAuthor { name })
        })
        .collect()
}

async fn search_crossref(
    client: &reqwest::Client,
    query: &str,
    limit: i32,
    options: &SearchOptions,
) -> Vec<SearchResult> {
    let mut filters = vec!["type:journal-article".to_string()];
    if let Some(from_date) = &options.from_date {
        filters.push(format!("from-pub-date:{}", from_date));
    }
    if let Some(until_date) = &options.until_date {
        filters.push(format!("until-pub-date:{}", until_date));
    }
    let mut url = format!(
        "https://api.crossref.org/works?query.bibliographic={}&rows={}&filter={}&mailto=zluo5820@gmail.com",
        urlencoding::encode(query),
        limit,
        urlencoding::encode(&filters.join(","))
    );
    if is_newest_sort(options) {
        url.push_str("&sort=published&order=desc");
    }

    let resp = match client.get(&url).send().await {
        Ok(r) => r,
        Err(e) => {
            log::warn!("Crossref 请求失败: {}", e);
            return vec![];
        }
    };

    if !resp.status().is_success() {
        log::warn!("Crossref 状态码: {}", resp.status());
        return vec![];
    }

    let data = match resp.json::<CrossrefResponse>().await {
        Ok(d) => d,
        Err(e) => {
            log::warn!("Crossref 解析失败: {}", e);
            return vec![];
        }
    };

    log::info!("Crossref: {} results", data.message.items.len());

    data.message
        .items
        .into_iter()
        .filter_map(|w| {
            let title = w.title.first()?.trim().to_string();
            if title.is_empty() {
                return None;
            }
            let doi = w.doi.clone();
            let id = doi
                .clone()
                .unwrap_or_else(|| w.url.clone().unwrap_or_default());
            let source_url = w
                .url
                .clone()
                .or_else(|| doi.as_ref().map(|d| format!("https://doi.org/{}", d)))
                .unwrap_or_default();
            let year = crossref_year(&w);
            let published_date = crossref_published_date(&w);
            Some(SearchResult {
                id,
                title,
                abstract_text: w.abstract_text.as_ref().map(|a| strip_markup(a)),
                authors: crossref_authors(w.author),
                year,
                citation_count: w.is_referenced_by_count.unwrap_or(0),
                open_access_url: None,
                open_access_pdf_url: None,
                open_access_landing_url: None,
                source_url,
                source: "Crossref".to_string(),
                journal: w.container_title.first().cloned(),
                doi,
                published_date,
                is_top_journal: false,
                quality_score: 0.0,
            })
        })
        .collect()
}

// ---- arXiv ----

async fn search_arxiv(
    client: &reqwest::Client,
    query: &str,
    limit: i32,
    options: &SearchOptions,
) -> Vec<SearchResult> {
    let sort_by = if is_newest_sort(options) {
        "submittedDate"
    } else {
        "relevance"
    };
    let mut url = format!(
        "https://export.arxiv.org/api/query?search_query=all:{}&start=0&max_results={}&sortBy={}",
        urlencoding::encode(query),
        limit,
        sort_by
    );
    if is_newest_sort(options) {
        url.push_str("&sortOrder=descending");
    }

    let resp = match client.get(&url).send().await {
        Ok(r) => r,
        Err(e) => {
            log::warn!("arXiv 请求失败: {}", e);
            return vec![];
        }
    };

    let body = match resp.text().await {
        Ok(b) => b,
        Err(e) => {
            log::warn!("arXiv 读取失败: {}", e);
            return vec![];
        }
    };

    parse_arxiv_xml(&body)
        .into_iter()
        .filter(|result| within_date_range(result, options))
        .collect()
}

async fn search_arxiv_feed(
    client: &reqwest::Client,
    categories: &[String],
    from_date: &str,
    until_date: &str,
    limit: i32,
) -> (i32, Vec<SearchResult>) {
    let category_query = categories
        .iter()
        .map(|category| format!("cat:{}", category))
        .collect::<Vec<_>>()
        .join(" OR ");
    let date_query = format!(
        "submittedDate:[{} TO {}]",
        compact_date_for_arxiv(from_date, false),
        compact_date_for_arxiv(until_date, true)
    );
    let search_query = format!("({}) AND {}", category_query, date_query);
    let page_size = 100;
    let requested = limit.clamp(1, 200);
    let mut start = 0;
    let mut total_available = 0;
    let mut results = Vec::new();

    while (results.len() as i32) < requested {
        let max_results = (requested - results.len() as i32).min(page_size);
        let url = format!(
            "https://export.arxiv.org/api/query?search_query={}&start={}&max_results={}&sortBy=submittedDate&sortOrder=descending",
            urlencoding::encode(&search_query),
            start,
            max_results,
        );

        let resp = match client.get(&url).send().await {
            Ok(r) => r,
            Err(e) => {
                log::warn!("arXiv feed 请求失败: {}", e);
                break;
            }
        };
        let body = match resp.text().await {
            Ok(b) => b,
            Err(e) => {
                log::warn!("arXiv feed 读取失败: {}", e);
                break;
            }
        };

        if total_available == 0 {
            total_available = parse_arxiv_total_results(&body).unwrap_or(0);
        }
        let page_results = parse_arxiv_xml(&body);
        if page_results.is_empty() {
            break;
        }
        start += page_results.len() as i32;
        results.extend(page_results);
    }

    (total_available, results)
}

fn parse_arxiv_total_results(xml: &str) -> Option<i32> {
    let value = xml
        .match_indices("<opensearch:totalResults>")
        .next()
        .and_then(|(start, _)| {
            let from = start + "<opensearch:totalResults>".len();
            let end = xml[from..].find("</opensearch:totalResults>")? + from;
            Some(xml[from..end].trim())
        })?;
    value.parse::<i32>().ok()
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
                            if key == "href" {
                                href = val.clone();
                            }
                            if key == "title" {
                                link_title = val;
                            }
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
                            if key == "href" {
                                href = val.clone();
                            }
                            if key == "title" {
                                link_title = val;
                            }
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
                        authors.push(SearchAuthor {
                            name: text.trim().to_string(),
                        });
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
                        let clean_title = title
                            .replace('\n', " ")
                            .split_whitespace()
                            .collect::<Vec<_>>()
                            .join(" ");
                        let clean_summary = summary
                            .replace('\n', " ")
                            .split_whitespace()
                            .collect::<Vec<_>>()
                            .join(" ");
                        let year = published.get(..4).and_then(|y| y.parse::<i32>().ok());
                        results.push(SearchResult {
                            id: arxiv_id.clone(),
                            title: clean_title,
                            abstract_text: if clean_summary.is_empty() {
                                None
                            } else {
                                Some(clean_summary)
                            },
                            authors: authors.clone(),
                            year,
                            citation_count: 0,
                            open_access_url: pdf_url.clone(),
                            open_access_pdf_url: pdf_url.clone(),
                            open_access_landing_url: Some(arxiv_id.clone()),
                            source_url: arxiv_id.clone(),
                            source: "arXiv".to_string(),
                            journal: Some("arXiv".to_string()),
                            doi: None,
                            published_date: if published.len() >= 10 {
                                Some(published[..10].to_string())
                            } else {
                                date_from_year(year)
                            },
                            is_top_journal: false,
                            quality_score: 0.0,
                        });
                    }
                } else if tag == "author" {
                    in_author = false;
                }
                current_tag.clear();
            }
            Ok(Event::Eof) => break,
            Err(e) => {
                log::warn!("arXiv XML 解析错误: {}", e);
                break;
            }
            _ => {}
        }
        buf.clear();
    }

    log::info!("arXiv: {} results", results.len());
    results
}

// ---- Combined search ----

#[tauri::command]
pub async fn search_papers(
    query: String,
    limit: Option<i32>,
    options: Option<SearchOptions>,
) -> Result<SearchResponse, String> {
    let requested_limit = limit.unwrap_or(12).clamp(4, 40);
    let options = normalize_search_options(options);
    let mode = options.search_mode.as_deref().unwrap_or("keyword_search");
    let per_source = ((requested_limit + 3) / 4).max(4).min(15);
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(14))
        .user_agent("Lumen/0.1 (mailto:zluo5820@gmail.com)")
        .build()
        .map_err(|e| format!("创建 HTTP 客户端失败: {}", e))?;

    if mode == "recent_ai_feed" || mode == "arxiv_category_feed" {
        let categories = arxiv_categories_for_options(&options);
        let from_date = options
            .from_date
            .clone()
            .unwrap_or_else(|| "1970-01-01".to_string());
        let until_date = options
            .until_date
            .clone()
            .unwrap_or_else(|| chrono::Utc::now().format("%Y-%m-%d").to_string());
        let feed_limit = options.feed_limit.unwrap_or(limit.unwrap_or(50)).clamp(1, 200);
        let (total_available, mut results) =
            search_arxiv_feed(&client, &categories, &from_date, &until_date, feed_limit).await;
        let tokens = query_tokens(&query);
        results = results
            .into_iter()
            .map(|result| annotate_result(result, &tokens, &options))
            .collect();
        let fetched = results.len() as i32;
        return Ok(SearchResponse {
            total: fetched,
            results,
            mode: Some(mode.to_string()),
            total_available: Some(total_available),
            fetched: Some(fetched),
            categories: Some(categories),
            from_date: Some(from_date),
            until_date: Some(until_date),
        });
    }

    let (openalex_results, arxiv_results, semantic_results, crossref_results) = tokio::join!(
        search_openalex(&client, &query, per_source, &options),
        search_arxiv(&client, &query, per_source, &options),
        search_semantic_scholar(&client, &query, per_source, &options),
        search_crossref(&client, &query, per_source, &options),
    );

    let mut by_key: HashMap<String, SearchResult> = HashMap::new();

    let tokens = query_tokens(&query);

    for result in openalex_results
        .into_iter()
        .chain(arxiv_results.into_iter())
        .chain(semantic_results.into_iter())
        .chain(crossref_results.into_iter())
        .filter(|result| within_date_range(result, &options))
    {
        let result = annotate_result(result, &tokens, &options);
        let key = result_key(&result);
        if let Some(existing) = by_key.get_mut(&key) {
            merge_result(existing, result);
        } else {
            by_key.insert(key, result);
        }
    }

    let mut results: Vec<SearchResult> = by_key.into_values().collect();
    if is_newest_sort(&options) {
        results.sort_by(|a, b| {
            publication_date_key(b)
                .cmp(&publication_date_key(a))
                .then_with(|| {
                    b.quality_score
                        .partial_cmp(&a.quality_score)
                        .unwrap_or(std::cmp::Ordering::Equal)
                })
        });
    } else {
        results.sort_by(|a, b| {
            b.quality_score
                .partial_cmp(&a.quality_score)
                .unwrap_or(std::cmp::Ordering::Equal)
        });
    }
    results.truncate(requested_limit as usize);

    let total = results.len() as i32;
    log::info!("合并搜索: query={}, total={}", query, total);

    Ok(SearchResponse {
        total,
        results,
        mode: Some(mode.to_string()),
        total_available: None,
        fetched: Some(total),
        categories: None,
        from_date: options.from_date,
        until_date: options.until_date,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn init_log() {
        let _ = env_logger::builder().is_test(true).try_init();
    }

    fn default_options() -> SearchOptions {
        normalize_search_options(None)
    }

    // ---- OpenAlex ----

    #[tokio::test]
    async fn openalex_returns_results() {
        init_log();
        let client = reqwest::Client::new();
        let results = search_openalex(
            &client,
            "transformer attention mechanism",
            5,
            &default_options(),
        )
        .await;
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
        let results = search_openalex(&client, "deep learning", 3, &default_options()).await;
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
        let results = search_openalex(&client, "zzzxxxxqqqq99999", 5, &default_options()).await;
        assert!(results.len() <= 1, "乱码查询不应返回多条结果");
    }

    // ---- arXiv ----

    #[tokio::test]
    async fn arxiv_returns_results() {
        init_log();
        let client = reqwest::Client::new();
        let results = search_arxiv(&client, "large language models", 5, &default_options()).await;
        assert!(!results.is_empty(), "arXiv 应返回结果");
        for r in &results {
            assert!(!r.title.is_empty());
            assert_eq!(r.source, "arXiv");
            assert!(
                r.source_url.contains("arxiv.org") || r.id.contains("arxiv.org"),
                "arXiv 结果 URL 应包含 arxiv.org: {}",
                r.source_url
            );
        }
    }

    #[tokio::test]
    async fn arxiv_has_abstracts() {
        init_log();
        let client = reqwest::Client::new();
        let results = search_arxiv(&client, "neural network", 3, &default_options()).await;
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
        assert_eq!(
            r.open_access_url.as_deref(),
            Some("http://arxiv.org/pdf/2301.00001v1")
        );
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
        let options = default_options();
        let (openalex, arxiv) = tokio::join!(
            search_openalex(&client, "reinforcement learning", per_source, &options),
            search_arxiv(&client, "reinforcement learning", per_source, &options),
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

    #[test]
    fn journal_tier_marks_curated_sources_without_broad_false_positive() {
        assert_eq!(journal_tier(Some("Nature Neuroscience")), 3);
        assert_eq!(journal_tier(Some("Journal of Cognitive Neuroscience")), 2);
        assert_eq!(journal_tier(Some("Social Science & Medicine")), 0);
    }

    #[test]
    fn normalize_doi_removes_common_prefixes() {
        assert_eq!(
            normalize_doi("HTTPS://DOI.ORG/10.1038/s41586-024-00000-0"),
            "10.1038/s41586-024-00000-0"
        );
        assert_eq!(
            normalize_doi("doi:10.1126/science.test"),
            "10.1126/science.test"
        );
    }

    #[test]
    fn strip_markup_removes_crossref_abstract_tags() {
        let abstract_ = "<jats:p>Working memory &amp; attention interact.</jats:p>";
        assert_eq!(
            strip_markup(abstract_),
            "Working memory & attention interact."
        );
    }

    #[test]
    fn relevance_score_prioritizes_author_matches() {
        let tokens = query_tokens("Stephen Cheng Sarah Wiegreze Dinesh Manocha");
        let target = SearchResult {
            id: "arxiv:2604.08524".to_string(),
            title:
                "What Drives Representation Steering? A Mechanistic Case Study on Steering Refusal"
                    .to_string(),
            abstract_text: Some("test".to_string()),
            authors: vec![
                SearchAuthor {
                    name: "Stephen Cheng".to_string(),
                },
                SearchAuthor {
                    name: "Sarah Wiegreffe".to_string(),
                },
                SearchAuthor {
                    name: "Dinesh Manocha".to_string(),
                },
            ],
            year: Some(2026),
            citation_count: 0,
            open_access_url: None,
            open_access_pdf_url: None,
            open_access_landing_url: None,
            source_url: "https://arxiv.org/abs/2604.08524".to_string(),
            source: "arXiv".to_string(),
            journal: Some("arXiv".to_string()),
            doi: None,
            published_date: Some("2026-04-01".to_string()),
            is_top_journal: false,
            quality_score: 0.0,
        };
        let weak = SearchResult {
            id: "crossref:weak".to_string(),
            title: "It's Sarah, Not Stephen!".to_string(),
            abstract_text: None,
            authors: vec![],
            year: Some(2017),
            citation_count: 1,
            open_access_url: None,
            open_access_pdf_url: None,
            open_access_landing_url: None,
            source_url: "https://doi.org/example".to_string(),
            source: "Crossref".to_string(),
            journal: Some("AORN Journal".to_string()),
            doi: Some("10.1016/example".to_string()),
            published_date: Some("2017-01-01".to_string()),
            is_top_journal: false,
            quality_score: 0.0,
        };

        assert!(
            relevance_score(&target, &tokens) > relevance_score(&weak, &tokens),
            "author matches should outrank incidental title matches"
        );
    }
}
