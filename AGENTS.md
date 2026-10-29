# Octane AI (9Router)

Octane AI / 9Router adalah proxy AI dan dashboard terpadu yang mendukung berbagai penyedia LLM (OpenAI, Claude, Gemini, DeepSeek, Kiro, dll.) dengan translasi streaming SSE secara real-time.

## Gambaran Arsitektur

- `open-sse/` — Mesin streaming dan translasi format. Menerjemahkan request dan chunk SSE antara format klien dan format provider. Panduan lengkap ada di `open-sse/AGENTS.md`.
- `src/` — Aplikasi web Next.js (dashboard, konfigurasi, antarmuka manajemen, endpoint API).
- `cli/` — Alat CLI Node.js untuk menjalankan dan mengontrol 9Router secara lokal.
- `tests/` — Test suite menggunakan Vitest (`tests/vitest.config.js`). Panduan pengujian translator ada di `tests/translator/AGENTS.md`.

## Perintah Utama

- **Jalankan unit & translator test**: `npx vitest run --config tests/vitest.config.js`
- **Development server**: `npm run dev`
- **Build**: `npm run build`
- **Linter**: `npx eslint .`

## Agent skills

Bagian ini mengonfigurasi standar rekayasa agen AI (Matt Pocock skills).

### Issue tracker

Isu dan spesifikasi tugas dikelola melalui GitHub Issues menggunakan CLI `gh`. Lihat panduan lengkap di `docs/agents/issue-tracker.md`.

### Triage labels

Peran triage kanonikal dipetakan ke label GitHub (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). Lihat detailnya di `docs/agents/triage-labels.md`.

### Domain docs

Tata letak dokumen domain menggunakan layout konteks tunggal (`CONTEXT.md` di root dan `docs/adr/` untuk keputusan arsitektur). Lihat ketentuannya di `docs/agents/domain.md`.

---

## Guardrails MIBP Fork

### 1. `package-lock.json` MUST be generated with npm 10 (Docker's npm)

**DO NOT** regenerate `package-lock.json` with your global `npm` (npm 11+).
**DO NOT** delete `package-lock.json` or add it to `.gitignore`.

**WHY:** The Docker image pins `node:22-alpine` by digest (see `Dockerfile`
`ARG NODE_IMAGE`), which ships **npm 10.9.8**. The `Dockerfile` runs `npm ci`
against the committed lockfile.

```bash
npx -y npm@10.9.8 install --package-lock-only
node scripts/verify-lockfile-npm10.mjs   # must print ✅
```

---

### 2. Tests must NEVER write to the real database (`~/.9router`)

**DO NOT** remove `tests/setup/isolateDataDir.js` from `tests/vitest.config.js`
`setupFiles`. **DO NOT** delete `tests/unit/test-data-dir-isolation.test.js`.

---

### 3. Hidden providers must not leak into the Usage page

**DO NOT** remove the `!p.hidden` filter in `src/shared/utils/usageProviders.js`
(`buildUsageProviderList`).

---

### 4. `codebuddy-intl` connection test + OAuth identity

**DO NOT** remove `"codebuddy-intl"` from `OAUTH_TEST_CONFIG` in
`src/app/api/providers/[id]/test/testUtils.js`.

---

### 5. Fork-only features — NEVER drop during an upstream sync

| Area | Key files / markers |
|---|---|
| **Freebuff provider** | `open-sse/executors/freebuff.js`, `open-sse/providers/registry/freebuff.js`, `open-sse/services/usage/freebuff.js`, `src/lib/oauth/providers/freebuff.js`, `public/providers/freebuff.png` |
| **Perch-CLI provider** | `open-sse/executors/perch-cli.js`, `open-sse/providers/registry/perch-cli.js`, `src/lib/oauth/providers/perch.js`, `public/providers/perch-cli.png` |
| **Proxy-pool fitness** | `open-sse/services/proxyPoolFitness.js`, `open-sse/services/poolGeo.js`, `src/lib/network/poolEgressProbe.js`, `src/lib/network/stateSweeper.js`, `src/app/(dashboard)/dashboard/proxy-fitness/`, `src/app/api/proxy-pools/**` |
| **Docker hardening** | `Dockerfile`: digest-pinned `NODE_IMAGE`, tracked `package-lock.json`, `npm ci`, `HEALTHCHECK`. `.github/workflows/docker-publish.yml`. |
| **Cline free-tier models** | `open-sse/providers/registry/cline.js` `authModes: ["oauth","apikey"]` + `cline-free/*` models; `open-sse/shared/clineAuth.js` |

---

### 6. Undefined identifiers must never reach the Docker build (`verify-no-undef.mjs`)

**DO NOT** remove `RUN node scripts/verify-no-undef.mjs` from the Dockerfile
builder stage (after `COPY . .`, before `npm run build`). **DO NOT** delete
`scripts/verify-no-undef.mjs`.

```bash
node scripts/verify-no-undef.mjs   # must print ✅
```

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
