# miTch Transparency Layer

miTch Transparency Layer is a Manifest V3 Chrome extension and local CLI toolkit that shows users, developers, and reviewers what websites can technically access, observe, infer, or request from their browser.

Core principle:

> We show what is technically observable and technically possible. We do not claim what happens on remote servers.

## Ecosystem role and status

The extension is the AskMI ecosystem's experimental **Visibility & Evidence Companion**:

- **VeriCred** issues credentials.
- **miTch / AskMI** evaluates policy, mediates consent, and presents proofs.
- **Transparency Layer** observes browser-visible surfaces and explains possible data-minimising alternatives.
- **AskMI Control** monitors repository and engineering posture.

Transparency observations, Surface Scores, and Proof Bridge suggestions are advisory. They never authorize, deny, or influence credential disclosure and are not compliance, fraud, trust, or safety verdicts.

Current status: **v0.3.0 experimental/local-only** (with all v0.4 programme gates `G0`–`G4` from [Issue #20](https://github.com/Late-bloomer420/miTch-Transparency-Layer/issues/20) implemented and verified). It is not certified, independently audited, or established as production-ready.

## Features

- **Bilingual Human-Centred UI (`EN` / `DE`):** Full English and German interface (`i18n.js`) with non-colour accessibility symbols (`●`, `◈`, `◌`, `◇`, `?`, `⊘`, `○`) and expandable 6-part plain-language signal disclosures (*Observed*, *Declared or possible*, *Not verified*, *Unknown*, *Why it matters*, *User choices*).
- **Collection Modes (`continuous` vs `on-demand`):** Inspect tabs automatically or restrict active tab/cookie/DOM inspection to explicit user clicks ([Permission Model](docs/PERMISSION_MODEL.md)).
- **PSL / eTLD+1 Site Boundaries (`domain-boundary.js`):** Public-Suffix-List-aware domain classification across multi-label public suffixes (`.co.uk`, `.com.au`, `.co.jp`, shared hosting suffixes, IPv4/IPv6, and `localhost`) with separated request, unique-domain, and tracker-domain counts.
- **Stealth MAIN-World Observer (`page-observer.js`):** Zero `data-mitch-*` DOM attributes and zero global `CustomEvent` emissions; uses a private `MessageChannel` handshake at `document_start` and `Proxy` + `WeakMap` wrapper hygiene preserving `Function.prototype.toString`, descriptors, `instanceof`, and exceptions.
- **Dynamic SPA Form Observation (`content.js`):** Throttled `MutationObserver` rescans dynamically injected forms/inputs using structural metadata only (never reading typed values).
- **Local Before/After Comparison & Opt-In Session Timeline (`comparison-store.js`):** Compare snapshots across login state, cookie consent, or page changes, with an opt-in (default-OFF) local session timeline and 1-click deletion.
- **AskMI Proof Bridge (v0.3):** Maps high-confidence over-collection (such as full Date of Birth fields) to a local, canonical AskMI minimal proof suggestion (`age_over_18`, `contractVersion: "1.0.0"`).
- **Surface Score (`surface-score-v1`):** Informational surface summary separating observation coverage, technical exposure, and evidence quality (`value: null` with `[observedMinimum, unverifiedMaximum]` bounds whenever scan status is incomplete; low score ≠ safe).
- **Surface Receipt v1 (`askmi.transparency.surface-receipt.v1`):** Five-state evidence report (`observed`, `declared`, `potential`, `unknown`, `unavailable`) with origin-only URL redaction, Markdown metacharacter escaping, and SHA-256 canonical integrity hash.

## Developer & Auditor CLI (`cli/mitch-scan.mjs`)

Validate receipts against the JSON Schema, compute privacy-surface diffs, or run deterministic scans without launching Chrome manually:

```bash
# Validate a Surface Receipt v1 JSON file
node cli/mitch-scan.mjs validate fixtures/receipts/allowed.json

# Compare two receipts (JSON or Markdown diff of score, domains, observed/unavailable checks)
node cli/mitch-scan.mjs diff fixtures/receipts/allowed.json fixtures/receipts/high-surface.json --format markdown

# Scan a built-in fixture or local HTML file into a normalized Surface Receipt v1
node cli/mitch-scan.mjs scan --fixture allowed
```

See [docs/AUDITOR_AND_DEVELOPER_TOOLING.md](docs/AUDITOR_AND_DEVELOPER_TOOLING.md) for full CLI documentation, exit codes, and the optional sanitized GitHub Action (`.github/workflows/surface-audit.yml`).

## Install Locally

1. Open `chrome://extensions`.
2. Enable Developer Mode.
3. Select Load unpacked.
4. Choose this repository folder.

## Tests

Run the deterministic unit test suite and release-integrity verifier locally (also enforced on every push and pull request via `.github/workflows/ci.yml`):

```bash
node --test test/*.test.mjs
node cli/mitch-scan.mjs validate fixtures/receipts/allowed.json
node scripts/build-release.mjs --verify
```

Automated test suites:
- [`test/surface-receipt.test.mjs`](test/surface-receipt.test.mjs) — Surface Receipt v1 normalization, URL redaction, Markdown injection escaping, and 5-state evidence preservation.
- [`test/scan-score-and-release.test.mjs`](test/scan-score-and-release.test.mjs) — Scan provenance, Surface Score non-improvement invariants, badge failure states, and deterministic zip integrity.
- [`test/domain-boundary.test.mjs`](test/domain-boundary.test.mjs) — PSL/eTLD+1 domain boundary classification, IP/localhost handling, and third-party request vs unique domain separation.
- [`test/observer-hygiene.test.mjs`](test/observer-hygiene.test.mjs) — Zero DOM/event footprint, private `MessageChannel` transport, `Function.prototype.toString` preservation, and dynamic SPA form rescans.
- [`test/i18n-and-honesty.test.mjs`](test/i18n-and-honesty.test.mjs) — DE/EN localization completeness, non-colour symbols, 6-part plain-language explanations, and anti-overclaim guardrails.
- [`test/comparison-store.test.mjs`](test/comparison-store.test.mjs) — Local before/after snapshot diffs and opt-in default-OFF session timeline with 1-click deletion.
- [`test/tooling-cli-diff.test.mjs`](test/tooling-cli-diff.test.mjs) — JSON Schema validator, deterministic fixtures, privacy-surface diff engine, and `cli/mitch-scan.mjs` commands.
- [`test/ecosystem-contracts.test.mjs`](test/ecosystem-contracts.test.mjs) & [`test/proof-bridge.test.mjs`](test/proof-bridge.test.mjs) — Version-pinned `age_over_18` (`1.0.0`) claim contract compatibility, fail-closed version checks, and localhost deep-link guards.

## Architecture and documentation

- [Ecosystem role and authority boundaries](docs/ECOSYSTEM_ROLE_AND_BOUNDARIES.md)
- [Cross-repository ecosystem integration proposals](docs/ECOSYSTEM_INTEGRATION_PROPOSALS.md)
- [Transparency Surface Receipt v1 specification](docs/TRANSPARENCY_RECEIPT_V1.md)
- [Permission model & MAIN-world observer boundaries](docs/PERMISSION_MODEL.md)
- [Accessibility & bilingual UX evidence](docs/ACCESSIBILITY_EVIDENCE.md)
- [Auditor & developer CLI tooling guide](docs/AUDITOR_AND_DEVELOPER_TOOLING.md)
- [Evidence-gated v0.4 product roadmap](docs/PRODUCT_ROADMAP_V04.md)

## Release Package

The repository includes a deterministic, revision-bound experimental package for the current `v0.3.0` source tree:

```text
release/mitch-transparency-layer-v0.3.0.zip
release/release-manifest.json
release/RELEASE_CHECKLIST.md
```

Regenerate and verify the package after changing any extension runtime file or `PRIVACY_POLICY.md`:

```bash
node scripts/build-release.mjs
node scripts/build-release.mjs --verify
```

## Privacy Policy

The privacy policy is available in [PRIVACY_POLICY.md](PRIVACY_POLICY.md) and on GitHub Pages.


## Blind Provider & Convener Architecture ("Convener statt Autoritaet")

The Transparency Layer operates as a **Blind Provider & Neutral Convener**:
- **Structurally Blind to User Content:** Never reads typed form values, cookie values, or Web Storage contents; strips URL query/fragment tokens; enforces `connect-src 'none'`; and uses URL `#hash` fragments for local wallet handoffs.
- **Rule-Based Convener (AQDR Art. 9):** Evaluates open standards (**W3C DPV v2.0**, **ISO/IEC TS 27560:2023**, **Sec-GPC: 1**, **W3C Digital Credentials API**, and offline **ToS;DR CC BY-SA 3.0** declarations in `rules/known-surfaces.v1.json`) and flags signal-vs-surface discrepancies locally without inspecting personal data or claiming central authority.
