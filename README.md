# miTch Transparency Layer

miTch Transparency Layer is a Manifest V3 Chrome extension that shows users what websites can technically access, observe, infer, or request from their browser.

Core principle:

> We show what is technically observable and technically possible. We do not claim what happens on remote servers.

## Ecosystem role and status

The extension is the AskMI ecosystem's experimental **Visibility & Evidence Companion**:

- **VeriCred** issues credentials.
- **miTch / AskMI** evaluates policy, mediates consent, and presents proofs.
- **Transparency Layer** observes browser-visible surfaces and explains possible data-minimising alternatives.
- **AskMI Control** monitors repository and engineering posture.

Transparency observations, Surface Scores, and Proof Bridge suggestions are advisory. They never authorize, deny, or influence credential disclosure and are not compliance, fraud, trust, or safety verdicts.

Current status: **v0.3.0 experimental/local-only**. It is not certified, independently audited, or established as production-ready. The evidence-gated v0.4 programme is tracked in [issue #20](https://github.com/Late-bloomer420/miTch-Transparency-Layer/issues/20).

## Features

- Current website detection: domain, protocol, and page title
- Cookie analysis: total, first-party, and third-party cookies when detectable
- Storage analysis: localStorage and sessionStorage usage
- Fingerprinting surface detection: Canvas, WebGL, AudioContext, WebRTC, and dynamic `eval()` CSP enforcement
- Third-party domain classification: distinguishes known analytics/ad trackers from external CDN resources
- AskMI Data-Minimization & Visibility Layer: classifies form inputs (`WELT`, `GRUNDVERSORGUNG`, `VULNERABLE`) using field metadata only (never reading typed values)
- AskMI Proof Bridge (v0.3): maps high-confidence over-collection (such as full Date of Birth fields) to a local, canonical AskMI minimal proof suggestion (`age_over_18`)
- Permission surface: geolocation, notifications, camera, microphone, and clipboard
- Surface Score (`surface-score-v1`): informational surface summary separating observation coverage, technical exposure, and evidence quality (low score ≠ safe; unavailable checks are never counted as zero)
- Five-state evidence report: observed, declared, potential, unknown, and unavailable checks (exportable as Markdown or JSON Surface Receipt v1)

## AskMI Proof Bridge (v0.3)

When a webpage form requests over-collected personal attributes (for example, a full Date of Birth / `birthdate`), the **Proof Bridge** surfaces a local-only minimal proof suggestion aligned with `@askmi/shared-types/contracts/claim-contract` (`contractVersion: "1.0.0"`):

- **What it does:**
  - Maps high-confidence `birthdate` form fields onto the canonical EUDI predicate claim `age_over_18`.
  - Allows you to copy a self-contained JSON or Markdown **Proof Suggestion** receipt to your clipboard.
  - Provides an opt-in, localhost-only (`http://localhost:5174/`) experimental hand-off link for developers running the local AskMI Wallet PWA.
- **What it deliberately does NOT do:**
  - Never reads or stores any values typed into form inputs.
  - Never initiates an OID4VP presentation flow or contacts any remote verifier, wallet, or backend server.
  - Never guesses minimal predicates for ambiguous, medical (`VULNERABLE`), or financial fields (fail-closed).

## Changelog

- **v0.3.0** — Added the AskMI Proof Bridge (`proof-bridge.js`), canonical `age_over_18` minimal proof suggestion card with JSON/Markdown export, opt-in localhost-only wallet deep-link, and Node test suite (`test/proof-bridge.test.mjs`). See [docs/UPGRADE_PLAN_V03.md](docs/UPGRADE_PLAN_V03.md).
- **v0.2.0** — Added real-world page hooks (`page-observer.js`), CSP `eval()` violation tracking, AskMI Visibility Layer form classification, third-party tracker domain breakdown, and Markdown/JSON Surface Receipt export. See [docs/UPGRADE_PLAN_V02.md](docs/UPGRADE_PLAN_V02.md).
- **v0.1.0** — Initial Manifest V3 release with cookie, storage, permission, and surface score reporting.

## Install Locally

1. Open `chrome://extensions`.
2. Enable Developer Mode.
3. Select Load unpacked.
4. Choose this repository folder.

## Tests

Run the deterministic unit test suite and release-integrity verifier locally (also enforced on every push and pull request via `.github/workflows/ci.yml`):

```bash
node --test test/*.test.mjs
node scripts/build-release.mjs --verify
```

Current automated coverage verifies Proof Bridge mapping (`test/proof-bridge.test.mjs`), Surface Receipt v1 normalization/redaction/Markdown escaping (`test/surface-receipt.test.mjs`), and scan provenance, Surface Score non-improvement invariants, badge failure states, and deterministic zip integrity (`test/scan-score-and-release.test.mjs`). Browser-observer isolation and PSL domain-boundary hardening are tracked in [#17](https://github.com/Late-bloomer420/miTch-Transparency-Layer/issues/17) and [#22](https://github.com/Late-bloomer420/miTch-Transparency-Layer/issues/22).

## Architecture and roadmap

- [Ecosystem role and authority boundaries](docs/ECOSYSTEM_ROLE_AND_BOUNDARIES.md)
- [Transparency Surface Receipt v1 draft](docs/TRANSPARENCY_RECEIPT_V1.md)
- [Evidence-gated v0.4 product roadmap](docs/PRODUCT_ROADMAP_V04.md)
- [v0.4 programme tracker](https://github.com/Late-bloomer420/miTch-Transparency-Layer/issues/20)
- [v0.3 Proof Bridge plan](docs/UPGRADE_PLAN_V03.md)
- [v0.2 observation upgrade plan](docs/UPGRADE_PLAN_V02.md)

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

See [release/RELEASE_CHECKLIST.md](release/RELEASE_CHECKLIST.md) for the release-binding checklist. Note: this package remains **experimental / local-only** (`v0.3.0`) and makes no certification, compliance, or production-readiness claim.

## Privacy Policy

The privacy policy is available in [PRIVACY_POLICY.md](PRIVACY_POLICY.md) and on GitHub Pages.
