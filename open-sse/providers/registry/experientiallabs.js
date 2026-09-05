/**
 * Experiential Labs — OpenAI-compatible aggregator (fireworks/azure-foundry routes).
 * API key via env EXPERIENTIALLABS_API_KEY (env-fallback pattern, cf. azure.js);
 * a DB connection row with the same provider id also works.
 * Gratis untuk 4 model unggulan (rate $0) — routed via ot/ masking di OctaneExecutor.
 */
export default {
  id: "experientiallabs",
  priority: 45,
  hasFree: true,
  alias: "exp",
  aliases: ["exp", "explabs", "experientiallabs"],
  uiAlias: "exp",
  display: {
    name: "Experiential Labs",
    icon: "science",
    color: "#00B8D4",
    textIcon: "EL",
    website: "https://platform.experientiallabs.ai",
    notice: {
      apiKeyUrl: "https://platform.experientiallabs.ai/docs",
      text: "OpenAI-compatible gateway — set EXPERIENTIALLABS_API_KEY di .env.",
    },
  },
  category: "free",
  authType: "apikey",
  authModes: ["apikey"],
  transport: {
    baseUrl: "https://api.experientiallabs.ai/v1/chat/completions",
    format: "openai",
  },
  features: {
    usage: true,
    usageApikey: true,
  },
  models: [
    { id: "gpt-6-astra", name: "GPT-6 Astra", upstreamModelId: "gpt-6-astra", thinking: true, contextLength: 1050000 },
    { id: "claude-fable-5.1", name: "Claude Fable 5.1", upstreamModelId: "claude-fable-5.1", thinking: true, contextLength: 1000000 },
    { id: "deepseek-v4-flash", name: "DeepSeek V4 Flash", upstreamModelId: "deepseek-v4-flash", thinking: true, contextLength: 1050000 },
    { id: "minimax-m3-free", name: "MiniMax M3 Free", upstreamModelId: "minimax-m3-free", thinking: true, contextLength: 1000000 },
  ],
};
