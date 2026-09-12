#!/usr/bin/env node
/**
 * Synchronize monthly account-level locks for CodeBuddy accounts in data.sqlite.
 * Scans connections with "Credits exhausted" error from the current month
 * and sets modelLock___all to the 1st of next month UTC.
 */
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.resolve(__dirname, "../data/db/data.sqlite");

console.log(`Opening database: ${dbPath}`);
const db = new Database(dbPath);

const now = new Date();
const nextMonthReset = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0)).toISOString();
console.log(`Next monthly reset target: ${nextMonthReset}`);

const rows = db.prepare(`
  SELECT id, provider, name, email, priority, data
  FROM providerConnections
  WHERE provider IN ('codebuddy-intl', 'codebuddy-cn')
`).all();

console.log(`Found ${rows.length} CodeBuddy connection(s).`);

let updatedCount = 0;
let healthyCount = 0;

const updateStmt = db.prepare(`
  UPDATE providerConnections
  SET data = ?
  WHERE id = ?
`);

db.transaction(() => {
  for (const row of rows) {
    let data = {};
    try {
      data = JSON.parse(row.data || "{}");
    } catch {
      continue;
    }

    const lowerErr = String(data.lastError || "").toLowerCase();
    const isExhausted = lowerErr.includes("credits exhausted") || lowerErr.includes("credit exhausted") || lowerErr.includes("14018");

    let isCurrentMonthErr = false;
    if (data.lastErrorAt) {
      const errDate = new Date(data.lastErrorAt);
      isCurrentMonthErr = errDate.getUTCFullYear() === now.getUTCFullYear() && errDate.getUTCMonth() === now.getUTCMonth();
    }

    if (isExhausted && isCurrentMonthErr) {
      const accountName = row.name || row.email || row.id.slice(0, 8);
      data.modelLock___all = nextMonthReset;
      data.testStatus = "unavailable";
      updateStmt.run(JSON.stringify(data), row.id);
      console.log(`🔒 [LOCKED UNTIL RESET] ${accountName} (${row.id.slice(0, 8)}) -> modelLock___all = ${nextMonthReset}`);
      updatedCount++;
    } else {
      const accountName = row.name || row.email || row.id.slice(0, 8);
      console.log(`✅ [ACTIVE / HEALTHY] ${accountName} (${row.id.slice(0, 8)})`);
      healthyCount++;
    }
  }
})();

console.log(`\nSync complete:`);
console.log(`- Locked until next monthly reset (${nextMonthReset}): ${updatedCount} account(s)`);
console.log(`- Active / Healthy available: ${healthyCount} account(s)`);
