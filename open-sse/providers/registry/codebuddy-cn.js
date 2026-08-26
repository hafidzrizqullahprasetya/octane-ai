export default {
  id: "codebuddy-cn",
  // Short model prefix (cbcn/glm-5.2). "cbcn" = CodeBuddy CN; reserve "cbai"
  // for a future codebuddy-ai (intl) provider. The full id still resolves.
  alias: "cbcn",
  uiAlias: "cbcn",
  hidden: false,
  priority: 90,
  display: {
    name: "CodeBuddy CN",
    icon: "smart_toy",
    color: "#006EFF",
    website: "https://copilot.tencent.com",
    notice: {
      signupUrl: "https://copilot.tencent.com",
    },
  },
  category: "oauth",
  authModes: ["oauth", "apikey"],
  hasOAuth: true,
  transport: {
    baseUrl: "https://copilot.tencent.com/v2/chat/completions",
    forceStream: true,
    // CodeBuddy is a unified OpenAI-compatible gateway: every model (GLM, Kimi,
    // MiniMax, DeepSeek, Hunyuan) takes reasoning via OpenAI-style reasoning_effort,
    // not its vendor-native thinking shape. Force the openai thinking format.
    thinkingFormat: "openai",
    headers: {
      "User-Agent": "CLI/2.108.1 CodeBuddy/2.108.1",
      "X-Product": "SaaS",
      "X-IDE-Type": "CLI",
      "X-IDE-Name": "CLI",
      "x-requested-with": "XMLHttpRequest",
      "x-codebuddy-request": "1",
    },
    auth: {
      combined: true,
      header: "Authorization",
      scheme: "bearer",
    },
    // Quota endpoint differs from the chat gateway: POST returns nested Tencent
    // billing payload (data.Response.Data.Accounts[]). See services/usage/codebuddy-cn.js.
    usage: {
      url: "https://copilot.tencent.com/v2/billing/meter/get-user-resource",
    },
  },
  models: [
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
    { id: "kimi-k2.6", name: "Kimi-K2.6" },
    { id: "kimi-k2.5", name: "Kimi-K2.5" },

    // Anthropic Claude Series
    { id: "claude-opus-5(high)", name: "Claude Opus 5 (High Reasoning)" },
    { id: "claude-opus-5(xhigh)", name: "Claude Opus 5 (XHigh Reasoning)" },
    { id: "claude-opus-5(max)", name: "Claude Opus 5 (Max Reasoning)" },
    { id: "claude-opus-5", name: "Claude Opus 5" },
    { id: "claude-opus-4.6", name: "Claude Opus 4.6" },
    { id: "claude-sonnet-4.6(max)", name: "Claude Sonnet 4.6 (Max Reasoning)" },
    { id: "claude-sonnet-4.6", name: "Claude Sonnet 4.6" },

    // OpenAI GPT-5.6 Series
    { id: "gpt-5.6-luna", name: "GPT-5.6 Luna" },
    { id: "gpt-5.6-sol", name: "GPT-5.6 Sol" },
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
    { id: "minimax-m3", name: "MiniMax-M3" },

    // DeepSeek Series
    { id: "deepseek-v4-pro", name: "DeepSeek-V4-Pro" },
    { id: "deepseek-v4-flash", name: "DeepSeek-V4-Flash" },
    { id: "deepseek-v3-2-volc", name: "DeepSeek-V3.2" },

    // Vision
    { id: "glm-5v-turbo", name: "GLM-5v-Turbo" },
  ],
  oauth: {
    baseUrl: "https://copilot.tencent.com",
    stateUrl: "https://copilot.tencent.com/v2/plugin/auth/state",
    tokenUrl: "https://copilot.tencent.com/v2/plugin/auth/token",
    refreshUrl: "https://copilot.tencent.com/v2/plugin/auth/token/refresh",
    userAgent: "CLI/2.63.2 CodeBuddy/2.63.2",
    platform: "CLI",
    pollInterval: 5000,
  },
  features: {
    usage: true,
    usageApikey: true,
  },
};
