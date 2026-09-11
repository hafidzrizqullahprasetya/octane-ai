export default {
  id: "alysis",
  priority: 75,
  alias: "alysis",
  aliases: [
    "alysiscode",
  ],
  uiAlias: "alysis",
  display: {
    name: "Alysis",
    icon: "bolt",
    color: "#8B5CF6",
    textIcon: "AL",
    website: "https://alysiscode.com",
    notice: {
      signupUrl: "https://alysiscode.com",
    },
  },
  category: "apikey",
  authType: "apikey",
  authModes: ["apikey"],
  transport: {
    baseUrl: "https://vzigujbcjjmpntxhmyvr.supabase.co/functions/v1/llm/v1/chat/completions",
    format: "openai",
    quirks: {
      // Host runs a strict request schema (Supabase edge fn): unknown message
      // fields like the DeepSeek-style `reasoning_content` placeholder are
      // rejected with 400 "Invalid or oversized hosted request" on multi-turn
      // sessions (every assistant message carries it). Strip them.
      dropReasoningContent: true,
    },
  },
  models: [
    { id: "deepseek-v4-flash", name: "DeepSeek V4 Flash" },
    { id: "deepseek-v4-flash-vision-exp", name: "DeepSeek V4 Flash Vision (Exp)" },
    { id: "deepseek-v4-pro", name: "DeepSeek V4 Pro" },
    { id: "deepseek-v4.1-flash-expires-on-0910", name: "DeepSeek V4.1 Flash (Exp)" },
  ],
  features: { usage: true, usageApikey: true },
};
