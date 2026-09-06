/**
 * Freebuff — the free, ad-supported coding agent by Codebuff (freebuff.com).
 *
 * The Freebuff CLI (github.com/CodebuffAI/freebuff) is an interactive TUI that
 * talks to the Codebuff/Freebuff backend. Two hosts are involved:
 *   - login flow (freebuff mode) runs on  https://freebuff.com
 *       POST /api/auth/cli/code {fingerprintId} → { loginUrl, fingerprintHash, expiresAt }
 *       open loginUrl in browser, then GET /api/auth/cli/status until {user}.
 *       (The server echoes the request host into loginUrl, so calling
 *       freebuff.com yields freebuff.com/login?auth_code=… exactly like the
 *       official CLI — www.codebuff.com would yield the wrong link.)
 *   - LLM traffic goes to the OpenAI-compatible endpoint on
 *       https://www.codebuff.com/api/v1/chat/completions
 *     (freebuff.com does NOT serve /api/v1/* — it 404s with the SPA shell.)
 *
 * Both hosts share one backend: the authToken obtained via the freebuff.com
 * login validates against www.codebuff.com (Bearer auth). The request body
 * must carry the CLI's `codebuff` provider block
 * (`codebuff_metadata.run_id/client_id/cost_mode`) — injected by
 * executors/freebuff.js. cost_mode:"free" is what admits a session on the free
 * (country-gated, session-limited) tier instead of billing credits.
 */
export default {
  id: "freebuff",
  priority: 45,
  hasFree: true,
  alias: "fb",
  aliases: ["fb", "codebuff", "freebuff"],
  uiAlias: "fb",
  display: {
    name: "Freebuff",
    icon: "bolt",
    color: "#84CC16",
    textIcon: "FB",
    website: "https://freebuff.com",
    notice: {
      signupUrl: "https://freebuff.com",
      text: "Freebuff / Codebuff multi-account pool with custom thinking levels.",
    },
  },
  category: "free",
  authType: "oauth",
  authModes: ["oauth"],
  hasOAuth: true,
  transport: {
    baseUrl: "https://www.codebuff.com/api/v1/chat/completions",
    format: "openai",
    headers: {
      "User-Agent": "ai-sdk/openai-compatible/1.0/codebuff",
    },
    retry: {
      429: { attempts: 2, delayMs: 2000 },
      503: { attempts: 2, delayMs: 1500 },
    },
    // Session endpoint doubles as the quota API: GET /api/v1/freebuff/session
    // returns the shared daily session quota (rateLimitsByModel) without
    // claiming anything — POST would burn a session, so quota reads are GET
    // only (see services/usage/freebuff.js).
    usage: {
      url: "https://www.codebuff.com/api/v1/freebuff/session",
    },
  },
  features: {
    usage: true,
  },
  // Active & verified OctaneAI / Freebuff models with all thinking endpoints
  // (6-model allowlist — mirrors executors/freebuff.js FREE_ROOT_AGENT_BY_MODEL)
  // Default-only: the fb/ path strips thinking suffixes and drops
  // reasoning_effort (base3 agents own reasoning server-side), so suffixed
  // variants would be cosmetic — one entry per model, server default applies.
  models: [
    // 🧠 GPT-5.6 Luna (Vision + Reasoning)
    { id: "gpt-5.6-luna", name: "GPT-5.6 Luna", upstreamModelId: "openai/gpt-5.6-luna" },

    // ⚡ DeepSeek V4 Flash (High Speed / Night Route)
    { id: "deepseek-v4-flash", name: "DeepSeek V4 Flash", upstreamModelId: "deepseek/deepseek-v4-flash" },

    // 🌀 MiMo V2.5 (Unlimited Free)
    { id: "mimo-v2.5", name: "MiMo V2.5", upstreamModelId: "mimo/mimo-v2.5" },

    // 🧪 Z-AI GLM-5.3 Flash (Hero / Unmetered, server-pinned high — Default only)
    { id: "glm-5.3-flash", name: "GLM-5.3 Flash", upstreamModelId: "z-ai/glm-5.3-flash" },

    // ☀️ Upstage Solar Pro 4
    { id: "solar-pro4", name: "Solar Pro 4", upstreamModelId: "upstage/solar-pro4" },

    // 🎨 Meta Muse Spark 1.3 (via freebuff; for effort control use ot/muse-spark via opencode)
    { id: "muse-spark-1.3", name: "Muse Spark 1.3", upstreamModelId: "meta/muse-spark-1.3-contributor" },
  ],
  // Login-flow host — the CLI in freebuff mode logs in via freebuff.com, and
  // the server builds loginUrl from the host it was called on, so the link the
  // user opens must come from freebuff.com to match the official CLI.
  oauth: {
    baseUrl: "https://freebuff.com",
    loginCodePath: "/api/auth/cli/code",
    loginStatusPath: "/api/auth/cli/status",
    oauthTimeoutMs: 300000,
  },
};
