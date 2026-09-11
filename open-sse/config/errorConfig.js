// OpenAI-compatible error types mapping (client-facing)
export const ERROR_TYPES = {
  400: { type: "invalid_request_error", code: "bad_request" },
  401: { type: "authentication_error", code: "invalid_api_key" },
  402: { type: "billing_error", code: "payment_required" },
  403: { type: "permission_error", code: "insufficient_quota" },
  404: { type: "invalid_request_error", code: "model_not_found" },
  406: { type: "invalid_request_error", code: "model_not_supported" },
  429: { type: "rate_limit_error", code: "rate_limit_exceeded" },
  500: { type: "server_error", code: "internal_server_error" },
  502: { type: "server_error", code: "bad_gateway" },
  503: { type: "server_error", code: "service_unavailable" },
  504: { type: "server_error", code: "gateway_timeout" }
};

// Default error messages per status code (client-facing)
export const DEFAULT_ERROR_MESSAGES = {
  400: "Bad request",
  401: "Invalid API key provided",
  402: "Payment required",
  403: "You exceeded your current quota",
  404: "Model not found",
  406: "Model not supported",
  429: "Rate limit exceeded",
  500: "Internal server error",
  502: "Bad gateway - upstream provider error",
  503: "Service temporarily unavailable",
  504: "Gateway timeout"
};

// Exponential backoff config for rate limits
export const BACKOFF_CONFIG = {
  base: 2000,
  max: 5 * 60 * 1000,
  maxLevel: 15
};

// Default cooldown for transient/unknown errors
export const TRANSIENT_COOLDOWN_MS = 30 * 1000;

// Hard cap for provider-reported rate limit cooldown (e.g. codex resets_at can be 5-6h)
export const MAX_RATE_LIMIT_COOLDOWN_MS = 30 * 60 * 1000;

// Cooldown durations (ms)
const COOLDOWN = {
  long: 2 * 60 * 1000,
  short: 5 * 1000,
};

/**
 * Unified error classification rules.
 * Checked top-to-bottom: text rules first (by order), then status rules.
 * Each rule: { text?, status?, cooldownMs?, backoff?, noFallback? }
 *   - text: substring match (case-insensitive) on error message
 *   - status: HTTP status code match
 *   - cooldownMs: fixed cooldown duration
 *   - backoff: true = use exponential backoff (rate limit)
 *   - noFallback: true = deterministic client/request error — retrying another
 *     account can never succeed, so don't lock the account and don't fallback.
 *     The error is returned to the client immediately.
 */
export const ERROR_RULES = [
  // --- No-fallback rules: deterministic 400s (checked FIRST) ---
  // Retrying these on another account is pointless and only burns all accounts.
  { text: "oversized hosted request", noFallback: true },
  { text: "8 mib maximum",            noFallback: true },
  { text: "invalid or oversized",      noFallback: true },
  // --- Text-based rules (checked after no-fallback, order = priority) ---
  { text: "no credentials",           cooldownMs: COOLDOWN.long },
  { text: "request not allowed",      cooldownMs: COOLDOWN.short },
  { text: "improperly formed request", cooldownMs: COOLDOWN.long },
  // Alysis 502: upstream (DeepSeek host di balik edge fn) sesekali menolak dan
  // menyuruh retry — akunnya sendiri sehat (akun lain di IP sama lolos, dan
  // akun yang sama sukses di request berikutnya). Soft fallback: pindah akun
  // untuk request ini saja, TANPA lock / testStatus unavailable.
  { text: "upstream rejected the request", noLock: true },
  { text: "rate limit",               backoff: true },
  { text: "too many requests",        backoff: true },
  { text: "frequency limit",          backoff: true },
  { text: "usage exceeds",            backoff: true },
  { text: "quota exceeded",           backoff: true },
  // Top-up-required (e.g. CodeBuddy 14018): no point retrying every few
  // seconds — lock long immediately. Mirrors MAX_RATE_LIMIT_COOLDOWN_MS.
  { text: "credits exhausted",        cooldownMs: 30 * 60 * 1000 },
  { text: "insufficient credits",     cooldownMs: 30 * 60 * 1000 },
  { text: "capacity",                 backoff: true },
  { text: "overloaded",               backoff: true },

  // --- Status-based rules (fallback when text doesn't match) ---
  { status: 401, cooldownMs: COOLDOWN.long },
  { status: 402, cooldownMs: COOLDOWN.long },
  { status: 403, cooldownMs: COOLDOWN.long },
  { status: 404, cooldownMs: COOLDOWN.long },
  { status: 429, backoff: true },
];

// Backward compat: COOLDOWN_MS object (used by index.js re-export)
export const COOLDOWN_MS = {
  unauthorized: COOLDOWN.long,
  paymentRequired: COOLDOWN.long,
  notFound: COOLDOWN.long,
  transient: TRANSIENT_COOLDOWN_MS,
  requestNotAllowed: COOLDOWN.short,
};
