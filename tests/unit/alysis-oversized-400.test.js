// Regression: alysis multi-turn 400 "Invalid or oversized hosted request".
//
// Two failure layers fixed together:
//
// 1. ROOT CAUSE — reasoning_content placeholder injection. The model id
//    "deepseek-v4.1-flash-*" matches MODEL_RULES /deepseek/i, so every
//    assistant message in a long session gained a `reasoning_content: " "`
//    field. The alysis host runs a strict request schema (Supabase edge fn)
//    and answers 400 on the unknown message field — single-message requests
//    (no assistant history) pass, which is exactly the "test lancar, session
//    400" symptom. quirk dropReasoningContent now strips it.
//
// 2. COLLATERAL DAMAGE — the 400 was classified as a fallback-able error, so
//    both accounts got modelLock_* 30s and the client saw 503 instead of the
//    real 400. ERROR_RULES noFallback entries now return shouldFallback:false
//    with no cooldown, and markAccountUnavailable honors it (no DB lock).
//
// 3. SIZE — genuine >8MiB payloads are trimmed by rtk/sizeGuard before
//    dispatch so they fit the host cap (prod-safe: only runs when oversized).

import { describe, it, expect } from "vitest";
import { injectReasoningContent } from "../../open-sse/utils/reasoningContentInjector.js";
import { checkFallbackError } from "../../open-sse/services/accountFallback.js";
import { enforceRequestSizeLimit, formatSizeGuardLog } from "../../open-sse/rtk/sizeGuard.js";
import { PROVIDERS } from "../../open-sse/providers/index.js";

const ALYSIS_400 = JSON.stringify({
  error: {
    message: "Invalid or oversized hosted request. Check model, messages, content types and output limits (8 MiB maximum).",
    type: "invalid_request_error",
    code: "invalid_request_error",
  },
});

describe("alysis strict-schema host", () => {
  it("registry declares dropReasoningContent quirk", () => {
    expect(PROVIDERS.alysis?.quirks?.dropReasoningContent).toBe(true);
  });

  it("never injects reasoning_content for alysis deepseek models (multi-turn)", () => {
    const body = {
      messages: [
        { role: "system", content: "sys" },
        { role: "user", content: "hi" },
        { role: "assistant", content: "hello", tool_calls: [{ id: "c1", type: "function", function: { name: "f", arguments: "{}" } }] },
        { role: "tool", tool_call_id: "c1", content: "out" },
      ],
    };
    const out = injectReasoningContent({ provider: "alysis", model: "deepseek-v4.1-flash-expires-on-0910", body });
    expect(out.messages.every(m => m.reasoning_content === undefined)).toBe(true);
  });

  it("strips reasoning_content echoed back by the client history", () => {
    const body = {
      messages: [
        { role: "user", content: "hi" },
        { role: "assistant", content: "hello", reasoning_content: "previous thinking" },
      ],
    };
    const out = injectReasoningContent({ provider: "alysis", model: "deepseek-v4-flash", body });
    expect(out.messages[1].reasoning_content).toBeUndefined();
  });

  it("still injects for plain deepseek provider (no behavior change)", () => {
    const body = { messages: [{ role: "assistant", content: "x" }] };
    const out = injectReasoningContent({ provider: "deepseek", model: "deepseek-v4-flash", body });
    expect(out.messages[0].reasoning_content).toBe(" ");
  });
});

describe("no-fallback for deterministic oversized 400", () => {
  it("alysis 400 oversized → shouldFallback:false, no cooldown", () => {
    const r = checkFallbackError(400, ALYSIS_400, 0);
    expect(r.shouldFallback).toBe(false);
    expect(r.cooldownMs).toBe(0);
  });

  it("matches via the shorter 'invalid or oversized' text too", () => {
    const r = checkFallbackError(400, "[400]: Invalid or oversized hosted request", 3);
    expect(r.shouldFallback).toBe(false);
  });

  it("plain 400s keep the existing transient behavior", () => {
    const r = checkFallbackError(400, "Bad request", 0);
    expect(r.shouldFallback).toBe(true);
  });

  it("other errors are untouched (regression)", () => {
    expect(checkFallbackError(429, "rate limit exceeded", 0).shouldFallback).toBe(true);
    expect(checkFallbackError(401, "Invalid API key", 0).cooldownMs).toBe(2 * 60 * 1000);
    expect(checkFallbackError(500, "usage exceeds frequency limit", 0).cooldownMs).toBe(2000);
  });
});

describe("size guard keeps oversized payloads under the host cap", () => {
  const big = (n) => "x".repeat(n);

  it("no-op for small bodies", () => {
    const body = { messages: [{ role: "user", content: "hi" }] };
    expect(enforceRequestSizeLimit("alysis", body)).toBeNull();
  });

  it("trims an oversized tool result with a marker", () => {
    const body = { messages: [
      { role: "system", content: "sys" },
      { role: "user", content: big(9 * 1024 * 1024) },
    ] };
    const stats = enforceRequestSizeLimit("alysis", body);
    expect(stats?.applied).toBe(true);
    expect(stats.bytesAfter).toBeLessThan(8 * 1024 * 1024 / 1.2 + 1024);
    expect(body.messages[1].content).toContain("9router truncated");
  });

  it("drops middle plain turns but keeps system + last turn", () => {
    // Long session: 150 turns × 200KiB. Phase-1 truncation alone still leaves
    // ~150 × 64KiB ≈ 9.6MiB > the 6.99MiB cap budget, so middle turns drop.
    const messages = [{ role: "system", content: "sys" }];
    for (let i = 0; i < 150; i++) {
      messages.push({ role: i % 2 ? "assistant" : "user", content: big(200 * 1024) });
    }
    messages.push({ role: "user", content: "final question" });
    const body = { messages };
    const stats = enforceRequestSizeLimit("alysis", body);
    expect(stats?.messagesDropped).toBeGreaterThan(0);
    expect(stats.bytesAfter).toBeLessThanOrEqual(8 * 1024 * 1024 / 1.2 + 8 * 1024);
    const roles = body.messages.map(m => m.role);
    expect(roles[0]).toBe("system");
    expect(body.messages[body.messages.length - 1].content).toBe("final question");
  });

  it("never drops tool calls or their tool results (pairing)", () => {
    const body = { messages: [
      { role: "system", content: "sys" },
      { role: "assistant", content: "t", tool_calls: [{ id: "c1", type: "function", function: { name: "f", arguments: "{}" } }] },
      { role: "tool", tool_call_id: "c1", content: big(9 * 1024 * 1024) },
      { role: "user", content: "go" },
    ] };
    enforceRequestSizeLimit("alysis", body);
    const hasToolCall = body.messages.some(m => m.role === "assistant" && m.tool_calls?.length);
    const hasToolResult = body.messages.some(m => m.role === "tool");
    expect(hasToolCall).toBe(true);
    expect(hasToolResult).toBe(true);
  });

  it("formats a one-line log entry", () => {
    const stats = { applied: true, bytesBefore: 9 * 1024 * 1024, bytesAfter: 4 * 1024 * 1024, fieldsTrimmed: 2, messagesDropped: 1 };
    const line = formatSizeGuardLog(stats);
    expect(line).toContain("9.00MiB → 4.00MiB");
    expect(line).toContain("trim:2");
    expect(line).toContain("drop:1");
  });
});
