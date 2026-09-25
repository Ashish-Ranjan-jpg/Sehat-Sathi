"""
health_database.py

Healthcare information database powered by the MedlinePlus Web Service API.
Provides search, caching, and translation for health topic information.

Uses db_engine (SQLite locally or Supabase PostgreSQL online) for caching
fetched topics to minimize API calls and improve response times.

MedlinePlus API:
  - Base URL: https://wsearch.nlm.nih.gov/ws/query
  - Rate Limit: 85 requests/minute per IP
  - Returns XML, updated daily (Tue-Sat)
  - Supports English and Spanish natively
  - Free, no registration required
"""

import os
import re
import json
import uuid
import html
import urllib.request
import urllib.parse
from datetime import datetime, timezone, timedelta
from xml.etree import ElementTree

import db_engine
from dotenv import load_dotenv

env_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
load_dotenv(env_file)

# Cache duration — MedlinePlus updates daily, so 24 hours is safe
CACHE_HOURS = 24

# Popular topics to pre-seed the database landing page
POPULAR_TOPIC_QUERIES = [
    "Diabetes",
    "Asthma",
    "Heart Disease",
    "High Blood Pressure",
    "Pregnancy",
    "Depression",
    "COVID-19",
    "Cancer",
    "Arthritis",
    "Allergies",
    "Anemia",
    "Thyroid Diseases",
]


def _now():
    return datetime.now(timezone.utc).isoformat()


def _is_cache_fresh(fetched_at_iso):
    """Check if a cached entry is still within the cache window."""
    if not fetched_at_iso:
        return False
    try:
        fetched_at = datetime.fromisoformat(fetched_at_iso)
        if fetched_at.tzinfo is None:
            fetched_at = fetched_at.replace(tzinfo=timezone.utc)
        return datetime.now(timezone.utc) - fetched_at < timedelta(hours=CACHE_HOURS)
    except Exception:
        return False


# ---------------------------------------------------------------------------
# Database setup
# ---------------------------------------------------------------------------

def _init_health_db():
    db_engine.execute(
        """
        CREATE TABLE IF NOT EXISTS health_topics (
            id TEXT PRIMARY KEY,
            title TEXT,
            url TEXT,
            summary TEXT,
            snippet TEXT,
            groups TEXT,
            language TEXT,
            source_language TEXT DEFAULT 'en',
            fetched_at TEXT,
            search_terms TEXT
        )
        """
    )


_init_health_db()


# ---------------------------------------------------------------------------
# XML Parsing — MedlinePlus API
# ---------------------------------------------------------------------------

def _clean_html_tags(text):
    """Remove HTML tags and clean up entities from MedlinePlus content."""
    if not text:
        return ""
    # Unescape HTML entities (MedlinePlus double-encodes: &lt; → < etc.)
    text = html.unescape(text)
    text = html.unescape(text)  # Double unescape for double-encoded content
    # Remove <span class="qt0"> highlight tags
    text = re.sub(r'<span[^>]*class="qt\d+"[^>]*>', '', text)
    text = text.replace('</span>', '')
    # Convert <p> and <br> to newlines for readability
    text = re.sub(r'<br\s*/?>', '\n', text)
    text = re.sub(r'</p>\s*', '\n\n', text)
    text = re.sub(r'<p[^>]*>', '', text)
    # Convert list items to bullet points
    text = re.sub(r'<li[^>]*>', '• ', text)
    text = text.replace('</li>', '\n')
    text = re.sub(r'</?[uo]l[^>]*>', '\n', text)
    # Remove any remaining HTML tags
    text = re.sub(r'<[^>]+>', '', text)
    # Clean up whitespace
    text = re.sub(r'\n{3,}', '\n\n', text)
    text = text.strip()
    return text


def _parse_medlineplus_xml(xml_text):
    """
    Parse MedlinePlus XML search results into a list of topic dicts.

    Each dict has: title, url, summary, snippet, groups, organization
    """
    topics = []
    try:
        root = ElementTree.fromstring(xml_text)
    except ElementTree.ParseError:
        return topics

    doc_list = root.find('list')
    if doc_list is None:
        return topics

    for doc_elem in doc_list.findall('document'):
        url = doc_elem.get('url', '')

        title = ''
        summary = ''
        snippet = ''
        organization = ''
        groups = []
        alt_titles = []

        for content in doc_elem.findall('content'):
            name = content.get('name', '')
            text = content.text or ''

            if name == 'title':
                title = _clean_html_tags(text)
            elif name == 'FullSummary':
                summary = _clean_html_tags(text)
            elif name == 'snippet':
                snippet = _clean_html_tags(text)
            elif name == 'organizationName':
                organization = text.strip()
            elif name == 'groupName':
                cleaned = _clean_html_tags(text)
                if cleaned and cleaned not in groups:
                    groups.append(cleaned)
            elif name == 'altTitle':
                alt = _clean_html_tags(text)
                if alt:
                    alt_titles.append(alt)

        if title:
            topics.append({
                'title': title,
                'url': url,
                'summary': summary,
                'snippet': snippet,
                'groups': groups,
                'organization': organization or 'National Library of Medicine',
                'alt_titles': alt_titles,
            })

    return topics


def search_medlineplus(query, language="en", max_results=10):
    """
    Call the MedlinePlus Web Service API and return parsed results.

    Args:
        query: Search term
        language: 'en' for English, 'es' for Spanish (MedlinePlus native)
        max_results: Maximum number of results (default 10)

    Returns:
        List of topic dicts with title, url, summary, snippet, groups
    """
    db = "healthTopics" if language != "es" else "healthTopicsSpanish"

    params = urllib.parse.urlencode({
        'db': db,
        'term': query,
        'rettype': 'brief',
        'retmax': str(max_results),
    })

    url = f"https://wsearch.nlm.nih.gov/ws/query?{params}"

    try:
        req = urllib.request.Request(
            url,
            headers={
                'User-Agent': 'SehatSaathi-HealthDatabase/1.0',
                'Accept': 'application/xml',
            }
        )
        with urllib.request.urlopen(req, timeout=10) as response:
            xml_text = response.read().decode('utf-8')
            return _parse_medlineplus_xml(xml_text)
    except Exception as e:
        print(f"[health_database] MedlinePlus API error: {e}")
        return []


# ---------------------------------------------------------------------------
# Translation
# ---------------------------------------------------------------------------

def _translate_with_groq(text, target_lang):
    """Translate medical text into target_lang using Groq LLM API with fallback models."""
    if not text or not text.strip():
        return text

    try:
        from dotenv import load_dotenv
        env_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
        load_dotenv(env_file)
        from groq import Groq

        api_key = os.environ.get("GROQ_API_KEY")
        if not api_key:
            return None

        lang_map = {
            "hi": "Hindi", "bn": "Bengali", "ta": "Tamil", "te": "Telugu",
            "mr": "Marathi", "gu": "Gujarati", "kn": "Kannada",
            "pa": "Punjabi", "ur": "Urdu", "es": "Spanish", "fr": "French"
        }
        lang_name = lang_map.get(target_lang.lower(), target_lang)

        client = Groq(api_key=api_key)
        candidate_models = ["openai/gpt-oss-120b", "openai/gpt-oss-20b", "qwen/qwen3.8-27b"]

        for model_name in candidate_models:
            try:
                response = client.chat.completions.create(
                    model=model_name,
                    messages=[
                        {
                            "role": "system",
                            "content": f"You are a professional medical translator into {lang_name}. Translate the text accurately into {lang_name} while preserving any formatting, paragraph breaks, or bullet points. Output ONLY the translated text in {lang_name} without any extra commentary or conversational filler."
                        },
                        {"role": "user", "content": text}
                    ],
                    temperature=0.2,
                    max_tokens=3500,
                )
                translated = response.choices[0].message.content.strip()
                if translated and translated.strip() != text.strip():
                    return translated
            except Exception as model_err:
                print(f"[health_database] Groq model {model_name} failed: {model_err}")
                continue

    except Exception as e:
        print(f"[health_database] Groq LLM error: {e}")
    return None


def _translate_text(text, target_lang):
    """
    Translate text into target_lang.
    Tries Groq LLM API first (fast, reliable, high quality).
    Falls back to deep-translator (GoogleTranslator & MyMemoryTranslator) if Groq is unavailable.
    """
    if not text or target_lang in ("en", "english"):
        return text

    # Step 1: Try Groq LLM API primary translator
    groq_res = _translate_with_groq(text, target_lang)
    if groq_res and groq_res.strip() != text.strip():
        return groq_res

    # Step 2: Fallback to GoogleTranslator (deep-translator)
    try:
        from deep_translator import GoogleTranslator
        max_chunk = 4500
        if len(text) <= max_chunk:
            res = GoogleTranslator(source='en', target=target_lang).translate(text)
            if res and res != text:
                return res
        else:
            paragraphs = text.split('\n\n')
            translated_parts = []
            current_chunk = ""
            for para in paragraphs:
                if len(current_chunk) + len(para) + 2 > max_chunk:
                    if current_chunk:
                        translated_parts.append(GoogleTranslator(source='en', target=target_lang).translate(current_chunk))
                    current_chunk = para
                else:
                    current_chunk = current_chunk + '\n\n' + para if current_chunk else para
            if current_chunk:
                translated_parts.append(GoogleTranslator(source='en', target=target_lang).translate(current_chunk))
            res = '\n\n'.join(translated_parts)
            if res:
                return res
    except Exception as e:
        print(f"[health_database] deep-translator Google error: {e}")

    # Step 3: Fallback to MyMemoryTranslator (deep-translator)
    try:
        from deep_translator import MyMemoryTranslator
        mymemory_lang_map = {
            "hi": "hi-IN", "bn": "bn-IN", "ta": "ta-IN", "te": "te-IN",
            "mr": "mr-IN", "gu": "gu-IN", "kn": "kn-IN", "pa": "pa-IN",
            "ur": "ur-PK", "es": "es-ES", "fr": "fr-FR"
        }
        mm_target = mymemory_lang_map.get(target_lang.lower(), target_lang)
        res = MyMemoryTranslator(source="en-GB", target=mm_target).translate(text[:500])
        if res and res.strip() != text[:500].strip():
            return res
    except Exception as e:
        print(f"[health_database] deep-translator MyMemory error: {e}")

    return text


def translate_topic(topic_dict, target_lang):
    """
    Translate a topic dict's title, summary, and snippet to the target language.
    """
    if not target_lang or target_lang in ("en", "english"):
        return topic_dict

    translated = dict(topic_dict)
    translated['title'] = _translate_text(topic_dict.get('title', ''), target_lang)
    translated['summary'] = _translate_text(topic_dict.get('summary', ''), target_lang)
    translated['snippet'] = _translate_text(topic_dict.get('snippet', ''), target_lang)
    translated['language'] = target_lang
    translated['source_language'] = 'en'
    return translated





# ---------------------------------------------------------------------------
# Relevance Ranking & Filtering
# ---------------------------------------------------------------------------

def _rank_and_filter_topics(topics, query):
    """
    Score, filter, deduplicate, and sort topics by relevance to the query.
    Ensures exact/partial title matches appear first and completely irrelevant items are discarded.
    If query is empty, deduplicates and returns all topics (for landing page/popular topics).
    """
    if not topics:
        return []

    q_clean = (query or '').strip().lower()
    if not q_clean:
        # No search query - return deduplicated topics directly (for popular topics landing view)
        seen_titles = set()
        deduped = []
        for t in topics:
            title_norm = (t.get('title') or '').strip().lower()
            if title_norm and title_norm not in seen_titles:
                seen_titles.add(title_norm)
                deduped.append(t)
        return deduped

    q_words = [w for w in re.split(r'\W+', q_clean) if len(w) > 1]
    if not q_words and q_clean:
        q_words = [q_clean]

    scored = []
    seen_titles = set()

    for topic in topics:
        title_raw = topic.get('title') or ''
        title_norm = title_raw.strip().lower()
        if not title_norm or title_norm in seen_titles:
            continue
        seen_titles.add(title_norm)

        summary = (topic.get('summary') or '').lower()
        snippet = (topic.get('snippet') or '').lower()

        score = 0

        # Exact title match (highest priority)
        if q_clean and title_norm == q_clean:
            score += 200
        # Title starts with full query string
        elif q_clean and title_norm.startswith(q_clean):
            score += 120
        # Title contains full query string
        elif q_clean and q_clean in title_norm:
            score += 80

        # Title word matches
        title_word_matches = sum(1 for w in q_words if w in title_norm)
        score += title_word_matches * 40

        # Text (summary/snippet) word matches (lower weight)
        text_word_matches = sum(1 for w in q_words if w in summary or w in snippet)
        score += text_word_matches * 5

        # Strict Relevance Thresholding:
        # Require title keyword match or at least 2 text word matches, AND minimum score threshold
        if title_word_matches == 0 and text_word_matches < 2:
            continue
        if score < 35:
            continue

        scored.append((score, topic))

    # Sort by relevance score descending
    scored.sort(key=lambda x: x[0], reverse=True)
    return [item[1] for item in scored]


def _filter_most_relevant(topics, query):
    """
    Filters search results to strictly return only the most relevant, highly-accurate match(es).
    - If an exact title match exists, returns ONLY that 1 single top match.
    - If a strong title match exists (title starts with query or query is main title phrase), returns top 1-2 matches.
    - Otherwise returns at most top 1-2 items that meet strict relevance criteria, dropping all unrelated noise.
    """
    if not topics:
        return []

    q_clean = (query or '').strip().lower()
    top_topic = topics[0]
    top_title = (top_topic.get('title') or '').strip().lower()

    # 1. Exact title match -> return ONLY the single top match
    if q_clean and top_title == q_clean:
        return [top_topic]

    # 2. Title starts with search query or query is exact phrase in title -> return top 1 (or max 2 if both are strong title matches)
    if q_clean and (top_title.startswith(q_clean) or q_clean in top_title):
        strong_matches = []
        for t in topics:
            t_title = (t.get('title') or '').strip().lower()
            if t_title == q_clean or t_title.startswith(q_clean) or q_clean in t_title:
                strong_matches.append(t)
                if len(strong_matches) >= 2:
                    break
        return strong_matches if strong_matches else [top_topic]

    # 3. Otherwise return at most top 1 to 2 items max
    return topics[:2]


# ---------------------------------------------------------------------------
# Caching layer
# ---------------------------------------------------------------------------

def _cache_topic(topic_dict, language, search_term=""):
    """Store a topic in the local cache."""
    topic_id = uuid.uuid4().hex[:12]

    groups_json = json.dumps(topic_dict.get('groups', []), ensure_ascii=False)

    db_engine.execute(
        """
        INSERT INTO health_topics
            (id, title, url, summary, snippet, groups, language,
             source_language, fetched_at, search_terms)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            topic_id,
            topic_dict.get('title', ''),
            topic_dict.get('url', ''),
            topic_dict.get('summary', ''),
            topic_dict.get('snippet', ''),
            groups_json,
            language,
            topic_dict.get('source_language', 'en'),
            _now(),
            search_term,
        )
    )
    return topic_id


def _search_cache(query, language):
    """Search the local cache for matching topics with strict term matching."""
    q_clean = query.strip().lower()
    like_query = f"%{q_clean}%"
    rows = db_engine.fetchall(
        """
        SELECT * FROM health_topics
        WHERE language = ? AND (
            title LIKE ? OR summary LIKE ? OR snippet LIKE ?
        )
        ORDER BY fetched_at DESC
        LIMIT 20
        """,
        (language, like_query, like_query, like_query),
    )

    # Filter to fresh results and rank by relevance
    fresh = [r for r in rows if _is_cache_fresh(r.get('fetched_at'))]
    topics = [_row_to_topic(r) for r in fresh]
    return _rank_and_filter_topics(topics, query)


def _row_to_topic(row):
    """Convert a DB row to a clean topic dict."""
    record = dict(row)
    groups_raw = record.get('groups', '[]')
    if isinstance(groups_raw, str):
        try:
            record['groups'] = json.loads(groups_raw)
        except Exception:
            record['groups'] = []
    return record


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def search_topics(query, language="en"):
    """
    Search for health topics fast with relevance ranking and strict filtering.
    Returns only the most relevant matching topic(s) to maximize search accuracy.
    """
    if not query or not query.strip():
        return {"results": [], "count": 0, "source": "none"}

    query = query.strip()
    search_lang = "es" if language == "es" else "en"

    # Step 1: Check cache with strict relevance ranking
    cached = _search_cache(query, search_lang)
    if cached:
        filtered_cached = _filter_most_relevant(cached, query)
        if filtered_cached:
            return {"results": filtered_cached, "count": len(filtered_cached), "source": "cache"}

    # Step 2: Fetch from MedlinePlus API
    raw_topics = search_medlineplus(query, language=search_lang, max_results=10)

    if not raw_topics:
        filtered_cached = _filter_most_relevant(cached, query) if cached else []
        return {"results": filtered_cached, "count": len(filtered_cached), "source": "cache" if cached else "medlineplus"}

    # Step 3: Relevance score and filter raw API results
    ranked_live = _rank_and_filter_topics(raw_topics, query)

    results = []
    for topic in ranked_live:
        topic['language'] = search_lang
        topic['source_language'] = 'en'
        topic_id = _cache_topic(topic, search_lang, search_term=query)
        topic['id'] = topic_id
        results.append(topic)

    filtered = _filter_most_relevant(results, query)
    return {"results": filtered, "count": len(filtered), "source": "medlineplus"}


def get_topic(topic_id):
    """Get a single cached topic by ID."""
    row = db_engine.fetchone(
        "SELECT * FROM health_topics WHERE id = ?", (topic_id,)
    )
    return _row_to_topic(row) if row else None


def get_translated_topic(topic_id, target_lang="en"):
    """
    Translate a single specific topic on-demand into target_lang.
    Checks cache first by topic URL or title to avoid re-translating.
    """
    original = get_topic(topic_id)
    if not original:
        return None

    if not target_lang or (target_lang in ("en", "english") and original.get("language") == "en"):
        return original

    # Check if we already have a cached translation of this topic in target_lang
    url = original.get("url", "")
    title = original.get("title", "")
    existing = None

    if url:
        existing = db_engine.fetchone(
            "SELECT * FROM health_topics WHERE language = ? AND url = ?",
            (target_lang, url),
        )
    if not existing and title:
        existing = db_engine.fetchone(
            "SELECT * FROM health_topics WHERE language = ? AND search_terms LIKE ?",
            (target_lang, f"%{title}%"),
        )

    # Validate cached entry: must be fresh AND actually translated (not English fallback)
    if existing and _is_cache_fresh(existing.get("fetched_at")):
        cached_topic = _row_to_topic(existing)
        is_title_diff = cached_topic.get("title") and cached_topic.get("title") != original.get("title")
        is_summary_diff = cached_topic.get("summary") and cached_topic.get("summary") != original.get("summary")
        if is_title_diff or is_summary_diff:
            return cached_topic

    # Translate on demand (1 topic only!)
    translated = translate_topic(original, target_lang)

    # Only cache if translation actually succeeded (content differs from original)
    is_title_translated = translated.get("title") and translated.get("title") != original.get("title")
    is_summary_translated = translated.get("summary") and translated.get("summary") != original.get("summary")

    if is_title_translated or is_summary_translated:
        new_id = _cache_topic(translated, target_lang, search_term=original.get("title", ""))
        translated["id"] = new_id
    else:
        # Keep original topic ID if translation was not cached
        translated["id"] = topic_id

    return translated


import threading
from concurrent.futures import ThreadPoolExecutor


def _fetch_single_popular_topic(term, search_lang):
    """Fetch and cache a single popular topic."""
    try:
        existing = _search_cache(term, search_lang)
        if existing and len(existing) > 0:
            return existing[0]

        raw = search_medlineplus(term, language=search_lang, max_results=1)
        if not raw:
            return None

        topic = raw[0]
        topic['language'] = search_lang
        topic['source_language'] = 'en'
        topic_id = _cache_topic(topic, search_lang, search_term=term)
        topic['id'] = topic_id
        return topic
    except Exception as e:
        print(f"[health_database] Error fetching popular topic '{term}': {e}")
        return None


def get_popular_topics(language="en"):
    """
    Get popular health topics instantly (<5ms) from SQLite cache.
    Only queries MedlinePlus API if SQLite cache is sparse.
    """
    search_lang = "es" if language == "es" else "en"

    # Step 1: Query cached popular topics directly from SQLite in a single fast SQL query
    rows = db_engine.fetchall(
        """
        SELECT * FROM health_topics
        WHERE language = ?
        ORDER BY fetched_at DESC
        LIMIT 20
        """,
        (search_lang,),
    )

    fresh = [r for r in rows if _is_cache_fresh(r.get('fetched_at'))]
    topics = [_row_to_topic(r) for r in fresh]
    unique_popular = _rank_and_filter_topics(topics, "")

    if len(unique_popular) >= 10:
        return unique_popular[:12]

    # Step 2: If cache has fewer items, fetch missing popular topics in parallel
    cached_titles = {t.get('title', '').lower() for t in unique_popular}

    missing_terms = [
        term for term in POPULAR_TOPIC_QUERIES
        if not any(term.lower() in ct for ct in cached_titles)
    ]

    if not missing_terms:
        return unique_popular[:12]

    fetched_topics = []
    with ThreadPoolExecutor(max_workers=8) as executor:
        futures = [executor.submit(_fetch_single_popular_topic, t, search_lang) for t in missing_terms]
        for f in futures:
            res = f.result()
            if res:
                fetched_topics.append(res)

    all_popular = unique_popular + fetched_topics
    return _rank_and_filter_topics(all_popular, "")[:12]


def _prewarm_popular_cache():
    """Background thread to pre-warm cache on module startup."""
    try:
        get_popular_topics("en")
    except Exception as e:
        print(f"[health_database] Prewarm error: {e}")


# Start background cache pre-warming on import
threading.Thread(target=_prewarm_popular_cache, daemon=True).start()



CHAT_STOP_WORDS = {
    'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should',
    'can', 'could', 'may', 'might', 'must', 'shall', 'i', 'you', 'he',
    'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them', 'my',
    'your', 'his', 'its', 'our', 'their', 'what', 'which', 'who', 'whom',
    'whose', 'where', 'when', 'why', 'how', 'tell', 'about', 'explain',
    'please', 'help', 'give', 'information', 'detail', 'details', 'show',
    'hi', 'hello', 'hey', 'thanks', 'thank', 'bye', 'goodbye', 'treated',
    'treatment', 'symptom', 'symptoms', 'cause', 'causes', 'diagnose',
    'diagnosis', 'prevent', 'prevention', 'cure', 'cures', 'medicine',
    'medicines', 'medication', 'medications', 'drug', 'drugs', 'dose', 'dosage'
}


def extract_chat_medical_terms(query):
    if not query or not query.strip():
        return ""
    words = [w for w in re.split(r'\W+', query.strip().lower()) if len(w) > 1]
    medical_words = [w for w in words if w not in CHAT_STOP_WORDS]
    return ' '.join(medical_words)


def search_for_chat(query):
    """
    Intelligent medical topic search for AI chat assistant.
    Only matches when user query contains explicit medical condition/symptom terms.
    Returns None (AI Generated) for greetings, conversational text, or non-medical queries.
    """
    if not query or not query.strip():
        return None

    # Step 1: Extract core medical terms (stripping greetings & generic query words)
    med_terms = extract_chat_medical_terms(query)
    if not med_terms or len(med_terms) < 3:
        return None

    # Step 2: Check cache first using extracted medical terms
    cached = _search_cache(med_terms, "en")
    if cached:
        best_cached = cached[0]
        title_lower = (best_cached.get('title') or '').lower()
        if any(term in title_lower for term in med_terms.split()):
            return {
                "title": best_cached.get("title", ""),
                "summary": best_cached.get("summary", ""),
                "snippet": best_cached.get("snippet", ""),
                "url": best_cached.get("url", ""),
                "id": best_cached.get("id", ""),
            }

    # Step 3: Fetch from MedlinePlus API using clean medical terms
    raw = search_medlineplus(med_terms, language="en", max_results=5)
    if not raw:
        return None

    # Score and filter MedlinePlus results
    ranked = _rank_and_filter_topics(raw, med_terms)
    if not ranked:
        return None

    best = ranked[0]
    title_lower = (best.get('title') or '').lower()

    # Require that topic title contains at least one extracted medical term
    if not any(term in title_lower for term in med_terms.split()):
        return None

    # Cache best result
    best['language'] = 'en'
    best['source_language'] = 'en'
    topic_id = _cache_topic(best, 'en', search_term=med_terms)

    return {
        "title": best.get("title", ""),
        "summary": best.get("summary", ""),
        "snippet": best.get("snippet", ""),
        "url": best.get("url", ""),
        "id": topic_id,
    }
