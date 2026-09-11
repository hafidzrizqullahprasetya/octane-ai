// Payload size guard: keep the outbound request body under a host's request
// size limit (e.g. alysis Supabase edge fn rejects >8 MiB with
// "Invalid or oversized hosted request"). Runs AFTER every token-saver, right
// before dispatch, so it is the last line of defense — it only ever kicks in
// for genuinely oversized payloads, which makes it safe in production too:
// a trimmed request still answers; a 400 kills every account in the pool.
//
// Strategy (in order, cheapest/most surgical first):
//   1. Truncate oversized tool-result / text string contents with a marker.
//   2. Drop whole middle history messages (keep system, first & last turns)
//      when single-field truncation is not enough.
// OpenAI chat shape is the pivot format, so this covers the alysis
// (openai→openai) route; other shapes fall through untouched (fail-open).

const MIB = 1024 * 1024;

// Host request caps by provider id (bytes). Providers without an entry share
// the conservative default. Budget stays under the cap with headroom for
// JSON-escape growth (~1.33x worst case for CJK/emoji) so the serialized
// body stays under the host limit.
const DEFAULT_MAX_REQUEST_BYTES = 6 * MIB; // vs generic 8 MiB host caps
const PROVIDER_MAX_REQUEST_BYTES = {
  // Supabase edge function host limit is 8 MiB for the whole request.
  alysis: 8 * MIB,
};

const HEADROOM_FACTOR = 1.2; // JSON-escape + envelope growth headroom

// Single-field truncation budgets
const TOOL_RESULT_KEEP_BYTES = 32 * 1024;   // per tool-result string content
const TEXT_PART_KEEP_BYTES = 64 * 1024;     // per message text part

function byteLength(str) {
  return typeof str === "string" ? Buffer.byteLength(str, "utf8") : 0;
}

function truncationMarker(bytesRemoved) {
  return `\n…[9router truncated ~${Math.max(1, Math.round(bytesRemoved / 1024))}KB to fit the provider request size limit]`;
}

// Truncate one string field on a holder object; returns bytes removed (0 when untouched).
function truncateStringField(holder, key, keepBytes) {
  const val = holder?.[key];
  if (typeof val !== "string") return 0;
  const size = byteLength(val);
  if (size <= keepBytes) return 0;
  // UTF-8 safe cut: start at keepBytes CHARS (1 byte/char common case keeps
  // the full budget), then shrink 10% at a time while the encoded size is
  // still over budget (up to 4 bytes/char for emoji/CJK).
  let out = val.slice(0, keepBytes);
  while (out.length > 0 && byteLength(out) > keepBytes) out = out.slice(0, Math.floor(out.length * 0.9));
  const removed = size - byteLength(out);
  holder[key] = out + truncationMarker(removed);
  return removed;
}

function bodyBytes(body) {
  try { return byteLength(JSON.stringify(body)); } catch { return Infinity; }
}

// Truncate every oversized string content on one message. Returns bytes removed.
function truncateMessageContent(msg, stats) {
  let removed = 0;
  if (!msg) return 0;
  if (typeof msg.content === "string") {
    const keep = msg.role === "tool" ? TOOL_RESULT_KEEP_BYTES : TEXT_PART_KEEP_BYTES;
    removed += truncateStringField(msg, "content", keep);
  } else if (Array.isArray(msg.content)) {
    for (const part of msg.content) {
      if (!part || typeof part !== "object") continue;
      const isToolResult = part.type === "tool_result";
      const keep = isToolResult ? TOOL_RESULT_KEEP_BYTES : TEXT_PART_KEEP_BYTES;
      if (typeof part.text === "string") removed += truncateStringField(part, "text", keep);
    }
  }
  if (removed > 0) stats.fieldsTrimmed++;
  return removed;
}

// Biggest droppable middle message: not system, not among the last 2 messages,
// and never part of a tool_calls/tool pair (dropping one half orphans the other
// and strict OpenAI hosts 400 on unpaired tool messages).
function findBiggestDroppable(messages) {
  let bestIdx = -1;
  let bestSize = 0;
  const lastProtected = messages.length - 2;
  for (let i = 1; i < lastProtected; i++) {
    const msg = messages[i];
    if (!msg) continue;
    if (msg.role === "system") continue;
    if (msg.role === "tool") continue;
    if (msg.role === "assistant" && Array.isArray(msg.tool_calls) && msg.tool_calls.length > 0) continue;
    const size = bodyBytes(msg);
    if (size > bestSize) { bestIdx = i; bestSize = size; }
  }
  return bestIdx;
}

/**
 * Ensure the serialized body stays under the provider's request byte cap.
 * Mutates body in place. Returns stats: { applied, bytesBefore, bytesAfter,
 * fieldsTrimmed, messagesDropped } — null when no trimming was needed.
 */
export function enforceRequestSizeLimit(provider, body, log = null) {
  if (!body || typeof body !== "object") return null;
  const messages = Array.isArray(body.messages) ? body.messages : null;
  if (!messages) return null;

  const cap = (PROVIDER_MAX_REQUEST_BYTES[provider] || DEFAULT_MAX_REQUEST_BYTES) / HEADROOM_FACTOR;
  const before = bodyBytes(body);
  if (before <= cap) return null;

  const stats = { applied: true, bytesBefore: before, bytesAfter: before, fieldsTrimmed: 0, messagesDropped: 0 };

  // Phase 1: truncate oversized string fields inside every message
  for (const msg of messages) truncateMessageContent(msg, stats);

  // Phase 2: drop biggest plain middle turns until under the cap
  while (bodyBytes(body) > cap && messages.length > 3) {
    const dropIdx = findBiggestDroppable(messages);
    if (dropIdx === -1) break;
    messages.splice(dropIdx, 1);
    stats.messagesDropped++;
  }

  // Phase 3: last resort — hard-truncate every remaining oversized field to 8KiB
  if (bodyBytes(body) > cap) {
    for (const msg of messages) {
      if (typeof msg?.content === "string") {
        truncateStringField(msg, "content", 8 * 1024);
      } else if (Array.isArray(msg?.content)) {
        for (const part of msg.content) {
          if (part && typeof part.text === "string") truncateStringField(part, "text", 8 * 1024);
        }
      }
    }
  }

  stats.bytesAfter = bodyBytes(body);
  if (stats.bytesAfter > cap) {
    log?.warn?.("SIZEGUARD", `${provider} | still above cap after trimming (${(stats.bytesAfter / MIB).toFixed(2)}MiB) — sending anyway`);
  } else {
    log?.debug?.("SIZEGUARD", `${provider} | ${(stats.bytesBefore / MIB).toFixed(2)}MiB → ${(stats.bytesAfter / MIB).toFixed(2)}MiB | trimmed=${stats.fieldsTrimmed} dropped=${stats.messagesDropped}`);
  }
  return stats;
}

/** Format a one-line log entry for the size guard. */
export function formatSizeGuardLog(stats) {
  if (!stats?.applied) return null;
  const mb = (n) => (n / MIB).toFixed(2);
  const parts = [`${mb(stats.bytesBefore)}MiB → ${mb(stats.bytesAfter)}MiB`];
  if (stats.fieldsTrimmed) parts.push(`trim:${stats.fieldsTrimmed}`);
  if (stats.messagesDropped) parts.push(`drop:${stats.messagesDropped}`);
  return `[SIZEGUARD] ${parts.join(" · ")}`;
}
