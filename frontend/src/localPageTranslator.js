import { translations } from "./i18n.js";

const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "CODE", "PRE", "SVG"]);
const TEXT_ATTRIBUTES = ["placeholder", "title", "aria-label", "alt"];

/** Apply local dictionary entries to rendered text and labels across every mounted route. */
export function startLocalPageTranslator() {
  if (typeof window === "undefined" || !document.body) {
    return { setLanguage() {}, async translatePage() { return true; }, dispose() {} };
  }

  const originalText = new WeakMap();
  const appliedText = new WeakMap();
  const originalAttributes = new WeakMap();
  const appliedAttributes = new WeakMap();
  let language = localStorage.getItem("sehat_saathi_lang") || "hi";
  let timer;
  let scanning = false;
  let scanAgain = false;

  function sourceFor(languageCode, text) {
    const dictionary = translations[languageCode];
    if (!dictionary) return text;
    for (const [key, localized] of Object.entries(dictionary)) {
      if (typeof localized !== "string" || localized.trim() !== text.trim()) continue;
      const source = translations.en[key];
      if (typeof source === "string") return source;
    }
    return text;
  }

  function localized(source, languageCode) {
    const dictionary = translations[languageCode] || translations.en;
    const key = translations.en[source] === source ? source : Object.keys(translations.en).find((item) => translations.en[item] === source);
    return key && typeof dictionary[key] === "string" ? dictionary[key] : source;
  }

  function visible(element) {
    if (!element || element.closest("[hidden],[aria-hidden='true'],[data-local-translate-skip]")) return false;
    const style = window.getComputedStyle(element);
    return style.display !== "none" && style.visibility !== "hidden" && element.getClientRects().length > 0;
  }

  function scan() {
    if (scanning) { scanAgain = true; return; }
    scanning = true;
    try {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode())) {
        const parent = node.parentElement;
        if (!parent || SKIP_TAGS.has(parent.tagName) || parent.closest("script,style,noscript,[contenteditable='true']") || !visible(parent)) continue;
        const current = node.nodeValue || "";
        if (!current.trim()) continue;
        let source = originalText.get(node);
        const last = appliedText.get(node);
        if (source === undefined || (last !== undefined && current !== last)) {
          const leading = current.match(/^\s*/)?.[0] || "";
          const trailing = current.match(/\s*$/)?.[0] || "";
          const body = current.slice(leading.length, current.length - trailing.length || undefined);
          source = `${leading}${sourceFor(language, body)}${trailing}`;
          originalText.set(node, source);
        }
        const leading = source.match(/^\s*/)?.[0] || "";
        const trailing = source.match(/\s*$/)?.[0] || "";
        const body = source.slice(leading.length, source.length - trailing.length || undefined);
        const value = `${leading}${localized(body, language)}${trailing}`;
        if (value !== current) node.nodeValue = value;
        appliedText.set(node, value);
      }

      for (const element of document.body.querySelectorAll("input,textarea,button,[title],[aria-label],[alt]")) {
        if (element.closest("[contenteditable='true']") || !visible(element)) continue;
        let originals = originalAttributes.get(element);
        if (!originals) { originals = {}; originalAttributes.set(element, originals); }
        let applied = appliedAttributes.get(element);
        if (!applied) { applied = {}; appliedAttributes.set(element, applied); }
        for (const name of TEXT_ATTRIBUTES) {
          if (!element.hasAttribute(name)) continue;
          const current = element.getAttribute(name) || "";
          if (!current.trim()) continue;
          if (originals[name] === undefined || (applied[name] !== undefined && current !== applied[name])) {
            originals[name] = sourceFor(language, current);
          }
          const value = localized(originals[name], language);
          if (value !== current) element.setAttribute(name, value);
          applied[name] = value;
        }
      }
    } finally {
      scanning = false;
      if (scanAgain) { scanAgain = false; scheduleScan(); }
    }
  }

  function scheduleScan() {
    clearTimeout(timer);
    timer = setTimeout(scan, 0);
  }

  function setLanguage() {
    language = localStorage.getItem("sehat_saathi_lang") || "hi";
    scheduleScan();
  }

  const observer = new MutationObserver(scheduleScan);
  observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: TEXT_ATTRIBUTES });
  window.addEventListener("sehat-saathi-language-changed", setLanguage);

  return {
    setLanguage,
    async translatePage(targetLanguage) {
      language = targetLanguage || "en";
      scan();
      return true;
    },
    dispose() {
      observer.disconnect();
      window.removeEventListener("sehat-saathi-language-changed", setLanguage);
      clearTimeout(timer);
    },
  };
}
