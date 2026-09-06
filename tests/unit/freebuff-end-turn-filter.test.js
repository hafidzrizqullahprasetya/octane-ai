// The injected `end_turn` tool satisfies the upstream foreign_toolset gate,
// but a leaked `end_turn` tool_call reaches downstream harnesses that never
// declared it → the client stalls on an unknown tool ("kadang nyendat").
// These tests pin the response-side filter: end_turn fragments must be
// dropped from both streaming (SSE) and JSON responses, real tool calls must
// flow through untouched, and finish_reason must collapse to stop when only
// end_turn remained.
import { describe, expect, it } from "vitest";
import {
  __test__,
} from "../../open-sse/executors/freebuff.js";

const {
  stripEndTurnFromChatMessage,
  stripEndTurnJsonResponse,
  stripEndTurnStream,
} = __test__;

const sse = (lines) =>
  new Response(
    new Blob([lines.map((l) => `data: ${l}\n\n`).join("")]).stream(),
    { status: 200, headers: { "content-type": "text/event-stream" } },
  );

async function drainToChunks(response) {
  const reader = response.body.getReader();
  const dec = new TextDecoder();
  let text = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    text += dec.decode(value, { stream: true });
  }
  text += dec.decode();
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("data:"))
    .map((l) => l.slice(5).trim())
    .filter((p) => p !== "[DONE]")
    .map((p) => JSON.parse(p));
}

describe("freebuff end_turn response filter", () => {
  it("JSON: drops an isolated end_turn call and collapses finish to stop", async () => {
    const res = await stripEndTurnJsonResponse(
      new Response(
        JSON.stringify({
          id: "chatcmpl-1",
          choices: [{
            index: 0,
            message: {
              role: "assistant",
              content: null,
              tool_calls: [{ id: "call_e", type: "function", function: { name: "end_turn", arguments: "{}" } }],
            },
            finish_reason: "tool_calls",
          }],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    const parsed = JSON.parse(await res.text());
    expect(parsed.choices[0].message.tool_calls).toEqual([]);
    expect(parsed.choices[0].message.content).toBe("");
    expect(parsed.choices[0].finish_reason).toBe("stop");
  });

  it("JSON: keeps real calls, drops only end_turn", async () => {
    const res = await stripEndTurnJsonResponse(
      new Response(
        JSON.stringify({
          id: "chatcmpl-1",
          choices: [{
            index: 0,
            message: {
              role: "assistant",
              tool_calls: [
                { id: "call_e", type: "function", function: { name: "end_turn", arguments: "{}" } },
                { id: "call_r", type: "function", function: { name: "read", arguments: '{"f":"a"}' } },
              ],
            },
            finish_reason: "tool_calls",
          }],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    const parsed = JSON.parse(await res.text());
    const names = parsed.choices[0].message.tool_calls.map((t) => t.function.name);
    expect(names).toEqual(["read"]);
    expect(parsed.choices[0].finish_reason).toBe("tool_calls");
  });

  it("SSE: isolated end_turn turn ends with finish stop and no tool_calls", async () => {
    const out = await drainToChunks(
      stripEndTurnStream(
        sse([
          JSON.stringify({ id: "c1", choices: [{ index: 0, delta: { role: "assistant" }, finish_reason: null }] }),
          JSON.stringify({
            id: "c1",
            choices: [{
              index: 0,
              delta: { tool_calls: [{ index: 0, id: "call_e", type: "function", function: { name: "end_turn", arguments: "" } }] },
              finish_reason: null,
            }],
          }),
          JSON.stringify({
            id: "c1",
            choices: [{ index: 0, delta: {}, finish_reason: "tool_calls" }],
          }),
        ]),
      ),
    );
    // role prelude streams through; the tool_call + finish must not leak end_turn
    expect(out.some((c) => (c?.choices?.[0]?.delta?.tool_calls || []).length > 0)).toBe(false);
    const fin = out.find((c) => c?.choices?.[0]?.finish_reason);
    expect(fin?.choices?.[0]?.finish_reason).toBe("stop");
  });

  it("SSE: parallel real call + end_turn call — real call survives, indices re-packed", async () => {
    const out = await drainToChunks(
      stripEndTurnStream(
        sse([
          JSON.stringify({
            id: "c1",
            choices: [{
              index: 0,
              delta: {
                tool_calls: [
                  { index: 0, id: "call_r", type: "function", function: { name: "read", arguments: "" } },
                  { index: 1, id: "call_e", type: "function", function: { name: "end_turn", arguments: "" } },
                ],
              },
              finish_reason: null,
            }],
          }),
          JSON.stringify({
            id: "c1",
            choices: [{
              index: 0,
              delta: { tool_calls: [{ index: 0, function: { arguments: '{"f":"a"}' } }] },
              finish_reason: null,
            }],
          }),
          JSON.stringify({
            id: "c1",
            choices: [{
              index: 0,
              delta: { tool_calls: [{ index: 1, function: { arguments: "{}" } }] },
              finish_reason: null,
            }],
          }),
          JSON.stringify({
            id: "c1",
            choices: [{ index: 0, delta: {}, finish_reason: "tool_calls" }],
          }),
        ]),
      ),
    );
    const names = out
      .flatMap((c) => c?.choices?.[0]?.delta?.tool_calls || [])
      .map((t) => t?.function?.name)
      .filter(Boolean);
    expect(names).toEqual(["read"]);
    const idxs = out
      .flatMap((c) => c?.choices?.[0]?.delta?.tool_calls || [])
      .map((t) => t.index);
    expect(idxs).toEqual([0, 0]);
    const fin = out.find((c) => c?.choices?.[0]?.finish_reason);
    expect(fin?.choices?.[0]?.finish_reason).toBe("tool_calls");
  });

  it("SSE: name arriving split across chunks still gets filtered (prelude fragments held back)", async () => {
    const out = await drainToChunks(
      stripEndTurnStream(
        sse([
          JSON.stringify({
            id: "c1",
            choices: [{
              index: 0,
              delta: { tool_calls: [{ index: 0, id: "call_e", type: "function", function: { name: "", arguments: "" } }] },
              finish_reason: null,
            }],
          }),
          JSON.stringify({
            id: "c1",
            choices: [{
              index: 0,
              delta: { tool_calls: [{ index: 0, function: { name: "end_turn", arguments: "{}" } }] },
              finish_reason: null,
            }],
          }),
          JSON.stringify({
            id: "c1",
            choices: [{ index: 0, delta: {}, finish_reason: "tool_calls" }],
          }),
        ]),
      ),
    );
    // The held-back id prologue must never have been forwarded alone.
    expect(out.some((c) => (c?.choices?.[0]?.delta?.tool_calls || []).length > 0)).toBe(false);
    const fin = out.find((c) => c?.choices?.[0]?.finish_reason);
    expect(fin?.choices?.[0]?.finish_reason).toBe("stop");
  });

  it("stripEndTurnFromChatMessage is a no-op (returns false) without end_turn", () => {
    const parsed = {
      choices: [{
        message: {
          tool_calls: [{ id: "call_r", function: { name: "read", arguments: "{}" } }],
        },
        finish_reason: "tool_calls",
      }],
    };
    expect(stripEndTurnFromChatMessage(parsed)).toBe(false);
    expect(parsed.choices[0].message.tool_calls).toHaveLength(1);
  });
});
