export default {
  id: "opencode",
  priority: 40,
  hasFree: true,
  alias: "oc",
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
    noAuth: true,
  },
  models: [
    { id: "x-preview-f-free", name: "Ox Alpha Free (Unlimited)" },
    { id: "ox-alpha-free", name: "Ox Alpha Free (Unlimited)" },
    { id: "mimo-v2.5-free", name: "MiMo V2.5 Free" },
    { id: "nemotron-3.5-lightning-free", name: "Nemotron 3.5 Lightning Free" },
    { id: "nemotron-3-ultra-free", name: "Nemotron 3 Ultra Free" },
    { id: "laguna-s-2.1-free", name: "Laguna S 2.1 Free" },
    { id: "hy3-free", name: "Hunyuan 3 Free" },
    { id: "big-pickle", name: "Big Pickle Free" },
  ],
  modelsFetcher: { url: "https://opencode.ai/zen/v1/models", type: "opencode-free" },
  passthroughModels: true,
};
