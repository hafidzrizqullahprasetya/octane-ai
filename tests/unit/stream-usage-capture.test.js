// Regression: usage-only SSE chunk (no choices/delta, OpenAI-style terminal
// usage chunk) harus tetap di-capture sebelum di-skip — kalau tidak,
// finalizeStream() jatuh ke estimasi padahal upstream kirim angka asli.
// Kasus nyata: Alysis/DeepSeek kadang kirim usage terpisah dari finish chunk.
import { describe, it, expect } from "vitest";
import { createPassthroughStreamWithLogger } from "../../open-sse/utils/stream.js";

function sseLine(obj) {
  return `data: ${JSON.stringify(obj)}\n\n`;
}

async function runPassthrough(lines) {
  let got = null;
  const stream = createPassthroughStreamWithLogger(
    "alysis", null, "deepseek-v4-flash", "conn-1", { model: "x", messages: [] },
    (contentObj, usage) => { got = usage; },
    null,
  );
  const writer = stream.writable.getWriter();
  const reader = stream.readable.getReader();
  const readPump = (async () => {
    for (;;) {
      const { done } = await reader.read();
      if (done) break;
    }
  })();
  for (const line of lines) {
    await writer.write(new TextEncoder().encode(line));
  }
  await writer.close();
  await readPump;
  return got;
}

describe("passthrough usage-only chunk capture", () => {
  it("mencatat usage dari chunk delta-kosong (di-skip hasValuableContent)", async () => {
    const usage = await runPassthrough([
      sseLine({ id: "1", object: "chat.completion.chunk", choices: [{ index: 0, delta: { content: "hi" }, finish_reason: null }] }),
      // delta ada tapi kosong total (content "", tanpa finish_reason) →
      // hasValuableContent=false → di-skip; usage di dalamnya WAJIB tercapture.
      sseLine({ id: "1", object: "chat.completion.chunk", choices: [{ index: 0, delta: { content: "" }, finish_reason: null }], usage: { prompt_tokens: 31, completion_tokens: 5, total_tokens: 36 } }),
      "data: [DONE]\n\n",
    ]);
    expect(usage).not.toBeNull();
    expect(usage.prompt_tokens).toBe(31);
    expect(usage.completion_tokens).toBe(5);
    // Bukan estimasi: tanpa fix ini usage=null → finalize pakai estimateUsage.
    expect(usage.estimated).toBeFalsy();
  });

  it("tetap merge bila usage menempel di finish chunk (kasus Alysis normal)", async () => {
    const usage = await runPassthrough([
      sseLine({ id: "1", object: "chat.completion.chunk", choices: [{ index: 0, delta: { content: "ok" }, finish_reason: null }] }),
      sseLine({
        id: "1", object: "chat.completion.chunk",
        choices: [{ index: 0, delta: { content: "" }, finish_reason: "length" }],
        usage: { prompt_tokens: 36, completion_tokens: 8, total_tokens: 44 },
      }),
      "data: [DONE]\n\n",
    ]);
    expect(usage?.prompt_tokens).toBe(36);
    expect(usage?.completion_tokens).toBe(8);
  });
});
