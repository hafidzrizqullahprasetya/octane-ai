import { BaseExecutor } from "./base.js";
import { PROVIDERS } from "../config/providers.js";
import { FreebuffExecutor } from "./freebuff.js";
import { OpenCodeExecutor } from "./opencode.js";
import { DefaultExecutor } from "./default.js";
import { resolveConnectionProxyConfig } from "../../src/lib/network/connectionProxy.js";
import { getSettings } from "../../src/lib/db/repos/settingsRepo.js";
import { getProxyPools } from "../../src/lib/db/repos/proxyPoolsRepo.js";
import { pickProxyPoolId } from "../../src/lib/network/connectionProxy.js";

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
  "muse-spark-1.2": ["opencode"],
  "muse-spark-1.3": ["opencode"],
  "deepseek-v4-flash": ["freebuff"],
  "mimo-v2.5": ["freebuff"],
  "muse-spark-1.3-contributor-free": ["opencode"],
  "muse-spark-1.2-contributor-free": ["opencode"],
  "ox-alpha-free": ["opencode"],
  "mimo-v2.5-free": ["opencode"],
  "laguna-s-2.1-free": ["opencode"],
};

const FREEBUFF_UPSTREAM_MODEL_MAP = {
  "kimi-k3": "crof/kimi-k3-eco",
  "muse-spark-1.2": "meta/muse-spark-1.2-contributor",
  "mimo-v2.5": "mimo/mimo-v2.5",
};

const FREEBUFF_AGENT_MODEL_MAP = {
  "crof/kimi-k3-eco": "base3-free-kimi-k3-eco",
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
    const modelKey = cleanModel.split("(")[0].trim();
    
    // Try to get order from global settings if available (attached to ctx or global)
    let order = providersForModel;
    const configuredModelProvider = ctx.settings?.octaneModelRoutes?.[modelKey];
    if (configuredModelProvider && providersForModel.includes(configuredModelProvider)) {
      order = [configuredModelProvider, ...providersForModel.filter((provider) => provider !== configuredModelProvider)];
    }
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

    const executorMap = getDelegatedExecutors();
    const fallbackEnabled = isFallbackEnabled(ctx.settings);
    // Jika fallback mati, cuma coba provider pertama (freebuff) — biar test murni
    const tryOrder = fallbackEnabled ? order : [order[0]];

    let lastError = null;
    // Delivery tanpa masuk mall: resepsionis harus punya daftar stok gudang.
    // Jika ctx.providerConnections tidak dikirim (chatCore tidak inject), ambil langsung dari DB biar ot/ tetap bisa delivery ke freebuff top order.
    let allConnections = ctx.providerConnections;
    if (!allConnections) {
      try {
        const mod = await import("../../src/lib/db/repos/connectionsRepo.js");
        if (mod.getProviderConnections) {
          allConnections = await mod.getProviderConnections({ isActive: true });
        }
      } catch (e) {
        log?.warn?.("OCTANE", `Failed to load providerConnections: ${e.message}`);
      }
    }
    for (const providerId of tryOrder) {
      const executor = executorMap[providerId] || getDefaultExecutor(providerId);
      // Strict model per akun: cari semua koneksi provider itu yang assignedModel cocok dengan cleanModel
      // Biar test per model pakai akun yang memang di-assign untuk model itu, dan reuse sesi yang sama (tidak bikin sesi baru per test)
      let candidates = [];
      const sourceConns = allConnections || ctx.providerConnections || [];
      if (executor.noAuth) {
        candidates = [{
          id: "noauth",
          provider: providerId,
          name: "Public",
          isActive: true,
          accessToken: "public",
          providerSpecificData: proxyOptions || {},
        }];
      }
      if (sourceConns.length && !executor.noAuth) {
        candidates = sourceConns
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
        if (candidates.length === 0 && !executor.noAuth) {
          const any = sourceConns.find(c => c.provider === providerId && c.testStatus === "active");
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
        // Resolve the same connection proxy as the direct provider path. This
        // keeps ot/ and fb/ on the same egress and preserves model-scoped pool
        // fitness for Freebuff.
        let connProxyOptions = proxyOptions;
        if (providerId === "freebuff") {
          const proxyData = conn.providerSpecificData?.proxyPoolIds?.length
            ? {
                ...conn.providerSpecificData,
                proxyPoolScope: `freebuff::${cleanModel}`,
              }
            : conn.providerSpecificData || {};
          const resolved = await resolveConnectionProxyConfig(proxyData, conn.id);
          if (resolved?.noFitPool) {
            log?.warn?.("OCTANE", `No fit Freebuff proxy pool for ot/${cleanModel}`);
          }
          connProxyOptions = {
            connectionProxyEnabled: resolved.connectionProxyEnabled,
            connectionProxyUrl: resolved.connectionProxyUrl,
            connectionNoProxy: resolved.connectionNoProxy,
            connectionProxyPoolId: resolved.proxyPoolId || null,
            proxyPoolId: resolved.proxyPoolId || null,
            vercelRelayUrl: resolved.vercelRelayUrl || "",
            strictProxy: resolved.strictProxy === true,
          };
        } else if (executor.noAuth) {
          const settings = await getSettings();
          const override = (settings.providerStrategies || {})[providerId] || {};
          const strategy = override.rotateStrategy || "none";
          let poolIds = [];
          let pickedId = override.proxyPoolId || null;
          if (strategy !== "none") {
            const pools = await getProxyPools({ isActive: true });
            poolIds = pools.filter((pool) => pool.proxyUrl).map((pool) => pool.id);
            pickedId = pickProxyPoolId(poolIds, strategy, providerId, { scope: `${providerId}::${cleanModel}` });
          } else if (pickedId) {
            poolIds = [pickedId];
          }
          const resolved = await resolveConnectionProxyConfig({ proxyPoolId: pickedId || "" });
          connProxyOptions = {
            connectionProxyEnabled: resolved.connectionProxyEnabled,
            connectionProxyUrl: resolved.connectionProxyUrl,
            connectionNoProxy: resolved.connectionNoProxy,
            connectionProxyPoolId: resolved.proxyPoolId || null,
            proxyPoolId: resolved.proxyPoolId || null,
            vercelRelayUrl: resolved.vercelRelayUrl || "",
            strictProxy: resolved.strictProxy === true,
            proxyPoolIds: poolIds,
            proxyRotationStrategy: strategy,
          };
        }

        try {
            let providerModel = providerId === "freebuff"
              ? (FREEBUFF_UPSTREAM_MODEL_MAP[cleanModel.split("(")[0].trim()] || cleanModel)
              : cleanModel;
            if (providerId === "freebuff") {
              log?.debug?.("OCTANE", `Freebuff route ot/${cleanModel} -> model=${providerModel} agent=${FREEBUFF_AGENT_MODEL_MAP[providerModel] || "default"} account=${providerCreds?.name || providerCreds?.email || "?"}`);
            }
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

const delegatedExecutors = new Map();
function getDefaultExecutor(providerId) {
  if (!delegatedExecutors.has(providerId)) delegatedExecutors.set(providerId, new DefaultExecutor(providerId));
  return delegatedExecutors.get(providerId);
}

function getDelegatedExecutors() {
  return {
    freebuff: getDefaultExecutor("freebuff") instanceof FreebuffExecutor
      ? getDefaultExecutor("freebuff")
      : delegatedExecutors.set("freebuff", new FreebuffExecutor()).get("freebuff"),
    opencode: delegatedExecutors.has("opencode")
      ? delegatedExecutors.get("opencode")
      : delegatedExecutors.set("opencode", new OpenCodeExecutor()).get("opencode"),
    "codebuddy-intl": getDefaultExecutor("codebuddy-intl"),
    "codebuddy-cn": getDefaultExecutor("codebuddy-cn"),
  };
}

export default OctaneExecutor;
