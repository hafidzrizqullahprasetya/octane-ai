import { DefaultExecutor } from "./default.js";

/**
 * Experiential Labs executor — DefaultExecutor + env-key fallback.
 *
 * Dua penyimpangan dari DefaultExecutor:
 * 1. Auth: kalau koneksi tidak punya accessToken/apiKey (mis. kandidat "noauth"
 *    sintetis dari delegasi ot/), pakai EXPERIENTIALLABS_API_KEY dari env —
 *    pola env-fallback yang sama dengan azure.js. Header didelete dulu supaya
 *    tidak tertinggal "Bearer undefined" dari jalur combined-auth.
 * 2. Suffix effort ot/ `model(level)` dipetakan ke `reasoning_effort` upstream:
 *    low|medium -> "low", high|xhigh|max -> "high" (EXPLABS_EFFORT_MAP).
 */
const EXPLABS_EFFORT_MAP = { low: "low", medium: "low", high: "high", xhigh: "high", max: "high" };

export class ExperientialLabsExecutor extends DefaultExecutor {
  constructor() {
    super("experientiallabs");
  }

  transformRequest(model, body) {
    const base = String(model || "").split("(")[0].trim();
    const m = /\(([^)]+)\)/.exec(String(model || ""));
    const effort = m ? EXPLABS_EFFORT_MAP[m[1].trim()] : undefined;
    const transformed = super.transformRequest(base, body);
    if (transformed && typeof transformed === "object") {
      // Upstream must receive the clean id (delegation may pass "model(high)")
      if (transformed.model !== undefined || body?.model !== undefined) transformed.model = base;
      if (effort) transformed.reasoning_effort = effort;
    }
    return transformed;
  }

  buildHeaders(credentials, stream = true, url, model) {
    const headers = super.buildHeaders(credentials, stream, url, model);
    const hasToken = credentials?.apiKey || credentials?.accessToken;
    if (!hasToken) {
      for (const k of Object.keys(headers)) {
        if (k.toLowerCase() === "authorization") delete headers[k];
      }
      const envKey = process.env.EXPERIENTIALLABS_API_KEY?.trim();
      if (envKey) headers["Authorization"] = `Bearer ${envKey}`;
    }
    return headers;
  }
}

export default ExperientialLabsExecutor;
