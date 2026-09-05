/**
 * Experiential Labs usage handler
 *
 * EL exposes no quota API — its 429 body only reports an hourly cap breach.
 * The practical quota picture is therefore derived locally from the
 * usageHistory SQLite table (opened readonly): token burn per model over the
 * trailing hour, split evenly across the configured EL accounts, against the
 * hourly caps observed from the real EL 429 payload (2026-09-05):
 * gpt-6-astra 150k, claude-fable-5.1 90k. Models without a known cap surface
 * as unlimited with their used count.
 *
 * better-sqlite3 is loaded via dynamic import so Next's build graph never
 * pulls the native binding statically. The connection is opened and closed
 * per call. Fail-open: any DB error → { message } — never throws.
 */

import path from "node:path";

// Matcher suffix-toleran: usageHistory mencatat mask + effort suffix
// ("gpt-6-astra(high)", "claude-fable-5.1", …). Bare "deepseek-v4-flash" and
// "minimax-m3" via ot/ are FREEBUFF-served (OctaneExecutor MODEL_PROVIDER_MAP:
// deepseek/mimo -> freebuff) and must NOT count into EL buckets.
const EL_MODEL_MATCHERS = [
  { prefix: "gpt-6-astra", bucket: "gpt-6-astra" },
  { prefix: "claude-fable-5.1", bucket: "claude-fable-5.1" },
  { prefix: "deepseek-v4-flash-exp", bucket: "deepseek-v4-flash-exp" },
  { prefix: "minimax-m3-free", bucket: "minimax-m3-free" },
];

/**
 * Pure: map a usageHistory model id to its EL bucket, or "" when the row is
 * not Experiential Labs traffic.
 * @param {string} model
 * @returns {string}
 */
export function elModelBucket(model) {
  if (typeof model !== "string" || !model) return "";
  const base = model.toLowerCase();
  for (const { prefix, bucket } of EL_MODEL_MATCHERS) {
    if (base.startsWith(prefix)) return bucket;
  }
  return "";
}

// Hourly caps from the real EL 429 message (2026-09-05). Models not listed
// here are reported as unlimited.
const EL_DEFAULT_CAPS = {
  "gpt-6-astra": 150000,
  "claude-fable-5.1": 90000,
};

const DEFAULT_ACCOUNT_NAME = "Hourly usage";
const HOUR_MS = 60 * 60 * 1000;

export const EL_PLAN = "Experiential Labs";

function dbPath() {
  if (process.env.OCTANE_DB_PATH) return process.env.OCTANE_DB_PATH;
  // Next.js server runs with cwd = repo root; mirrors src/lib/db/paths.js layout.
  return path.join(process.cwd(), "data", "db", "data.sqlite");
}

function nextTopOfHour(now) {
  return new Date(Math.floor(now / HOUR_MS) * HOUR_MS + HOUR_MS).toISOString();
}

/**
 * Pure: build quota rows from raw usage rows — no DB, no network.
 * Usage per model is split evenly across accounts with consistent rounding
 * (the remainder is distributed one token at a time so the split always sums
 * back to the total). Only models with actual burn in the window get rows.
 * @param {Array<{promptTokens?:number, completionTokens?:number, model?:string}>} rows
 * @param {Array<{name?:string, caps?:Object}>} accounts providerSpecificData.accounts
 * @param {number} now epoch ms (injectable for tests)
 * @returns {Object} quotas map keyed "<account> · <model> (1h)"
 */
export function computeElQuotas(rows, accounts, now = Date.now()) {
  const resetAt = nextTopOfHour(now);

  const accountList = Array.isArray(accounts) && accounts.length > 0
    ? accounts
    : [{ name: DEFAULT_ACCOUNT_NAME, caps: { ...EL_DEFAULT_CAPS } }];

  const usedByModel = {};
  for (const row of Array.isArray(rows) ? rows : []) {
    if (!row || typeof row !== "object") continue;
    const bucket = elModelBucket(row.model);
    if (!bucket) continue;
    const prompt = Number(row.promptTokens) || 0;
    const completion = Number(row.completionTokens) || 0;
    usedByModel[bucket] = (usedByModel[bucket] || 0) + prompt + completion;
  }

  const buckets = [...new Set(EL_MODEL_MATCHERS.map((m) => m.bucket))];
  const quotas = {};
  const n = accountList.length;
  for (const model of buckets) {
    const totalUsed = usedByModel[model];
    if (!totalUsed) continue;

    const base = Math.floor(totalUsed / n);
    const remainder = totalUsed % n;

    accountList.forEach((account, i) => {
      const name = typeof account?.name === "string" && account.name
        ? account.name
        : `Account ${i + 1}`;
      const caps = account?.caps && typeof account.caps === "object" ? account.caps : {};
      const used = base + (i < remainder ? 1 : 0);

      if (Number.isFinite(caps[model]) && caps[model] > 0) {
        const cap = caps[model];
        const remaining = Math.max(0, cap - used);
        quotas[`${name} · ${model} (1h)`] = {
          used,
          total: cap,
          remaining,
          remainingPercentage: Math.max(0, Math.round((remaining / cap) * 100)),
          resetAt,
          unlimited: false,
        };
      } else {
        // Cap unknown (deepseek-v4-flash, minimax-m3-free, …) → unlimited.
        quotas[`${name} · ${model} (1h)`] = {
          used,
          total: 0,
          remaining: 0,
          remainingPercentage: 0,
          resetAt,
          unlimited: true,
        };
      }
    });
  }

  return quotas;
}

export async function getExperientialLabsUsage(apiKey, providerSpecificData, proxyOptions = null) {
  let db = null;
  let rows = [];
  try {
    try {
      // Dynamic import: keeps the native binding out of Next's static build graph.
      const { default: Database } = await import("better-sqlite3");
      db = new Database(dbPath(), { readonly: true, fileMustExist: true });
      const since = new Date(Date.now() - HOUR_MS).toISOString();
      // Suffix-tolerant match: model rows carry effort suffixes like
      // "gpt-6-astra(high)". LIKE prefix keeps bare + suffixed ids.
      const likeClauses = EL_MODEL_MATCHERS.map(() => "model LIKE ?").join(" OR ");
      const likeParams = EL_MODEL_MATCHERS.map((m) => `${m.prefix}%`);
      const stmt = db.prepare(
        `SELECT model, promptTokens, completionTokens, connectionId, timestamp FROM usageHistory
         WHERE provider = 'octane' AND (${likeClauses}) AND timestamp >= ?`,
      );
      rows = stmt.all(...likeParams, since);
    } catch (dbError) {
      // Fail-open: missing DB file / native binding unavailable → degrade gracefully.
      return { plan: EL_PLAN, message: `Experiential Labs usage unavailable: ${dbError.message}` };
    } finally {
      try { db?.close(); } catch { /* already closed */ }
    }

    const quotas = computeElQuotas(rows, providerSpecificData?.accounts, Date.now());

    if (Object.keys(quotas).length === 0) {
      return { plan: EL_PLAN, message: "No Experiential Labs usage recorded in the last hour." };
    }
    return { plan: EL_PLAN, quotas };
  } catch (error) {
    return { message: `Experiential Labs usage error: ${error.message}` };
  }
}

export default getExperientialLabsUsage;
