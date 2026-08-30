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
  models: [
    // Freebuff core (vision+reasoning)
    { id: "gpt-5.6-luna", name: "GPT-5.6 Luna", upstreamModelId: "openai/gpt-5.6-luna" },
    { id: "gpt-5.6-luna(high)", name: "GPT-5.6 Luna (High)", upstreamModelId: "openai/gpt-5.6-luna" },
    { id: "gpt-5.6-luna(xhigh)", name: "GPT-5.6 Luna (XHigh)", upstreamModelId: "openai/gpt-5.6-luna" },
    { id: "gpt-5.6-luna(max)", name: "GPT-5.6 Luna (Max)", upstreamModelId: "openai/gpt-5.6-luna" },
    { id: "kimi-k3", name: "Kimi K3", upstreamModelId: "crof/kimi-k3-eco" },
    { id: "kimi-k3(high)", name: "Kimi K3 (High)", upstreamModelId: "crof/kimi-k3-eco" },
    { id: "kimi-k3(xhigh)", name: "Kimi K3 (XHigh)", upstreamModelId: "crof/kimi-k3-eco" },
    { id: "kimi-k3(max)", name: "Kimi K3 (Max)", upstreamModelId: "crof/kimi-k3-eco" },
    { id: "muse-spark-1.2", name: "Muse Spark 1.2", upstreamModelId: "meta/muse-spark-1.2" },
    { id: "muse-spark-1.2(xhigh)", name: "Muse Spark 1.2 (XHigh)", upstreamModelId: "meta/muse-spark-1.2" },
    { id: "deepseek-v4-flash", name: "DeepSeek V4 Flash", upstreamModelId: "deepseek/deepseek-v4-flash" },
    { id: "mimo-v2.5", name: "MiMo V2.5", upstreamModelId: "mimo/mimo-v2.5" },
    // Opencode Free extras
    { id: "muse-spark-1.2-contributor-free", name: "Muse Spark 1.2 Contributor Free", upstreamModelId: "muse-spark-1.2-contributor-free" },
    { id: "ox-alpha-free", name: "Ox Alpha Free", upstreamModelId: "ox-alpha-free" },
    { id: "x-preview-f-free", name: "Ox Preview Free", upstreamModelId: "x-preview-f-free" },
    { id: "mimo-v2.5-free", name: "MiMo V2.5 Free", upstreamModelId: "mimo-v2.5-free" },
    { id: "nemotron-3.5-lightning-free", name: "Nemotron 3.5 Lightning Free", upstreamModelId: "nemotron-3.5-lightning-free" },
    { id: "nemotron-3-ultra-free", name: "Nemotron 3 Ultra Free", upstreamModelId: "nemotron-3-ultra-free" },
    { id: "laguna-s-2.1-free", name: "Laguna S 2.1 Free", upstreamModelId: "laguna-s-2.1-free" },
    { id: "hy3-free", name: "Hunyuan 3 Free", upstreamModelId: "hy3-free" },
    { id: "big-pickle", name: "Big Pickle Free", upstreamModelId: "big-pickle" },
  ],
};
