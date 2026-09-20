# Octane AI

Proxy AI lokal dan dashboard terpadu untuk meneruskan, menerjemahkan format streaming SSE, dan mengelola akun berbagai penyedia LLM (OpenAI, Claude, Gemini, DeepSeek, Kiro, Codex, dll.).

## Bahasa Domain

### Routing & Model

**Provider**:
Entitas penyedia model AI pihak hulu (contoh: OpenAI, Anthropic, Google Gemini, OpenCode, Kiro).
_Avoid_: Vendor, backend, service

**Connection**:
Akun kredensial tertentu (API Key atau token OAuth) yang terhubung ke suatu Provider.
_Avoid_: Akun, credential, session

**Model Alias**:
Nama pemetaan lokal yang diarahkan ke model target penyedia tertentu (misalnya model alias `ot/` atau `cc/`).
_Avoid_: Nickname, label, rename

**Combo**:
Urutan fallback multi-model otomatis yang mencoba model berikutnya saat model sebelumnya gagal atau kuotanya habis.
_Avoid_: Fallback list, pipeline, chain

### Mesin Translasi (open-sse)

**Translator**:
Modul konversi format bolak-balik antara format request klien dan format target provider melalui perantara format standar.
_Avoid_: Converter, adapter, parser

**Executor**:
Adaptor pelaksana panggilan HTTP upstream untuk provider tertentu yang menangani otentikasi, header, dan transmisi streaming khusus.
_Avoid_: Runner, driver, client

**RTK (Request Token Killer)**:
Modul kompresi in-place untuk payload request (memangkas output tool_result atau menginjeksi instruksi sistem) guna menghemat token dan context window.
_Avoid_: Minifier, trimmer, optimizer

**Persona Injector**:
Modul injeksi instruksi sistem persona khusus (seperti BOZ-GEMINI atau BOZ-MUSE) pada level model request.
_Avoid_: Prompt prepend, system modifier

### Akun & Kuota

**Quota Guard**:
Mekanisme pemantauan kuota dan laju panggilan (rate limit) per koneksi akun untuk mencegah lock akun massal dan status 429.
_Avoid_: Throttler, limiter

**Account Lock**:
Status penonaktifan sementara untuk suatu koneksi akun yang mengalami kehabisan kuota atau pembatasan pihak upstream sebelum cooldown reset.
_Avoid_: Ban, block, disable
