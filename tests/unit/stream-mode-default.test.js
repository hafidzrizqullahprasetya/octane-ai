import { describe, expect, it, vi } from "vitest";

// chatCore pulls in every executor; none are needed for this pure helper.
vi.mock("../../open-sse/executors/index.js", () => ({ getExecutor: vi.fn() }));

vi.mock("@/lib/usageDb.js", () => ({
  trackPendingRequest: vi.fn(),
  appendRequestLog: vi.fn(async () => {}),
  saveRequestDetail: vi.fn(async () => {}),
  saveRequestUsage: vi.fn(async () => {})
}));

const { resolveStreamMode } = await import("../../open-sse/handlers/chatCore.js");

describe("resolveStreamMode", () => {
  it("returns JSON when an OpenAI/Claude client omits stream", () => {
    expect(resolveStreamMode({ model: "m", messages: [] }, false)).toBe(false);
  });

  it("keeps streaming for Gemini-style clients that never send stream", () => {
    expect(resolveStreamMode({ contents: [] }, true)).toBe(true);
  });

  it("honours an explicit stream boolean either way", () => {
    expect(resolveStreamMode({ stream: true }, false)).toBe(true);
    expect(resolveStreamMode({ stream: false }, true)).toBe(false);
  });

  it("treats a missing body like an omitted field", () => {
    expect(resolveStreamMode(undefined, false)).toBe(false);
  });
});
