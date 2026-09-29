import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const frontendDir = path.resolve(scriptDir, "..");
const rootDir = path.resolve(frontendDir, "..");
const sourcePath = path.join(frontendDir, "src", "i18n.js");
const stringsPath = path.join(frontendDir, "src", "i18n_app_strings.js");
const outputDir = path.join(frontendDir, "src", "locales");
const envPath = path.join(rootDir, ".env");
const targets = ["bn", "ta", "te", "mr", "gu", "kn", "pa", "ur"];
const languageCodes = {
  bn: "bn-IN", ta: "ta-IN", te: "te-IN", mr: "mr-IN",
  gu: "gu-IN", kn: "kn-IN", pa: "pa-IN", ur: "ur-IN",
};

function readSarvamKey() {
  const line = fs.readFileSync(envPath, "utf8").split(/\r?\n/)
    .find((entry) => /^\s*SARVAM_API_KEY\s*=/.test(entry));
  const key = line?.slice(line.indexOf("=") + 1).trim().replace(/^['"]|['"]$/g, "");
  if (!key) throw new Error("SARVAM_API_KEY is missing from .env");
  return key;
}

function parseObjectLiteral(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end < 0) throw new Error(`Could not locate ${startMarker}`);
  const body = source.slice(start + startMarker.length, end);
  const entries = {};
  const entryPattern = /^\s*(["'])(.*?)\1\s*:\s*(["'])((?:[^\\]|\\.)*?)\3\s*,?\s*$/gm;
  for (const match of body.matchAll(entryPattern)) {
    const key = JSON.parse(`"${match[2].replaceAll('"', '\\"')}"`);
    const value = JSON.parse(`"${match[4].replaceAll('"', '\\"')}"`);
    entries[key] = value;
  }
  return entries;
}

function parseAppStrings() {
  const source = fs.readFileSync(stringsPath, "utf8");
  const start = source.indexOf("[", source.indexOf("export const appUiStrings"));
  const end = source.indexOf("];", start);
  if (start < 0 || end < 0) throw new Error("Could not locate appUiStrings array");
  const strings = [];
  const pattern = /"((?:[^"\\]|\\.)*)"\s*,?/g;
  for (const match of source.slice(start + 1, end).matchAll(pattern)) {
    strings.push(JSON.parse(`"${match[1]}"`));
  }
  return strings;
}

function getSourceEntries() {
  const source = fs.readFileSync(sourcePath, "latin1");
  const english = parseObjectLiteral(source, "  en: {", "\n  hi: {");
  for (const text of parseAppStrings()) english[text] = text;
  return Object.entries(english).filter(([, value]) => value.trim());
}

function readExisting(locale) {
  const file = path.join(outputDir, `${locale}.json`);
  try {
    const dictionary = JSON.parse(fs.readFileSync(file, "utf8"));
    let changed = false;
    for (const [key, value] of Object.entries(dictionary)) {
      if (typeof value !== "string") continue;
      const markerAt = value.search(/\sSSAT\d{5,6}END\s*:/);
      if (markerAt >= 0) {
        dictionary[key] = value.slice(0, markerAt).trimEnd();
        changed = true;
      }
    }
    if (changed) fs.writeFileSync(file, `${JSON.stringify(dictionary, null, 2)}\n`, "utf8");
    return dictionary;
  }
  catch { return {}; }
}

function writeLocale(locale, dictionary) {
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(path.join(outputDir, `${locale}.json`), `${JSON.stringify(dictionary, null, 2)}\n`, "utf8");
}

function makeBatches(entries) {
  const batches = [];
  let batch = [];
  let size = 0;
  for (const entry of entries) {
    const rowSize = entry[1].length + 22;
    if (batch.length && size + rowSize > 1800) {
      batches.push(batch);
      batch = [];
      size = 0;
    }
    batch.push(entry);
    size += rowSize;
  }
  if (batch.length) batches.push(batch);
  return batches;
}

async function translateBatch(batch, locale, apiKey) {
  const input = batch.map(([key, text], index) => `SSAT${String(index).padStart(5, "0")}END: ${text.replace(/\s+/g, " ").trim()}`).join("\n");
  for (let attempt = 0; attempt < 5; attempt += 1) {
    if (attempt) await new Promise((resolve) => setTimeout(resolve, Math.min(30_000, 1000 * (2 ** attempt))));
    const response = await fetch("https://api.sarvam.ai/translate", {
      method: "POST",
      headers: { "api-subscription-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        input,
        source_language_code: "en-IN",
        target_language_code: languageCodes[locale],
        model: "sarvam-translate:v1",
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if ((response.status === 429 || response.status === 503) && attempt < 4) {
      const retryAfter = Number(response.headers.get("retry-after")) || (2 ** attempt);
      await new Promise((resolve) => setTimeout(resolve, Math.min(30_000, retryAfter * 1000)));
      continue;
    }
    if (!response.ok || !payload.translated_text) {
      throw new Error(`Sarvam request failed for ${locale} (HTTP ${response.status})`);
    }
    const text = payload.translated_text;
    // Sarvam may normalize five-digit markers to six digits after item 9.
    const markers = [...text.matchAll(/SSAT(\d{5,6})END/g)];
    const translated = {};
    markers.forEach((marker, index) => {
      const originalIndex = Number(marker[1]);
      const nextStart = markers[index + 1]?.index ?? text.length;
      const result = text.slice(marker.index + marker[0].length, nextStart).trim().replace(/^[:;|–-]\s*/, "");
      if (batch[originalIndex] && result) translated[batch[originalIndex][0]] = result;
    });
    return translated;
  }
  throw new Error(`Sarvam retries exhausted for ${locale}`);
}

async function main() {
  const apiKey = readSarvamKey();
  const entries = getSourceEntries();
  const batches = makeBatches(entries);
  console.log(`Generating ${entries.length} source strings across ${targets.length} locales (${batches.length} batches per locale).`);
  for (const locale of targets) {
    const dictionary = readExisting(locale);
    const missing = entries.filter(([key]) => typeof dictionary[key] !== "string");
    const pendingBatches = makeBatches(missing);
    console.log(`${locale}: ${Object.keys(dictionary).length} present, ${missing.length} remaining.`);
    for (let index = 0; index < pendingBatches.length; index += 1) {
      let outstanding = pendingBatches[index];
      for (let retry = 0; outstanding.length && retry < 4; retry += 1) {
        const translated = await translateBatch(outstanding, locale, apiKey);
        Object.assign(dictionary, translated);
        outstanding = outstanding.filter(([key]) => typeof dictionary[key] !== "string");
        if (outstanding.length) await new Promise((resolve) => setTimeout(resolve, 1050));
      }
      writeLocale(locale, dictionary);
      console.log(`${locale}: batch ${index + 1}/${pendingBatches.length}, ${Object.keys(dictionary).length}/${entries.length} entries.`);
      if (outstanding.length) {
        throw new Error(`${locale} batch ${index + 1} is still missing ${outstanding.length} strings; rerun to resume.`);
      }
      await new Promise((resolve) => setTimeout(resolve, 1050));
    }
    writeLocale(locale, dictionary);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
