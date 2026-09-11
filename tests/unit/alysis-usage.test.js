// Alysis credits tracker: rates/peak math (sumber: bundle alysiscode.com)
// + wiring registry & parseQuotaData. Tanpa network/DB asli.
import { describe, it, expect, beforeAll } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  alysisIsPeak,
  alysisModelBucket,
  alysisRowCredits,
  computeAlysisWindowBurn,
  getAlysisUsage,
  ALYSIS_PLAN,
} from "../../open-sse/services/usage/alysis.js";
import REGISTRY from "../../open-sse/providers/registry/index.js";
import { parseQuotaData } from "../../src/app/(dashboard)/dashboard/usage/components/ProviderLimits/utils.js";

const FLASH = { miss: 25, hit: 0.8, out: 75 };

describe("alysis peak window (Mon–Fri 01:00–04:00 & 06:00–10:00 UTC)", () => {
  it("peak di Tue 03:30 UTC", () => {
    expect(alysisIsPeak(Date.UTC(2026, 7, 11, 3, 30))).toBe(true); // Tue
  });
  it("off-peak di sela 04:00–06:00", () => {
    expect(alysisIsPeak(Date.UTC(2026, 7, 11, 4, 13))).toBe(false);
  });
  it("off-peak akhir pekan", () => {
    expect(alysisIsPeak(Date.UTC(2026, 7, 9, 3, 30))).toBe(false); // Sun
  });
  it("batas bawah 01:00 peak, 10:00 off", () => {
    expect(alysisIsPeak(Date.UTC(2026, 7, 11, 1, 0))).toBe(true);
    expect(alysisIsPeak(Date.UTC(2026, 7, 11, 10, 0))).toBe(false);
  });
});

describe("alysis pricing math", () => {
  it("trial 33/5/0 off-peak = 0.0012 credits (camelCase)", () => {
    const c = alysisRowCredits(
      { promptTokens: 33, completionTokens: 5, cachedTokens: 0 }, FLASH, false,
    );
    expect(c).toBeCloseTo(0.0012, 6);
  });
  it("bentuk snake_case DB asli (prompt_tokens) juga kebaca", () => {
    const c = alysisRowCredits(
      { prompt_tokens: 33, completion_tokens: 5, cached_tokens: 0 }, FLASH, false,
    );
    expect(c).toBeCloseTo(0.0012, 6);
  });
  it("peak = 2x", () => {
    const off = alysisRowCredits({ promptTokens: 1000, completionTokens: 100, cachedTokens: 0 }, FLASH, false);
    const peak = alysisRowCredits({ promptTokens: 1000, completionTokens: 100, cachedTokens: 0 }, FLASH, true);
    expect(peak).toBeCloseTo(off * 2, 9);
  });
  it("cached dipisah dari fresh", () => {
    // 70K cached + 500 fresh + 300 out (request tipikal flash versi website)
    const c = alysisRowCredits({ promptTokens: 70500, completionTokens: 300, cachedTokens: 70000 }, FLASH, false);
    // 0.0125 + 0.056 + 0.0225 = 0.091 ≈ 50/540 estimasi website
    expect(c).toBeCloseTo(0.091, 3);
  });
  it("window burn skip model asing + tokens string JSON", () => {
    // Timestamp off-peak eksplisit (Sabtu) — hitungan peak tergantung jam test.
    const ts = new Date(Date.UTC(2026, 7, 8, 12, 0)).toISOString(); // Sat 12:00 UTC
    const burn = computeAlysisWindowBurn([
      { model: "deepseek-v4-flash", timestamp: ts, tokens: JSON.stringify({ promptTokens: 33, completionTokens: 5, cachedTokens: 0 }) },
      { model: "gpt-6-astra", timestamp: ts, tokens: { promptTokens: 99999, completionTokens: 99999 } },
    ]);
    expect(burn).toBeCloseTo(0.0012, 6);
  });
});

describe("alysis bucket", () => {
  it.each([
    ["deepseek-v4-flash", "deepseek-v4-flash"],
    ["alysis/deepseek-v4-pro", "deepseek-v4-pro"],
    ["deepseek-v4-flash(high)", "deepseek-v4-flash"],
    ["gpt-6-astra", ""],
    ["", ""],
  ])("%s -> %s", (input, expected) => {
    expect(alysisModelBucket(input)).toBe(expected);
  });
});

describe("alysis registry wiring", () => {
  it("punya usage + usageApikey", () => {
    const entry = REGISTRY.find((r) => r.id === "alysis");
    expect(entry).toBeDefined();
    expect(entry.features?.usage).toBe(true);
    expect(entry.features?.usageApikey).toBe(true);
  });
  it("parseQuotaData pertahankan unlimited", () => {
    const rows = parseQuotaData("alysis", {
      quotas: { "deepseek-v4-flash (30d · tokens)": { used: 38, total: 0, resetAt: null, unlimited: true } },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].unlimited).toBe(true);
  });
});

describe("getAlysisUsage live (temp sqlite)", () => {
  let dbFile;
  beforeAll(async () => {
    const { default: Database } = await import("better-sqlite3");
    dbFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "alysis-")), "data.sqlite");
    const db = new Database(dbFile);
    db.exec("CREATE TABLE usageHistory (model TEXT, tokens TEXT, timestamp TEXT, provider TEXT)");
    db.prepare("INSERT INTO usageHistory VALUES (?, ?, ?, ?)").run(
      "deepseek-v4-flash",
      JSON.stringify({ promptTokens: 33, completionTokens: 5, cachedTokens: 0 }),
      new Date().toISOString(),
      "alysis",
    );
    db.close();
    process.env.OCTANE_DB_PATH = dbFile;
  });

  it("3 baris credits, tanpa message", async () => {
    const r = await getAlysisUsage("slk_dummy", {}, null);
    expect(r.plan).toBe(ALYSIS_PLAN);
    expect(r.message).toBeUndefined();
    const keys = Object.keys(r.quotas);
    expect(keys).toHaveLength(3);
    const m30 = r.quotas["Credits used (30 days)"];
    expect(m30.total).toBe(50);
    // Burn tergantung peak/off-peak saat test jalan (Jumat 06:xx UTC = peak ×2).
    // Yang penting: bukan nol, kecil (< 0.01), dan konsisten antar window.
    expect(m30.used).toBeGreaterThan(0);
    expect(m30.used).toBeLessThan(0.01);
    expect(m30.remainingPercentage).toBe(100);
    expect(r.quotas["Credits used (5 hours)"].total).toBe(25);
    expect(r.quotas["Credits used (5 hours)"].used).toBe(m30.used);
  });
});
