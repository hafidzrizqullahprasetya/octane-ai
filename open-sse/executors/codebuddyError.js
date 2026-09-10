/**
 * Shared CodeBuddy upstream error parser (codebuddy-intl + codebuddy-cn).
 *
 * Observed 429 shapes from https://www.codebuddy.ai/v2/chat/completions:
 *   1. Credits exhausted (no reset time, account needs top-up):
 *      {"error":{"data":{"code":14018,"msg":"Credits exhausted. Please visit ..."}}}
 *   2. Per-model frequency limit (real reset time in the message):
 *      {"code":6004,"msg":"usage exceeds frequency limit, but don't worry,
 *        your usage will reset at 2026-09-10 15:34:37 UTC+8, ..."}
 *
 * Without this, both fall through to generic exponential backoff (2s...5m):
 * - 6004 with a 4h reset spins on the SAME account every 2s/4s/8s... ("all 16
 *   accounts locked (reset after 2s)") instead of locking until the real reset.
 * - 14018 hammers top-up-required accounts every few seconds on first failures.
 *
 * Returns { status, message, resetsAtMs? } or null when not a CodeBuddy
 * quota shape (caller falls back to super.parseError).
 */

// Keep in sync with MAX_RATE_LIMIT_COOLDOWN_MS (open-sse/config/errorConfig.js).
// markAccountUnavailable caps non-antigravity resetsAtMs to that value anyway;
// returning it directly gives a long lock immediately instead of a 2s retry.
export const CODEBUDDY_EXHAUSTED_COOLDOWN_MS = 30 * 60 * 1000;

/**
 * Parse "will reset at 2026-09-10 15:34:37 UTC+8" (also UTC+08:00 / UTC-5).
 * @param {string} text
 * @returns {number|null} UTC epoch ms, or null when not found/unparsable.
 */
export function parseCodebuddyResetMs(text) {
  const m = String(text || "").match(
    /reset at (\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})\s*UTC\s*([+-])\s*(\d{1,2})(?::?(\d{2}))?/i
  );
  if (!m) return null;
  const [, Y, Mo, D, h, mi, s, sign, oh, om] = m;
  const offMin = (parseInt(oh, 10) * 60 + parseInt(om || "0", 10)) * (sign === "-" ? -1 : 1);
  const utcMs = Date.UTC(+Y, +Mo - 1, +D, +h, +mi, +s) - offMin * 60 * 1000;
  return Number.isFinite(utcMs) ? utcMs : null;
}

function tryParseJson(bodyText) {
  try {
    return JSON.parse(bodyText);
  } catch { /* noop */ }
  // Defensive: body may carry a "[429]: " prefix; recover the JSON tail.
  const idx = String(bodyText || "").indexOf("{");
  if (idx > 0) {
    try {
      return JSON.parse(String(bodyText).slice(idx));
    } catch { /* noop */ }
  }
  return null;
}

/**
 * @param {{ status?: number }} response - fetch Response (only .status is read)
 * @param {string} bodyText - raw upstream body
 * @returns {{ status: number, message: string, resetsAtMs?: number }|null}
 */
export function parseCodebuddyError(response, bodyText) {
  if (!response || response.status !== 429 || !bodyText) return null;
  const json = tryParseJson(bodyText);
  if (!json || typeof json !== "object") return null;

  const err = json.error && typeof json.error === "object" ? json.error : null;
  const data = err?.data && typeof err.data === "object" ? err.data : null;
  const code = json.code ?? data?.code ?? err?.code ?? null;
  const rawMsg = json.msg ?? data?.msg ?? err?.message ?? err?.msg ?? json.message ?? "";
  const msg = typeof rawMsg === "string" ? rawMsg : JSON.stringify(rawMsg);
  const numCode = Number(code);

  // Per-model frequency limit — honor the upstream reset time so the account
  // locks until it can actually serve again (capped to 30m downstream).
  if (numCode === 6004) {
    const resetMs = parseCodebuddyResetMs(msg);
    if (resetMs && resetMs > Date.now()) {
      return { status: 429, message: msg || bodyText, resetsAtMs: resetMs };
    }
    return { status: 429, message: msg || bodyText };
  }

  // Credits exhausted — no reset time; lock long immediately (top-up required).
  if (numCode === 14018 || /credits?\s+exhausted/i.test(msg)) {
    return {
      status: 429,
      message: msg || bodyText,
      resetsAtMs: Date.now() + CODEBUDDY_EXHAUSTED_COOLDOWN_MS,
    };
  }

  return null;
}
