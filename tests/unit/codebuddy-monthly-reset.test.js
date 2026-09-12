import { describe, it, expect } from "vitest";
import {
  codebuddyMonthlyResetMs,
  isCodebuddyMonthlyExhausted,
} from "../../src/sse/services/auth.js";
import { isModelLockActive } from "../../open-sse/services/accountFallback.js";

describe("codebuddyMonthlyResetMs", () => {
  it("calculates next month 1st UTC for codebuddy-intl with 429 credits exhausted", () => {
    const err = "[429]: Credits exhausted. Please visit the link below to purchase add-on packs and get more credits: https://www.codebuddy.ai/profile/usage";
    const resetMs = codebuddyMonthlyResetMs(429, err, "codebuddy-intl");
    expect(resetMs).not.toBeNull();

    const date = new Date(resetMs);
    const now = new Date();
    const expectedYear = now.getUTCMonth() === 11 ? now.getUTCFullYear() + 1 : now.getUTCFullYear();
    const expectedMonth = (now.getUTCMonth() + 1) % 12;

    expect(date.getUTCFullYear()).toBe(expectedYear);
    expect(date.getUTCMonth()).toBe(expectedMonth);
    expect(date.getUTCDate()).toBe(1);
    expect(date.getUTCHours()).toBe(0);
    expect(date.getUTCMinutes()).toBe(0);
    expect(date.getUTCSeconds()).toBe(0);
  });

  it("handles codebuddy-cn with 14018 error code", () => {
    const err = '{"error":{"data":{"code":14018,"msg":"Credits exhausted."}}}';
    const resetMs = codebuddyMonthlyResetMs(429, err, "codebuddy-cn");
    expect(resetMs).not.toBeNull();
    expect(resetMs).toBeGreaterThan(Date.now());
  });

  it("returns null for non-429 status or unrelated errors", () => {
    expect(codebuddyMonthlyResetMs(500, "Credits exhausted", "codebuddy-intl")).toBeNull();
    expect(codebuddyMonthlyResetMs(429, "rate limit exceeded", "codebuddy-intl")).toBeNull();
    expect(codebuddyMonthlyResetMs(429, "Credits exhausted", "openai")).toBeNull();
  });
});

describe("isCodebuddyMonthlyExhausted", () => {
  it("returns true for accounts that hit credit exhaustion in current month", () => {
    const conn = {
      id: "conn-1",
      lastError: "[429]: Credits exhausted. Please visit https://www.codebuddy.ai",
      lastErrorAt: new Date().toISOString(),
    };
    expect(isCodebuddyMonthlyExhausted("codebuddy-intl", conn)).toBe(true);
    expect(isCodebuddyMonthlyExhausted("codebuddy-cn", conn)).toBe(true);
  });

  it("returns false for accounts whose exhaustion was in a previous month (reset arrived)", () => {
    const prevMonthDate = new Date();
    prevMonthDate.setUTCMonth(prevMonthDate.getUTCMonth() - 1);

    const conn = {
      id: "conn-2",
      lastError: "[429]: Credits exhausted. Please top up",
      lastErrorAt: prevMonthDate.toISOString(),
    };
    expect(isCodebuddyMonthlyExhausted("codebuddy-intl", conn)).toBe(false);
  });

  it("returns false for non-codebuddy providers or healthy accounts", () => {
    const conn = {
      id: "conn-3",
      lastError: "[429]: Credits exhausted",
      lastErrorAt: new Date().toISOString(),
    };
    expect(isCodebuddyMonthlyExhausted("github", conn)).toBe(false);

    const healthyConn = {
      id: "conn-4",
      lastError: null,
      lastErrorAt: null,
    };
    expect(isCodebuddyMonthlyExhausted("codebuddy-intl", healthyConn)).toBe(false);
  });
});

describe("isModelLockActive with modelLock___all", () => {
  it("blocks any model when modelLock___all is set for the month", () => {
    const future = new Date(Date.now() + 86400000 * 15).toISOString();
    const conn = {
      id: "conn-all",
      modelLock___all: future,
    };

    expect(isModelLockActive(conn, "deepseek-v4.1-flash")).toBe(true);
    expect(isModelLockActive(conn, "glm-5.3")).toBe(true);
    expect(isModelLockActive(conn, "kimi-k3")).toBe(true);
    expect(isModelLockActive(conn, null)).toBe(true);
  });
});
