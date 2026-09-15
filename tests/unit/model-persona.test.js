import { describe, it, expect } from "vitest";
import { MODEL_PERSONAS, resolveModelPersona } from "../../open-sse/config/personaPrompts.js";
import { injectModelPersona } from "../../open-sse/rtk/persona.js";
import { injectSystemPrompt } from "../../open-sse/rtk/systemInject.js";
import { FORMATS } from "../../open-sse/translator/formats.js";
import { OPENAI_BLOCK } from "../../open-sse/translator/schema/blocks.js";
import { ROLE } from "../../open-sse/translator/schema/roles.js";

describe("personaPrompts config", () => {
  it("exposes exactly two personas with non-empty verbatim prompts", () => {
    expect(MODEL_PERSONAS.length).toBe(2);
    for (const p of MODEL_PERSONAS) {
      expect(p.id.length).toBeGreaterThan(0);
      expect(p.prompt.length).toBeGreaterThan(1000);
    }
  });

  it("gemini persona matches ag/gemini-3* models", () => {
    expect(resolveModelPersona("ag", "gemini-3.8-flash-high")?.id).toBe("boz-gemini");
    expect(resolveModelPersona("ag", "gemini-3.8-flash")?.id).toBe("boz-gemini");
    expect(resolveModelPersona("ag", "gemini-3-flash")?.id).toBe("boz-gemini");
  });

  it("muse persona matches muse-spark* across providers (oc/ot/cl)", () => {
    expect(resolveModelPersona("oc", "muse-spark-1.3")?.id).toBe("boz-muse");
    expect(resolveModelPersona("oc", "muse-spark-1.3(xhigh)")?.id).toBe("boz-muse");
    expect(resolveModelPersona("ot", "muse-spark-1.3")?.id).toBe("boz-muse");
    expect(resolveModelPersona("cl", "muse-spark-1.3")?.id).toBe("boz-muse");
  });

  it("does not match non-persona models", () => {
    expect(resolveModelPersona("ag", "gpt-oss-120b-medium")).toBeNull();
    expect(resolveModelPersona("ag", "claude-sonnet-4-6")).toBeNull();
    expect(resolveModelPersona("cbai", "glm-5.3")).toBeNull();
    expect(resolveModelPersona("cl", "anthropic/claude-sonnet-4.6")).toBeNull();
    expect(resolveModelPersona(null, "gemini-3.8-flash")).toBeNull();
    expect(resolveModelPersona("ag", null)).toBeNull();
  });
});

describe("injectModelPersona", () => {
  const persona = resolveModelPersona("ag", "gemini-3.8-flash-high");
  const muse = resolveModelPersona("ot", "muse-spark-1.3");

  it("appends persona to existing openai system string", () => {
    const body = { messages: [{ role: ROLE.SYSTEM, content: "hello" }, { role: ROLE.USER, content: "hi" }] };
    injectModelPersona(body, FORMATS.OPENAI, persona);
    expect(body.messages[0].content).toBe(`hello\n\n${persona.prompt}`);
  });

  it("creates a system message when none present", () => {
    const body = { messages: [{ role: ROLE.USER, content: "hi" }] };
    injectModelPersona(body, FORMATS.OPENAI, muse);
    expect(body.messages[0]).toEqual({ role: ROLE.SYSTEM, content: muse.prompt });
    expect(body.messages[1].role).toBe(ROLE.USER);
  });

  it("is idempotent across repeated injection (marker guard)", () => {
    const body = { messages: [{ role: ROLE.SYSTEM, content: "hello" }] };
    injectModelPersona(body, FORMATS.OPENAI, persona);
    injectModelPersona(body, FORMATS.OPENAI, persona);
    const marker = persona.prompt.split("\n", 1)[0];
    expect(body.messages[0].content.split(marker).length - 1).toBe(1);
  });

  it("skips injection when client already sent the persona", () => {
    const body = { messages: [{ role: ROLE.SYSTEM, content: `client rules\n\n${muse.prompt}` }] };
    injectModelPersona(body, FORMATS.OPENAI, muse);
    expect(body.messages[0].content).toBe(`client rules\n\n${muse.prompt}`);
  });

  it("injects into claude body.system", () => {
    const body = { system: "existing", messages: [] };
    injectModelPersona(body, FORMATS.CLAUDE, persona);
    expect(body.system).toBe(`existing\n\n${persona.prompt}`);
  });

  it("injects into gemini systemInstruction parts", () => {
    const body = { systemInstruction: { parts: [{ text: "existing" }] } };
    injectModelPersona(body, FORMATS.GEMINI, persona);
    expect(body.systemInstruction.parts).toEqual([{ text: "existing" }, { text: persona.prompt }]);
  });

  it("injects into antigravity wrapped body.request shape", () => {
    const body = { request: { systemInstruction: { parts: [] } } };
    injectModelPersona(body, FORMATS.ANTIGRAVITY, persona);
    expect(body.request.systemInstruction.parts).toEqual([{ text: persona.prompt }]);
  });

  it("fail-open: no throw on null persona or malformed body", () => {
    expect(() => injectModelPersona({}, FORMATS.OPENAI, null)).not.toThrow();
    expect(() => injectModelPersona(null, FORMATS.OPENAI, persona)).not.toThrow();
    expect(() => injectModelPersona("string", FORMATS.OPENAI, persona)).not.toThrow();
  });

  it("keeps injectSystemPrompt parity with caveman injector path", () => {
    const a = { messages: [{ role: ROLE.SYSTEM, content: "x" }] };
    const b = { messages: [{ role: ROLE.SYSTEM, content: "x" }] };
    injectSystemPrompt(a, FORMATS.OPENAI, persona.prompt);
    injectModelPersona(b, FORMATS.OPENAI, persona);
    expect(a.messages[0].content).toBe(b.messages[0].content);
  });

  it("openai block type is TEXT (never input_text) when appending to array content", () => {
    const body = { messages: [{ role: ROLE.SYSTEM, content: [{ type: OPENAI_BLOCK.TEXT, text: "hello" }] }] };
    injectModelPersona(body, FORMATS.OPENAI, muse);
    const arr = body.messages[0].content;
    expect(arr[arr.length - 1]).toEqual({ type: OPENAI_BLOCK.TEXT, text: muse.prompt });
  });
});
