// CodeBuddy international (codebuddy.ai) — mirrors codebuddy-cn registry shape,
// swapping the Tencent CN domain for the .ai endpoint set. All OAuth/plugin URLs
// use the /v2/plugin prefix with platform=ide (CN uses platform=CLI).
export default {
  id: "codebuddy-intl",
  alias: "cbai",
  uiAlias: "cbai",
  hidden: false,
  priority: 90,
  display: {
    name: "CodeBuddy",
    icon: "smart_toy",
    color: "#006EFF",
    website: "https://www.codebuddy.ai",
    notice: {
      signupUrl: "https://www.codebuddy.ai",
    },
  },
  category: "oauth",
  authModes: ["oauth", "apikey"],
  hasOAuth: true,
  transport: {
    // Chat gateway is OpenAI-compatible SSE (same /v2/chat/completions path as CN).
    baseUrl: "https://www.codebuddy.ai/v2/chat/completions",
    forceStream: true,
    // CodeBuddy intl speaks the same unified OpenAI reasoning_effort shape as CN.
    thinkingFormat: "openai",
    headers: {
      "User-Agent": "IDE/2.108.1 CodeBuddy/2.108.1",
      "X-Product": "SaaS",
      "X-IDE-Type": "IDE",
      "X-IDE-Name": "IDE",
      "x-requested-with": "XMLHttpRequest",
      "x-codebuddy-request": "1",
    },
    auth: {
      combined: true,
      header: "Authorization",
      scheme: "bearer",
    },
    // Intl billing endpoint mirrors CN shape (data.Response.Data.Accounts[]).
    usage: {
      url: "https://www.codebuddy.ai/v2/billing/meter/get-user-resource",
    },
  },
  models: [
    // DeepSeek Series
    { id: "deepseek-v4.1-flash", name: "DeepSeek-V4.1-Flash" },

    // GLM 5.3 Series
    { id: "glm-5.3(high)", name: "GLM-5.3 (High Reasoning)" },
    { id: "glm-5.3(xhigh)", name: "GLM-5.3 (XHigh Reasoning)" },
    { id: "glm-5.3(max)", name: "GLM-5.3 (Max Reasoning)" },
    { id: "glm-5.3", name: "GLM-5.3" },

    // Kimi K3 Series
    { id: "kimi-k3(high)", name: "Kimi-K3 (High Reasoning)" },
    { id: "kimi-k3(xhigh)", name: "Kimi-K3 (XHigh Reasoning)" },
    { id: "kimi-k3(max)", name: "Kimi-K3 (Max Reasoning)" },
    { id: "kimi-k3", name: "Kimi-K3" },

    // Anthropic Claude Series
    { id: "claude-opus-5(high)", name: "Claude Opus 5 (High Reasoning)" },
    { id: "claude-opus-5(xhigh)", name: "Claude Opus 5 (XHigh Reasoning)" },
    { id: "claude-opus-5(max)", name: "Claude Opus 5 (Max Reasoning)" },
    { id: "claude-opus-5", name: "Claude Opus 5" },
    { id: "claude-opus-4.6", name: "Claude Opus 4.6" },
    { id: "claude-sonnet-4.6(max)", name: "Claude Sonnet 4.6 (Max Reasoning)" },
    { id: "claude-sonnet-4.6", name: "Claude Sonnet 4.6" },

    // OpenAI GPT-5.6 / GPT-5.5 Series
    { id: "gpt-5.6-luna(high)", name: "GPT-5.6 Luna (High Reasoning)" },
    { id: "gpt-5.6-luna(xhigh)", name: "GPT-5.6 Luna (XHigh Reasoning)" },
    { id: "gpt-5.6-luna(max)", name: "GPT-5.6 Luna (Max Reasoning)" },
    { id: "gpt-5.6-luna", name: "GPT-5.6 Luna" },
    { id: "gpt-5.6-terra(high)", name: "GPT-5.6 Terra (High Reasoning)" },
    { id: "gpt-5.6-terra(xhigh)", name: "GPT-5.6 Terra (XHigh Reasoning)" },
    { id: "gpt-5.6-terra(max)", name: "GPT-5.6 Terra (Max Reasoning)" },
    { id: "gpt-5.6-terra", name: "GPT-5.6 Terra" },
    { id: "gpt-5.5(high)", name: "GPT-5.5 (High Reasoning)" },
    { id: "gpt-5.5", name: "GPT-5.5" },

    // MiniMax Series
    { id: "minimax-m3(high)", name: "MiniMax-M3 (High Reasoning)" },
    { id: "minimax-m3(xhigh)", name: "MiniMax-M3 (XHigh Reasoning)" },
    { id: "minimax-m3(max)", name: "MiniMax-M3 (Max Reasoning)" },
  ],
  oauth: {
    baseUrl: "https://www.codebuddy.ai",
    stateUrl: "https://www.codebuddy.ai/v2/plugin/auth/state",
    tokenUrl: "https://www.codebuddy.ai/v2/plugin/auth/token",
    refreshUrl: "https://www.codebuddy.ai/v2/plugin/auth/token/refresh",
    userAgent: "IDE/2.63.2 CodeBuddy/2.63.2",
    platform: "ide",
    pollInterval: 5000,
  },
  features: {
    usage: true,
    usageApikey: true,
  },
};
