import { BaseExecutor } from "./base.js";
import { PROVIDERS } from "../config/providers.js";
import { FreebuffExecutor } from "./freebuff.js";
import { OpenCodeExecutor } from "./opencode.js";
import { DefaultExecutor } from "./default.js";

/**
 * Octane AI — unified ot/ provider
 * Aggregates all free ot/ models (freebuff, opencode, etc.) and routes
 * by provider order. Clean ot/ ids without meta/openai prefix.
 * Order is read from settings.octaneProviderOrder or defaults to
 * ["freebuff","opencode","codebuddy-intl","codebuddy-cn"].
 */

// Map ot/ clean id -> upstream per provider (for routing)
// Freebuff uses crof/openai/meta, Opencode uses its own free ids
const MODEL_PROVIDER_MAP = {
  "gpt-5.6-luna": ["freebuff"],
  "kimi-k3": ["freebuff"],
  "muse-spark-1.2": ["freebuff", "opencode"],
  "deepseek-v4-flash": ["freebuff"],
  "mimo-v2.5": ["freebuff", "opencode"],
  "ox-alpha-free": ["opencode"],
  "mimo-v2.5-free": ["opencode"],
  "nemotron-3.5-lightning-free": ["opencode"],
  "laguna-s-2.1-free": ["opencode"],
  "hy3-free": ["opencode"],
  "big-pickle": ["opencode"],
};

function getOctaneOrder(settings) {
  const order = settings?.octaneProviderOrder || settings?.providerOrder?.octane;
  if (Array.isArray(order) && order.length) return order;
  return ["freebuff", "opencode", "codebuddy-intl", "codebuddy-cn", "qoder"];
}

function isFallbackEnabled(settings) {
  // Default false — user wants freebuff murni, tidak fallback ke codebuddy untuk test
  if (typeof settings?.octaneFallbackEnabled === "boolean") return settings.octaneFallbackEnabled;
  return false;
}

function shouldPrevent401(providerCreds) {
  // Cegah 401 dengan cek lastError/testStatus sebelum hit upstream
  if (!providerCreds) return true;
  if (providerCreds.testStatus === "error" && providerCreds.lastError?.includes("401")) return true;
  if (providerCreds.lastError?.includes("Not Enough Credits") || providerCreds.lastError?.includes("re-login")) return true;
  return false;
}

export class OctaneExecutor extends BaseExecutor {
  constructor() {
    super("octane", PROVIDERS.octane || PROVIDERS.freebuff);
  }

  // Octane has no direct transport — delegate to underlying provider
  buildUrl() {
    return null;
  }

  async execute(ctx) {
    const { model, body, stream, credentials, signal, log, proxyOptions } = ctx;
    // Strip ot/ prefix if present for internal lookup
    const cleanModel = model.replace(/^ot\//, "").replace(/^octane\//, "");
    const providersForModel = MODEL_PROVIDER_MAP[cleanModel] || MODEL_PROVIDER_MAP[cleanModel.split("(")[0].trim()] || ["freebuff", "opencode"];
    
    // Try to get order from global settings if available (attached to ctx or global)
    let order = providersForModel;
    try {
      // ctx.settings may be injected by chatCore
      const settingsOrder = ctx.settings?.octaneProviderOrder;
      if (Array.isArray(settingsOrder) && settingsOrder.length) {
        // Intersect with providersForModel, keep order
        const filtered = settingsOrder.filter(p => providersForModel.includes(p));
        const remaining = providersForModel.filter(p => !filtered.includes(p));
        order = [...filtered, ...remaining];
      }
    } catch {}

    const executorMap = {
      freebuff: new FreebuffExecutor(),
      opencode: new OpenCodeExecutor(),
      "codebuddy-intl": new DefaultExecutor("codebuddy-intl"),
      "codebuddy-cn": new DefaultExecutor("codebuddy-cn"),
    };
    const fallbackEnabled = isFallbackEnabled(ctx.settings);
    // Jika fallback mati, cuma coba provider pertama (freebuff) — biar test murni
    const tryOrder = fallbackEnabled ? order : [order[0]];

    let lastError = null;
    for (const providerId of tryOrder) {
      const executor = executorMap[providerId] || new DefaultExecutor(providerId);
      // Need credentials for that provider — ctx.credentials is for octane, need to find provider's credentials
      // For now, try to find connection for that provider via global providerConnections (injected via ctx)
      // Fallback: use the same credentials if provider is freebuff/opencode with same token type
      // In Octane AI, all ot/ models share the same pool — we try each provider's executor with its own credentials
      // If credentials not found, skip
      let providerCreds = null;
      if (ctx.providerConnections) {
        const conn = ctx.providerConnections.find(c => c.provider === providerId && c.testStatus === "active");
        if (conn) {
          providerCreds = { accessToken: conn.accessToken, ...conn, providerSpecificData: conn.providerSpecificData };
        }
      }
      // Cegah 401: jika creds sudah error 401, skip dan suruh re-login (jangan hit upstream)
      if (shouldPrevent401(providerCreds)) {
        const err = new Error(`Freebuff auth 401 — re-login di dashboard untuk ${providerId} (gh ${providerCreds?.name || providerCreds?.email || "?"})`);
        err.status = 401;
        lastError = err;
        log?.warn?.("OCTANE", `Skip ${providerId} ot/${cleanModel} — token 401, perlu re-login`);
        if (!fallbackEnabled) throw err;
        continue;
      }
      // If no specific creds, try the passed credentials (for free tier, token may be generic)
      if (!providerCreds && ctx.credentials) {
        providerCreds = ctx.credentials;
      }
      if (!providerCreds) continue;

      try {
        // Map clean ot/ id to provider's expected id
        let providerModel = cleanModel;
        // Freebuff expects upstream ids like openai/gpt-5.6-luna etc., but its normalize handles clean
        // Opencode expects x-preview-f-free etc. as is
        const result = await executor.execute({
          model: providerModel,
          body: { ...body, model: providerModel },
          stream,
          credentials: providerCreds,
          signal,
          log,
          proxyOptions,
          settings: ctx.settings,
          providerConnections: ctx.providerConnections,
        });
        return result;
      } catch (e) {
        lastError = e;
        log?.warn?.("OCTANE", `ot/${cleanModel} via ${providerId} failed: ${e.message} — trying next`);
        // If it's a hard auth error, try next provider; if it's rate limit, also try next
        continue;
      }
    }
    throw lastError || new Error(`Octane: no provider available for ot/${cleanModel}`);
  }
}

export default OctaneExecutor;
