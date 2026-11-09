# Release Integrity Checklist (v0.3+)

This checklist binds the packaged Chrome MV3 zip archive in `release/` to the exact extension source tree, manifest version, test suite, and privacy policy (`#14`).

> **Status boundary:** `miTch Transparency Layer` is currently **experimental / local-only** (`v0.3.0`). Completing this checklist verifies source-to-package reproducibility and honest claim boundaries; it is **not** a legal compliance audit, security certification, or production-readiness guarantee.

## 1. Automated Build & Verification

Whenever any packaged extension file (`manifest.json`, `.js`, `.html`, `.css`, `icons/*`, or `PRIVACY_POLICY.md`) changes, regenerate the revision-bound build metadata and deterministic zip archive:

```bash
node scripts/build-release.mjs
```

This updates:
- `build-meta.js` — embeds `collectorVersion`, `sourceRevision` (`v<version>+tree.<12-hex>`), `sourceTreeSha256`, `ruleSetVersion`, and `scoringRuleVersion` for runtime Surface Receipt provenance.
- `release/mitch-transparency-layer-v0.3.0.zip` — deterministic PKZIP (`STORE`, fixed DOS timestamp, LF-normalized text files) containing every runtime file referenced by `manifest.json` and `popup.html` plus `PRIVACY_POLICY.md`.
- `release/release-manifest.json` — machine-verifiable SHA-256 inventory of every packaged file, privacy policy parity hashes, and overall `archive.sha256`.

## 2. Pre-Release Gate Checks

Every pull request and release commit must pass all three automated commands (enforced in `.github/workflows/ci.yml`):

- [ ] **Syntax check:** `node --check` passes on all extension scripts and `build-meta.js`.
- [ ] **Deterministic test suite:** `node --test test/*.test.mjs` passes with zero failures.
- [ ] **Release & policy parity verification:** `node scripts/build-release.mjs --verify` exits `0`, confirming:
  - `manifest.json` version matches the zip filename and `release/release-manifest.json`;
  - `build-meta.js` `sourceTreeSha256` matches all packaged source files;
  - `PRIVACY_POLICY.md` and `docs/index.html` headings and local-only/no-value-inspection clauses are in sync;
  - no stale historical archive (`release/mitch-transparency-layer-v0.1.zip`) remains in `release/`; and
  - every zip entry passes CRC-32 and SHA-256 verification.

## 3. Manual Honesty & Claim-Boundary Review

Before tagging or publishing a build:

- [ ] `README.md`, `popup.html`, and exported receipts describe the score strictly as `Surface Score` (an informational surface summary, never a safety, trust, fraud, or compliance verdict).
- [ ] Missing or unreachable checks (`limited`, `unsupported`, `error`, `preview`) never render as `0/100` or "clean".
- [ ] Receipts strip URL query/fragment/credential components (`urlIncluded: false`) and escape page-derived Markdown metacharacters.
- [ ] Form inspection reads input attribute metadata only and never reads or exports typed values, cookie values, or storage values.
