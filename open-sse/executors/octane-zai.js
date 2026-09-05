import { DefaultExecutor } from "./default.js";

/**
 * Octane-ZAI executor — self-hosted AutoClaw proxy (noAuth sidecar).
 * Sama seperti DefaultExecutor untuk transport openai, tapi TIDAK mengirim
 * header Authorization (DefaultExecutor selalu set "Bearer undefined"
 * untuk provider combined/noAuth — lihat default.js applyAuth).
 */
export class OctaneZaiExecutor extends DefaultExecutor {
  constructor() {
    super("octane-zai");
  }

  buildHeaders(credentials, stream = true, url, model) {
    const headers = super.buildHeaders(credentials, stream, url, model);
    for (const k of Object.keys(headers)) {
      if (k.toLowerCase() === "authorization" && /undefined|public/.test(headers[k])) {
        delete headers[k];
      }
    }
    return headers;
  }
}

export default OctaneZaiExecutor;
