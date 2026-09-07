import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock proxyAwareFetch so session/run/chat flows never hit the network.
const fetchMock = vi.fn();
vi.mock("../../open-sse/utils/proxyFetch.js", () => ({
  proxyAwareFetch: (...args) => fetchMock(...args),
}));

// Regression test for the Freebuff daily-quota (rate_limited) account cooldown.
// Before the fix: a 429 rate_limited body from the session endpoint was
// classified as a generic "stale" gate — no cooldown was recorded, so the same
// exhausted account stayed a candidate for every request until the window
// reset, burning an upstream attempt (and latency) on each turn.
// After the fix: classifySessionGate recognises rate_limited, the gate error
// carries a resetAt when the body provides one, and the executor fail-fasts
// from the rateLimitCooldowns map instead of hitting upstream again.

import { FreebuffExecutor, __test__ } from "../../open-sse/executors/freebuff.js";

const { classifySessionGate, sessionGateFromError } = __test__;

// Real-world 429 shape from the session endpoint (trimmed — long fields end up
// truncated in the error message, so the JSON tail must still parse).
const RATE_LIMIT_BODY = JSON.stringify({
  status: "rate_limited",
  accessTier: "limited",
  model: "z-ai/glm-5.3-flash",
  pool: "freebucks",
  poolLabel: "Freebucks",
  limit: 25,
  recentCount: 25,
  period: "pacific_day",
  resetTimeZone: "America/Los_Angeles",
  resetAt: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
});

// The error string as it propagates out of requestSession
// ("Freebuff session request failed: 429 {…json…}") plus a long truncated
// prefix to prove the JSON-tail extraction tolerates it.
const RATE_LIMIT_ERROR = new Error(
  `Freebuff session request failed: 429 ${RATE_LIMIT_BODY.slice(0, 200)}…`,
);
// The truncation above breaks JSON parsing on purpose — also test the full body.
const RATE_LIMIT_ERROR_FULL = new Error(
  `Freebuff session request failed: 429 ${RATE_LIMIT_BODY}`,
);

function makeExecutor() {
  return new FreebuffExecutor();
}

beforeEach(() => {
  fetchMock.mockReset();
  __test__.resetSessionCache();
});

describe("classifySessionGate — rate_limited recognition", () => {
  it("classifies a rate_limited body as kind 'rate_limited' (previously 'stale')", () => {
    const gate = classifySessionGate("rate_limited", "You've used 25 of 25 sessions", null);
    expect(gate.kind).toBe("rate_limited");
  });

  it("does not misclassify other gates", () => {
    expect(classifySessionGate("model_locked", "", "other-model").kind).toBe("model_locked");
    expect(classifySessionGate("session_superseded", "", null).kind).toBe("superseded");
    expect(classifySessionGate("session_model_mismatch", "limited tier ip", null).kind).toBe("limited_ip");
    expect(classifySessionGate("unknown_code", "", null).kind).toBe("stale");
  });
});

describe("sessionGateFromError — resetAt extraction", () => {
  it("parses a full rate_limited error and extracts resetAt as ms epoch", () => {
    const gate = sessionGateFromError(RATE_LIMIT_ERROR_FULL);
    expect(gate).not.toBeNull();
    expect(gate.kind).toBe("rate_limited");
    expect(typeof gate.resetAt).toBe("number");
    expect(gate.resetAt).toBeGreaterThan(Date.now());
  });

  it("returns rate_limited without resetAt when the body has none", () => {
    const body = JSON.stringify({ status: "rate_limited", limit: 25, recentCount: 25 });
    const gate = sessionGateFromError(new Error(`Freebuff session request failed: 429 ${body}`));
    expect(gate.kind).toBe("rate_limited");
    expect(gate.resetAt).toBeUndefined();
  });

  it("returns null for non-JSON errors", () => {
    expect(sessionGateFromError(new Error("socket hang up"))).toBeNull();
  });
});

describe("FreebuffExecutor.execute — account-scoped rate-limit cooldown", () => {
  it("fail-fasts with 429 + resetsAtMs once the rate-limit cooldown is set (no upstream fetch)", async () => {
    const executor = makeExecutor();
    const token = "tok-rl-test";
    const model = "z-ai/glm-5.3-flash";

    // Simulate the cooldown recorded by a previous 429 (what
    // throwSessionGateError does) — directly seed the map via the exported
    // gate path: build the same error shape and classify.
    const gate = sessionGateFromError(RATE_LIMIT_ERROR_FULL);
    expect(gate.kind).toBe("rate_limited");
    // Seed through the same key layout the executor reads.
    // throwSessionGateError is not exported; emulate its write via
    // setCooldown semantics using the gate's resetAt.
    // We can't reach the private map directly, so drive execute() twice:
    // first call hits ensureSession (mocked 429) → cooldown set → second call
    // must fail fast BEFORE any fetch (fetch mock counts calls).

    // Session endpoint returns the 429 body; run registration never happens
    // because the gate throws inside ensureSession.
    fetchMock.mockImplementation(async () => ({
      ok: false,
      status: 429,
      json: async () => JSON.parse(RATE_LIMIT_BODY),
      text: async () => RATE_LIMIT_BODY,
    }));

    const baseCtx = (msg) => ({
      model,
      body: { model, messages: [{ role: "user", content: msg }] },
      stream: false,
      credentials: { accessToken: token, connectionName: "gh-test" },
      proxyOptions: {},
      settings: {},
    });

    await expect(executor.execute(baseCtx("hi"))).rejects.toThrow(/rate_limited|quota|429/i);
    const callsAfterFirst = fetchMock.mock.calls.length;
    expect(callsAfterFirst).toBeGreaterThan(0);

    // Second execute: cooldown is set → must fail fast WITHOUT touching fetch.
    await expect(executor.execute(baseCtx("hi again"))).rejects.toThrow(/quota exhausted|retry after/i);
    expect(fetchMock.mock.calls.length).toBe(callsAfterFirst);
  });
});
