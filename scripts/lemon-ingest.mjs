#!/usr/bin/env node

/**
 * lemon-ingest — Bulk Screenplay Analyzer for Lemon Studios
 *
 * Analyzes a folder of PDF screenplays through Anthropic's Claude API,
 * saves results to Firestore + local JSON backup, supports pause/resume,
 * and generates a markdown summary report.
 *
 * Usage:
 *   node scripts/lemon-ingest.mjs <folder> [options]
 *
 * Options:
 *   --model <model>       sonnet (default), haiku, opus, hybrid
 *   --category <name>     Override all categories to one label
 *   --api-key <key>       Anthropic API key (skips interactive prompt)
 *   --dry-run             Estimate cost/time without processing
 *   --resume              Resume interrupted run
 */

import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

// ─────────────────────────────────────────────────────────────────────────────
// 1. CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const MODEL_IDS = {
  sonnet: 'claude-sonnet-4-5-20250929',
  haiku: 'claude-haiku-4-5-20251001',
  opus: 'claude-opus-4-6',
};

const MODEL_COSTS = {
  haiku:  { input: 0.001, output: 0.005, perScript: 0.06 },
  sonnet: { input: 0.003, output: 0.015, perScript: 0.22 },
  opus:   { input: 0.015, output: 0.075, perScript: 0.90 },
};

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const MAX_TOKENS = 16000;
const MAX_TEXT_CHARS = 150_000;
const MAX_RETRIES = 3;
const RETRY_BASE_SECONDS = 5;
const RETRYABLE_STATUS = new Set([429, 500, 502, 503]);
const NON_RETRYABLE_STATUS = new Set([400, 401, 413]);
const STATE_FILENAME = '.lemon-ingest-state.json';

const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyBN_JWOlHSeu5nbcqY47fkY-9NDd2lIA00',
  authDomain: 'lemon-screenplay-dashboard.firebaseapp.com',
  projectId: 'lemon-screenplay-dashboard',
  storageBucket: 'lemon-screenplay-dashboard.firebasestorage.app',
  messagingSenderId: '493694843892',
  appId: '1:493694843892:web:a31ae16c08191ff25797a1',
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

// ─────────────────────────────────────────────────────────────────────────────
// 2. UTILITY FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

function toDocId(sourceFile) {
  return (
    sourceFile
      .replace(/[/\\]/g, '_')
      .replace(/[^a-zA-Z0-9_\-. ]/g, '')
      .trim()
      .replace(/\s+/g, '_')
      .slice(0, 200) || `doc_${Date.now()}`
  );
}

function extractJSON(text) {
  const startIdx = text.indexOf('{');
  if (startIdx === -1) throw new Error('No JSON found in response');
  let depth = 0;
  let endIdx = -1;
  let inString = false;
  let escape = false;
  for (let i = startIdx; i < text.length; i++) {
    const ch = text[i];
    if (escape) { escape = false; continue; }
    if (ch === '\\' && inString) { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) { endIdx = i; break; }
    }
  }
  if (endIdx === -1) throw new Error('Incomplete JSON in response');
  return JSON.parse(text.slice(startIdx, endIdx + 1));
}

function maskKey(key) {
  if (!key || key.length < 10) return '***';
  return key.slice(0, 7) + '****...' + key.slice(-6);
}

function formatDuration(ms) {
  const totalSeconds = Math.round(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h${String(minutes).padStart(2, '0')}m${String(seconds).padStart(2, '0')}s`;
  if (minutes > 0) return `${minutes}m${String(seconds).padStart(2, '0')}s`;
  return `${seconds}s`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function titleFromFilename(filename) {
  return path.basename(filename, path.extname(filename)).replace(/[_-]+/g, ' ').trim();
}

function padRight(str, len) {
  if (str.length >= len) return str.slice(0, len);
  return str + ' '.repeat(len - str.length);
}

function padLeft(str, len) {
  const s = String(str);
  if (s.length >= len) return s;
  return ' '.repeat(len - s.length) + s;
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. PDF PARSING (Node.js with pdfjs-dist)
// ─────────────────────────────────────────────────────────────────────────────

let pdfjsLib = null;

async function initPdfJs() {
  if (pdfjsLib) return;
  pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
}

async function parsePDF(filePath) {
  await initPdfJs();
  const data = new Uint8Array(fs.readFileSync(filePath));
  const doc = await pdfjsLib.getDocument({ data, useSystemFonts: true }).promise;
  const pageCount = doc.numPages;
  const textParts = [];

  for (let i = 1; i <= pageCount; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items.map((item) => item.str).join(' ');
    textParts.push(pageText);
  }

  let fullText = textParts.join('\n\n');
  if (fullText.length > MAX_TEXT_CHARS) {
    fullText = fullText.slice(0, MAX_TEXT_CHARS);
  }

  const wordCount = fullText.split(/\s+/).filter(Boolean).length;

  return { text: fullText, pageCount, wordCount };
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. PROMPT LOADING (from functions/src/prompts.ts)
// ─────────────────────────────────────────────────────────────────────────────

function loadPrompts() {
  const promptsPath = path.join(PROJECT_ROOT, 'functions', 'src', 'prompts.ts');
  if (!fs.existsSync(promptsPath)) {
    throw new Error(`Prompts file not found at ${promptsPath}`);
  }
  const source = fs.readFileSync(promptsPath, 'utf-8');

  function extractTemplateConst(name) {
    // Match: export const NAME = `...`;
    const regex = new RegExp(`export\\s+const\\s+${name}\\s*=\\s*\`([\\s\\S]*?)\`;`, 'm');
    const match = source.match(regex);
    if (!match) throw new Error(`Could not extract ${name} from prompts.ts`);
    return match[1];
  }

  const coreQualityPrompt = extractTemplateConst('CORE_QUALITY_PROMPT');
  const commercialLens = extractTemplateConst('COMMERCIAL_LENS_PROMPT');
  const latamLens = extractTemplateConst('LATAM_LENS_PROMPT');
  const productionLens = extractTemplateConst('PRODUCTION_READINESS_LENS_PROMPT');
  const coproductionLens = extractTemplateConst('COPRODUCTION_LENS_PROMPT');

  return { coreQualityPrompt, commercialLens, latamLens, productionLens, coproductionLens };
}

function buildPrompt(prompts, text, metadata, lenses) {
  let prompt = prompts.coreQualityPrompt
    .replace('{title}', metadata.title)
    .replace('{page_count}', String(metadata.pageCount))
    .replace('{word_count}', String(metadata.wordCount))
    .replace('{text}', text);

  const lensMap = {
    latam: prompts.latamLens,
    commercial: prompts.commercialLens,
    production: prompts.productionLens,
    coproduction: prompts.coproductionLens,
  };

  const lensPrompts = lenses.map((l) => lensMap[l]).filter(Boolean);

  if (lensPrompts.length > 0) {
    prompt += '\n\n' + '='.repeat(79) + '\n';
    prompt += '                    OPTIONAL LENSES (Include in output)\n';
    prompt += '='.repeat(79) + '\n';
    prompt += lensPrompts.join('\n');
    prompt += `\n\nAdd a "lenses" object to your JSON output with the following structure.\n`;
    prompt += `For each lens NOT enabled, include it as: "lens_name": { "enabled": false }\n\n`;
    prompt += `"lenses": {\n`;
    prompt += `    "latam_market": { "enabled": ${lenses.includes('latam')}, ... },\n`;
    prompt += `    "commercial_viability": { "enabled": ${lenses.includes('commercial')}, ... },\n`;
    prompt += `    "production_readiness": { "enabled": ${lenses.includes('production')}, ... },\n`;
    prompt += `    "coproduction": { "enabled": ${lenses.includes('coproduction')} }\n`;
    prompt += `}\n`;
  } else {
    prompt += `\n\nAdd an empty "lenses" object to your JSON output:\n\n`;
    prompt += `"lenses": {\n`;
    prompt += `    "latam_market": { "enabled": false },\n`;
    prompt += `    "commercial_viability": { "enabled": false },\n`;
    prompt += `    "production_readiness": { "enabled": false },\n`;
    prompt += `    "coproduction": { "enabled": false }\n`;
    prompt += `}\n`;
  }

  return prompt;
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. ANTHROPIC API CLIENT
// ─────────────────────────────────────────────────────────────────────────────

async function callAnthropic(apiKey, modelName, prompt) {
  const modelId = MODEL_IDS[modelName];
  if (!modelId) throw new Error(`Unknown model: ${modelName}`);

  const body = JSON.stringify({
    model: modelId,
    max_tokens: MAX_TOKENS,
    messages: [{ role: 'user', content: prompt }],
  });

  let lastError = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      const delayMs = RETRY_BASE_SECONDS * Math.pow(3, attempt - 1) * 1000;
      process.stdout.write(`  Retry ${attempt}/${MAX_RETRIES} in ${delayMs / 1000}s...`);
      await sleep(delayMs);
    }

    try {
      const response = await fetch(ANTHROPIC_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': ANTHROPIC_VERSION,
        },
        body,
      });

      if (!response.ok) {
        const status = response.status;
        const errorText = await response.text().catch(() => '');

        if (NON_RETRYABLE_STATUS.has(status)) {
          throw new Error(`API error ${status} (non-retryable): ${errorText.slice(0, 200)}`);
        }

        if (RETRYABLE_STATUS.has(status) && attempt < MAX_RETRIES) {
          lastError = new Error(`API error ${status}: ${errorText.slice(0, 200)}`);
          continue;
        }

        throw new Error(`API error ${status}: ${errorText.slice(0, 200)}`);
      }

      const data = await response.json();
      const text = data.content?.[0]?.text;
      if (!text) throw new Error('Empty response from API');

      const inputTokens = data.usage?.input_tokens || 0;
      const outputTokens = data.usage?.output_tokens || 0;

      return { text, inputTokens, outputTokens };
    } catch (err) {
      if (err.message.includes('non-retryable')) throw err;

      lastError = err;
      if (attempt >= MAX_RETRIES) break;

      // Network error — retryable
      if (err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT' || err.cause) {
        continue;
      }

      // If it's an error we just created from HTTP status, retry logic already handled
      if (err.message.startsWith('API error')) {
        if (attempt >= MAX_RETRIES) throw err;
        continue;
      }

      throw err;
    }
  }

  throw lastError || new Error('All retries exhausted');
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. FIREBASE CLIENT
// ─────────────────────────────────────────────────────────────────────────────

let firebaseApp = null;
let firestoreDb = null;
let firebaseStorage = null;
let firebaseInitialized = false;

async function initFirebase() {
  if (firebaseInitialized) return;

  try {
    const { initializeApp } = await import('firebase/app');
    const { getFirestore } = await import('firebase/firestore');
    const { getAuth, signInAnonymously } = await import('firebase/auth');
    const { getStorage } = await import('firebase/storage');

    firebaseApp = initializeApp(FIREBASE_CONFIG);
    firestoreDb = getFirestore(firebaseApp);
    firebaseStorage = getStorage(firebaseApp);

    const auth = getAuth(firebaseApp);
    await signInAnonymously(auth);

    firebaseInitialized = true;
    return true;
  } catch (err) {
    console.error(`\n  Warning: Firebase init failed — ${err.message}`);
    console.error('  Results will be saved to local JSON only.\n');
    return false;
  }
}

async function saveToFirestore(docId, analysisData) {
  if (!firebaseInitialized) return false;
  try {
    const { doc, setDoc } = await import('firebase/firestore');
    await setDoc(doc(firestoreDb, 'uploaded_analyses', docId), analysisData);
    return true;
  } catch (err) {
    console.error(`  Firestore save failed for ${docId}: ${err.message}`);
    return false;
  }
}

async function uploadPdf(category, safeName, filePath) {
  if (!firebaseInitialized) return false;
  try {
    const { ref, uploadBytes } = await import('firebase/storage');
    const buffer = fs.readFileSync(filePath);
    const storageRef = ref(firebaseStorage, `screenplays/${category}/${safeName}.pdf`);
    await uploadBytes(storageRef, buffer);
    return true;
  } catch (err) {
    console.error(`  PDF upload failed for ${safeName}: ${err.message}`);
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. STATE MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────

function statePath(folder) {
  return path.join(folder, STATE_FILENAME);
}

function loadState(folder) {
  const sp = statePath(folder);
  if (fs.existsSync(sp)) {
    try {
      return JSON.parse(fs.readFileSync(sp, 'utf-8'));
    } catch {
      return null;
    }
  }
  return null;
}

function saveState(folder, state) {
  fs.writeFileSync(statePath(folder), JSON.stringify(state, null, 2), 'utf-8');
}

function createFreshState(model) {
  return {
    model,
    startedAt: new Date().toISOString(),
    completed: {},
    failed: {},
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. FOLDER SCANNING
// ─────────────────────────────────────────────────────────────────────────────

function scanFolder(folder, categoryOverride) {
  const results = [];
  const folderName = path.basename(folder).toUpperCase();

  function scan(dir, category) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        const subCategory = categoryOverride || entry.name.toUpperCase();
        scan(fullPath, subCategory);
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.pdf')) {
        results.push({
          filePath: fullPath,
          filename: entry.name,
          category: categoryOverride || category,
          title: titleFromFilename(entry.name),
        });
      }
    }
  }

  scan(folder, categoryOverride || folderName);
  return results.sort((a, b) => a.filename.localeCompare(b.filename));
}

// ─────────────────────────────────────────────────────────────────────────────
// 9. DRY RUN / COST ESTIMATION
// ─────────────────────────────────────────────────────────────────────────────

async function estimateCosts(scripts, model) {
  let totalPages = 0;

  // Quick page count scan — parse just enough to get page count
  await initPdfJs();
  for (const script of scripts) {
    try {
      const data = new Uint8Array(fs.readFileSync(script.filePath));
      const doc = await pdfjsLib.getDocument({ data, useSystemFonts: true }).promise;
      script.pageCount = doc.numPages;
      totalPages += doc.numPages;
    } catch {
      script.pageCount = 0;
    }
  }

  const count = scripts.length;
  let costLow, costHigh, timeEstimate;

  if (model === 'hybrid') {
    // Best case: all PASS at sonnet level; worst case: ~25% promoted to opus
    const sonnetCost = count * MODEL_COSTS.sonnet.perScript;
    const promotionRate = 0.25;
    const opusExtra = count * promotionRate * MODEL_COSTS.opus.perScript;
    costLow = sonnetCost;
    costHigh = sonnetCost + opusExtra;
    // Sonnet ~2min/script, promoted scripts add ~4min extra
    const baseMinutes = count * 2;
    const extraMinutes = count * promotionRate * 4;
    timeEstimate = (baseMinutes + extraMinutes) * 60 * 1000;
  } else {
    const costs = MODEL_COSTS[model];
    costLow = count * costs.perScript * 0.7;
    costHigh = count * costs.perScript * 1.3;
    const minPerScript = model === 'opus' ? 4 : model === 'sonnet' ? 2 : 1;
    timeEstimate = count * minPerScript * 60 * 1000;
  }

  return {
    count,
    totalPages,
    costLow: costLow.toFixed(0),
    costHigh: costHigh.toFixed(0),
    timeEstimate: formatDuration(timeEstimate),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 10. PROCESSING
// ─────────────────────────────────────────────────────────────────────────────

async function processScript(script, apiKey, model, prompts, lenses) {
  const start = Date.now();

  // Parse PDF
  const { text, pageCount, wordCount } = await parsePDF(script.filePath);
  script.pageCount = pageCount;
  script.wordCount = wordCount;

  // Build prompt
  const prompt = buildPrompt(prompts, text, {
    title: script.title,
    pageCount,
    wordCount,
  }, lenses);

  let finalModel = model === 'hybrid' ? 'sonnet' : model;
  let result = await callAnthropic(apiKey, finalModel, prompt);
  let analysis = extractJSON(result.text);

  let promoted = false;
  let sonnetCost = null;

  // Hybrid: check verdict, promote to opus if recommended
  if (model === 'hybrid') {
    const verdict = analysis?.core_quality?.verdict || '';
    const verdictLower = verdict.toLowerCase();
    if (verdictLower.includes('recommend') || verdictLower.includes('film_now') || verdictLower.includes('film now')) {
      sonnetCost = calculateCost('sonnet', result.inputTokens, result.outputTokens);
      // Re-analyze with Opus
      result = await callAnthropic(apiKey, 'opus', prompt);
      analysis = extractJSON(result.text);
      finalModel = 'opus';
      promoted = true;
    }
  }

  const cost = calculateCost(
    finalModel === 'opus' && model === 'hybrid' ? 'opus' : (model === 'hybrid' ? 'sonnet' : model),
    result.inputTokens,
    result.outputTokens
  );
  const totalCost = promoted ? cost + sonnetCost : cost;

  const elapsed = Date.now() - start;

  // Build V6 wrapper
  const sourceFile = script.title.replace(/[^a-zA-Z0-9]/g, '_') + '.pdf';
  const docId = toDocId(sourceFile);
  const wrapped = {
    source_file: sourceFile,
    analysis_model: `claude-${finalModel}`,
    analysis_version: 'v6_unified',
    lenses_enabled: lenses,
    metadata: {
      filename: script.title + '.pdf',
      page_count: pageCount,
      word_count: wordCount,
    },
    analysis,
    collection: script.category,
    _savedAt: new Date().toISOString(),
    _docId: docId,
  };

  // Save to Firestore
  await saveToFirestore(docId, wrapped);

  // Upload PDF to storage
  const safeName = script.title.replace(/[^a-zA-Z0-9_\- ]/g, '').replace(/\s+/g, '_');
  await uploadPdf(script.category, safeName, script.filePath);

  // Save local JSON backup
  const jsonDir = path.join(path.dirname(script.filePath), '.lemon-ingest-output');
  if (!fs.existsSync(jsonDir)) fs.mkdirSync(jsonDir, { recursive: true });
  const jsonPath = path.join(jsonDir, `${safeName}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(wrapped, null, 2), 'utf-8');

  const weightedScore = analysis?.core_quality?.weighted_score ?? null;
  const verdict = analysis?.core_quality?.verdict ?? 'UNKNOWN';

  return {
    docId,
    verdict,
    weightedScore,
    cost: totalCost,
    promoted,
    elapsed,
    model: finalModel,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
    title: analysis?.title || script.title,
  };
}

function calculateCost(model, inputTokens, outputTokens) {
  const costs = MODEL_COSTS[model];
  if (!costs) return 0;
  return (inputTokens / 1_000_000) * costs.input + (outputTokens / 1_000_000) * costs.output;
}

async function processQueue(scripts, apiKey, model, prompts, folder, state, lenses) {
  const total = scripts.length;
  const results = [];
  let processedCount = Object.keys(state.completed).length;

  for (let i = 0; i < total; i++) {
    const script = scripts[i];
    const idx = i + 1;
    const label = padLeft(idx, String(total).length);

    // Skip completed
    if (state.completed[script.filename]) {
      continue;
    }

    const displayTitle = `"${script.title}"`;
    const truncTitle = padRight(displayTitle, 30);

    try {
      const result = await processScript(script, apiKey, model, prompts, lenses);
      processedCount++;

      state.completed[script.filename] = {
        apiKey: maskKey(apiKey),
        cost: result.cost,
        verdict: result.verdict,
        weightedScore: result.weightedScore,
        promoted: result.promoted,
      };
      delete state.failed[script.filename];
      saveState(folder, state);

      const verdictIcon = result.verdict === 'PASS' ? '\u2713'
        : (result.verdict === 'CONSIDER' ? '\u2713'
        : (result.promoted ? '\u2605' : '\u2713'));
      const promotedTag = result.promoted ? ' [promoted]' : '';
      const costStr = `$${result.cost.toFixed(2)}`;
      const duration = formatDuration(result.elapsed);

      const verdictColor = result.verdict === 'PASS' ? '\x1b[90m'       // dim
        : result.verdict === 'CONSIDER' ? '\x1b[33m'                     // yellow
        : result.verdict === 'RECOMMEND' ? '\x1b[32m'                    // green
        : result.verdict === 'FILM_NOW' ? '\x1b[35m'                     // magenta
        : '\x1b[0m';
      const reset = '\x1b[0m';

      const scoreStr = result.weightedScore !== null ? ` (${result.weightedScore.toFixed(1)})` : '';

      console.log(
        `[${label}/${total}] ${verdictIcon} ${truncTitle} ${verdictColor}-> ${padRight(result.verdict, 9)}${scoreStr}${reset} -- ${costStr}${promotedTag} -- ${duration}`
      );

      results.push(result);
    } catch (err) {
      const retryCount = (state.failed[script.filename]?.retries || 0) + 1;
      state.failed[script.filename] = {
        error: err.message.slice(0, 200),
        retries: retryCount,
      };
      saveState(folder, state);

      console.log(
        `[${label}/${total}] \u2717 ${truncTitle} -> FAILED (retry ${Math.min(retryCount, MAX_RETRIES)}/${MAX_RETRIES}: ${err.message.slice(0, 60)}) -- skipped`
      );
    }
  }

  return results;
}

// ─────────────────────────────────────────────────────────────────────────────
// 11. REPORT GENERATION
// ─────────────────────────────────────────────────────────────────────────────

function generateReport(folder, state, results, model, startTime, endTime) {
  const duration = formatDuration(endTime - startTime);
  const completed = Object.entries(state.completed);
  const failed = Object.entries(state.failed);
  const total = completed.length + failed.length;

  // Verdict counts
  const verdicts = {};
  let totalCost = 0;
  const apiKeyCosts = {};
  const promotions = [];
  const scored = [];

  for (const [filename, info] of completed) {
    const v = info.verdict || 'UNKNOWN';
    verdicts[v] = (verdicts[v] || 0) + 1;
    totalCost += info.cost || 0;

    const mk = info.apiKey || 'unknown';
    apiKeyCosts[mk] = (apiKeyCosts[mk] || 0) + (info.cost || 0);

    if (info.promoted) {
      promotions.push({ filename, verdict: v, score: info.weightedScore });
    }
    if (info.weightedScore != null) {
      scored.push({ filename, verdict: v, score: info.weightedScore });
    }
  }

  // Sort scored descending
  scored.sort((a, b) => b.score - a.score);
  const top10 = scored.slice(0, 10);

  // Category breakdown
  const categories = {};
  for (const [filename, info] of completed) {
    // Derive category from results or state — we'll use a simple approach
    const cat = info.category || 'UNCATEGORIZED';
    if (!categories[cat]) categories[cat] = { total: 0, verdicts: {} };
    categories[cat].total++;
    const v = info.verdict || 'UNKNOWN';
    categories[cat].verdicts[v] = (categories[cat].verdicts[v] || 0) + 1;
  }

  const lines = [];
  lines.push('# Lemon Ingest Report');
  lines.push('');
  lines.push('## Run Metadata');
  lines.push(`- **Date:** ${new Date(startTime).toISOString().split('T')[0]}`);
  lines.push(`- **Model:** ${model}`);
  lines.push(`- **Duration:** ${duration}`);
  lines.push(`- **Total scripts:** ${total}`);
  lines.push('');

  lines.push('## Results Summary');
  lines.push(`- **Processed:** ${completed.length}`);
  lines.push(`- **Failed:** ${failed.length}`);
  lines.push(`- **Total cost:** $${totalCost.toFixed(2)}`);
  lines.push('');

  lines.push('## Verdict Breakdown');
  lines.push('| Verdict | Count | Percentage |');
  lines.push('|---------|------:|------------|');
  for (const v of ['FILM_NOW', 'RECOMMEND', 'CONSIDER', 'PASS', 'UNKNOWN']) {
    const count = verdicts[v] || 0;
    if (count === 0 && v !== 'PASS') continue;
    const pct = completed.length > 0 ? ((count / completed.length) * 100).toFixed(1) : '0.0';
    lines.push(`| ${v} | ${count} | ${pct}% |`);
  }
  lines.push('');

  lines.push('## Cost Breakdown by API Key');
  lines.push('| API Key | Cost |');
  lines.push('|---------|-----:|');
  for (const [key, cost] of Object.entries(apiKeyCosts)) {
    lines.push(`| ${key} | $${cost.toFixed(2)} |`);
  }
  lines.push('');

  if (promotions.length > 0) {
    lines.push('## Hybrid Promotions (Sonnet -> Opus)');
    lines.push('| Script | Verdict | Score |');
    lines.push('|--------|---------|------:|');
    for (const p of promotions) {
      lines.push(`| ${p.filename} | ${p.verdict} | ${p.score?.toFixed(1) || 'N/A'} |`);
    }
    lines.push('');
  }

  if (top10.length > 0) {
    lines.push('## Top 10 Scripts by Weighted Score');
    lines.push('| Rank | Script | Verdict | Score |');
    lines.push('|-----:|--------|---------|------:|');
    for (let i = 0; i < top10.length; i++) {
      const s = top10[i];
      lines.push(`| ${i + 1} | ${s.filename} | ${s.verdict} | ${s.score.toFixed(1)} |`);
    }
    lines.push('');
  }

  if (failed.length > 0) {
    lines.push('## Failures');
    lines.push('| Script | Error | Retries |');
    lines.push('|--------|-------|--------:|');
    for (const [filename, info] of failed) {
      lines.push(`| ${filename} | ${info.error?.slice(0, 80) || 'unknown'} | ${info.retries || 0} |`);
    }
    lines.push('');
  }

  const reportPath = path.join(folder, 'lemon-ingest-report.md');
  fs.writeFileSync(reportPath, lines.join('\n'), 'utf-8');
  return reportPath;
}

// ─────────────────────────────────────────────────────────────────────────────
// 12. INTERACTIVE PROMPTS
// ─────────────────────────────────────────────────────────────────────────────

function createRL() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

function askQuestion(rl, question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => resolve(answer.trim()));
  });
}

async function resolveApiKey(flagKey) {
  // Priority: flag > env > interactive
  if (flagKey) return flagKey;
  if (process.env.ANTHROPIC_API_KEY) return process.env.ANTHROPIC_API_KEY;

  const rl = createRL();
  try {
    const key = await askQuestion(rl, 'Enter Anthropic API key: ');
    if (!key) {
      console.error('No API key provided. Exiting.');
      process.exit(1);
    }
    return key;
  } finally {
    rl.close();
  }
}

async function confirmProceed(estimate, model, apiKey) {
  console.log('');
  console.log(`Model: ${model} | Scripts: ${estimate.count} | Est. cost: $${estimate.costLow}-$${estimate.costHigh} | Est. time: ~${estimate.timeEstimate}`);
  console.log(`API Key: ${maskKey(apiKey)}`);

  const rl = createRL();
  try {
    const answer = await askQuestion(rl, 'Proceed? (y/n): ');
    return answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes';
  } finally {
    rl.close();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 13. ARG PARSING & MAIN
// ─────────────────────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    folder: null,
    model: 'sonnet',
    category: null,
    apiKey: null,
    dryRun: false,
    resume: false,
  };

  let i = 0;
  while (i < args.length) {
    const arg = args[i];
    if (arg === '--model' && args[i + 1]) {
      options.model = args[++i];
    } else if (arg === '--category' && args[i + 1]) {
      options.category = args[++i];
    } else if (arg === '--api-key' && args[i + 1]) {
      options.apiKey = args[++i];
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--resume') {
      options.resume = true;
    } else if (arg === '--help' || arg === '-h') {
      printUsage();
      process.exit(0);
    } else if (!arg.startsWith('--')) {
      options.folder = arg;
    } else {
      console.error(`Unknown option: ${arg}`);
      printUsage();
      process.exit(1);
    }
    i++;
  }

  if (!options.folder) {
    // No folder = interactive wizard mode
    return null;
  }

  const validModels = ['sonnet', 'haiku', 'opus', 'hybrid'];
  if (!validModels.includes(options.model)) {
    console.error(`Error: Invalid model "${options.model}". Valid: ${validModels.join(', ')}`);
    process.exit(1);
  }

  options.folder = path.resolve(options.folder);
  if (!fs.existsSync(options.folder) || !fs.statSync(options.folder).isDirectory()) {
    console.error(`Error: "${options.folder}" is not a valid directory.`);
    process.exit(1);
  }

  return options;
}

function printUsage() {
  console.log(`
Usage: node scripts/lemon-ingest.mjs <folder> [options]

Options:
  --model <model>       sonnet (default), haiku, opus, hybrid
  --category <name>     Override all categories to one label
  --api-key <key>       Anthropic API key (or set ANTHROPIC_API_KEY)
  --dry-run             Estimate cost/time without processing
  --resume              Resume interrupted run
  --help, -h            Show this help
`);
}

function printBanner() {
  console.log('');
  console.log('\x1b[33m\x1b[1m\uD83C\uDF4B lemon-ingest \u2014 Bulk Screenplay Analyzer\x1b[0m');
  console.log('\x1b[33m\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\x1b[0m');
  console.log('');
}

async function interactiveWizard() {
  const rl = createRL();
  const ask = (q) => askQuestion(rl, q);

  try {
    console.log('  Welcome! Let\'s set up your bulk analysis.\n');

    // 1. Folder
    console.log('\x1b[33m  📁 Drag a folder into this window, or type the path:\x1b[0m');
    let folder = (await ask('  > ')).trim().replace(/\\ /g, ' ').replace(/['"`]/g, '');
    if (!folder) { console.log('  No folder provided. Exiting.'); process.exit(0); }
    folder = path.resolve(folder);
    if (!fs.existsSync(folder) || !fs.statSync(folder).isDirectory()) {
      console.error(`  "${folder}" is not a valid directory.`); process.exit(1);
    }

    // 2. Model
    console.log('');
    console.log('\x1b[33m  🤖 Choose analysis model:\x1b[0m');
    console.log('     1. Sonnet 4.5    — ~$0.22/script, ~3 min  \x1b[2m(best balance)\x1b[0m');
    console.log('     2. Haiku 4.5     — ~$0.06/script, ~1 min  \x1b[2m(fast & cheap)\x1b[0m');
    console.log('     3. Opus 4.6      — ~$0.90/script, ~5 min  \x1b[2m(premium quality)\x1b[0m');
    console.log('     4. Hybrid        — $0.22–$1.12/script     \x1b[2m(Sonnet first, Opus for the best)\x1b[0m');
    const modelChoice = (await ask('  > ')).trim();
    const modelMap = { '1': 'sonnet', '2': 'haiku', '3': 'opus', '4': 'hybrid' };
    const model = modelMap[modelChoice] || 'sonnet';
    console.log(`     → ${model}`);

    // 3. Category override
    console.log('');
    console.log('\x1b[33m  🏷️  Category override \x1b[2m(press Enter to use folder names as categories):\x1b[0m');
    const category = (await ask('  > ')).trim() || null;
    if (category) console.log(`     → All scripts will be labeled "${category}"`);
    else console.log('     → Using folder names');

    // 4. API key
    console.log('');
    const envKey = process.env.ANTHROPIC_API_KEY;
    if (envKey) {
      console.log(`\x1b[33m  🔑 Found API key: ${maskKey(envKey)}\x1b[0m`);
      const useIt = (await ask('     Use this key? (y/n): ')).trim().toLowerCase();
      if (useIt === 'n' || useIt === 'no') {
        const newKey = (await ask('     Enter new API key: ')).trim();
        if (!newKey) { console.log('  No key provided. Exiting.'); process.exit(1); }
        return { folder, model, category, apiKey: newKey, dryRun: false, resume: false };
      }
      return { folder, model, category, apiKey: envKey, dryRun: false, resume: false };
    }
    console.log('\x1b[33m  🔑 Enter your Anthropic API key:\x1b[0m');
    const apiKey = (await ask('  > ')).trim();
    if (!apiKey) { console.log('  No key provided. Exiting.'); process.exit(1); }

    return { folder, model, category, apiKey, dryRun: false, resume: false };
  } finally {
    rl.close();
  }
}

async function main() {
  printBanner();

  let options = parseArgs();

  // If no folder was given, run interactive wizard
  if (!options) {
    options = await interactiveWizard();
  }

  const { folder, model, category, dryRun, resume } = options;

  // Load prompts
  let prompts;
  try {
    prompts = loadPrompts();
  } catch (err) {
    console.error(`Failed to load prompts: ${err.message}`);
    process.exit(1);
  }

  // Scan folder
  const scripts = scanFolder(folder, category);
  if (scripts.length === 0) {
    console.error('No PDF files found in the specified folder.');
    process.exit(1);
  }

  console.log(`Found ${scripts.length} screenplay PDF(s) in: ${folder}`);

  // Cost estimation (always shown)
  const estimate = await estimateCosts(scripts, model);

  // Dry run
  if (dryRun) {
    console.log('');
    console.log(`Model: ${model} | Scripts: ${estimate.count} | Est. cost: $${estimate.costLow}-$${estimate.costHigh} | Est. time: ~${estimate.timeEstimate}`);
    console.log(`Total pages: ${estimate.totalPages}`);
    console.log('');
    console.log('Dry run complete. No scripts were processed.');
    process.exit(0);
  }

  // Resolve API key
  const apiKey = await resolveApiKey(options.apiKey);

  // Confirm
  const proceed = await confirmProceed(estimate, model, apiKey);
  if (!proceed) {
    console.log('Aborted.');
    process.exit(0);
  }

  // Initialize Firebase
  console.log('');
  process.stdout.write('Connecting to Firebase... ');
  const fbOk = await initFirebase();
  console.log(fbOk ? 'connected.' : 'offline mode (local JSON only).');

  // State management
  let state;
  if (resume) {
    state = loadState(folder);
    if (state) {
      const prevCompleted = Object.keys(state.completed).length;
      const prevFailed = Object.keys(state.failed).length;
      console.log(`Resuming: ${prevCompleted} completed, ${prevFailed} failed from previous run.`);
    } else {
      console.log('No previous state found. Starting fresh.');
      state = createFreshState(model);
    }
  } else {
    state = createFreshState(model);
  }
  saveState(folder, state);

  // Process
  const lenses = ['commercial'];
  console.log('');

  const startTime = Date.now();
  const results = await processQueue(scripts, apiKey, model, prompts, folder, state, lenses);
  const endTime = Date.now();

  // Enrich state with category for report
  for (const script of scripts) {
    if (state.completed[script.filename]) {
      state.completed[script.filename].category = script.category;
    }
  }
  saveState(folder, state);

  // Summary
  const completedCount = Object.keys(state.completed).length;
  const failedCount = Object.keys(state.failed).length;
  const totalCost = Object.values(state.completed).reduce((sum, c) => sum + (c.cost || 0), 0);

  console.log('');
  console.log('\x1b[33m\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\x1b[0m');
  console.log(`\x1b[1mDone!\x1b[0m ${completedCount} processed, ${failedCount} failed -- $${totalCost.toFixed(2)} total -- ${formatDuration(endTime - startTime)}`);

  // Generate report
  const reportPath = generateReport(folder, state, results, model, startTime, endTime);
  console.log(`Report saved: ${reportPath}`);
  console.log('');
}

main().catch((err) => {
  console.error(`\nFatal error: ${err.message}`);
  if (err.stack) console.error(err.stack);
  process.exit(1);
});
