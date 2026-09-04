import crypto from "crypto";
import { BaseExecutor } from "./base.js";
import { PROVIDERS } from "../config/providers.js";
import { getThinkingLevels } from "../providers/thinkingLevels.js";
import { injectReasoningContent } from "../utils/reasoningContentInjector.js";
import { resolveSessionId } from "../utils/sessionManager.js";

const OPENCODE_UA = "opencode";
// Models served by /zen/v1/responses; every other model stays on /chat/completions.
const RESPONSES_MODELS = new Set([
  "muse-spark-1.3-contributor-free",
  "muse-spark-1.3",
  "muse-spark-1.3-contributor",
  "muse-spark-1.2-contributor-free",
  "muse-spark-1.2",
  "muse-spark",
]);

function generateRequestId() {
  return `msg_${crypto.randomUUID().replace(/-/g, "")}`;
}

function generateSessionId() {
  return `ses_${crypto.randomUUID().replace(/-/g, "")}`;
}

// Strip the thinking suffix "model(level)" so registry lookups hit the base id.
function baseModelId(model) {
  return String(model || "").replace(/\([^()]+\)\s*$/, "").trim();
}

function isResponsesModel(model) {
  return RESPONSES_MODELS.has(baseModelId(model));
}

function resolveOpencodeSession(body, credentials) {
  const headers = credentials?.rawHeaders || {};
  return resolveSessionId({
    headers,
    body,
    connectionId: credentials?.connectionId,
    scope: "opencode",
    generate: generateSessionId,
  });
}

function normalizeOpencodeReasoning(model, body) {
  const current = body.reasoning;
  const currentReasoning = current && typeof current === "object" && !Array.isArray(current)
    ? current
    : null;
  const requestedEffort = typeof body.reasoning_effort === "string"
    ? body.reasoning_effort
    : currentReasoning?.effort;
  if (typeof requestedEffort !== "string") return;

  const cleanModel = baseModelId(model || body.model);
  const supportedLevels = getThinkingLevels("opencode", cleanModel);
  let effort = requestedEffort.toLowerCase().trim();
  if ((effort === "max" || effort === "ultra") && supportedLevels?.length && !supportedLevels.includes(effort)) {
    if (effort === "ultra" && supportedLevels.includes("max")) effort = "max";
    else if (supportedLevels.includes("xhigh")) effort = "xhigh";
  }

  body.reasoning = { ...currentReasoning, effort };
  if (!body.reasoning.summary) body.reasoning.summary = "auto";
  delete body.reasoning_effort;
}

import { stripThinkingSuffix, parseSuffix } from "../translator/concerns/thinkingUnified.js";
import { openaiToOpenAIResponsesRequest } from "../translator/request/openai-responses.js";
import { openaiResponsesToOpenAIResponse } from "../translator/response/openai-responses.js";
import { initState } from "../translator/index.js";
import { proxyAwareFetch } from "../utils/proxyFetch.js";


// OpenCode free tier is limited per egress IP — a 429/403 with a limit-ish
// body means the POOL's IP is exhausted, not the account. Declare it
// pool-scoped so chatCore marks the pool unfit, retries via another pool, and
// it shows up (clearable) on the Proxy Fitness page.
const IP_LIMIT_BODY = /limit|rate|quota|exhausted|capacity|too many|retry/i;

function resolveOpencodeModelId(model) {
  const stripped = stripThinkingSuffix(model) || model;
  if (stripped === "ox-alpha-free" || stripped === "x-preview-f-free" || stripped === "ox-alpha") return "x-preview-f-free";
  if (stripped === "muse-spark-1.3" || stripped === "muse-spark-1.3-contributor-free" || stripped === "muse-spark-1.3-contributor" || stripped.startsWith("muse-spark-1.3")) return "muse-spark-1.3-contributor-free";
  if (stripped === "muse-spark" || stripped === "muse-spark-1.2" || stripped === "muse-spark-1.2-contributor-free" || stripped === "muse-spark-1.2-contributor" || stripped.startsWith("muse-spark-1.2") || stripped.startsWith("muse-spark")) return "muse-spark-1.2-contributor-free";
  if (stripped === "mimo-v2.5-free" || stripped === "mimo-v2.5") return "mimo-v2.5-free";
  if (stripped === "laguna-s-2.1-free" || stripped === "laguna-s-2.1") return "laguna-s-2.1-free";
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
    let effort = suffixParsed?.override?.level || body?.reasoning_effort || "xhigh";
    // Clamp unsupported 'max' for Muse Spark (model ladder is minimal/low/medium/high/xhigh, no max)
    if (effort === "max" && /^muse-spark/.test(resolvedModel)) effort = "xhigh";

    if (RESPONSES_MODELS.has(resolvedModel) || isResponsesModel(model)) {
      if (body?.messages && Array.isArray(body.messages) && body.messages.length > 0) {
        const enriched = { ...body, reasoning_effort: effort };
        return openaiToOpenAIResponsesRequest(resolvedModel, enriched, true, credentials);
      }
      const res = { ...body, model: resolvedModel };
      res.reasoning = { effort, summary: "auto" };
      delete res.reasoning_effort;
      delete res.messages;
      delete res.max_tokens;
      delete res.max_completion_tokens;
      return res;
    }

    const resolvedBody = { ...body, model: resolvedModel };
    return injectReasoningContent({ provider: this.provider, model: resolvedModel, body: resolvedBody });
  }

  buildUrl(model) {
    const base = this.config.baseUrl;
    const resolvedModel = resolveOpencodeModelId(model);
    return (RESPONSES_MODELS.has(resolvedModel) || isResponsesModel(model))
      ? `${base}/zen/v1/responses`
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
