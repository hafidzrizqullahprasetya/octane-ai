export default {
  id: "octane",
  priority: 1,
  hasFree: true,
  alias: "ot",
  aliases: ["ot", "oct", "octane"],
  uiAlias: "ot",
  display: {
    name: "Octane AI",
    icon: "rocket_launch",
    color: "#FF6B35",
    textIcon: "OT",
    website: "https://api.octane.web.id",
    notice: {
      text: "Koleksi semua model ot/ gratis — auto fallback antar provider sesuai urutan.",
    },
  },
  category: "free",
  authType: "oauth",
  authModes: ["oauth"],
  hasOAuth: false,
  noAuth: true,
  // Unified collection — no direct transport, executor will delegate to underlying provider
  transport: {
    baseUrl: "https://api.octane.web.id/v1/chat/completions",
    format: "openai",
  },
  features: {
    usage: true,
  },
  // Clean ot/ ids — tanpa meta/openai/crof prefix, branding ot/ langsung
  // Default-only untuk rute freebuff (luna/deepseek/mimo/glm/solar): suffix
  // thinking di-strip dan reasoning di-drop executor (server default), jadi
  // varian suffix kosmetik. Varian thinking cuma untuk rute yang effort-nya
  // diteruskan (muse via opencode, experientiallabs).
  models: [
    // Freebuff core (vision+reasoning)
    { id: "gpt-5.6-luna", name: "GPT-5.6 Luna", upstreamModelId: "openai/gpt-5.6-luna" },
    { id: "muse-spark-1.3", name: "Muse Spark 1.3", upstreamModelId: "muse-spark-1.3-contributor", contextLength: 1000000 },
    { id: "muse-spark-1.3(minimal)", name: "Muse Spark 1.3 (Minimal)", upstreamModelId: "muse-spark-1.3-contributor", contextLength: 1000000 },
    { id: "muse-spark-1.3(low)", name: "Muse Spark 1.3 (Low)", upstreamModelId: "muse-spark-1.3-contributor", contextLength: 1000000 },
    { id: "muse-spark-1.3(medium)", name: "Muse Spark 1.3 (Medium)", upstreamModelId: "muse-spark-1.3-contributor", contextLength: 1000000 },
    { id: "muse-spark-1.3(high)", name: "Muse Spark 1.3 (High)", upstreamModelId: "muse-spark-1.3-contributor", contextLength: 1000000 },
    { id: "muse-spark-1.3(xhigh)", name: "Muse Spark 1.3 (XHigh)", upstreamModelId: "muse-spark-1.3-contributor", contextLength: 1000000 },
    { id: "deepseek-v4-flash", name: "DeepSeek V4 Flash", upstreamModelId: "deepseek/deepseek-v4-flash", thinking: true, vision: true, contextLength: 1000000 },
    { id: "mimo-v2.5", name: "MiMo V2.5", upstreamModelId: "mimo/mimo-v2.5", thinking: true, vision: true, contextLength: 1000000 },
    // Octane-ZAI self-hosted (GLM via akun Z.ai sendiri, 1M context)
    { id: "glm-5.3", name: "GLM 5.3", upstreamModelId: "glm-5.3", contextLength: 1000000 },
    { id: "glm-5.3-flash", name: "GLM 5.3 Flash", upstreamModelId: "glm-5.3-flash", thinking: true, vision: true, contextLength: 1000000 },
    // Opencode Free extras
    { id: "muse-spark-1.3-contributor-free", name: "Muse Spark 1.3 Contributor Free", upstreamModelId: "muse-spark-1.3-contributor-free" },
    { id: "ox-alpha-free", name: "Ox Alpha Free", upstreamModelId: "ox-alpha-free" },
    { id: "x-preview-f-free", name: "Ox Preview Free", upstreamModelId: "x-preview-f-free" },
    { id: "mimo-v2.5-free", name: "MiMo V2.5 Free", upstreamModelId: "mimo-v2.5-free" },
    { id: "laguna-s-2.1-free", name: "Laguna S 2.1 Free", upstreamModelId: "laguna-s-2.1-free" },
    // Experiential Labs (free $0 tier, via env key EXPERIENTIALLABS_API_KEY)
    { id: "gpt-6-astra", name: "GPT-6 Astra", upstreamModelId: "gpt-6-astra", thinking: true, contextLength: 1050000 },
    { id: "gpt-6-astra(high)", name: "GPT-6 Astra (High)", upstreamModelId: "gpt-6-astra", thinking: true },
    { id: "claude-fable-5.1", name: "Claude Fable 5.1", upstreamModelId: "claude-fable-5.1", thinking: true, contextLength: 1000000 },
    { id: "claude-fable-5.1(high)", name: "Claude Fable 5.1 (High)", upstreamModelId: "claude-fable-5.1", thinking: true },
    { id: "deepseek-v4-flash-exp", name: "DeepSeek V4 Flash (Exp)", upstreamModelId: "deepseek-v4-flash-exp", thinking: true, contextLength: 1050000 },
    { id: "deepseek-v4-flash-exp(high)", name: "DeepSeek V4 Flash Exp (High)", upstreamModelId: "deepseek-v4-flash-exp", thinking: true },
    { id: "minimax-m3-free", name: "MiniMax M3 Free", upstreamModelId: "minimax-m3-free", thinking: true, contextLength: 1000000 },
  ],
};
