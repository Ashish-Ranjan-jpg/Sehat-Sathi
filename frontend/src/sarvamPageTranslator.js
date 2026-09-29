import { API_BASE } from "./api.js";
import { translations } from "./i18n.js";

const TEXT_TAGS_TO_SKIP = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "CODE", "PRE", "SVG"]);
const ATTRIBUTES_TO_TRANSLATE = ["placeholder", "title", "aria-label", "alt"];
const PAGE_CACHE_PREFIX = "sehat_saathi_sarvam_page_v2_";
const MAX_CACHE_ENTRIES = 3000;
const MAX_CACHE_SIZE = 1_000_000;
let activeSarvamTranslationJobs = 0;

/** Translate rendered React text through Sarvam, including components absent from i18n. */
export function startSarvamPageTranslator() {
  if (typeof window === "undefined" || !document.body) {
    return { setLanguage() {}, async translatePage() { return false; }, dispose() {} };
  }

  const originals = new WeakMap();
  const lastApplied = new WeakMap();
  const appliedLanguage = new WeakMap();
  const attributeOriginals = new WeakMap();
  const attributeLastApplied = new WeakMap();
  const attributeAppliedLanguage = new WeakMap();
  const translationCaches = new Map();
  const reverseDictionaries = new Map();
  let language = localStorage.getItem("sehat_saathi_lang") || "hi";
  let scanTimer = null;
  let busy = false;
  let scanAgain = false;
  let wholePageActive = true;

  function reportTranslationJob(active) {
    activeSarvamTranslationJobs = Math.max(0, activeSarvamTranslationJobs + (active ? 1 : -1));
    window.dispatchEvent(new CustomEvent("sehat-saathi-translation-progress", {
      detail: { active: activeSarvamTranslationJobs > 0 },
    }));
  }

  function getSourceTextForKnownTranslation(targetLanguage, value) {
    const localized = translations[targetLanguage];
    if (!localized) return null;
    let reverse = reverseDictionaries.get(targetLanguage);
    if (!reverse || reverse.localized !== localized) {
      reverse = new Map();
      for (const [key, sourceText] of Object.entries(translations.en || {})) {
        const translatedText = localized[key];
        if (typeof sourceText === "string" && typeof translatedText === "string" && translatedText !== sourceText) {
          reverse.set(translatedText.trim(), sourceText);
        }
      }
      reverse.localized = localized;
      reverseDictionaries.set(targetLanguage, reverse);
    }
    return reverse.get(value.trim()) || null;
  }

  function getTranslationCache(targetLanguage) {
    if (translationCaches.has(targetLanguage)) return translationCaches.get(targetLanguage);
    let cache = new Map();
    try {
      const saved = localStorage.getItem(`${PAGE_CACHE_PREFIX}${targetLanguage}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          cache = new Map(Object.entries(parsed).filter(([, value]) => typeof value === "string"));
        }
      }
    } catch (error) {
      console.warn("[Sarvam page translation] Could not read the saved translation cache:", error);
    }
    translationCaches.set(targetLanguage, cache);
    return cache;
  }

  function saveTranslationCache(targetLanguage, cache) {
    try {
      let serialized = JSON.stringify(Object.fromEntries(cache));
      while ((cache.size > MAX_CACHE_ENTRIES || serialized.length > MAX_CACHE_SIZE) && cache.size > 0) {
        const removeCount = Math.max(1, Math.ceil(cache.size * 0.1));
        for (let index = 0; index < removeCount; index++) cache.delete(cache.keys().next().value);
        serialized = JSON.stringify(Object.fromEntries(cache));
      }
      localStorage.setItem(`${PAGE_CACHE_PREFIX}${targetLanguage}`, serialized);
    } catch (error) {
      console.warn("[Sarvam page translation] Could not save the translation cache:", error);
    }
  }

  function setText(node, value, translatedLanguage = language) {
    lastApplied.set(node, value);
    appliedLanguage.set(node, translatedLanguage);
    node.nodeValue = value;
  }

  function setAttribute(element, name, value, translatedLanguage = language) {
    const applied = attributeLastApplied.get(element) || {};
    applied[name] = value;
    attributeLastApplied.set(element, applied);
    const languages = attributeAppliedLanguage.get(element) || {};
    languages[name] = translatedLanguage;
    attributeAppliedLanguage.set(element, languages);
    element.setAttribute(name, value);
  }

  function isVisible(element) {
    if (!element || element.closest("[hidden],[aria-hidden='true'],[data-sarvam-skip]")) return false;
    const style = window.getComputedStyle(element);
    return style.display !== "none" && style.visibility !== "hidden" && element.getClientRects().length > 0;
  }

  function collect() {
    const work = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const parent = node.parentElement;
      if (!parent || TEXT_TAGS_TO_SKIP.has(parent.tagName) || parent.closest("script,style,noscript,[contenteditable='true']") || !isVisible(parent)) continue;
      const current = node.nodeValue || "";
      if (!current.trim()) continue;
      let original = originals.get(node);
      const last = lastApplied.get(node);
      if (original === undefined) {
        const canonical = getSourceTextForKnownTranslation(language, current);
        const leading = current.match(/^\s*/)?.[0] || "";
        const trailing = current.match(/\s*$/)?.[0] || "";
        original = canonical ? `${leading}${canonical}${trailing}` : current;
        originals.set(node, original);
        if (canonical) {
          lastApplied.set(node, current);
          appliedLanguage.set(node, language);
        }
      } else if (last !== undefined && current !== last && appliedLanguage.get(node) === language) {
        original = current;
        originals.set(node, original);
      }
      if (language === "en") {
        if (current !== original) setText(node, original, "en");
      } else if (current !== last || appliedLanguage.get(node) !== language) {
        const leading = original.match(/^\s*/)?.[0] || "";
        const trailing = original.match(/\s*$/)?.[0] || "";
        const text = original.slice(leading.length, original.length - trailing.length || undefined);
        if (text.length > 1 && /[\p{L}]/u.test(text)) {
          work.push({ node, text, leading, trailing });
        }
      }
    }

    for (const element of document.body.querySelectorAll("input,textarea,button,[title],[aria-label],[alt]")) {
      if (element.closest("[contenteditable='true']") || !isVisible(element)) continue;
      for (const name of ATTRIBUTES_TO_TRANSLATE) {
        if (!element.hasAttribute(name)) continue;
        const current = element.getAttribute(name) || "";
        if (!current.trim()) continue;
        let originalsForElement = attributeOriginals.get(element);
        if (!originalsForElement) {
          originalsForElement = {};
          attributeOriginals.set(element, originalsForElement);
        }
        let original = originalsForElement[name];
        const applied = attributeLastApplied.get(element) || {};
        if (original === undefined) {
          const canonical = getSourceTextForKnownTranslation(language, current);
          original = canonical || current;
          originalsForElement[name] = original;
          if (canonical) {
            applied[name] = current;
            attributeLastApplied.set(element, applied);
            const languages = attributeAppliedLanguage.get(element) || {};
            languages[name] = language;
            attributeAppliedLanguage.set(element, languages);
          }
        } else if (applied[name] !== undefined && current !== applied[name] && attributeAppliedLanguage.get(element)?.[name] === language) {
          original = current;
          originalsForElement[name] = original;
        }
        if (language === "en") {
          if (current !== original) setAttribute(element, name, original, "en");
        } else if ((current !== applied[name] || attributeAppliedLanguage.get(element)?.[name] !== language) && original.length > 1 && /[\p{L}]/u.test(original)) {
          work.push({ element, attribute: name, text: original });
        }
      }
    }
    return work;
  }

  async function translateWork(work, requestedLanguage) {
    if (!work.length) return true;
    return await translateWorkBatches(work, requestedLanguage);
  }

  async function translateWorkBatches(work, requestedLanguage) {
    // Keep each browser request modest. The backend packs actual Sarvam calls
    // under the provider's 2,000 character limit. Persist translations so a
    // repeat visit or language switch reuses the result without another API call.
    const staged = new Map();
    const cache = getTranslationCache(requestedLanguage);
    const missingByText = new Map();
    for (const item of work) {
      if (cache.has(item.text)) {
        staged.set(item, cache.get(item.text));
      } else {
        if (!missingByText.has(item.text)) missingByText.set(item.text, []);
        missingByText.get(item.text).push(item);
      }
    }
    const uniqueMissing = [...missingByText.keys()];
    for (let offset = 0; offset < uniqueMissing.length; offset += 50) {
      if (language !== requestedLanguage) return false;
      const group = uniqueMissing.slice(offset, offset + 50);
      let translatedGroup = null;
      for (let attempt = 0; attempt < 4 && !translatedGroup; attempt++) {
        if (language !== requestedLanguage) return false;
        const texts = {};
        group.forEach((text, index) => { texts[`page_${index}`] = text; });
        try {
          const response = await fetch(`${API_BASE.replace(/\/+$/, "")}/api/translate-ui`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ target_lang: requestedLanguage, texts }),
          });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const result = await response.json();
          if (result.status === "success" && result.translations && group.every((_, index) => typeof result.translations[`page_${index}`] === "string")) {
            translatedGroup = result.translations;
          } else if (attempt < 3) {
            await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
          }
        } catch (error) {
          console.warn("[Sarvam page translation] Could not translate a rendered text batch:", error);
          if (attempt < 3) await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
        }
      }
      if (!translatedGroup) return false;
      group.forEach((text, index) => {
        const translated = translatedGroup[`page_${index}`];
        const safeTranslation = translated
          .replace(/(?:\r?\n|\s)SSAT\d{5,6}END\s*:[\s\S]*$/u, "")
          .trimEnd() || text;
        cache.set(text, safeTranslation);
        for (const item of missingByText.get(text) || []) staged.set(item, safeTranslation);
      });
      saveTranslationCache(requestedLanguage, cache);
    }

    // Apply only after every batch has a complete Sarvam response.
    for (const [item, translated] of staged) {
      if (language !== requestedLanguage) return false;
      if (item.node?.isConnected) setText(item.node, `${item.leading || ""}${translated}${item.trailing || ""}`, requestedLanguage);
      else if (item.element?.isConnected) setAttribute(item.element, item.attribute, translated, requestedLanguage);
    }
    return true;
  }

  async function scan() {
    if (wholePageActive) {
      scanAgain = true;
      return;
    }
    if (busy) {
      scanAgain = true;
      return;
    }
    busy = true;
    const requestedLanguage = language;
    try {
      if (requestedLanguage === "en") collect();
      else await translateWork(collect(), requestedLanguage);
    } finally {
      busy = false;
      if (scanAgain) {
        scanAgain = false;
        scheduleScan();
      }
    }
  }

  function scheduleScan() {
    if (wholePageActive) {
      scanAgain = true;
      return;
    }
    clearTimeout(scanTimer);
    scanTimer = setTimeout(scan, 120);
  }

  function refreshLanguage() {
    language = localStorage.getItem("sehat_saathi_lang") || "hi";
    wholePageActive = true;
    clearTimeout(scanTimer);
  }

  function refreshTranslations() {
    language = localStorage.getItem("sehat_saathi_lang") || "hi";
    scheduleScan();
  }

  const observer = new MutationObserver(scheduleScan);
  observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRIBUTES_TO_TRANSLATE });
  window.addEventListener("sehat-saathi-translations-updated", refreshTranslations);
  window.addEventListener("sehat-saathi-language-changed", refreshLanguage);
  async function translatePage(targetLanguage) {
    language = targetLanguage || "en";
    wholePageActive = true;
    clearTimeout(scanTimer);
    reportTranslationJob(true);
    try {
      for (let round = 0; round < 8; round++) {
        scanAgain = false;
        const work = language === "en" ? [] : collect();
        if (work.length && !(await translateWork(work, language))) return false;
        if (language === "en") collect();

        // Wait for observer notifications and React updates, then translate any
        // text mounted while Sarvam was working before revealing the page.
        await new Promise(resolve => setTimeout(resolve, 180));
        if (language === "en") {
          if (!scanAgain) return true;
        } else if (!scanAgain && collect().length === 0) {
          return true;
        }
      }
      return false;
    } finally {
      reportTranslationJob(false);
      wholePageActive = false;
      if (scanAgain) scheduleScan();
    }
  };

  return {
    setLanguage: refreshLanguage,
    translatePage,
    dispose() {
      observer.disconnect();
      window.removeEventListener("sehat-saathi-translations-updated", refreshTranslations);
      window.removeEventListener("sehat-saathi-language-changed", refreshLanguage);
      clearTimeout(scanTimer);
    },
  };
}
