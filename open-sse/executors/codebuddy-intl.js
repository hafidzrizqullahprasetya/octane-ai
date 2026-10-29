import { createHash, randomUUID } from "node:crypto";
import { DefaultExecutor } from "./default.js";
import { parseCodebuddyError } from "./codebuddyError.js";

/**
 * CodeBuddyIntlExecutor — talks to https://www.codebuddy.ai/v2/chat/completions
 *
 * Same OpenAI-compatible-but-stream-only gateway behavior as codebuddy-cn:
 * non-stream requests are rejected, and reasoning is surfaced only when the
 * request carries the IDE's OpenAI-style reasoning params. Force stream and
 * mirror reasoning_summary exactly like CodeBuddyExecutor.
 */

// Deterministic RFC-4122-v5-shaped UUID derived from a session key, mirroring
// the official client's per-conversation id (uuid5 over the session key).
function stableUuidFrom(key) {
 const hash = createHash("sha1").update(key).digest("hex");
 const timeHigh = ((parseInt(hash.slice(12, 16), 16) & 0x0fff) | 0x5000)
  .toString(16)
  .padStart(4, "0");
 const clockSeq = ((parseInt(hash.slice(16, 20), 16) & 0x3fff) | 0x8000)
  .toString(16)
  .padStart(4, "0");
 return [
  hash.slice(0, 8),
  hash.slice(8, 12),
  timeHigh,
  clockSeq,
  hash.slice(20, 32),
 ].join("-");
}

export class CodeBuddyIntlExecutor extends DefaultExecutor {
 constructor() {
  super("codebuddy-intl");
 }

 // Upstream "channel verification" (HTTP 400 code 11128 "conversation id
 // missing", 9router #4892): the intl gateway now rejects any request that
 // does not carry the X-Conversation-* header family the official IDE sends
 // on every turn — a conversation id derived stably from the session key,
 // plus fresh UUIDs for the request and the message. Verified A/B against
 // the live upstream: same credentials and body, headers absent -> 11128,
 // headers present -> 200 SSE. codebuddy-cn (copilot.tencent.com) is not
 // gated yet, so only the intl executor grows these headers.
 buildHeaders(credentials, stream = true, url, model, body = null) {
  const headers = super.buildHeaders(credentials, stream, url, model, body);

  // Stable per-conversation id: prefer whatever session key the client sent,
  // else derive from the opening user message (stable across retries of the
  // same turn and across accounts), else fall back to a random UUID.
  const sessionKey =
   (typeof body?.session_id === "string" && body.session_id) ||
   (typeof body?.prompt_cache_key === "string" && body.prompt_cache_key) ||
   (typeof body?.conversation_id === "string" && body.conversation_id) ||
   null;
  const firstUser = Array.isArray(body?.messages)
   ? body.messages.find((m) => m?.role === "user")
   : null;
  const userText =
   typeof firstUser?.content === "string"
    ? firstUser.content
    : Array.isArray(firstUser?.content)
     ? firstUser.content
      .map((b) => (b && typeof b.text === "string" ? b.text : ""))
      .join("\n")
     : "";
  const conversationKey = sessionKey || (userText ? `cbai:${userText}` : null);

  headers["X-Conversation-ID"] = conversationKey
   ? stableUuidFrom(conversationKey)
   : (headers["X-Conversation-ID"] || randomUUID());

  // CRITICAL FIX: The official CodeBuddy IDE assigns ONE requestId to both
  // X-Request-ID and X-Conversation-Request-ID. Mismatching them triggered
  // 11140 ("account restricted due to unusual activity" / WAF bot detection).
  const requestId = headers["X-Request-ID"] || randomUUID();
  headers["X-Request-ID"] = requestId;
  headers["X-Conversation-Request-ID"] = requestId;
  headers["X-Conversation-Message-ID"] = headers["X-Conversation-Message-ID"] || randomUUID();

  // W3C / B3 trace context expected by CodeBuddy gateway
  const traceId = requestId.replace(/-/g, "");
  if (!headers["X-Trace-ID"]) headers["X-Trace-ID"] = traceId;
  if (!headers["X-B3-TraceId"]) headers["X-B3-TraceId"] = traceId;
  if (!headers["X-B3-Sampled"]) headers["X-B3-Sampled"] = "1";
  return headers;
 }

 transformRequest(model, body, stream, credentials) {
  const transformed = super.transformRequest(model, body, stream, credentials);
  transformed.stream = true;

  const eff = transformed.reasoning_effort;
  if (eff === "none" || eff === "off") {
   delete transformed.reasoning_effort;
  } else if (eff) {
   transformed.reasoning_summary = "auto";
  }

  // CodeBuddy rejects plain OpenAI shape (11101 invalid request): needs a
  // leading system prompt + user content as typed blocks, not a bare string.
  const source = Array.isArray(transformed.messages) ? transformed.messages : [];
  const systemParts = ["You are CodeBuddy Code."];
  const userMessages = [];

  const AGENT_PATTERN = /you are claude code|claude.?code.+official.+cli|anthropic.+official.+cli|anxthxropic.+official.+cli|you are (?:cursor|windsurf|cline|aider|continue|copilot|cody)|cc_entrypoint\s*=\s*(?:cli|vscode|jetbrains|gui)|claude.?code.+issues|give feedback.+claude.?code|OhMyOpenCode/gi;

  for (const message of source) {
   if (!message || typeof message !== "object") continue;
   if (["system", "developer"].includes(message.role)) {
    const text = typeof message.content === "string"
     ? message.content
     : Array.isArray(message.content)
      ? message.content.map(b => (b && typeof b.text === "string" ? b.text : "")).join("\n")
      : "";
    const cleaned = text.replace(AGENT_PATTERN, "[external-client-identity]").trim();
    if (cleaned && !systemParts.includes(cleaned)) {
     systemParts.push(cleaned);
    }
    continue;
   }
   if (message.role === "user" && typeof message.content === "string") {
    userMessages.push({ ...message, content: [{ type: "text", text: message.content }] });
   } else {
    userMessages.push({ ...message });
   }
  }

  transformed.messages = [{ role: "system", content: systemParts.join("\n\n") }, ...userMessages];

  return transformed;
 }
 parseError(response, bodyText) {
  return parseCodebuddyError(response, bodyText) || super.parseError(response, bodyText);
 }
}

export default CodeBuddyIntlExecutor;
