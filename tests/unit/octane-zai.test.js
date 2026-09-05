// Regression tests for the octane-zai integration (ot/glm-5.3 + ot/glm-5.3-flash).
// Written RED-first against the unmodified tree: the registry + routing cases
// fail until the octane-zai provider lands; parseModel + capabilities are
// guards that must keep passing after the change.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import { parseModel } from "../../open-sse/services/model.js";
import REGISTRY from "../../open-sse/providers/registry/index.js";
import { getCapabilitiesForModel } from "../../open-sse/providers/capabilities.js";

const OCTANE_ZAI_BASE = "http://octane-zai:18787/v1/chat/completions";

describe("octane-zai parseModel", () => {
  it.each(["ot/glm-5.3", "ot/glm-5.3-flash"])("parses %s to provider octane", (id) => {
    expect(parseModel(id)).toMatchObject({ provider: "octane" });
  });
});

describe("octane-zai registry entry", () => {
  const entry = REGISTRY.find((e) => e.id === "octane-zai");

  it("exists", () => {
    expect(entry).toBeDefined();
  });

  it("is a noAuth provider", () => {
    expect(entry?.noAuth).toBe(true);
  });

  it("uses the openai transport format", () => {
    expect(entry?.transport?.format).toBe("openai");
  });

  it("points at the octane-zai gateway", () => {
    expect(entry?.transport?.baseUrl).toBe(OCTANE_ZAI_BASE);
  });

  it("serves glm-5.3 and glm-5.3-flash", () => {
    const ids = (entry?.models || []).map((m) => m.id);
    expect(ids).toContain("glm-5.3");
    expect(ids).toContain("glm-5.3-flash");
  });
});

describe("OctaneExecutor glm-5.3 routing", () => {
  // Seam: static read of the executor source — importing the executor would
  // pull the settings/connections DB chain, so no DB/network is touched here.
  const src = fs.readFileSync(
    new URL("../../open-sse/executors/octane.js", import.meta.url),
    "utf8"
  );
  const mapStart = src.indexOf("MODEL_PROVIDER_MAP");
  const mapBlock =
    mapStart === -1 ? "" : src.slice(mapStart, src.indexOf("};", mapStart) + 3);

  it.each(["glm-5.3", "glm-5.3-flash"])("MODEL_PROVIDER_MAP routes %s to octane-zai", (model) => {
    const line = mapBlock.split("\n").find((l) => l.includes(`"${model}"`));
    expect(line).toBeDefined();
    expect(line).toMatch(/octane-zai/);
  });
});

describe("octane-zai capabilities", () => {
  it.each(["glm-5.3", "glm-5.3-flash"])("%s resolves a sane context window", (model) => {
    const caps = getCapabilitiesForModel("octane-zai", model);
    expect(caps.contextWindow).toBeGreaterThanOrEqual(128000);
    expect(caps.maxOutput).toBeGreaterThan(0);
  });
});

describe("OctaneZaiExecutor", () => {
  // Seam: static read — importing the executor pulls the DB/proxy chain,
  // so no DB/network is touched here. Runtime behavior (clean headers,
  // correct URL, E2E 200 "Jakarta") verified manually via node + docker.
  const src = fs.readFileSync(
    new URL("../../open-sse/executors/octane-zai.js", import.meta.url),
    "utf8"
  );
  const indexSrc = fs.readFileSync(
    new URL("../../open-sse/executors/index.js", import.meta.url),
    "utf8"
  );

  it("extends DefaultExecutor for provider octane-zai", () => {
    expect(src).toMatch(/extends DefaultExecutor/);
    expect(src).toMatch(/super\("octane-zai"\)/);
  });

  it("strips the bogus Bearer undefined auth header", () => {
    expect(src).toMatch(/authorization/i);
    expect(src).toMatch(/delete headers\[k\]/);
  });

  it("is registered in the executor index", () => {
    expect(indexSrc).toMatch(/OctaneZaiExecutor/);
    expect(indexSrc).toMatch(/"octane-zai": new OctaneZaiExecutor\(\)/);
  });
});
