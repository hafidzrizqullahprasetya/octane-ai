/**
 * Octane-ZAI usage: pure mergeAccounts + fetch fail-open via mocked globalThis.fetch.
 * Runs on node:test stdlib only — no vitest.
 */
import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";

import { mergeAccounts } from "../../open-sse/services/usage/octanezai.js";

const LIVE_ACCOUNT = {
  name: "zai-main",
  plan: "Lite",
  quotas: {
    "Session (5h)": {
      used: 25, total: 100, remaining: 75,
      remainingPercentage: 75, resetAt: "2026-09-05T10:00:00.000Z", unlimited: false,
    },
    "Weekly (7d)": {
      used: 10, total: 100, remaining: 90,
      remainingPercentage: 90, resetAt: null, unlimited: false,
    },
  },
  points: 1200,
  fetchedLive: true,
  error: "",
};

function payloadWith(...accounts) {
  return { accounts, generatedAt: "2026-09-05T09:00:00.000Z" };
}

describe("mergeAccounts (pure)", () => {
  it("flattens every (account, quota-label) pair into '<account> · <label>' rows", () => {
    const result = mergeAccounts(payloadWith(LIVE_ACCOUNT));
    assert.equal(result.message, undefined);
    assert.equal(result.plan, "Lite");
    assert.deepEqual(result.quotas["zai-main · Session (5h)"], {
      used: 25, total: 100, remaining: 75,
      remainingPercentage: 75, resetAt: "2026-09-05T10:00:00.000Z", unlimited: false,
    });
    assert.ok(result.quotas["zai-main · Weekly (7d)"]);
    assert.equal(result.quotas["zai-main · points"], undefined);
  });

  it("combines multiple live accounts with '<n> akun ZAI' plan", () => {
    const second = {
      ...LIVE_ACCOUNT,
      name: "zai-second",
      plan: "Pro",
      quotas: { Tokens: { used: 5, total: 100, remaining: 95, remainingPercentage: 95, resetAt: null, unlimited: false } },
    };
    const result = mergeAccounts(payloadWith(LIVE_ACCOUNT, second));
    assert.equal(result.plan, "2 akun ZAI");
    assert.ok(result.quotas["zai-second · Tokens"]);
    // Rows are namespaced — no label collision between accounts.
    assert.ok(result.quotas["zai-main · Session (5h)"]);
  });

  it("single live account plan falls back to that account's plan", () => {
    const result = mergeAccounts(payloadWith({ ...LIVE_ACCOUNT, plan: "Standard" }));
    assert.equal(result.plan, "Standard");
  });

  it("skips accounts with fetchedLive=false (error kept out of quotas)", () => {
    const dead = { name: "zai-dead", plan: "Lite", quotas: {}, points: 10, fetchedLive: false, error: "401 unauthorized" };
    const result = mergeAccounts(payloadWith(LIVE_ACCOUNT, dead));
    assert.equal(result.plan, "Lite"); // 1 live account → its plan
    assert.ok(!Object.keys(result.quotas).some((k) => k.startsWith("zai-dead")));
  });

  it("all-live-failed → message with error detail, empty quotas", () => {
    const dead = { name: "zai-dead", plan: "Lite", quotas: {}, points: 10, fetchedLive: false, error: "fetch failed" };
    const result = mergeAccounts(payloadWith(dead));
    assert.equal(result.quotas, undefined);
    assert.match(result.message, /Octane-ZAI usage unavailable/);
    assert.match(result.message, /zai-dead: fetch failed/);
  });

  it("malformed payloads never throw", () => {
    for (const bad of [null, undefined, {}, { accounts: "nope" }, { accounts: [null, 42, {}] }]) {
      const result = mergeAccounts(bad);
      assert.equal(result.quotas, undefined);
      assert.ok(result.message);
    }
  });
});

describe("getOctaneZaiUsage (local http server — real fetch path)", () => {
  // proxyAwareFetch captures globalThis.fetch at module load, so patching
  // globalThis.fetch in a test cannot intercept it. Instead we point
  // OCTANE_ZAI_USAGE_URL at a loopback http server and exercise the real
  // fetch path end-to-end.
  const originalEnv = process.env.OCTANE_ZAI_USAGE_URL;
  let server;
  let baseUrl;
  let seenHeaders;
  let responder;

  function startServer() {
    return new Promise((resolve) => {
      server = createServer((req, res) => {
        seenHeaders = { ...req.headers };
        const { status, body } = responder();
        res.writeHead(status, { "Content-Type": "application/json" });
        res.end(body);
      });
      server.listen(0, "127.0.0.1", () => resolve(`http://127.0.0.1:${server.address().port}/v1/usage`));
    });
  }

  after(() => {
    try { server?.close(); } catch { /* already closed */ }
  });

  it("happy path: returns contract from sidecar payload", async () => {
    baseUrl = await startServer();
    responder = () => ({ status: 200, body: JSON.stringify(payloadWith(LIVE_ACCOUNT)) });
    process.env.OCTANE_ZAI_USAGE_URL = baseUrl;

    const { getOctaneZaiUsage } = await import("../../open-sse/services/usage/octanezai.js");
    const result = await getOctaneZaiUsage("tok-123", {}, null);

    assert.equal(result.plan, "Lite");
    assert.ok(result.quotas["zai-main · Session (5h)"]);
    assert.equal(seenHeaders.authorization, "Bearer tok-123");
    assert.equal(seenHeaders.accept, "application/json");
  });

  it("noAuth connection: empty accessToken still sends a well-formed request", async () => {
    if (!server) await startServer().then((u) => { baseUrl = u; });
    responder = () => ({ status: 200, body: JSON.stringify(payloadWith(LIVE_ACCOUNT)) });
    process.env.OCTANE_ZAI_USAGE_URL = baseUrl;

    const { getOctaneZaiUsage } = await import("../../open-sse/services/usage/octanezai.js");
    const result = await getOctaneZaiUsage("", {}, null);

    assert.ok(result.quotas);
    // Node strips trailing OWS from header values, so the empty-token Bearer
    // arrives as "Bearer" (wire value "Bearer ").
    assert.match(seenHeaders.authorization, /^Bearer\s*$/);
  });

  it("HTTP 500 → fail-open message", async () => {
    responder = () => ({ status: 500, body: "boom" });
    process.env.OCTANE_ZAI_USAGE_URL = baseUrl;

    const { getOctaneZaiUsage } = await import("../../open-sse/services/usage/octanezai.js");
    const result = await getOctaneZaiUsage("t", {}, null);
    assert.match(result.message, /Octane-ZAI usage API error \(500\)/);
  });

  it("unreachable sidecar → fail-open message, never throws", async () => {
    process.env.OCTANE_ZAI_USAGE_URL = "http://127.0.0.1:9/v1/usage"; // discard port → ECONNREFUSED

    const { getOctaneZaiUsage } = await import("../../open-sse/services/usage/octanezai.js");
    const result = await getOctaneZaiUsage("t", {}, null);
    assert.match(result.message, /Octane-ZAI usage error/);
  });
});

