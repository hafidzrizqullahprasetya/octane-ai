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
  alias: "ot",
  aliases: ["fb", "octane", "octaneai"],
  uiAlias: "ot",
  display: {
    name: "OctaneAI",
    icon: "bolt",
    color: "#84CC16",
    textIcon: "OT",
    website: "https://octaneai.com",
    notice: {
      signupUrl: "https://freebuff.com",
      text: "OctaneAI provider (powered by Freebuff multi-account pool). High-performance AI proxy with custom thinking levels.",
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
  models: [
    // 🧠 GPT-5.6 Luna (Vision + Reasoning)
    { id: "gpt-5.6-luna(high)", name: "GPT-5.6 Luna (High)", upstreamModelId: "openai/gpt-5.6-luna" },
    { id: "gpt-5.6-luna(xhigh)", name: "GPT-5.6 Luna (XHigh)", upstreamModelId: "openai/gpt-5.6-luna" },
    { id: "gpt-5.6-luna(max)", name: "GPT-5.6 Luna (Max)", upstreamModelId: "openai/gpt-5.6-luna" },
    { id: "gpt-5.6-luna", name: "GPT-5.6 Luna (Default)", upstreamModelId: "openai/gpt-5.6-luna" },

    // 🌌 Kimi K3 (1.05M Context Reasoning)
    { id: "kimi-k3(high)", name: "Kimi K3 (High)", upstreamModelId: "crof/kimi-k3-eco" },
    { id: "kimi-k3(xhigh)", name: "Kimi K3 (XHigh)", upstreamModelId: "crof/kimi-k3-eco" },
    { id: "kimi-k3(max)", name: "Kimi K3 (Max)", upstreamModelId: "crof/kimi-k3-eco" },
    { id: "kimi-k3", name: "Kimi K3 (Default)", upstreamModelId: "crof/kimi-k3-eco" },

    // 🐂 Ox Alpha (1M Context Vision & Reasoning)
    { id: "ox-alpha(low)", name: "Ox Alpha (Low)", upstreamModelId: "stealth/ox-alpha" },
    { id: "ox-alpha(high)", name: "Ox Alpha (High)", upstreamModelId: "stealth/ox-alpha" },
    { id: "ox-alpha(max)", name: "Ox Alpha (Max)", upstreamModelId: "stealth/ox-alpha" },
    { id: "ox-alpha", name: "Ox Alpha (Default)", upstreamModelId: "stealth/ox-alpha" },

    // ⚡ DeepSeek V4 Flash (High Speed / Night Route)
    { id: "deepseek-v4-flash(high)", name: "DeepSeek V4 Flash (High)", upstreamModelId: "deepseek/deepseek-v4-flash" },
    { id: "deepseek-v4-flash(max)", name: "DeepSeek V4 Flash (Max)", upstreamModelId: "deepseek/deepseek-v4-flash" },
    { id: "deepseek-v4-flash", name: "DeepSeek V4 Flash (Default)", upstreamModelId: "deepseek/deepseek-v4-flash" },

    // 🎨 Meta Muse Spark 1.2 (OpenCode Route)
    { id: "muse-spark-1.2(minimal)", name: "Muse Spark 1.2 (Minimal)", upstreamModelId: "meta/muse-spark-1.2" },
    { id: "muse-spark-1.2(low)", name: "Muse Spark 1.2 (Low)", upstreamModelId: "meta/muse-spark-1.2" },
    { id: "muse-spark-1.2(medium)", name: "Muse Spark 1.2 (Medium)", upstreamModelId: "meta/muse-spark-1.2" },
    { id: "muse-spark-1.2(high)", name: "Muse Spark 1.2 (High)", upstreamModelId: "meta/muse-spark-1.2" },
    { id: "muse-spark-1.2(xhigh)", name: "Muse Spark 1.2 (XHigh)", upstreamModelId: "meta/muse-spark-1.2" },
    { id: "muse-spark-1.2", name: "Muse Spark 1.2 (Default)", upstreamModelId: "meta/muse-spark-1.2" },

    // 🤖 GLM-5.3 & GLM-5.2 (CodeBuddy Route)
    { id: "glm-5.3(high)", name: "GLM-5.3 (High)", upstreamModelId: "glm-5.3" },
    { id: "glm-5.3(xhigh)", name: "GLM-5.3 (XHigh)", upstreamModelId: "glm-5.3" },
    { id: "glm-5.3(max)", name: "GLM-5.3 (Max)", upstreamModelId: "glm-5.3" },
    { id: "glm-5.3", name: "GLM-5.3 (Default)", upstreamModelId: "glm-5.3" },
    { id: "kimi-k3(high)", name: "Kimi K3 (High)", upstreamModelId: "kimi-k3" },
    { id: "kimi-k3(xhigh)", name: "Kimi K3 (XHigh)", upstreamModelId: "kimi-k3" },
    { id: "kimi-k3(max)", name: "Kimi K3 (Max)", upstreamModelId: "kimi-k3" },
    { id: "kimi-k3", name: "Kimi K3 (Default)", upstreamModelId: "kimi-k3" },
    { id: "glm-5.2(high)", name: "GLM-5.2 (High)", upstreamModelId: "glm-5.2" },
    { id: "glm-5.2(xhigh)", name: "GLM-5.2 (XHigh)", upstreamModelId: "glm-5.2" },
    { id: "glm-5.2", name: "GLM-5.2 (Default)", upstreamModelId: "glm-5.2" },
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
