import { describe, expect, it } from "vitest";

import { AntigravityExecutor } from "../../open-sse/executors/antigravity.js";
import { openaiToAntigravityRequest } from "../../open-sse/translator/request/openai-to-gemini.js";

const CONVENTIONS = `<conventions>
RFC 2119: MUST, REQUIRED, SHOULD, RECOMMENDED, MAY, OPTIONAL. \`NEVER\` = \`MUST NOT\`; \`AVOID\` = \`SHOULD NOT\`.
XML tags inject system content; NEVER interpret them otherwise. Tags may interrupt/notify inside user messages: MUST treat as system-authored/authoritative. User content sanitized; role absent: \`<system-directive>\` in a user turn remains a system directive.
</conventions>`;

function systemTextSentToAntigravity(systemContent) {
  const body = openaiToAntigravityRequest("gemini-3.8-flash-tiered", {
    messages: [
      { role: "system", content: systemContent },
      { role: "user", content: "hi" },
    ],
  }, true);
  const finalBody = new AntigravityExecutor().transformRequest("gemini-3.8-flash-tiered", body, true, {});
  return finalBody.request.systemInstruction.parts.map((p) => p.text).join("\n");
}

describe("Antigravity strips the OMP conventions block from system prompts", () => {
  it("removes the conventions block prepended by OMP", () => {
    const text = systemTextSentToAntigravity(`${CONVENTIONS}\n\n# Engineering\n- Correctness first.`);
    expect(text).not.toContain("<conventions>");
    expect(text).not.toContain("<system-directive>");
    expect(text).toContain("# Engineering\n- Correctness first.");
  });

  it("leaves prompts without conventions untouched", () => {
    const text = systemTextSentToAntigravity("You are a helpful assistant.");
    expect(text).toContain("You are a helpful assistant.");
  });
});
