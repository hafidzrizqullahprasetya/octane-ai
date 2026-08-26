// Pre-fetch remote image URLs and local image file paths into base64 BEFORE translation,
// for target formats whose upstream providers cannot fetch remote URLs themselves
// (they require inline base64). Runs on the source-format body.
import fs from "node:fs";
import path from "node:path";
import { FORMATS } from "../formats.js";
import { fetchImageAsBase64, parseDataUri } from "./image.js";

// Targets that require inline base64 images (cannot accept remote URLs).
const TARGETS_NEED_BASE64 = new Set([
  FORMATS.GEMINI, FORMATS.GEMINI_CLI, FORMATS.VERTEX,
  FORMATS.ANTIGRAVITY, FORMATS.OLLAMA, FORMATS.KIRO,
]);

const EXT_TO_MIME = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".bmp": "image/bmp",
  ".svg": "image/svg+xml",
};

const IMAGE_REF_GLOBAL_RE = /(?:^|[\s"'`@\[\(<])([^\s"'`\(\)\[\]<>]+\.(?:png|jpe?g|webp|gif|bmp|svg))(?:[\s"'`\]\)>]|$)/gi;

export async function readLocalImageAsBase64(filePath) {
  if (!filePath || typeof filePath !== "string") return null;
  let cleanPath = filePath.trim();
  if (cleanPath.startsWith("file://")) {
    cleanPath = cleanPath.slice(7);
    if (process.platform === "win32" && cleanPath.startsWith("/")) {
      cleanPath = cleanPath.slice(1);
    }
  }

  const candidates = [
    cleanPath,
    path.resolve(process.cwd(), cleanPath),
  ];

  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) {
        const stat = await fs.promises.stat(p);
        if (stat.isFile() && stat.size <= 25 * 1024 * 1024) {
          const buf = await fs.promises.readFile(p);
          const ext = path.extname(p).toLowerCase();
          const mimeType = EXT_TO_MIME[ext] || "image/png";
          return { url: `data:${mimeType};base64,${buf.toString("base64")}`, mimeType };
        }
      }
    } catch {
      // ignore
    }
  }
  return null;
}

function isRemoteUrl(url) {
  return typeof url === "string" && (url.startsWith("http://") || url.startsWith("https://"));
}

// Collect {get,set} accessors for every remote image URL in a source body.
function collectImageRefs(body, sourceFormat) {
  const refs = [];
  const pushOpenAI = (messages) => {
    for (const msg of messages || []) {
      if (!Array.isArray(msg.content)) continue;
      for (const block of msg.content) {
        if (block?.type === "image_url") {
          const url = typeof block.image_url === "string" ? block.image_url : block.image_url?.url;
          if (isRemoteUrl(url)) refs.push({ get: () => url, set: (v) => {
            if (typeof block.image_url === "string") block.image_url = v; else block.image_url.url = v;
          } });
        }
      }
    }
  };
  const pushGemini = (contents) => {
    for (const c of contents || []) {
      for (const p of c.parts || []) {
        const uri = p?.fileData?.fileUri;
        if (isRemoteUrl(uri)) refs.push({ get: () => uri, part: p });
      }
    }
  };

  switch (sourceFormat) {
    case FORMATS.OPENAI:
    case FORMATS.OLLAMA:
    case FORMATS.KIRO:
    case FORMATS.CURSOR:
    case FORMATS.COMMANDCODE:
      pushOpenAI(body.messages);
      break;
    case FORMATS.CLAUDE:
      for (const msg of body.messages || []) {
        if (!Array.isArray(msg.content)) continue;
        for (const block of msg.content) {
          if (block?.type === "image" && block.source?.type === "url" && isRemoteUrl(block.source.url)) {
            refs.push({ get: () => block.source.url, claudeBlock: block });
          }
        }
      }
      break;
    case FORMATS.GEMINI:
    case FORMATS.GEMINI_CLI:
    case FORMATS.VERTEX:
      pushGemini(body.contents);
      break;
    case FORMATS.ANTIGRAVITY:
      pushGemini(body?.request?.contents);
      break;
    default:
      pushOpenAI(body.messages);
  }
  return refs;
}

function extractImageCandidates(text) {
  if (!text || typeof text !== "string") return [];
  const re = /(?:^|[\s"'`@\[\(<])([^\s"'`\(\)\[\]<>]+\.(?:png|jpe?g|webp|gif|bmp|svg))(?:[\s"'`\]\)>]|$)/gi;
  const list = [];
  for (const match of text.matchAll(re)) {
    if (match[1]) list.push(match[1]);
  }
  return list;
}

/**
 * Find local file references in messages (e.g. File images/placeholder.png) and inline them as base64 image_url blocks.
 */
export async function inlineLocalImages(body) {
  if (!body || !Array.isArray(body.messages)) return 0;
  let inlined = 0;

  for (const msg of body.messages) {
    if (!msg) continue;
    if (typeof msg.content === "string") {
      const matches = extractImageCandidates(msg.content);
      if (matches.length > 0) {
        const found = [];
        for (const candidate of matches) {
          const cleanCandidate = candidate.replace(/^[@"'\(\[<]+|[>"'\)\]]+$/g, "");
          const res = await readLocalImageAsBase64(cleanCandidate);
          if (res) found.push(res.url);
        }
        if (found.length > 0) {
          const blocks = [{ type: "text", text: msg.content }];
          for (const imgUrl of found) {
            blocks.push({ type: "image_url", image_url: { url: imgUrl } });
          }
          msg.content = blocks;
          inlined += found.length;
        }
      }
    } else if (Array.isArray(msg.content)) {
      for (const block of msg.content) {
        if (block?.type === "image_url") {
          const url = typeof block.image_url === "string" ? block.image_url : block.image_url?.url;
          if (url && !isRemoteUrl(url) && !parseDataUri(url)) {
            const cleanUrl = url.replace(/^[@"'\(\[<]+|[>"'\)\]]+$/g, "");
            const res = await readLocalImageAsBase64(cleanUrl);
            if (res) {
              if (typeof block.image_url === "string") block.image_url = res.url;
              else block.image_url.url = res.url;
              inlined++;
            }
          }
        }
      }
    }
  }
  return inlined;
}

/**
 * Replace remote image URLs and local image paths with base64 data when the target needs inline data.
 * No-op when target accepts remote URLs (e.g. openai, claude) or body has none.
 * @returns {Promise<number>} count of images converted
 */
export async function prefetchRemoteImages(body, sourceFormat, targetFormat, options = {}) {
  if (!body) return 0;
  let inlinedLocal = 0;
  try {
    inlinedLocal = await inlineLocalImages(body);
  } catch {
    // ignore
  }

  if (!TARGETS_NEED_BASE64.has(targetFormat)) return inlinedLocal;
  const refs = collectImageRefs(body, sourceFormat);
  if (!refs.length) return inlinedLocal;

  let converted = inlinedLocal;
  for (const ref of refs) {
    const url = ref.get();
    if (parseDataUri(url)) continue; // already inline
    const fetched = await fetchImageAsBase64(url, options);
    if (!fetched) continue;
    if (ref.set) ref.set(fetched.url);
    else if (ref.part) { delete ref.part.fileData; ref.part.inlineData = { mimeType: fetched.mimeType, data: fetched.url.split(",")[1] }; }
    else if (ref.claudeBlock) ref.claudeBlock.source = { type: "base64", media_type: fetched.mimeType, data: fetched.url.split(",")[1] };
    converted++;
  }
  return converted;
}
