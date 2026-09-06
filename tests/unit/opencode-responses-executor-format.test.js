// Regression: OpenCodeExecutor's /responses branch converts upstream Responses
// SSE into OpenAI Chat Completions SSE in-process. It MUST declare
// `responseFormat: FORMATS.OPENAI` on the result — otherwise chatCore treats the
// (already converted) chat chunks as raw Responses events and runs the
// responses→chat translator over them a second time, dropping every text and
// tool_calls chunk (translateResponse(openai-responses→openai) returns [] for
// chat-shaped JSON). Symptom: muse-spark tool calls "stall" with no output.
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
  it("declares responseFormat=openai so chatCore skips a second responses→chat translation", async () => {
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
    expect(result.responseFormat).toBe(FORMATS.OPENAI);

    // The executor's SSE must survive chatCore's translate pipeline unchanged:
    // translateResponse(openai=openai, openai) is a same-format passthrough,
    // while a mismatched responses→openai run drops everything (would be []).
    const text = await drainToString(result.response.body);
    const state = initState(FORMATS.OPENAI);
    const kept = [];
    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const json = trimmed.slice(5).trim();
      if (json === "[DONE]") continue;
      const parsed = JSON.parse(json);
      for (const item of translateResponse(result.responseFormat, FORMATS.OPENAI, parsed, state)) {
        kept.push(item);
      }
    }
    expect(kept.length).toBeGreaterThan(0);
    const toolChunk = kept.find((c) => c?.choices?.[0]?.delta?.tool_calls?.length);
    expect(toolChunk?.choices?.[0]?.delta?.tool_calls?.[0]?.function?.name).toBe("read");

    // And the OLD (buggy) assumption is now proven wrong: these same chunks
    // would all be dropped if chatCore believed the format were responses.
    const dropState = {};
    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const json = trimmed.slice(5).trim();
      if (json === "[DONE]") continue;
      const out = translateResponse(
        FORMATS.OPENAI_RESPONSES, FORMATS.OPENAI, JSON.parse(json), dropState,
      );
      expect(out).toEqual([]);
    }
  });
});
