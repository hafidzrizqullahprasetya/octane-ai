export default {
  id: "opencode",
  priority: 40,
  hasFree: true,
  alias: "oc",
  aliases: ["oc", "opencode"],
  uiAlias: "oc",
  display: {
    name: "OpenCode Free",
    icon: "terminal",
    color: "#E87040",
    textIcon: "OC",
  },
  category: "free",
  noAuth: true,
  transport: {
    baseUrl: "https://opencode.ai",
    headers: {
      "x-opencode-client": "desktop",
    },
    forceStream: true,
    noAuth: true,
    quirks: {
      forceAutoToolChoiceModels: ["muse-spark-1.3-contributor-free"],
    },
  },
  models: [
    // Endpoint formats differ per model, so declare non-chat models explicitly.
    { id: "muse-spark-1.2-contributor-free", name: "Muse Spark 1.2 Contributor Free", targetFormat: "openai-responses" },
    { id: "muse-spark-1.3(xhigh)", name: "Muse Spark 1.3 (XHigh)", targetFormat: "openai-responses" },
    { id: "muse-spark-1.3(high)", name: "Muse Spark 1.3 (High)", targetFormat: "openai-responses" },
    { id: "muse-spark-1.3(medium)", name: "Muse Spark 1.3 (Medium)", targetFormat: "openai-responses" },
    { id: "muse-spark-1.3(low)", name: "Muse Spark 1.3 (Low)", targetFormat: "openai-responses" },
    { id: "muse-spark-1.3(minimal)", name: "Muse Spark 1.3 (Minimal)", targetFormat: "openai-responses" },
    { id: "muse-spark-1.3", name: "Muse Spark 1.3 (Default)", targetFormat: "openai-responses" },
    { id: "muse-spark-1.3-contributor-free", name: "Muse Spark 1.3 Contributor Free", targetFormat: "openai-responses" },
    { id: "union-alpha", name: "Union Alpha Free", targetFormat: "claude" },
    { id: "mimo-v2.5-free", name: "MiMo V2.5 Free" },
    { id: "laguna-s-2.1-free", name: "Laguna S 2.1 Free" },
    { id: "jev-1.13-free", name: "Jev 1.13 Free", kind: "systemone" },
  ],
  serviceKinds: ["llm", "systemone"],
  systemoneConfig: {
    baseUrl: "https://opencode.ai/zen/v1/systemone",
    headers: {
      "x-opencode-client": "desktop",
      "User-Agent": "opencode/1.18.31",
    },
  },
  modelsFetcher: { url: "https://opencode.ai/zen/v1/models", type: "opencode-free" },
  passthroughModels: true,
};
