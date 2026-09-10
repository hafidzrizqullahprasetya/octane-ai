// Re-auth must not wipe proxy config (daramuji30 case):
// re-login via OAuth poll returns providerSpecificData:{} and
// createProviderConnection dedups on email — the merge must preserve
// existing proxyPoolIds/proxyRotationStrategy.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

const originalDataDir = process.env.DATA_DIR;
let tempDir;
let db;

const POOL = "a6b28a02-3d16-445f-8d34-a74625f8e61e";

beforeAll(async () => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "psd-merge-"));
  process.env.DATA_DIR = tempDir;
  vi.resetModules();
  db = await import("@/lib/db/index.js");
  await db.initDb();
});

afterAll(() => {
  if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true });
  if (originalDataDir === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = originalDataDir;
});

describe("createProviderConnection re-auth merge preserves proxy", () => {
  it("re-login with empty providerSpecificData keeps proxyPoolIds", async () => {
    const email = "daramuji30@dusasla.com";
    const first = await db.createProviderConnection({
      provider: "codebuddy-intl",
      authType: "oauth",
      name: email,
      email,
      accessToken: "tok1",
      refreshToken: "ref1",
      providerSpecificData: { proxyPoolIds: [POOL], proxyRotationStrategy: "smart" },
      testStatus: "active",
    });
    expect(first.providerSpecificData?.proxyPoolIds).toEqual([POOL]);

    // Simulate OAuth poll re-auth: fresh tokens, mapTokens → providerSpecificData:{}
    const second = await db.createProviderConnection({
      provider: "codebuddy-intl",
      authType: "oauth",
      name: email,
      email,
      accessToken: "tok2-new",
      refreshToken: "ref2-new",
      providerSpecificData: {},
      testStatus: "active",
    });

    expect(second.id).toBe(first.id); // dedup hit same row
    expect(second.accessToken).toBe("tok2-new"); // tokens DO refresh
    expect(second.providerSpecificData?.proxyPoolIds).toEqual([POOL]);
    expect(second.providerSpecificData?.proxyRotationStrategy).toBe("smart");
  });

  it("PUT-style updateProviderConnection with proxy still works", async () => {
    const email = "proxy-put-check@dusasla.com";
    const c = await db.createProviderConnection({
      provider: "codebuddy-intl",
      authType: "oauth",
      name: email,
      email,
      accessToken: "t",
      refreshToken: "r",
    });
    const updated = await db.updateProviderConnection(c.id, {
      providerSpecificData: {
        ...(c.providerSpecificData || {}),
        proxyPoolIds: [POOL],
        proxyRotationStrategy: "smart",
      },
    });
    expect(updated.providerSpecificData?.proxyPoolIds).toEqual([POOL]);
  });
});
