/**
 * Octane-ZAI — self-hosted AutoClaw (Z.ai) proxy, OpenAI-compatible.
 * Sidecar lokal (docker-compose service `octane-zai`), noAuth seperti opencode.
 * Menyediakan GLM-5.3 (text-only) + GLM-5.3-flash (multimodal) via akun Z.ai sendiri.
 */
export default {
  id: "octane-zai",
  priority: 41,
  hasFree: true,
  alias: "oz",
  aliases: ["oz", "octane-zai"],
  uiAlias: "oz",
  display: {
    name: "Octane ZAI",
    icon: "smart_toy",
    color: "#7C3AED",
    textIcon: "OZ",
    website: "https://github.com/hafidzrizqullahprasetya/octane-zai",
    notice: {
      text: "Self-hosted Z.ai proxy — GLM-5.3 + GLM-5.3-flash via akun sendiri (1M context).",
    },
  },
  category: "free",
  noAuth: true,
  transport: {
    baseUrl: "http://octane-zai:18787/v1/chat/completions",
    format: "openai",
    noAuth: true,
  },
  models: [
    { id: "glm-5.3", name: "GLM 5.3", upstreamModelId: "glm-5.3", strip: ["image", "audio"], contextLength: 1000000 },
    { id: "glm-5.3-flash", name: "GLM 5.3 Flash", upstreamModelId: "glm-5.3-flash", contextLength: 1000000 },
  ],
};
