import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock proxyAwareFetch so session/run/chat flows never hit the network.
const fetchMock = vi.fn();
vi.mock("../../open-sse/utils/proxyFetch.js", () => ({
  proxyAwareFetch: (...args) => fetchMock(...args),
}));

// Regression test for the Freebuff daily-quota (rate_limited / spend_limited)
// account cooldown. The session endpoint answers an exhausted account with a
// gate body (HTTP 429 or 200) carrying resetAt. requestSession must turn that
// into an error with status 429 + resetsAtMs so accountFallback marks the
// account unavailable until the daily reset (markAccountUnavailable honors
// resetsAtMs; freebuff bypasses the generic 30-min cap) instead of retrying the
// same exhausted account on every request. This superseded the executor-local
// rateLimitCooldowns map from ff38edab (upstream MIBP sync).

import { FreebuffExecutor, __test__ } from "../../open-sse/executors/freebuff.js";

const { classifySessionGate, requestSession } = __test__;

const RESET_AT = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString();
const rateLimitBody = (extra = {}) => ({
  status: "rate_limited",
  accessTier: "limited",
  model: "z-ai/glm-5.3-flash",
  pool: "freebucks",
  limit: 25,
  recentCount: 25,
  period: "pacific_day",
  ...extra,
});

function mockSession(httpStatus, body) {
  fetchMock.mockImplementation(async () => ({
    ok: httpStatus >= 200 && httpStatus < 300,
    status: httpStatus,
    headers: new Headers({ "content-type": "application/json" }),
    json: async () => body,
    text: async () => JSON.stringify(body),
  }));
}

beforeEach(() => {
  fetchMock.mockReset();
  __test__.resetSessionCache();
});

describe("classifySessionGate", () => {
  it("does not misclassify other gates", () => {
    expect(classifySessionGate("model_locked", "", "other-model").kind).toBe("model_locked");
    expect(classifySessionGate("session_superseded", "", null).kind).toBe("superseded");
    expect(classifySessionGate("session_model_mismatch", "limited tier ip", null).kind).toBe("limited_ip");
    expect(classifySessionGate("unknown_code", "", null).kind).toBe("stale");
  });
});

describe("requestSession — daily quota exhaustion carries the reset time", () => {
  it.each([429, 200])("rate_limited over HTTP %i → status 429 + resetsAtMs = resetAt", async (httpStatus) => {
    mockSession(httpStatus, rateLimitBody({ resetAt: RESET_AT }));
    const err = await requestSession("tok-rl", "z-ai/glm-5.3-flash", {}).catch((e) => e);
    expect(err).toBeInstanceOf(Error);
    expect(err.status).toBe(429);
    expect(err.resetsAtMs).toBe(Date.parse(RESET_AT));
  });

  it("spend_limited falls back to retryAfterMs when resetAt is missing", async () => {
    mockSession(429, { status: "spend_limited", retryAfterMs: 60_000 });
    const before = Date.now();
    const err = await requestSession("tok-sl", "z-ai/glm-5.3-flash", {}).catch((e) => e);
    expect(err.status).toBe(429);
    expect(err.resetsAtMs).toBeGreaterThanOrEqual(before + 60_000);
  });

  it("without resetAt or retryAfterMs there is no fake reset time", async () => {
    mockSession(429, rateLimitBody());
    const err = await requestSession("tok-none", "z-ai/glm-5.3-flash", {}).catch((e) => e);
    expect(err).toBeInstanceOf(Error);
    expect(err.resetsAtMs).toBeUndefined();
  });
});

describe("FreebuffExecutor.execute — surfaces the account-scoped cooldown", () => {
  it("rejects with 429 + resetsAtMs so accountFallback skips the account until reset", async () => {
    mockSession(429, rateLimitBody({ resetAt: RESET_AT }));
    const model = "z-ai/glm-5.3-flash";
    const err = await new FreebuffExecutor().execute({
      model,
      body: { model, messages: [{ role: "user", content: "hi" }] },
      stream: false,
      credentials: { accessToken: "tok-exec", connectionName: "gh-test" },
      proxyOptions: {},
      log: {},
    }).catch((e) => e);
    expect(err).toBeInstanceOf(Error);
    expect(err.status).toBe(429);
    expect(err.resetsAtMs).toBe(Date.parse(RESET_AT));
  });
});
