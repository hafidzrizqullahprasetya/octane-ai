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
- **Linter**: `npm run lint` (atau `npx eslint .`)

## Agent skills

Bagian ini mengonfigurasi standar rekayasa agen AI (Matt Pocock skills).

### Issue tracker

Isu dan spesifikasi tugas dikelola melalui GitHub Issues menggunakan CLI `gh`. Lihat panduan lengkap di `docs/agents/issue-tracker.md`.

### Triage labels

Peran triage kanonikal dipetakan ke label GitHub (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). Lihat detailnya di `docs/agents/triage-labels.md`.

### Domain docs

Tata letak dokumen domain menggunakan layout konteks tunggal (`CONTEXT.md` di root dan `docs/adr/` untuk keputusan arsitektur). Lihat ketentuannya di `docs/agents/domain.md`.
