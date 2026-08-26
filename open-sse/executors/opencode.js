import crypto from "crypto";
import { BaseExecutor } from "./base.js";
import { PROVIDERS } from "../config/providers.js";
import { injectReasoningContent } from "../utils/reasoningContentInjector.js";
import { resolveSessionId } from "../utils/sessionManager.js";

const OPENCODE_UA = "opencode";
const MESSAGES_MODELS = new Set();

function generateRequestId() {
  return `msg_${crypto.randomUUID().replace(/-/g, "")}`;
}

function generateSessionId() {
  return `ses_${crypto.randomUUID().replace(/-/g, "")}`;
}

// Normalize any resolved id into opencode's ses_ format (stable per-conversation)
function toOpencodeSession(id) {
  const stripped = String(id || "").replace(/^ses_/, "").replace(/-/g, "");
  return stripped ? `ses_${stripped}` : null;
}

function resolveOpencodeSession(body, credentials) {
  return toOpencodeSession(resolveSessionId({
    headers: credentials?.rawHeaders,
    body,
    connectionId: credentials?.connectionId,
    scope: "opencode",
  }));
}

import { stripThinkingSuffix, parseSuffix } from "../translator/concerns/thinkingUnified.js";
import { openaiToOpenAIResponsesRequest } from "../translator/request/openai-responses.js";
import { openaiResponsesToOpenAIResponse } from "../translator/response/openai-responses.js";
import { initState } from "../translator/index.js";
import { proxyAwareFetch } from "../utils/proxyFetch.js";

const RESPONSES_MODELS = new Set([
  "muse-spark-1.2-contributor-free",
  "muse-spark-1.2",
  "muse-spark",
]);

// OpenCode free tier is limited per egress IP — a 429/403 with a limit-ish
// body means the POOL's IP is exhausted, not the account. Declare it
// pool-scoped so chatCore marks the pool unfit, retries via another pool, and
// it shows up (clearable) on the Proxy Fitness page.
const IP_LIMIT_BODY = /limit|rate|quota|exhausted|capacity|too many|retry/i;

function resolveOpencodeModelId(model) {
  const stripped = stripThinkingSuffix(model) || model;
  if (stripped === "ox-alpha-free" || stripped === "x-preview-f-free" || stripped === "ox-alpha") return "x-preview-f-free";
  if (stripped === "muse-spark" || stripped === "muse-spark-1.2" || stripped === "muse-spark-1.2-contributor-free" || stripped.startsWith("muse-spark")) return "muse-spark-1.2-contributor-free";
  if (stripped === "mimo-v2.5-free" || stripped === "mimo-v2.5") return "mimo-v2.5-free";
  if (stripped === "nemotron-3.5-lightning-free" || stripped === "nemotron-3.5-lightning") return "nemotron-3.5-lightning-free";
  if (stripped === "nemotron-3-ultra-free" || stripped === "nemotron-3-ultra") return "nemotron-3-ultra-free";
  if (stripped === "laguna-s-2.1-free" || stripped === "laguna-s-2.1") return "laguna-s-2.1-free";
  if (stripped === "hy3-free" || stripped === "hy3" || stripped === "hunyuan-3") return "hy3-free";
  if (stripped === "big-pickle") return "big-pickle";
  return stripped;
}

export class OpenCodeExecutor extends BaseExecutor {
  constructor() {
    super("opencode", PROVIDERS.opencode);
    this._currentSessionId = null;
  }

  transformRequest(model, body, stream, credentials) {
    this._currentSessionId = resolveOpencodeSession(body, credentials);
    const resolvedModel = resolveOpencodeModelId(model);
    const suffixParsed = parseSuffix(model);
    const effort = suffixParsed?.override?.level || body?.reasoning_effort || "xhigh";

    if (RESPONSES_MODELS.has(resolvedModel)) {
      const enrichedBody = {
        ...body,
        reasoning_effort: effort,
      };
      if (enrichedBody?.messages) {
        return openaiToOpenAIResponsesRequest(resolvedModel, enrichedBody, true, credentials);
      }
      return { ...enrichedBody, model: resolvedModel };
    }

    const resolvedBody = { ...body, model: resolvedModel };
    return injectReasoningContent({ provider: this.provider, model: resolvedModel, body: resolvedBody });
  }

  buildUrl(model) {
    const base = this.config.baseUrl;
    const resolvedModel = resolveOpencodeModelId(model);
    if (RESPONSES_MODELS.has(resolvedModel)) {
      return `${base}/zen/v1/responses`;
    }
    return MESSAGES_MODELS.has(resolvedModel)
      ? `${base}/zen/v1/messages`
      : `${base}/zen/v1/chat/completions`;
  }

  buildHeaders(credentials, stream = true) {
    const raw = credentials?.rawHeaders || {};
    const lower = {};
    for (const [k, v] of Object.entries(raw)) lower[k.toLowerCase()] = v;

    const downstreamUa = lower["user-agent"] || "";
    const isOpencodeDownstream = downstreamUa.toLowerCase().includes("opencode");

    return {
      "Content-Type": "application/json",
      "Authorization": "Bearer public",
      "User-Agent": isOpencodeDownstream ? downstreamUa : OPENCODE_UA,
      "x-opencode-client": lower["x-opencode-client"] || "cli",
      "x-opencode-session": lower["x-opencode-session"] || this._currentSessionId || generateSessionId(),
      "x-opencode-request": lower["x-opencode-request"] || generateRequestId(),
      "x-opencode-project": lower["x-opencode-project"] || "global",
      "Accept": stream ? "text/event-stream" : "*/*",
    };
  }

  async execute(options) {
    const { model, body, stream, credentials, signal, log, proxyOptions = null } = options;
    const resolvedModel = resolveOpencodeModelId(model);

    if (RESPONSES_MODELS.has(resolvedModel)) {
      const url = this.buildUrl(model);
      const transformedBody = this.transformRequest(model, body, stream, credentials);
      const headers = this.buildHeaders(credentials, true);

      log?.debug?.("OPENCODE", `Routing ${model} to /responses`);

      const response = await proxyAwareFetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(transformedBody),
        signal,
      }, proxyOptions);

      if (!response.ok || !response.body) {
        return { response, url, headers, transformedBody };
      }

      const state = initState("openai-responses");
      state.model = model;

      const decoder = new TextDecoder();
      let buffer = "";

      const transformStream = new TransformStream({
        transform(chunk, controller) {
          buffer += decoder.decode(chunk, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith("data:")) continue;
            const jsonStr = trimmed.slice(5).trim();
            if (jsonStr === "[DONE]") {
              if (stream === true) {
                controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
              }
              continue;
            }

            try {
              const parsed = JSON.parse(jsonStr);
              const converted = openaiResponsesToOpenAIResponse(parsed, state);
              if (converted) {
                controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(converted)}\n\n`));
              }
            } catch (e) {}
          }
        },
        flush(controller) {
          if (buffer.trim() && buffer.trim().startsWith("data:")) {
            const jsonStr = buffer.trim().slice(5).trim();
            if (jsonStr && jsonStr !== "[DONE]") {
              try {
                const parsed = JSON.parse(jsonStr);
                const converted = openaiResponsesToOpenAIResponse(parsed, state);
                if (converted) {
                  controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(converted)}\n\n`));
                }
              } catch (e) {}
            }
          }
        }
      });

      const convertedStream = response.body.pipeThrough(transformStream);
      return {
        response: new Response(convertedStream, {
          status: response.status,
          statusText: response.statusText,
          headers: {
            ...Object.fromEntries(response.headers.entries()),
            "content-type": "text/event-stream",
          },
        }),
        url,
        headers,
        transformedBody,
      };
    }

    return super.execute(options);
  }

  parseError(response, bodyText) {
    const status = response?.status || 0;
    const text = String(bodyText || "");
    if ((status === 429 || status === 403) && IP_LIMIT_BODY.test(text)) {
      return {
        status,
        message: text.slice(0, 300) || `OpenCode free limit (${status})`,
        poolScoped: { reason: "ip-limit" },
      };
    }
    return null; // fall through to default parsing
  }
}
