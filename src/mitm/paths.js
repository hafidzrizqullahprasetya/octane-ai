const fs = require("fs");
const path = require("path");
const os = require("os");

const APP_NAME = "9router";

function defaultDir() {
  if (process.platform === "win32") {
    return path.join(process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming"), APP_NAME);
  }
  return path.join(os.homedir(), `.${APP_NAME}`);
}

let buildDataDir = null;

function getDataDir() {
  if (process.env.NEXT_PHASE === "phase-production-build") {
    if (!buildDataDir || !fs.existsSync(buildDataDir)) {
      buildDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "9router-build-"));
    }
    return buildDataDir;
  }

  const configured = process.env.DATA_DIR;
  if (!configured) return defaultDir();
  try {
    fs.mkdirSync(configured, { recursive: true });
    return configured;
  } catch (e) {
    if (e?.code === "EACCES" || e?.code === "EPERM") {
      console.warn(`[DATA_DIR] '${configured}' not writable → fallback ~/.${APP_NAME}`);
      return defaultDir();
    }
    throw e;
  }
}

const DATA_DIR = getDataDir();
const MITM_DIR = path.join(DATA_DIR, "mitm");
try { fs.mkdirSync(MITM_DIR, { recursive: true }); } catch {}

module.exports = { DATA_DIR, MITM_DIR };
