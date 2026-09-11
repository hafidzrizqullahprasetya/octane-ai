/**
 * Alysis usage handler — Credits & usage ala website (0–50 credits).
 *
 * Sumber tarif (credits per 1 JT token, dari bundle alysiscode.com):
 *   flash / vision-exp : input miss 25 · hit 0.8 · output 75   (peak ×2)
 *   pro                : input miss 75 · hit 2.5 · output 225  (peak ×2)
 *   v4.1-flash-*       : = flash (snapshot; tidak ada tarif sendiri)
 * Peak = Mon–Fri 01:00–04:00 & 06:00–10:00 UTC (request priced at finish).
 * 100 credits = $1. Free plan: 50 credits/30d, window 7d = 50, 5h = 25.
 *
 * Kenapa hitung lokal, bukan baca website:
 * - Saldo resmi hanya via Supabase RPC `get_billing_summary` dengan user JWT;
 *   slk_ gateway key bukan JWT (PostgREST PGRST301) dan JWT user kedaluwarsa
 *   ±1 jam setelah harvest. Tidak ada endpoint kuota untuk slk_.
 * - Setiap respons gateway + usageHistory mencatat tokens (prompt/completion/
 *   cached) per request — cukup untuk menghitung burn credits per rumus di
 *   atas. Hasilnya estimasi off-peak/peak per timestamp (bukan angka resmi).
 *
 * better-sqlite3 via dynamic import; fail-open → { message }, never throws.
 */

import path from "node:path";

export const ALYSIS_PLAN = "Alysis Free · 50 credits/30d";

// Credits per 1M tokens — mirror bundle website (off-peak; peak = ×2).
// v4.1-flash-expires-on-0910 tidak punya tarif sendiri → pakai flash.
const ALYSIS_RATES = {
  "deepseek-v4-flash": { miss: 25, hit: 0.8, out: 75 },
  "deepseek-v4-flash-vision-exp": { miss: 25, hit: 0.8, out: 75 },
  "deepseek-v4-pro": { miss: 75, hit: 2.5, out: 225 },
  "deepseek-v4.1-flash-expires-on-0910": { miss: 25, hit: 0.8, out: 75 },
};

const ALYSIS_MODEL_PREFIXES = Object.keys(ALYSIS_RATES);

// Cap credits per window — mirror website (5h: 25, 7d: 50, 30d: 50).
const CREDIT_WINDOWS = [
  { label: "30 days", ms: 30 * 24 * 60 * 60 * 1000, cap: 50 },
  { label: "7 days", ms: 7 * 24 * 60 * 60 * 1000, cap: 50 },
  { label: "5 hours", ms: 5 * 60 * 60 * 1000, cap: 25 },
];

/**
 * Pure: true bila timestamp masuk peak window
 * (Mon–Fri 01:00–04:00 & 06:00–10:00 UTC).
 * @param {number} epochMs
 */
export function alysisIsPeak(epochMs) {
  const d = new Date(epochMs);
  const day = d.getUTCDay(); // 0=Sun..6=Sat
  if (day < 1 || day > 5) return false;
  const h = d.getUTCHours() + d.getUTCMinutes() / 60;
  return (h >= 1 && h < 4) || (h >= 6 && h < 10);
}

/**
 * Pure: map usageHistory model id ke bucket tarif, atau "" bila bukan.
 * Baris usageHistory menyimpan id ter-strip ("deepseek-v4-flash").
 * @param {string} model
 */
export function alysisModelBucket(model) {
  if (typeof model !== "string" || !model) return "";
  const base = model.toLowerCase()
    .replace(/^alysis\//, "")
    .replace(/\s*\((xhigh|max|high|medium|low|minimal|budget)\)$/i, "");
  for (const id of ALYSIS_MODEL_PREFIXES) {
    if (base === id || base.startsWith(id)) return id;
  }
  return "";
}

/**
 * Pure: credits untuk 1 baris usage.
 * Bentuk key campur aduk di alam liar: snake_case upstream OpenAI
 * (prompt_tokens), camelCase internal, bahkan input_tokens ala Claude —
 * terima semuanya. (Pelajaran: JSON tersimpan pakai snake_case!)
 * @param {object} t
 * @param {{miss:number, hit:number, out:number}} rates
 * @param {boolean} peak
 */
export function alysisRowCredits(t, rates, peak) {
  const prompt = Number(t?.promptTokens ?? t?.prompt_tokens ?? t?.input_tokens) || 0;
  const completion = Number(t?.completionTokens ?? t?.completion_tokens ?? t?.output_tokens) || 0;
  const cached = Math.min(Number(t?.cachedTokens ?? t?.cached_tokens) || 0, prompt);
  const fresh = Math.max(0, prompt - cached);
  const mult = peak ? 2 : 1;
  return mult * (fresh / 1e6 * rates.miss + cached / 1e6 * rates.hit + completion / 1e6 * rates.out);
}

/**
 * Pure: total burn credits dari raw usage rows dalam satu window
 * (caller memfilter window via SQL; timestamp dipakai untuk peak).
 * @param {Array<{model?:string, timestamp?:string, tokens?:object|string}>} rows
 */
export function computeAlysisWindowBurn(rows) {
  let burn = 0;
  for (const row of Array.isArray(rows) ? rows : []) {
    if (!row || typeof row !== "object") continue;
    const bucket = alysisModelBucket(row.model);
    if (!bucket) continue;
    let tokens = row.tokens;
    if (typeof tokens === "string") {
      try { tokens = JSON.parse(tokens); } catch { continue; }
    }
    const ts = row.timestamp ? new Date(row.timestamp).getTime() : NaN;
    burn += alysisRowCredits(tokens, ALYSIS_RATES[bucket], Number.isFinite(ts) && alysisIsPeak(ts));
  }
  return burn;
}

function round3(n) {
  return Math.round(n * 1000) / 1000;
}

function dbPath() {
  if (process.env.OCTANE_DB_PATH) return process.env.OCTANE_DB_PATH;
  return path.join(process.cwd(), "data", "db", "data.sqlite");
}

export async function getAlysisUsage(apiKey, providerSpecificData, proxyOptions = null) {
  void apiKey;
  void providerSpecificData;
  void proxyOptions;
  let db = null;
  try {
    try {
      const { default: Database } = await import("better-sqlite3");
      db = new Database(dbPath(), { readonly: true, fileMustExist: true });
      const likeClauses = ALYSIS_MODEL_PREFIXES.map(() => "model LIKE ?").join(" OR ");
      const likeParams = ALYSIS_MODEL_PREFIXES.map((m) => `${m}%`);
      const quotas = {};
      let totalBurn = 0;
      for (const window of CREDIT_WINDOWS) {
        const since = new Date(Date.now() - window.ms).toISOString();
        const rows = db.prepare(
          `SELECT model, tokens, timestamp FROM usageHistory
           WHERE provider = 'alysis' AND (${likeClauses}) AND timestamp >= ?`,
        ).all(...likeParams, since);
        const burn = computeAlysisWindowBurn(rows);
        totalBurn += window.label === "30 days" ? burn : 0;
        const used = round3(burn);
        const remaining = round3(Math.max(0, window.cap - burn));
        quotas[`Credits used (${window.label})`] = {
          used,
          total: window.cap,
          remaining,
          remainingPercentage: Math.round((remaining / window.cap) * 100),
          resetAt: null,
          unlimited: false,
        };
      }
      if (totalBurn === 0) {
        return {
          plan: ALYSIS_PLAN,
          message: "Belum ada pemakaian Alysis tercatat. Saldo resmi (50 credits/30d) hanya tampil di alysiscode.com/account/usage (butuh login Google).",
        };
      }
      return { plan: ALYSIS_PLAN, quotas };
    } catch (dbError) {
      return { plan: ALYSIS_PLAN, message: `Alysis usage unavailable: ${dbError.message}` };
    } finally {
      try { db?.close(); } catch { /* already closed */ }
    }
  } catch (error) {
    return { message: `Alysis usage error: ${error.message}` };
  }
}

export default getAlysisUsage;
