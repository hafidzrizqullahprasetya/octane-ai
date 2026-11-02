import { describe, it, expect, vi, afterEach } from "vitest";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";

describe("build-phase data directory guard", () => {
  const origNextPhase = process.env.NEXT_PHASE;
  const origDataDir = process.env.DATA_DIR;

  afterEach(() => {
    if (origNextPhase === undefined) {
      delete process.env.NEXT_PHASE;
    } else {
      process.env.NEXT_PHASE = origNextPhase;
    }
    if (origDataDir === undefined) {
      delete process.env.DATA_DIR;
    } else {
      process.env.DATA_DIR = origDataDir;
    }
    vi.resetModules();
  });

  it("src/lib/dataDir.js: returns throwaway dir under os.tmpdir() during build phase, ignoring DATA_DIR", async () => {
    const fakeDataDir = path.join(os.tmpdir(), `fake-data-dir-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    process.env.DATA_DIR = fakeDataDir;
    process.env.NEXT_PHASE = "phase-production-build";

    vi.resetModules();
    const { getDataDir, DATA_DIR } = await import("../../src/lib/dataDir.js");
    const dir = getDataDir();

    expect(dir).not.toBe(fakeDataDir);
    expect(path.resolve(dir)).not.toBe(path.resolve(fakeDataDir));
    expect(dir.startsWith(os.tmpdir())).toBe(true);
    expect(DATA_DIR).toBe(dir);
    expect(fs.existsSync(fakeDataDir)).toBe(false);
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch { }
  });

  it("src/lib/dataDir.js: returns DATA_DIR when not in build phase", async () => {
    const fakeDataDir = path.join(os.tmpdir(), `fake-data-dir-runtime-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    process.env.DATA_DIR = fakeDataDir;
    delete process.env.NEXT_PHASE;

    vi.resetModules();
    const { getDataDir, DATA_DIR } = await import("../../src/lib/dataDir.js");
    const dir = getDataDir();

    expect(dir).toBe(fakeDataDir);
    expect(DATA_DIR).toBe(fakeDataDir);
    try { fs.rmSync(fakeDataDir, { recursive: true, force: true }); } catch { }
  });

  it("open-sse/utils/writableDataDir.js: returns throwaway dir under os.tmpdir() during build phase, ignoring DATA_DIR", async () => {
    const fakeDataDir = path.join(os.tmpdir(), `fake-data-dir-sse-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    process.env.DATA_DIR = fakeDataDir;
    process.env.NEXT_PHASE = "phase-production-build";

    vi.resetModules();
    const { getWritableDataDir } = await import("../../open-sse/utils/writableDataDir.js");
    const dir = getWritableDataDir();

    expect(dir).not.toBe(fakeDataDir);
    expect(path.resolve(dir)).not.toBe(path.resolve(fakeDataDir));
    expect(dir.startsWith(os.tmpdir())).toBe(true);
    expect(fs.existsSync(fakeDataDir)).toBe(false);
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch { }
  });

  it("open-sse/utils/writableDataDir.js: returns DATA_DIR when not in build phase", async () => {
    const fakeDataDir = path.join(os.tmpdir(), `fake-data-dir-sse-runtime-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    process.env.DATA_DIR = fakeDataDir;
    delete process.env.NEXT_PHASE;

    vi.resetModules();
    const { getWritableDataDir } = await import("../../open-sse/utils/writableDataDir.js");
    const dir = getWritableDataDir();

    expect(dir).toBe(fakeDataDir);
    try { fs.rmSync(fakeDataDir, { recursive: true, force: true }); } catch { }
  });
});
