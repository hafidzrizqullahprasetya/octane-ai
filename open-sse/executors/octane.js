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

// REAL FREEBUFF — tanpa CodeBuddy, semua ot/ murni freebuff/opencode
// thinking suffix (high/xhigh/max) di-strip via baseClean, jadi 1 entry cover semua level max
const MODEL_PROVIDER_MAP = {
  "gpt-5.6-luna": ["freebuff"],
  "kimi-k3": ["freebuff"],
  "muse-spark-1.2": ["freebuff", "opencode"],
  "deepseek-v4-flash": ["freebuff"],
  "mimo-v2.5": ["freebuff"],
  "muse-spark-1.2-contributor-free": ["opencode"],
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
      // Strict model per akun: cari semua koneksi provider itu yang assignedModel cocok dengan cleanModel
      // Biar test per model pakai akun yang memang di-assign untuk model itu, dan reuse sesi yang sama (tidak bikin sesi baru per test)
      let candidates = [];
      if (ctx.providerConnections) {
        candidates = ctx.providerConnections
          .filter(c => c.provider === providerId && c.testStatus === "active")
          .filter(c => {
            const assigned = c.providerSpecificData?.assignedModel || c.providerSpecificData?.freebuffModel || "";
            const baseAssigned = assigned.split("(")[0].trim();
            const baseClean = cleanModel.split("(")[0].trim();
            // Untuk freebuff strict, harus match assignedModel
            if (providerId === "freebuff" && assigned) {
              return baseAssigned === baseClean || assigned === cleanModel;
            }
            return true;
          })
          .sort((a, b) => (a.priority || 999) - (b.priority || 999));
        // Kalau strict dan tidak ada yang match, skip provider ini
        if (providerId === "freebuff" && candidates.length === 0) {
          log?.warn?.("OCTANE", `No strict match for ot/${cleanModel} in ${providerId} — skip`);
          continue;
        }
        // Fallback: kalau tidak ada strict match tapi ada active, pakai yang pertama (untuk opencode yang tidak strict)
        if (candidates.length === 0) {
          const any = ctx.providerConnections.find(c => c.provider === providerId && c.testStatus === "active");
          if (any) candidates = [any];
        }
      }
      // Coba tiap kandidat akun yang strict match (reuse sesi per akun, tidak bikin sesi baru per test)
      for (const conn of candidates) {
        let providerCreds = { accessToken: conn.accessToken, ...conn, providerSpecificData: conn.providerSpecificData };
        // Cegah 401: jika creds sudah error 401, skip dan suruh re-login (jangan hit upstream)
        if (shouldPrevent401(providerCreds)) {
          const err = new Error(`Freebuff auth 401 — re-login di dashboard untuk ${providerId} (gh ${providerCreds?.name || providerCreds?.email || "?"})`);
          err.status = 401;
          lastError = err;
          log?.warn?.("OCTANE", `Skip ${providerId} ot/${cleanModel} gh ${providerCreds?.name} — token 401, perlu re-login`);
          continue;
        }
        // Pakai proxy khusus per akun (biar tidak semua numpuk 1 IP)
        const connProxyOptions = conn.providerSpecificData?.proxyPoolIds?.length
          ? { proxyPoolIds: conn.providerSpecificData.proxyPoolIds, proxyRotationStrategy: conn.providerSpecificData.proxyRotationStrategy, proxyPoolId: conn.providerSpecificData.proxyPoolIds[0] }
          : proxyOptions;

        try {
          let providerModel = cleanModel;
          const result = await executor.execute({
            model: providerModel,
            body: { ...body, model: providerModel },
            stream,
            credentials: providerCreds,
            signal,
            log,
            proxyOptions: connProxyOptions,
            settings: ctx.settings,
            providerConnections: ctx.providerConnections,
          });
          return result;
        } catch (e) {
          lastError = e;
          // Jika 401 dan fallback mati, langsung throw biar test murni kelihatan
          if (e.status === 401 && !fallbackEnabled) throw e;
          log?.warn?.("OCTANE", `ot/${cleanModel} via ${providerId} gh ${providerCreds?.name} failed: ${e.message} — trying next akun`);
          continue;
        }
      }
      // Jika semua kandidat di provider ini gagal dan fallback mati, stop
      if (!fallbackEnabled && lastError) throw lastError;
    }
    throw lastError || new Error(`Octane: no provider available for ot/${cleanModel}`);
  }
}

export default OctaneExecutor;
