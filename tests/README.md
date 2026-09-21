# Octane AI (9Router) Test Suite

Test suite for Octane AI / 9Router utilizing Vitest.

## Setup

Dependencies can be installed from the project root or the `tests/` directory:

```bash
cd tests/ && npm install
```

## Running Tests

From the repo root:

```bash
# Run all unit and translator tests
npx vitest run --config tests/vitest.config.js

# Run only translator tests
npx vitest run --config tests/vitest.config.js "tests/translator/"

# Run specific test file
npx vitest run --config tests/vitest.config.js "tests/unit/embeddingsCore.test.js"
```

Or from the `tests/` directory:

```bash
npm test
```

## Test Structure

- `tests/translator/` — Tests for `open-sse/translator/` covering multi-provider format translations (OpenAI, Claude, Gemini, Kiro, Codex, Antigravity, etc.). See `tests/translator/AGENTS.md` for detailed guidelines.
- `tests/unit/` — Unit tests for core handlers, endpoints, RTK, quota, and authentication (SAML, OAuth, etc.).
- `tests/setup/` — Test environment setups (e.g. `isolateDataDir.js` to isolate SQLite databases during test runs).

*(Note: `tests/unit/embeddings.cloud.test.js` is a historical test for the Cloudflare Worker cloud handler that requires an external cloud package).*
