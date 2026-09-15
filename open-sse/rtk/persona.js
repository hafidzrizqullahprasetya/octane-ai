// Model persona injector: appends the matched BOZAGENTIC persona prompt into the
// system message of the final request body, just before dispatch to the provider
// executor. Persona resolution lives in config/personaPrompts.js.
//
// Persona prompts are multi-paragraph (contain the SEP "\n\n" internally), so the
// single-segment idempotency inside systemInject.js cannot detect a pre-existing
// copy. Guard with a marker line (the persona file's header) instead: if any
// system-surface text already contains it, skip injection. Fail-open throughout.

import { injectSystemPrompt } from "./systemInject.js";
import { ROLE } from "../translator/schema/roles.js";
import { RESPONSES_ITEM } from "../translator/schema/blocks.js";

function collectSystemTexts(body) {
  const texts = [];
  const push = v => { if (typeof v === "string") texts.push(v); };
  try {
    if (typeof body.instructions === "string") texts.push(body.instructions);
    if (Array.isArray(body.messages)) {
      for (const m of body.messages) {
        if (!m || (m.role !== ROLE.SYSTEM && m.role !== ROLE.DEVELOPER)) continue;
        push(m.content);
        if (Array.isArray(m.content)) for (const p of m.content) push(p?.text);
      }
    }
    if (Array.isArray(body.input)) {
      for (const it of body.input) {
        if (!it || it.type !== RESPONSES_ITEM.MESSAGE || (it.role !== ROLE.SYSTEM && it.role !== ROLE.DEVELOPER)) continue;
        push(it.content);
        if (Array.isArray(it.content)) for (const p of it.content) push(p?.text);
      }
    }
    if (typeof body.system === "string") texts.push(body.system);
    if (Array.isArray(body.system)) for (const b of body.system) push(b?.text);
    const geminiShape = body.request && typeof body.request === "object" ? body.request : body;
    const sys = geminiShape.system_instruction ?? geminiShape.systemInstruction;
    if (sys?.parts) for (const p of sys.parts) push(p?.text);
    push(body.systemPrompt);
  } catch (_) { /* fail-open */ }
  return texts;
}

export function injectModelPersona(body, format, persona) {
  if (!body || !persona || !persona.prompt) return;
  try {
    const marker = persona.prompt.split("\n", 1)[0];
    if (marker && collectSystemTexts(body).some(t => t.includes(marker))) return;
  } catch (_) { /* fail-open */ }
  injectSystemPrompt(body, format, persona.prompt);
}
