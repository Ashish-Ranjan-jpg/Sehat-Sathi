"""
sarvam_translator.py - Sarvam AI Translation Module for Sehat Saathi UI Localization
Uses Sarvam AI translation (https://api.sarvam.ai/translate)
"""

import hashlib
import json
import os
import re
import requests
import time
import threading
from dotenv import load_dotenv

load_dotenv()

# Sarvam Supported Language Code Mapping
SARVAM_LANG_MAP = {
    "hi": "hi-IN",  # Hindi
    "bn": "bn-IN",  # Bengali
    "ta": "ta-IN",  # Tamil
    "te": "te-IN",  # Telugu
    "mr": "mr-IN",  # Marathi
    "gu": "gu-IN",  # Gujarati
    "kn": "kn-IN",  # Kannada
    "pa": "pa-IN",  # Punjabi
    "ur": "ur-IN",  # Urdu (Sarvam Translate v1)
    # Sarvam uses the ISO 639-1 code "od" for Odia (not the older "or").
    # Keep "or" as an alias because other parts of the app may still emit it.
    "od": "od-IN",
    "or": "od-IN",
    "ml": "ml-IN",  # Malayalam
    "en": "en-IN",  # English
}

SARVAM_API_URL = "https://api.sarvam.ai/translate"
_SARVAM_REQUEST_INTERVAL = 1.01  # Keep just under the documented 60 requests/minute Starter limit.
_SARVAM_REQUEST_LOCK = threading.Lock()
_SARVAM_NEXT_REQUEST_AT = 0.0


def _wait_for_sarvam_request_slot():
    """Rate-limit request start times across translation batches and users."""
    global _SARVAM_NEXT_REQUEST_AT
    with _SARVAM_REQUEST_LOCK:
        now = time.monotonic()
        request_at = max(now, _SARVAM_NEXT_REQUEST_AT)
        _SARVAM_NEXT_REQUEST_AT = request_at + _SARVAM_REQUEST_INTERVAL
    delay = request_at - now
    if delay > 0:
        time.sleep(delay)


def get_sarvam_api_key():
    """Retrieve Sarvam API Key dynamically from environment."""
    load_dotenv(override=True)
    return os.getenv("SARVAM_API_KEY", "").strip()


def translate_text_with_sarvam(text: str, target_lang: str, source_lang: str = "en") -> str:
    """
    Translate a single text string using Sarvam AI Translate API.
    Returns translated text, or None if translation fails / key missing.
    """
    api_key = get_sarvam_api_key()
    if not api_key:
        print("[Sarvam Translator] Warning: SARVAM_API_KEY not configured in .env")
        return None

    if not text or not text.strip():
        return text

    target_code = SARVAM_LANG_MAP.get(target_lang.lower())
    source_code = SARVAM_LANG_MAP.get(source_lang.lower(), "en-IN")

    if not target_code:
        print(f"[Sarvam Translator] Target language '{target_lang}' not supported directly by Sarvam API.")
        return None

    if source_code == target_code:
        return text

    headers = {
        "api-subscription-key": api_key,
        "Content-Type": "application/json"
    }

    # Sarvam Translate v1 accepts at most 2,000 characters. Batch construction
    # normally stays below this, but guard direct callers and unusually long UI
    # strings so the API does not reject an otherwise valid request.
    if len(text) > 2000:
        print(f"[Sarvam Translator] Skipping oversized request ({len(text)} characters; limit is 2000).")
        return None

    payload = {
        "input": text,
        "source_language_code": source_code,
        "target_language_code": target_code,
        "model": "sarvam-translate:v1"
    }

    for attempt in range(4):
        try:
            _wait_for_sarvam_request_slot()
            response = requests.post(SARVAM_API_URL, json=payload, headers=headers, timeout=20)
            if response.status_code == 200:
                data = response.json()
                translated = data.get("translated_text", "")
                if translated and translated.strip():
                    return translated.strip()
            elif response.status_code in (429, 503) and attempt < 3:
                retry_after = response.headers.get("Retry-After")
                try:
                    wait_seconds = min(float(retry_after), 20) if retry_after else 2 ** attempt
                except ValueError:
                    wait_seconds = 2 ** attempt
                time.sleep(wait_seconds)
                continue
            else:
                try:
                    detail = response.json()
                except ValueError:
                    detail = response.text[:1000]
                print(
                    "[Sarvam Translator] API request failed "
                    f"(status={response.status_code}, target={target_code}, "
                    f"input_chars={len(text)}): {detail}"
                )
                break
        except Exception as e:
            if attempt == 3:
                print(f"[Sarvam Translator] Error calling Sarvam Translate API: {e}")
            else:
                time.sleep(2 ** attempt)

    return None


_UI_TRANSLATION_CACHE = {}
_UI_TRANSLATION_PARTIAL_CACHE = {}
_UI_TEXT_CACHE = {}
_UI_TRANSLATION_LOCK = threading.Lock()


def _detect_ui_source_language(text: str, target_lang: str) -> str:
    """Infer source language for hardcoded UI literals using their script."""
    scripts = (
        ("hi", r"[\u0900-\u097f]"), ("bn", r"[\u0980-\u09ff]"),
        ("pa", r"[\u0a00-\u0a7f]"), ("gu", r"[\u0a80-\u0aff]"),
        ("or", r"[\u0b00-\u0b7f]"), ("ta", r"[\u0b80-\u0bff]"),
        ("te", r"[\u0c00-\u0c7f]"), ("kn", r"[\u0c80-\u0cff]"),
        ("ml", r"[\u0d00-\u0d7f]"), ("ur", r"[\u0600-\u06ff]"),
    )
    for language, pattern in scripts:
        if re.search(pattern, text):
            return language
    return "en"


def _translate_ui_batch(items, target_lang, source_lang="en"):
    """Translate a small group in one Sarvam request while retaining stable item IDs."""
    # sarvam-translate:v1 accepts up to 2,000 characters per request.
    key_by_index = []
    original_text_by_key = {key: text for key, text in items}
    lines = []
    for index, (key, text) in enumerate(items):
        marker = f"SSAT{index:05d}END"
        key_by_index.append(key)
        safe_text = re.sub(r"\s+", " ", text).strip()
        lines.append(f"{marker}: {safe_text}")

    translated = translate_text_with_sarvam(
        "\n".join(lines), target_lang=target_lang, source_lang=source_lang
    )
    if not translated:
        return {}

    # Sarvam may normalize five-digit markers to six digits after item 9.
    marker_pattern = re.compile(r"SSAT(\d{5,6})END")
    matches = list(marker_pattern.finditer(translated))
    results = {}
    for index, match in enumerate(matches):
        end = matches[index + 1].start() if index + 1 < len(matches) else len(translated)
        value = translated[match.end():end].strip(" \t\r\n:;|-")
        original_index = int(match.group(1))
        if value and original_index < len(key_by_index):
            key = key_by_index[original_index]
            original = original_text_by_key[key]
            leading = original[:len(original) - len(original.lstrip())]
            trailing = original[len(original.rstrip()):]
            results[key] = f"{leading}{value}{trailing}"
    return results


def _translate_ui_dictionary_locked(texts_dict: dict, target_lang: str, return_status: bool = False):
    """Translate an interface dictionary in batches and cache it per backend process."""
    if not texts_dict or target_lang in ("en", "english"):
        return (texts_dict, True) if return_status else texts_dict

    target_lang = target_lang.lower()
    target_code = SARVAM_LANG_MAP.get(target_lang)
    if not target_code:
        return (texts_dict, False) if return_status else texts_dict

    fingerprint = hashlib.sha256(
        json.dumps(texts_dict, sort_keys=True, ensure_ascii=False).encode("utf-8")
    ).hexdigest()
    cache_key = (target_lang, fingerprint)
    cached = _UI_TRANSLATION_CACHE.get(cache_key)
    if cached is not None:
        for key, value in texts_dict.items():
            if isinstance(value, str) and isinstance(cached.get(key), str):
                source_lang = _detect_ui_source_language(value, target_lang)
                _UI_TEXT_CACHE[(source_lang, target_lang, value)] = cached[key]
        return (cached.copy(), True) if return_status else cached.copy()
    output = dict(texts_dict)
    entries = [
        (key, value) for key, value in texts_dict.items()
        if isinstance(value, str) and value.strip()
    ]

    # Reuse individual results when the rendered-page translator discovers
    # strings already translated by the static dictionary or another screen.
    pending_by_source = {}
    oversized_parts = {}
    oversized_part_texts = {}
    for key, value in entries:
        source_lang = _detect_ui_source_language(value, target_lang)
        text_cache_key = (source_lang, target_lang, value)
        cached_text = _UI_TEXT_CACHE.get(text_cache_key)
        if cached_text is not None:
            output[key] = cached_text
        elif source_lang == target_lang:
            output[key] = value
            _UI_TEXT_CACHE[text_cache_key] = value
        elif len(value) + 20 > 1900:
            parts = []
            remaining = value
            while remaining:
                split_at = min(1850, len(remaining))
                if split_at < len(remaining):
                    word_boundary = remaining.rfind(" ", 0, split_at)
                    if word_boundary > 0:
                        split_at = word_boundary
                parts.append(remaining[:split_at].strip())
                remaining = remaining[split_at:].lstrip()
            part_keys = []
            for index, part in enumerate(parts):
                part_key = f"__long_{len(oversized_parts)}_{index}"
                part_keys.append(part_key)
                oversized_part_texts[part_key] = part
                pending_by_source.setdefault(source_lang, []).append((part_key, part))
            oversized_parts[key] = part_keys
        else:
            pending_by_source.setdefault(source_lang, []).append((key, value))

    complete = True
    oversized_part_keys = {part_key for keys in oversized_parts.values() for part_key in keys}
    for source_lang, source_entries in pending_by_source.items():
        batches = []
        batch = []
        char_count = 0
        for key, value in source_entries:
            # Include room for the stable marker and separators.
            row_length = len(value) + 20
            if batch and char_count + row_length > 1900:
                batches.append(batch)
                batch = []
                char_count = 0
            batch.append((key, value))
            char_count += row_length
        if batch:
            batches.append(batch)

        for group in batches:
            translated_group = _translate_ui_batch(group, target_lang, source_lang)
            group_texts = dict(group)
            for key, translated_value in translated_group.items():
                _UI_TEXT_CACHE[(source_lang, target_lang, group_texts[key])] = translated_value
                if key not in oversized_part_keys:
                    output[key] = translated_value
            if len(translated_group) != len(group):
                complete = False

    for key, part_keys in oversized_parts.items():
        translated_parts = []
        for part_key in part_keys:
            part_text = oversized_part_texts[part_key]
            part_source = _detect_ui_source_language(part_text, target_lang)
            part_value = _UI_TEXT_CACHE.get((part_source, target_lang, part_text))
            if part_value is None:
                complete = False
                break
            translated_parts.append(part_value)
        if len(translated_parts) == len(part_keys):
            output[key] = " ".join(translated_parts)

    if complete:
        _UI_TRANSLATION_CACHE[cache_key] = output.copy()
        _UI_TRANSLATION_PARTIAL_CACHE.pop(cache_key, None)
    return (output, complete) if return_status else output


def translate_ui_dictionary(texts_dict: dict, target_lang: str, return_status: bool = False):
    """Serialize first-time dictionary translation so concurrent users share one fill."""
    with _UI_TRANSLATION_LOCK:
        return _translate_ui_dictionary_locked(texts_dict, target_lang, return_status)
