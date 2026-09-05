/**
 * Experiential Labs usage: pure computeElQuotas — no DB, no network.
 * Runs on node:test stdlib only — no vitest.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { computeElQuotas, EL_PLAN } from "../../open-sse/services/usage/experientiallabs.js";

// Fixed "now": 2026-09-05 09:23:45 UTC → next top-of-hour is 10:00 UTC.
const NOW = Date.UTC(2026, 8, 5, 9, 23, 45);
const RESET_AT = "2026-09-05T10:00:00.000Z";

const DEFAULT_ACCOUNTS = [
  { name: "EL-1", caps: { "gpt-6-astra": 150000, "claude-fable-5.1": 90000 } },
];

function row(model, prompt, completion, connectionId = "conn-1") {
  return {
    model,
    promptTokens: prompt,
    completionTokens: completion,
    connectionId,
    timestamp: new Date(NOW - 1000).toISOString(),
  };
}

describe("computeElQuotas (pure)", () => {
  it("empty rows → empty quotas (no fabricated entries)", () => {
    const quotas = computeElQuotas([], DEFAULT_ACCOUNTS, NOW);
    assert.deepEqual(quotas, {});
  });

  it("single account: used = sum(prompt+completion), remainingPercentage rounds", () => {
    const rows = [row("gpt-6-astra", 60000, 15000), row("gpt-6-astra", 10000, 0)];
    const quotas = computeElQuotas(rows, DEFAULT_ACCOUNTS, NOW);
    const q = quotas["EL-1 · gpt-6-astra (1h)"];
    assert.ok(q, `missing key: ${Object.keys(quotas).join(", ")}`);
    assert.equal(q.used, 85000);
    assert.equal(q.total, 150000);
    assert.equal(q.remaining, 65000);
    assert.equal(q.remainingPercentage, 43); // 65000/150000 = 43.33 → 43
    assert.equal(q.resetAt, RESET_AT);
    assert.equal(q.unlimited, false);
  });

  it("splits usage evenly across accounts with consistent remainder distribution", () => {
    // 1001 tokens over 2 accounts → 501 + 500.
    const accounts = [
      { name: "EL-1", caps: { "gpt-6-astra": 150000 } },
      { name: "EL-2", caps: { "gpt-6-astra": 150000 } },
    ];
    const rows = [row("gpt-6-astra", 700, 301)];
    const quotas = computeElQuotas(rows, accounts, NOW);
    assert.equal(quotas["EL-1 · gpt-6-astra (1h)"].used, 501);
    assert.equal(quotas["EL-2 · gpt-6-astra (1h)"].used, 500);
    // Split always sums back to the total.
    assert.equal(
      quotas["EL-1 · gpt-6-astra (1h)"].used + quotas["EL-2 · gpt-6-astra (1h)"].used,
      1001,
    );
  });

  it("resetAt is next top-of-hour from injected now", () => {
    const rows = [row("claude-fable-5.1", 1000, 0)];
    const quotas = computeElQuotas(rows, DEFAULT_ACCOUNTS, NOW);
    assert.equal(quotas["EL-1 · claude-fable-5.1 (1h)"].resetAt, RESET_AT);
    // Hour boundary: now exactly on the hour → next hour.
    const onTheHour = Date.UTC(2026, 8, 5, 9, 0, 0);
    const quotas2 = computeElQuotas(rows, DEFAULT_ACCOUNTS, onTheHour);
    assert.equal(quotas2["EL-1 · claude-fable-5.1 (1h)"].resetAt, "2026-09-05T10:00:00.000Z");
  });

  it("suffix-tolerant: effort-suffixed model ids count into their bucket", () => {
    const rows = [
      row("gpt-6-astra(high)", 40000, 5000),
      row("gpt-6-astra", 10000, 0),
    ];
    const quotas = computeElQuotas(rows, DEFAULT_ACCOUNTS, NOW);
    const q = quotas["EL-1 · gpt-6-astra (1h)"];
    assert.ok(q, `missing key: ${Object.keys(quotas).join(", ")}`);
    assert.equal(q.used, 55000);
  });

  it("bare deepseek-v4-flash / minimax-m3 are freebuff-served and NOT counted as EL", () => {
    const rows = [row("deepseek-v4-flash", 999999, 999999), row("minimax-m3", 500, 0)];
    const quotas = computeElQuotas(rows, DEFAULT_ACCOUNTS, NOW);
    assert.deepEqual(quotas, {});
  });

  it("models without a known cap are unlimited with used shown", () => {
    const rows = [row("deepseek-v4-flash-exp", 1234, 111), row("minimax-m3-free", 500, 0)];
    const quotas = computeElQuotas(rows, DEFAULT_ACCOUNTS, NOW);
    const ds = quotas["EL-1 · deepseek-v4-flash-exp (1h)"];
    assert.equal(ds.unlimited, true);
    assert.equal(ds.used, 1345);
    assert.equal(ds.total, 0);
    const mm = quotas["EL-1 · minimax-m3-free (1h)"];
    assert.equal(mm.unlimited, true);
    assert.equal(mm.used, 500);
  });

  it("no accounts configured → single default 'Hourly usage' account with EL 429 caps", () => {
    const rows = [row("gpt-6-astra", 1000, 0), row("claude-fable-5.1", 500, 0)];
    const quotas = computeElQuotas(rows, undefined, NOW);
    assert.equal(quotas["Hourly usage · gpt-6-astra (1h)"].total, 150000);
    assert.equal(quotas["Hourly usage · gpt-6-astra (1h)"].used, 1000);
    assert.equal(quotas["Hourly usage · claude-fable-5.1 (1h)"].total, 90000);
    assert.equal(quotas["Hourly usage · claude-fable-5.1 (1h)"].remainingPercentage, 99); // 89500/90000 = 99.44 → 99
  });

  it("accounts without caps object fall back to unlimited for all models", () => {
    const rows = [row("gpt-6-astra", 100, 0)];
    const quotas = computeElQuotas(rows, [{ name: "EL-X" }], NOW);
    assert.equal(quotas["EL-X · gpt-6-astra (1h)"].unlimited, true);
  });

  it("ignores rows for untracked models", () => {
    const rows = [row("gpt-4o", 999999, 999999)];
    assert.deepEqual(computeElQuotas(rows, DEFAULT_ACCOUNTS, NOW), {});
  });
});

describe("registry + plan constant", () => {
  it("plan is 'Experiential Labs'", () => {
    assert.equal(EL_PLAN, "Experiential Labs");
  });

  it("registry carries usage flags (features.usage + usageApikey)", async () => {
    const entry = (await import("../../open-sse/providers/registry/experientiallabs.js")).default;
    assert.equal(entry.features.usage, true);
    assert.equal(entry.features.usageApikey, true);
    assert.deepEqual(entry.authModes, ["apikey"]);
  });
});

// Integration: real sqlite + full handler path. Catches wiring bugs the pure
// tests can't (e.g. SELECT missing the model column — the row reaches
// computeElQuotas without .model and is silently skipped).
describe("getExperientialLabsUsage (real sqlite integration)", () => {
  it("returns quota rows from a real usageHistory table", async () => {
    const fs = await import("node:fs");
    const os = await import("node:os");
    const path = await import("node:path");
    let Database;
    try {
      Database = (await import("better-sqlite3")).default;
    } catch {
      console.log("skip: better-sqlite3 unavailable");
      return;
    }
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "el-usage-"));
    const dbFile = path.join(dir, "data.sqlite");
    const db = new Database(dbFile);
    db.exec(`CREATE TABLE usageHistory (
      id INTEGER PRIMARY KEY AUTOINCREMENT, timestamp TEXT, provider TEXT, model TEXT,
      connectionId TEXT, apiKey TEXT, endpoint TEXT, promptTokens INTEGER,
      completionTokens INTEGER, cost REAL, status TEXT, tokens TEXT, meta TEXT)`);
    db.prepare(`INSERT INTO usageHistory (timestamp, provider, model, promptTokens, completionTokens, status)
                VALUES (?, 'octane', 'gpt-6-astra(high)', 26000, 14000, 'ok')`)
      .run(new Date().toISOString());
    db.close();

    const prev = process.env.OCTANE_DB_PATH;
    process.env.OCTANE_DB_PATH = dbFile;
    try {
      const { getExperientialLabsUsage } = await import(
        "../../open-sse/services/usage/experientiallabs.js"
      );
      const result = await getExperientialLabsUsage("x", {}, null);
      assert.ok(!result.message, `unexpected message: ${result.message}`);
      const q = result.quotas["Hourly usage · gpt-6-astra (1h)"];
      assert.ok(q, `missing key: ${Object.keys(result.quotas || {}).join(", ")}`);
      assert.equal(q.used, 40000);
      assert.equal(q.total, 150000);
    } finally {
      if (prev === undefined) delete process.env.OCTANE_DB_PATH;
      else process.env.OCTANE_DB_PATH = prev;
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
