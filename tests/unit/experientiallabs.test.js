// Regression tests for the Experiential Labs integration (ot/gpt-6-astra,
// ot/claude-fable-5.1, ot/deepseek-v4-flash-exp, ot/minimax-m3-free).
// Written against the integration tree: registry + routing + capabilities +
// pricing guards. Executor source is checked via static read (same seam style
// as octane-zai.test.js) — importing the executor would pull the settings/DB
// chain, so no DB/network is touched here.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import { parseModel } from "../../open-sse/services/model.js";
import REGISTRY from "../../open-sse/providers/registry/index.js";
import { getCapabilitiesForModel } from "../../open-sse/providers/capabilities.js";
import { getPricingForModel } from "../../open-sse/providers/pricing.js";

const EXPLABS_MODELS = ["gpt-6-astra", "claude-fable-5.1", "deepseek-v4-flash-exp", "minimax-m3-free"];
// Upstream ids in the experientiallabs registry (deepseek masked as -exp at the ot/ layer)
const EXPLABS_UPSTREAM = ["gpt-6-astra", "claude-fable-5.1", "deepseek-v4-flash", "minimax-m3-free"];
const EXPLABS_BASE = "https://api.experientiallabs.ai/v1/chat/completions";

describe("experientiallabs parseModel", () => {
  it.each(EXPLABS_MODELS)("parses ot/%s to provider octane", (id) => {
    expect(parseModel(`ot/${id}`)).toMatchObject({ provider: "octane" });
  });
});

describe("experientiallabs registry entry", () => {
  const entry = REGISTRY.find((e) => e.id === "experientiallabs");

  it("exists", () => {
    expect(entry).toBeDefined();
  });

  it("uses apikey auth + openai transport format", () => {
    expect(entry?.authType).toBe("apikey");
    expect(entry?.transport?.format).toBe("openai");
  });

  it("points at the experientiallabs gateway", () => {
    expect(entry?.transport?.baseUrl).toBe(EXPLABS_BASE);
  });

  it("serves all four upstream models", () => {
    const ids = (entry?.models || []).map((m) => m.id);
    for (const id of EXPLABS_UPSTREAM) expect(ids).toContain(id);
  });
});

describe("OctaneExecutor experientiallabs routing", () => {
  const src = fs.readFileSync(
    new URL("../../open-sse/executors/octane.js", import.meta.url),
    "utf8",
  );

  it.each(EXPLABS_MODELS)("routes ot/%s to experientiallabs", (id) => {
    expect(src).toContain(`"${id}": ["experientiallabs"]`);
  });

  it("synthesizes env-key credentials when no DB connection exists", () => {
    expect(src).toContain("EXPERIENTIALLABS_API_KEY");
    expect(src).toContain("env-key");
  });

  it("registers the delegated experientiallabs executor", () => {
    expect(src).toContain("new ExperientialLabsExecutor()");
  });
});

describe("experientiallabs executor effort mapping", () => {
  const src = fs.readFileSync(
    new URL("../../open-sse/executors/experientiallabs.js", import.meta.url),
    "utf8",
  );

  it("maps suffix levels to reasoning_effort (high/xhigh/max -> high)", () => {
    expect(src).toContain("reasoning_effort");
    expect(src).toContain("EXPLABS_EFFORT_MAP");
  });

  it("falls back to env key when credentials are absent", () => {
    expect(src).toContain("EXPERIENTIALLABS_API_KEY");
  });
});

describe("experientiallabs capabilities + pricing", () => {
  it("gpt-6-astra is a hybrid reasoning model with effort support", () => {
    const caps = getCapabilitiesForModel("experientiallabs", "gpt-6-astra");
    expect(caps.reasoning).toBe(true);
    expect(caps.thinkingEffortSupported).toBe(true);
  });

  it("minimax-m3-free keeps adaptive thinking (cannot disable)", () => {
    const caps = getCapabilitiesForModel("experientiallabs", "minimax-m3-free");
    expect(caps.reasoning).toBe(true);
    expect(caps.thinkingCanDisable).toBe(false);
  });

  it("free $0 rates are registered per provider", () => {
    const pricing = getPricingForModel("experientiallabs", "gpt-6-astra");
    expect(pricing).toMatchObject({ input: 0, output: 0 });
  });
});
