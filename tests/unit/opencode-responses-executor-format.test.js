// Regression: OpenCodeExecutor's /responses branch passes upstream Responses SSE
// through untouched and does NOT override `responseFormat`. Muse Spark models
// declare `targetFormat: "openai-responses"` in the registry, so chatCore runs
// the responses→client translation exactly once. An executor that converted to
// Chat SSE in-process without declaring it would make chatCore translate twice
// and drop every text/tool_calls chunk (symptom: muse-spark tool calls stall).
import { describe, expect, it, vi, beforeEach } from "vitest";
import "../translator/registerAll.js";
import { initState, translateResponse } from "../../open-sse/translator/index.js";
import { FORMATS } from "../../open-sse/translator/formats.js";
import { OpenCodeExecutor } from "../../open-sse/executors/opencode.js";

vi.mock("open-sse/utils/proxyFetch.js", () => ({
  proxyAwareFetch: vi.fn(),
}));

const { proxyAwareFetch } = await import("open-sse/utils/proxyFetch.js");

function sse(lines) {
  const text = lines.map((l) => `data: ${l}\n\n`).join("");
  return new Response(new Blob([text]).stream(), {
    status: 200,
    headers: { "content-type": "text/event-stream" },
  });
}

async function drainToString(stream) {
  const reader = stream.getReader();
  const dec = new TextDecoder();
  let out = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    out += dec.decode(value, { stream: true });
  }
  out += dec.decode();
  return out;
}

beforeEach(() => {
  vi.mocked(proxyAwareFetch).mockReset();
});

describe("OpenCodeExecutor /responses pipeline keeps tool output", () => {
  it("passes Responses SSE through so chatCore translates it exactly once", async () => {
    proxyAwareFetch.mockResolvedValue(
      sse([
        JSON.stringify({
          type: "response.output_item.added",
          output_index: 0,
          item: { id: "fc_1", type: "function_call", call_id: "call_1", name: "read", arguments: "" },
        }),
        JSON.stringify({ type: "response.function_call_arguments.delta", item_id: "fc_1", output_index: 0, delta: '{"f":"a"}' }),
        JSON.stringify({ type: "response.completed", response: { id: "resp_1", object: "response", status: "completed" } }),
      ]),
    );
    const ex = new OpenCodeExecutor();
    const result = await ex.execute({
      model: "muse-spark-1.3(xhigh)",
      body: { model: "muse-spark-1.3(xhigh)", messages: [{ role: "user", content: "hi" }] },
      stream: true,
      credentials: { connectionId: "t" },
      signal: undefined,
      log: {},
      proxyOptions: null,
    });
    // No override: chatCore falls back to the model's targetFormat (openai-responses).
    expect(result.responseFormat).toBeUndefined();

    const text = await drainToString(result.response.body);
    const state = initState(FORMATS.OPENAI_RESPONSES);
    const kept = [];
    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const json = trimmed.slice(5).trim();
      if (json === "[DONE]") continue;
      kept.push(...translateResponse(FORMATS.OPENAI_RESPONSES, FORMATS.OPENAI, JSON.parse(json), state));
    }
    const toolChunk = kept.find((c) => c?.choices?.[0]?.delta?.tool_calls?.length);
    expect(toolChunk?.choices?.[0]?.delta?.tool_calls?.[0]?.function?.name).toBe("read");
  });
});
