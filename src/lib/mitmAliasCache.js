// JSON cache for mitmAlias — read by standalone MITM server (no SQLite native binding).
// Source of truth = SQLite kv['mitmAlias']. JSON is a read-replica synced on app start
// and after every UI write.
import fs from "fs";
import path from "path";
import { getDataDir } from "./dataDir.js";

function getCacheFile() {
  return path.join(getDataDir(), "mitm", "aliases.json");
}

function writeAtomic(data) {
  const cacheFile = getCacheFile();
  const dir = path.dirname(cacheFile);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = `${cacheFile}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), "utf8");
  fs.renameSync(tmp, cacheFile);
}

// Sync entire mitmAlias map from DB → JSON file
export async function syncToJson() {
  try {
    const { getMitmAlias } = await import("@/lib/db/repos/aliasRepo.js");
    const all = await getMitmAlias();
    writeAtomic(all || {});
  } catch (e) {
    console.log("[mitmAliasCache] sync failed:", e.message);
  }
}

// Update cache for a single tool after UI saves to DB
export function writeAliasForTool(tool, mappings) {
  try {
    let current = {};
    const cacheFile = getCacheFile();
    if (fs.existsSync(cacheFile)) {
      try { current = JSON.parse(fs.readFileSync(cacheFile, "utf8")); } catch { /* corrupted → reset */ }
    }
    current[tool] = mappings || {};
    writeAtomic(current);
  } catch (e) {
    console.log("[mitmAliasCache] write failed:", e.message);
  }
}
