import { getProviderConnections, validateApiKey, updateProviderConnection, getSettings, getProxyPools } from "@/lib/localDb";
import { resolveConnectionProxyConfig, pickProxyPoolId } from "@/lib/network/connectionProxy";
import { formatRetryAfter, checkFallbackError, isModelLockActive, buildModelLockUpdate, getModelLockKey, MODEL_LOCK_ALL } from "open-sse/services/accountFallback.js";
import { MAX_RATE_LIMIT_COOLDOWN_MS } from "open-sse/config/errorConfig.js";
import { resolveProviderId, FREE_PROVIDERS } from "@/shared/constants/providers.js";
import { getAntigravityQuotaCache } from "./antigravityQuota.js";
import * as log from "../utils/logger.js";

// Mutex to prevent race conditions during account selection
let selectionMutex = Promise.resolve();

// ─── Per-provider retry pacing ───────────────────────────────────────────────
// Beberapa provider (alySIS free-harvest) menghitung reservasi kredit per
// request. Burst fallback — gagal 429 lalu dalam milidetik langsung memukul
// akun berikutnya — membuat reservasi menumpuk dan memicu billing-review /
// "available credits cannot cover" massal. Beri jeda kecil HANYA saat retry
// (sudah ada akun yang gagal / di-exclude), bukan pada request pertama, supaya
// latensi normal tidak ikut naik. Aman untuk provider lain (0 → no-op).
const PROVIDER_PICK_GAP_MS = { alysis: 400 };
const providerLastPickMs = new Map(); // providerId -> epoch ms
async function paceProviderPick(providerId) {
  const gap = PROVIDER_PICK_GAP_MS[providerId];
  if (!gap) return;
  const now = Date.now();
  const last = providerLastPickMs.get(providerId) || 0;
  const wait = gap - (now - last);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  providerLastPickMs.set(providerId, Date.now());
}

// ─── Pre-send quota safety (root-cause 429/billing prevention) ───────────────
// Alysis free-tier membatasi 25 credits/5h, 50 credits/30d dan MENOLAK dengan
// 429 "Available credits cannot cover this request" saat estimasi biaya
// request melebihi sisa (atau ada reservasi menggantung). Memukul akun yang
// sudah mau habis inilah yang memicu billing-review. Alih-alih menunggu 429,
// kita hitung burn lokal dari usageHistory (rate flash: 25/1M miss · 0.8/1M
// hit · 75/1M out) dan SKIP akun yang sudah mendekati cap — jadi request tidak
// pernah dikirim ke akun yang pasti ditolak. Ini mencegah 429 di hulu, bukan
// sekadar menanganinya di hilir.
const QUOTA_SAFETY = {
  alysis: { // rate flash (credits per 1 token)
    windows: [
      { ms: 5 * 3600 * 1000, cap: 25, skipAt: 0.8 },  // 5h: skip > 80% (20cr)
      { ms: 30 * 86400 * 1000, cap: 50, skipAt: 0.8 }, // 30d: skip > 80% (40cr)
    ],
    miss: 25 / 1e6, hit: 0.8 / 1e6, out: 75 / 1e6,
    // Estimasi biaya request masuk; kalau estimasi melebihi cap window, tolak
    // lokal (hemat reservasi) alih-alih dikirim lalu 429.
    maxEstCreditsPerRequest: 25 * 0.5, // jangan kirim estimasi > 50% cap 5h
  },
};

function alysisRowCredits(t, r) {
  const p = t?.prompt_tokens ?? t?.promptTokens ?? 0;
  const c = Math.min(t?.cached_tokens ?? t?.cachedTokens ?? 0, p);
  const f = Math.max(0, p - c);
  const o = t?.completion_tokens ?? t?.completionTokens ?? 0;
  return f * r.miss + c * r.hit + o * r.out;
}

const ALYSIS_USAGE_COLS = "tokens, timestamp";
async function alysisRecentBurn(connectionId, windowMs) {
  try {
    const { getAdapter } = await import("@/lib/db/driver.js");
    const db = await getAdapter();
    const since = new Date(Date.now() - windowMs).toISOString();
    const rows = db.all(
      `SELECT ${ALYSIS_USAGE_COLS} FROM usageHistory WHERE provider='alysis' AND connectionId = ? AND timestamp >= ?`,
      [connectionId, since]
    );
    const r = QUOTA_SAFETY.alysis;
    let burn = 0;
    for (const row of rows || []) {
      let t = row.tokens;
      if (typeof t === "string") { try { t = JSON.parse(t); } catch { continue; } }
      burn += alysisRowCredits(t, r);
    }
    return burn;
  } catch { return 0; } // fail-open: jangan pernah blokir karena error baca
}

// true bila akun ini harus di-skip untuk provider tsb (mendekati cap).
async function shouldSkipForQuota(providerId, connection) {
  const cfg = QUOTA_SAFETY[providerId];
  if (!cfg || !connection?.id) return false;
  for (const w of cfg.windows) {
    const burn = await alysisRecentBurn(connection.id, w.ms);
    if (burn >= w.cap * w.skipAt) {
      log.info("QUOTA_GUARD", `${providerId} | ${connection.name || connection.id?.slice(0, 8)} burn ${burn.toFixed(2)}/${w.cap}cr (${Math.round(w.ms / 3600000)}h) ≥ ${w.skipAt * 100}% — skip`);
      return true;
    }
  }
  return false;
}

// Estimasi biaya credits untuk 1 request masuk (~4 chars/token, out≈input/10).
export function estimateRequestCredits(providerId, body) {
  const cfg = QUOTA_SAFETY[providerId];
  if (!cfg) return 0;
  let chars = 0;
  try { chars = JSON.stringify(body || {}).length; } catch { return 0; }
  const inTok = Math.ceil(chars / 4);
  const outTok = Math.max(1, Math.ceil(inTok / 10));
  return inTok * cfg.miss + outTok * cfg.out;
}

// Expose config ke handler (pre-send cost guard).
export function getQuotaSafetyConfig(providerId) {
  return QUOTA_SAFETY[providerId] || null;
}

function stripThinkingSuffix(name) {
  if (!name) return "";
  return String(name).replace(/\s*\((xhigh|max|high|medium|low|minimal|budget)\)$/i, "").trim();
}

function normalizeModelForFilter(name) {
  if (!name) return null;
  const stripped = stripThinkingSuffix(name);
  if (stripped === "ox/ox-alpha" || stripped === "stealth/ox-alpha" || stripped === "ox-alpha") {
    return "ox/ox-alpha";
  }
  if (stripped === "gpt-5.6-luna" || stripped === "openai/gpt-5.6-luna") {
    return "openai/gpt-5.6-luna";
  }
  if (stripped === "kimi-k3" || stripped === "kimi-k3-eco" || stripped === "crof/kimi-k3" || stripped === "crof/kimi-k3-eco") {
    return "crof/kimi-k3-eco";
  }
  if (stripped === "deepseek-v4-flash" || stripped === "deepseek/deepseek-v4-flash") {
    return "deepseek/deepseek-v4-flash";
  }
  if (stripped === "muse-spark-1.3" || stripped === "meta/muse-spark-1.3" || stripped === "meta/muse-spark-1.3-contributor") {
    return "meta/muse-spark-1.3";
  }
  return stripped;
}

export function filterConnectionsForModel(providerId, connections, model, settings = {}) {
  const override = (settings.providerStrategies || {})[providerId] || {};
  if (override.strictModelAssignment !== true || !model) {
    return connections;
  }
  const cleanModel = normalizeModelForFilter(model);
  const matched = connections.filter((connection) => {
    const rawAssigned = connection.providerSpecificData?.assignedModel
      || (providerId === "freebuff" ? connection.providerSpecificData?.freebuffModel : null);
    const assignedModel = normalizeModelForFilter(rawAssigned);
    return assignedModel === cleanModel;
  });
  return matched.length > 0 ? matched : connections;
}

const GITHUB_MONTHLY_USAGE_LIMIT = "you've reached your additional usage limit for your plan";

/**
 * Model-specific lock expiry for retry timing.
 * Unlike getEarliestModelLockUntil() (min across ALL modelLock_* keys),
 * this reads only modelLock_${model} / modelLock___all so "reset after"
 * reflects the requested model, not some other model's lock.
 * @returns {string|null} ISO timestamp, or null when no active lock.
 */
function getModelSpecificLockUntil(connection, model) {
  if (!connection) return null;
  const now = Date.now();
  const candidates = [connection[getModelLockKey(model)], connection[MODEL_LOCK_ALL]];
  let earliest = null;
  for (const val of candidates) {
    if (!val) continue;
    const t = new Date(val).getTime();
    if (!Number.isFinite(t) || t <= now) continue;
    if (!earliest || t < earliest) earliest = t;
  }
  return earliest ? new Date(earliest).toISOString() : null;
}

function githubMonthlyResetMs(status, errorText, provider) {
  if (resolveProviderId(provider) !== "github" || Number(status) !== 402) return null;
  if (!String(errorText || "").toLowerCase().includes(GITHUB_MONTHLY_USAGE_LIMIT)) return null;
  const now = new Date();
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1);
}

/**
 * Get provider credentials from localDb
 * Filters out unavailable accounts and returns the selected account based on strategy
 * @param {string} provider - Provider name
 * @param {Set<string>|string|null} excludeConnectionIds - Connection ID(s) to exclude (for retry with next account)
 * @param {string|null} model - Model name for per-model rate limit filtering
 */
export async function getProviderCredentials(provider, excludeConnectionIds = null, model = null, options = {}) {
  // Normalize to Set for consistent handling
  const excludeSet = excludeConnectionIds instanceof Set
    ? excludeConnectionIds
    : (excludeConnectionIds ? new Set([excludeConnectionIds]) : new Set());
  const preferredConnectionId = options?.preferredConnectionId || null;
  // Acquire mutex to prevent race conditions
  const currentMutex = selectionMutex;
  let resolveMutex;
  selectionMutex = new Promise(resolve => { resolveMutex = resolve; });

  try {
    await currentMutex;

    // Resolve alias to provider ID (e.g., "kc" -> "kilocode")
    const providerId = resolveProviderId(provider);

    // Inject a virtual connection for no-auth free providers (with optional proxy pool from settings)
    if (FREE_PROVIDERS[providerId]?.noAuth) {
      const settings = await getSettings();
      const override = (settings.providerStrategies || {})[providerId] || {};
      const strategy = override.rotateStrategy || "none";
      let pickedId = override.proxyPoolId || null;
      let poolIds = [];
      if (strategy !== "none") {
        const allPools = await getProxyPools({ isActive: true });
        poolIds = allPools.filter(p => p.proxyUrl).map(p => p.id);
        // Scope region-aware ("smart") filtering to this provider/model so
        // pools marked unfit here are skipped.
        const scope = `${providerId}::${model || "*"}`;
        pickedId = pickProxyPoolId(poolIds, strategy, providerId, { scope });
      } else if (override.proxyPoolId) {
        poolIds = [override.proxyPoolId];
      }
      const resolvedProxy = await resolveConnectionProxyConfig({ proxyPoolId: pickedId || "" });
      return {
        id: "noauth",
        connectionName: "Public",
        isActive: true,
        accessToken: "public",
        providerSpecificData: {
          connectionProxyEnabled: resolvedProxy.connectionProxyEnabled,
          connectionProxyUrl: resolvedProxy.connectionProxyUrl,
          connectionNoProxy: resolvedProxy.connectionNoProxy,
          connectionProxyPoolId: resolvedProxy.proxyPoolId || null,
          vercelRelayUrl: resolvedProxy.vercelRelayUrl || "",
          proxyPoolId: resolvedProxy.proxyPoolId || null,
          strictProxy: resolvedProxy.strictProxy === true,
          // Let chatCore's pool-scoped retry rotate across the same candidate
          // pool set (excluding the failed pool) instead of reusing it — this
          // is what makes per-IP limit retries work for no-auth providers.
          proxyPoolIds: poolIds,
          proxyRotationStrategy: strategy,
        },
      };
    }

    let connections = await getProviderConnections({ provider: providerId, isActive: true });
    const settings = await getSettings();
    const providerOverride = (settings.providerStrategies || {})[providerId] || {};
    connections = filterConnectionsForModel(providerId, connections, model, settings);
    log.debug("AUTH", `${provider} | total connections: ${connections.length}, excludeIds: ${excludeSet.size > 0 ? [...excludeSet].join(",") : "none"}, model: ${model || "any"}`);

    if (connections.length === 0) {
      log.warn("AUTH", `No credentials for ${provider}`);
      return null;
    }

    // Antigravity quota cache is lazy: only populated after that account returns 409/429.
    const isAntigravity = providerId === "antigravity";
    const antigravityQuotaCache = isAntigravity && model ? getAntigravityQuotaCache() : null;

    // Filter out model-locked, excluded, and Antigravity quota-exhausted connections.
    let availableConnections = connections.filter(c => {
      if (excludeSet.has(c.id)) return false;
      if (isModelLockActive(c, model)) return false;
      // Antigravity: skip if live quota exhausted for this model
      if (isAntigravity && model && antigravityQuotaCache) {
        const quota = antigravityQuotaCache.get(c.id)?.[model];
        if (quota && quota.remainingPercentage <= 0 && quota.resetAt && new Date(quota.resetAt).getTime() > Date.now()) {
          const account = c.id?.slice(0, 8) || "unknown";
          log.info("AG_QUOTA", `${account} | CACHE_BLOCK ${model} — skip upstream until ${quota.resetAt}`);
          return false;
        }
      }
      return true;
    });

    // Quota-guard: skip akun yang burn-nya sudah mendekati cap (alySIS).
    // Mencegah request dikirim ke akun yang pasti ditolak 429 — akar billing
    // hold. Async karena baca usageHistory; fail-open (error → tidak skip).
    if (QUOTA_SAFETY[providerId] && availableConnections.length > 0) {
      const kept = [];
      for (const c of availableConnections) {
        // eslint-disable-next-line no-await-in-loop
        if (await shouldSkipForQuota(providerId, c)) {
          log.info("QUOTA_GUARD", `${providerId} | skip ${c.name || c.id?.slice(0, 8)} (mendekati cap)`);
          continue;
        }
        kept.push(c);
      }
      availableConnections = kept;
    }

    log.debug("AUTH", `${provider} | available: ${availableConnections.length}/${connections.length}`);
    connections.forEach(c => {
      const excluded = excludeSet.has(c.id);
      const locked = isModelLockActive(c, model);
      if (excluded || locked) {
        const lockUntil = getModelSpecificLockUntil(c, model);
        log.debug("AUTH", `  → ${c.id?.slice(0, 8)} | ${excluded ? "excluded" : ""} ${locked ? `modelLocked(${model}) until ${lockUntil}` : ""}`);
      }
    });

    if (availableConnections.length === 0) {
      // Retry timing must be per-model: getEarliestModelLockUntil() returns the
      // min across ALL modelLock_* keys, which can report another model's lock
      // (too early → premature retry, or too late → wrong "reset after").
      const lockedConns = connections.filter(c => isModelLockActive(c, model));
      const expiries = lockedConns.map(c => getModelSpecificLockUntil(c, model)).filter(Boolean);
      if (isAntigravity && model && antigravityQuotaCache) {
        connections.forEach((c) => {
          const resetAt = antigravityQuotaCache.get(c.id)?.[model]?.resetAt;
          if (resetAt && new Date(resetAt).getTime() > Date.now()) expiries.push(resetAt);
        });
      }
      const earliest = expiries.sort()[0] || null;
      if (earliest) {
        const earliestConn = [...lockedConns].sort((a, b) =>
          String(getModelSpecificLockUntil(a, model) || "").localeCompare(String(getModelSpecificLockUntil(b, model) || ""))
        )[0];
        log.warn("AUTH", `${provider} | all ${connections.length} accounts locked for ${model || "all"} (${formatRetryAfter(earliest)}) | lastError=${earliestConn?.lastError?.slice(0, 50)}`);
        return {
          allRateLimited: true,
          retryAfter: earliest,
          retryAfterHuman: formatRetryAfter(earliest),
          lastError: earliestConn?.lastError || null,
          lastErrorCode: earliestConn?.errorCode || null
        };
      }
      log.warn("AUTH", `${provider} | all ${connections.length} accounts unavailable`);
      return null;
    }

    // Jeda kecil HANYA saat retry (sudah ada akun yang gagal). Menahan burst
    // fallback ke akun berikutnya agar reservasi billing tidak menumpuk (alySIS).
    if (excludeSet.size > 0) await paceProviderPick(providerId);

    // Per-provider strategy overrides global setting
    const strategy = providerOverride.fallbackStrategy || settings.fallbackStrategy || "fill-first";

    let connection;
    // Pin to preferred connection if specified and available
    if (preferredConnectionId) {
      connection = availableConnections.find((c) => c.id === preferredConnectionId);
      if (connection) {
        log.info("AUTH", `${provider} | pinned to ${connection.id?.slice(0, 8)} (${connection.name || connection.email || "unnamed"})`);
      }
    }
    if (connection) {
      // skip strategy
    } else if (strategy === "round-robin") {
      const stickyLimit = providerOverride.stickyRoundRobinLimit || settings.stickyRoundRobinLimit || 3;

      // Sort by lastUsed (most recent first) to find current candidate
      const byRecency = [...availableConnections].sort((a, b) => {
        if (!a.lastUsedAt && !b.lastUsedAt) return (a.priority || 999) - (b.priority || 999);
        if (!a.lastUsedAt) return 1;
        if (!b.lastUsedAt) return -1;
        return new Date(b.lastUsedAt) - new Date(a.lastUsedAt);
      });

      const current = byRecency[0];
      const currentCount = current?.consecutiveUseCount || 0;

      if (current && current.lastUsedAt && currentCount < stickyLimit) {
        // Stay with current account
        connection = current;
        // Update lastUsedAt and increment count (await to ensure persistence)
        await updateProviderConnection(connection.id, {
          lastUsedAt: new Date().toISOString(),
          consecutiveUseCount: (connection.consecutiveUseCount || 0) + 1
        });
      } else {
        // Pick the least recently used (excluding current if possible)
        const sortedByOldest = [...availableConnections].sort((a, b) => {
          if (!a.lastUsedAt && !b.lastUsedAt) return (a.priority || 999) - (b.priority || 999);
          if (!a.lastUsedAt) return -1;
          if (!b.lastUsedAt) return 1;
          return new Date(a.lastUsedAt) - new Date(b.lastUsedAt);
        });

        connection = sortedByOldest[0];

        // Update lastUsedAt and reset count to 1 (await to ensure persistence)
        await updateProviderConnection(connection.id, {
          lastUsedAt: new Date().toISOString(),
          consecutiveUseCount: 1
        });
      }
    } else {
      // Default: fill-first (already sorted by priority in getProviderConnections)
      connection = availableConnections[0];
    }

    // Scope the region-aware picker to this provider/model (e.g. freebuff::gpt-5.6-luna)
    const psdForProxy = connection.providerSpecificData?.proxyPoolIds?.length
      ? { ...connection.providerSpecificData, proxyPoolScope: `${providerId}::${model || ""}` }
      : connection.providerSpecificData;
    const resolvedProxy = await resolveConnectionProxyConfig(psdForProxy || {}, connection.id);

    return {
      authType: connection.authType,
      apiKey: connection.apiKey,
      accessToken: connection.accessToken,
      refreshToken: connection.refreshToken,
      idToken: connection.idToken,
      expiresAt: connection.expiresAt,
      expiresIn: connection.expiresIn,
      lastRefreshAt: connection.lastRefreshAt,
      projectId: connection.projectId,
      connectionName: connection.displayName || connection.name || connection.email || connection.id,
      copilotToken: connection.providerSpecificData?.copilotToken,
      providerSpecificData: {
        ...(connection.providerSpecificData || {}),
        connectionProxyEnabled: resolvedProxy.connectionProxyEnabled,
        connectionProxyUrl: resolvedProxy.connectionProxyUrl,
        connectionNoProxy: resolvedProxy.connectionNoProxy,
        connectionProxyPoolId: resolvedProxy.proxyPoolId || null,
        vercelRelayUrl: resolvedProxy.vercelRelayUrl || "",
        proxyPoolId: resolvedProxy.proxyPoolId || null,
        noFitPool: resolvedProxy.noFitPool === true,
        strictProxy: resolvedProxy.strictProxy === true,
      },
      connectionId: connection.id,
      // Include current status for optimization check
      testStatus: connection.testStatus,
      lastError: connection.lastError,
      // Pass full connection for clearAccountError to read modelLock_* keys
      _connection: connection
    };
  } finally {
    if (resolveMutex) resolveMutex();
  }
}

/**
 * Mark account+model as unavailable — locks modelLock_${model} in DB.
 * All errors (429, 401, 5xx, etc.) lock per model, not per account.
 * @param {string} connectionId
 * @param {number} status - HTTP status code from upstream
 * @param {string} errorText
 * @param {string|null} provider
 * @param {string|null} model - The specific model that triggered the error
 * @returns {{ shouldFallback: boolean, cooldownMs: number }}
 */
export async function markAccountUnavailable(connectionId, status, errorText, provider = null, model = null, resetsAtMs = null) {
  if (!connectionId || connectionId === "noauth") return { shouldFallback: false, cooldownMs: 0 };
  const connections = await getProviderConnections({ provider });
  const conn = connections.find(c => c.id === connectionId);
  const backoffLevel = conn?.backoffLevel || 0;

  // GitHub premium-request exhaustion is account-wide until the next UTC month.
  const githubResetAtMs = githubMonthlyResetMs(status, errorText, provider);

  // Provider-specific precise cooldown (e.g. codex usage_limit_reached resets_at) overrides backoff
  let shouldFallback, cooldownMs, newBackoffLevel, noLock = false;
  if (githubResetAtMs) {
    shouldFallback = true;
    cooldownMs = githubResetAtMs - Date.now();
    newBackoffLevel = 0;
  } else if (resetsAtMs && resetsAtMs > Date.now()) {
    shouldFallback = true;
    // Antigravity quota API provides exact per-model resetAt. Do not truncate it.
    cooldownMs = resolveProviderId(provider) === "antigravity"
      ? resetsAtMs - Date.now()
      : Math.min(resetsAtMs - Date.now(), MAX_RATE_LIMIT_COOLDOWN_MS);
    newBackoffLevel = 0;
  } else {
    ({ shouldFallback, cooldownMs, newBackoffLevel, noLock } = checkFallbackError(status, errorText, backoffLevel));
  }
  if (!shouldFallback) return { shouldFallback: false, cooldownMs: 0 };

  // noLock (e.g. alysis 502 "upstream rejected"): upstream hiccup, akun sehat.
  // Fallback ke akun lain untuk request ini, tapi jangan tulis modelLock /
  // testStatus unavailable — kartu tetap hijau di dashboard.
  if (noLock) {
    const connName = conn?.displayName || conn?.name || conn?.email || connectionId.slice(0, 8);
    log.info("AUTH", `${connName} soft-fallback [${status}] — akun sehat, tidak di-lock`);
    return { shouldFallback: true, cooldownMs: 0 };
  }

  const reason = typeof errorText === "string" ? errorText.slice(0, 100) : "Provider error";
  const lockUpdate = buildModelLockUpdate(githubResetAtMs ? null : model, cooldownMs);

  await updateProviderConnection(connectionId, {
    ...lockUpdate,
    testStatus: "unavailable",
    lastError: reason,
    errorCode: status,
    lastErrorAt: new Date().toISOString(),
    backoffLevel: newBackoffLevel ?? backoffLevel
  });

  const lockKey = Object.keys(lockUpdate)[0];
  const connName = conn?.displayName || conn?.name || conn?.email || connectionId.slice(0, 8);
  log.warn("AUTH", `${connName} locked ${lockKey} for ${Math.round(cooldownMs / 1000)}s [${status}]`);

  if (provider && status && reason) {
    console.error(`❌ ${provider} [${status}]: ${reason}`);
  }

  return { shouldFallback: true, cooldownMs };
}

/**
 * Clear account error status on successful request.
 * - Clears modelLock_${model} (the model that just succeeded)
 * - Lazy-cleans any other expired modelLock_* keys
 * - Resets error state only if no active locks remain
 * @param {string} connectionId
 * @param {object} currentConnection - credentials object (has _connection) or raw connection
 * @param {string|null} model - model that succeeded
 */
export async function clearAccountError(connectionId, currentConnection, model = null) {
  if (!connectionId || connectionId === "noauth") return;
  const conn = currentConnection._connection || currentConnection;
  const now = Date.now();
  const allLockKeys = Object.keys(conn).filter(k => k.startsWith("modelLock_"));

  if (!conn.testStatus && !conn.lastError && allLockKeys.length === 0) return;

  // Keys to clear: current model's lock + all expired locks
  const keysToClear = allLockKeys.filter(k => {
    if (model && k === `modelLock_${model}`) return true; // succeeded model
    if (model && k === "modelLock___all") return true;    // account-level lock
    const expiry = conn[k];
    return expiry && new Date(expiry).getTime() <= now;   // expired
  });

  if (keysToClear.length === 0 && conn.testStatus !== "unavailable" && !conn.lastError) return;

  // Check if any active locks remain after clearing
  const remainingActiveLocks = allLockKeys.filter(k => {
    if (keysToClear.includes(k)) return false;
    const expiry = conn[k];
    return expiry && new Date(expiry).getTime() > now;
  });

  const clearObj = Object.fromEntries(keysToClear.map(k => [k, null]));

  // Only reset error state if no active locks remain
  if (remainingActiveLocks.length === 0) {
    Object.assign(clearObj, {
      testStatus: "active",
      lastError: null,
      errorCode: null,
      lastErrorAt: null,
      backoffLevel: 0
    });
  }

  await updateProviderConnection(connectionId, clearObj);
}

/**
 * Extract API key from request headers
 */
export function extractApiKey(request) {
  // Check Authorization header first
  const authHeader = request.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }

  // Check Anthropic x-api-key header
  const xApiKey = request.headers.get("x-api-key");
  if (xApiKey) {
    return xApiKey;
  }

  return null;
}

/**
 * Validate API key (optional - for local use can skip)
 */
export async function isValidApiKey(apiKey) {
  if (!apiKey) return false;
  return await validateApiKey(apiKey);
}
