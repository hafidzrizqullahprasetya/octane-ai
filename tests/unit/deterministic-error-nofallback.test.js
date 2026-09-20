import { describe, it, expect } from "vitest";
import { checkFallbackError } from "../../open-sse/services/accountFallback.js";
import { getCapabilitiesForModel } from "../../open-sse/providers/capabilities.js";
import { inlineLocalImages } from "../../open-sse/translator/concerns/prefetch.js";

describe("Deterministic error no-fallback & capabilities", () => {
  it("does not trigger fallback or account lock on Antigravity token limit overflow", () => {
    const err = '[400]: { "error": { "code": 400, "message": "The input token count exceeds the maximum number of tokens allowed 1048576.", "status": "INVALID_ARGUMENT" } }';
    const res = checkFallbackError(400, err, 0);
    expect(res.shouldFallback).toBe(false);
    expect(res.cooldownMs).toBe(0);
  });

  it("does not trigger fallback or account lock on CodeBuddy 11135 invalid_image_data", () => {
    const err = '[400]: {"code":11135,"msg":"Please start a new conversation, replace the image, and try again.","extError":{"code":"invalid_image_data"}}';
    const res = checkFallbackError(400, err, 0);
    expect(res.shouldFallback).toBe(false);
    expect(res.cooldownMs).toBe(0);
  });

  it("confirms native vision: true for DeepSeek V4.1 on CodeBuddy providers", () => {
    const intlCaps = getCapabilitiesForModel("codebuddy-intl", "deepseek-v4.1-flash");
    expect(intlCaps.vision).toBe(true);

    const cnCaps = getCapabilitiesForModel("codebuddy-cn", "deepseek-v4-flash");
    expect(cnCaps.vision).toBe(true);
  });

  it("does not inline local images from tool output or assistant messages", async () => {
    // Bash or tool output mentioning image files on disk
    const body = {
      messages: [
        {
          role: "tool",
          content: "rm 'public/providers/anthropic.png'\nrm 'public/favicon.svg'",
        },
        {
          role: "assistant",
          content: "I unindexed public/providers/anthropic.png",
        },
      ],
    };

    const count = await inlineLocalImages(body);
    expect(count).toBe(0);
    expect(typeof body.messages[0].content).toBe("string");
    expect(typeof body.messages[1].content).toBe("string");
  });
});
