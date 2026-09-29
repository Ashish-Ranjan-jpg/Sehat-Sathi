import { API_BASE } from "./api.js";

const TEXT_TAGS_TO_SKIP = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "CODE", "PRE", "SVG"]);
const ATTRIBUTES_TO_TRANSLATE = ["placeholder", "title", "aria-label", "alt"];

/** Translate rendered React text through Sarvam, including components absent from i18n. */
export function startSarvamPageTranslator() {
  if (typeof window === "undefined" || !document.body) return () => {};

  const originals = new WeakMap();
  const lastApplied = new WeakMap();
  const appliedLanguage = new WeakMap();
  const attributeOriginals = new WeakMap();
  const attributeLastApplied = new WeakMap();
  const attributeAppliedLanguage = new WeakMap();
  let language = localStorage.getItem("sehat_saathi_lang") || "hi";
  let scanTimer = null;
  let busy = false;
  let scanAgain = false;

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

  function collect() {
    const work = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const parent = node.parentElement;
      if (!parent || TEXT_TAGS_TO_SKIP.has(parent.tagName) || parent.closest("[data-sarvam-skip],script,style,noscript,[contenteditable='true']")) continue;
      const current = node.nodeValue || "";
      if (!current.trim()) continue;
      let original = originals.get(node);
      const last = lastApplied.get(node);
      if (original === undefined || (last !== undefined && current !== last)) {
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
      if (element.closest("[data-sarvam-skip],[contenteditable='true']")) continue;
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
        if (original === undefined || (applied[name] !== undefined && current !== applied[name])) {
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
    // Keep each browser request modest. The backend packs actual Sarvam calls
    // under the provider's 2,000 character limit and caches each source string.
    for (let offset = 0; offset < work.length; offset += 50) {
      if (language !== requestedLanguage) return;
      const group = work.slice(offset, offset + 50);
      const texts = {};
      group.forEach((item, index) => { texts[`page_${offset + index}`] = item.text; });
      try {
        const response = await fetch(`${API_BASE.replace(/\/+$/, "")}/api/translate-ui`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ target_lang: requestedLanguage, texts }),
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const result = await response.json();
        if (!result.translations) continue;
        group.forEach((item, index) => {
          if (language !== requestedLanguage) return;
          const translated = result.translations[`page_${offset + index}`];
          if (typeof translated !== "string" || !translated.trim()) return;
          if (item.node?.isConnected) setText(item.node, `${item.leading || ""}${translated}${item.trailing || ""}`, requestedLanguage);
          else if (item.element?.isConnected) setAttribute(item.element, item.attribute, translated, requestedLanguage);
        });
      } catch (error) {
        console.warn("[Sarvam page translation] Could not translate a rendered text batch:", error);
        return;
      }
    }
  }

  async function scan() {
    if (busy) {
      scanAgain = true;
      return;
    }
    busy = true;
    const requestedLanguage = language;
    try {
      if (requestedLanguage !== "en") await translateWork(collect(), requestedLanguage);
      else collect();
    } finally {
      busy = false;
      if (scanAgain) {
        scanAgain = false;
        scheduleScan();
      }
    }
  }

  function scheduleScan() {
    clearTimeout(scanTimer);
    scanTimer = setTimeout(scan, 120);
  }

  function refreshLanguage() {
    language = localStorage.getItem("sehat_saathi_lang") || "hi";
    scheduleScan();
  }

  const observer = new MutationObserver(scheduleScan);
  observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRIBUTES_TO_TRANSLATE });
  window.addEventListener("sehat-saathi-translations-updated", refreshLanguage);
  window.addEventListener("sehat-saathi-language-changed", refreshLanguage);
  scheduleScan();

  return () => {
    observer.disconnect();
    window.removeEventListener("sehat-saathi-translations-updated", refreshLanguage);
    window.removeEventListener("sehat-saathi-language-changed", refreshLanguage);
    clearTimeout(scanTimer);
  };
}
