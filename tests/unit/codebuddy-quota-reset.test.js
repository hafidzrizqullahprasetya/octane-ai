// CodeBuddy 6004 frequency-limit (real reset time) + 14018 credits-exhausted.
import { describe, it, expect } from "vitest";
import { parseCodebuddyError, parseCodebuddyResetMs } from "../../open-sse/executors/codebuddyError.js";
import { CodeBuddyIntlExecutor } from "../../open-sse/executors/codebuddy-intl.js";
import { checkFallbackError } from "../../open-sse/services/accountFallback.js";

const res = (status) => ({ status });

describe("parseCodebuddyResetMs", () => {
  it("parses UTC+8 reset time to UTC ms", () => {
    // 15:34:37 UTC+8 == 07:34:37 UTC
    const ms = parseCodebuddyResetMs(
      "usage exceeds frequency limit, but don't worry, your usage will reset at 2026-09-10 15:34:37 UTC+8, alternatively..."
    );
    expect(ms).toBe(Date.UTC(2026, 8, 10, 7, 34, 37));
  });

  it("returns null when no reset time", () => {
    expect(parseCodebuddyResetMs("Credits exhausted. Please top up.")).toBeNull();
  });
});

describe("parseCodebuddyError 6004 frequency limit", () => {
  it("returns precise resetsAtMs from the message", () => {
    const body = JSON.stringify({
      code: 6004,
      msg: "usage exceeds frequency limit, but don't worry, your usage will reset at 2099-01-01 15:34:37 UTC+8, alternatively, you can switch to the other models.",
      requestId: "x",
    });
    const out = parseCodebuddyError(res(429), body);
    expect(out).not.toBeNull();
    expect(out.status).toBe(429);
    expect(out.resetsAtMs).toBe(Date.UTC(2099, 0, 1, 7, 34, 37));
  });

  it("handles nested error.data shape", () => {
    const body = JSON.stringify({
      error: { data: { code: 6004, msg: "usage exceeds frequency limit, your usage will reset at 2099-06-01 00:00:00 UTC+8" } },
    });
    const out = parseCodebuddyError(res(429), body);
    expect(out?.resetsAtMs).toBe(Date.UTC(2099, 4, 31, 16, 0, 0));
  });
});

describe("parseCodebuddyError 14018 credits exhausted", () => {
  it("locks long immediately instead of 2s backoff", () => {
    const before = Date.now();
    const body = JSON.stringify({
      error: { data: { code: 14018, msg: "Credits exhausted. Please visit the link below to purchase add-on packs." } },
    });
    const out = parseCodebuddyError(res(429), body);
    expect(out).not.toBeNull();
    expect(out.status).toBe(429);
    // ~30m lock (MAX_RATE_LIMIT_COOLDOWN_MS downstream caps it the same way)
    expect(out.resetsAtMs - before).toBeGreaterThan(29 * 60 * 1000);
    expect(out.resetsAtMs - before).toBeLessThanOrEqual(30 * 60 * 1000 + 5000);
  });
});

describe("parseCodebuddyError passthrough", () => {
  it("returns null for non-429 and unknown shapes", () => {
    expect(parseCodebuddyError(res(500), "boom")).toBeNull();
    expect(parseCodebuddyError(res(429), "not json at all {{{")).toBeNull();
    expect(parseCodebuddyError(res(429), JSON.stringify({ error: { message: "plain rate limited" } }))).toBeNull();
  });
});

describe("CodeBuddyIntlExecutor.parseError", () => {
  it("routes 6004 through with resetsAtMs", () => {
    const exec = new CodeBuddyIntlExecutor();
    const body = JSON.stringify({
      code: 6004,
      msg: "usage exceeds frequency limit, your usage will reset at 2099-01-01 15:34:37 UTC+8",
    });
    const out = exec.parseError(res(429), body);
    expect(out.resetsAtMs).toBe(Date.UTC(2099, 0, 1, 7, 34, 37));
  });
});

describe("ERROR_RULES safety net (no executor parse)", () => {
  it("credits exhausted locks long even as plain text", () => {
    const r = checkFallbackError(429, "[429]: Credits exhausted. Please top up.", 0);
    expect(r.shouldFallback).toBe(true);
    expect(r.cooldownMs).toBe(30 * 60 * 1000);
  });

  it("frequency limit gets backoff instead of transient 30s", () => {
    const r = checkFallbackError(500, "usage exceeds frequency limit", 0);
    expect(r.shouldFallback).toBe(true);
    // backoff level 1 → base 2000ms (not the 30s transient default)
    expect(r.cooldownMs).toBe(2000);
  });
});
