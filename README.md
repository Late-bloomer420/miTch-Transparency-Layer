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
- Transparency Surface Score from 0 to 100
- Three-layer report: observed facts, potential access, and unknowns (exportable as Markdown or JSON Receipt)

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

Run the current pure Proof Bridge tests with:

```bash
node --test test/*.test.mjs
```

This suite does not yet cover the full receipt, score, browser-observer, permission, or dynamic-page surface. That expansion is tracked in [#14](https://github.com/Late-bloomer420/miTch-Transparency-Layer/issues/14), [#15](https://github.com/Late-bloomer420/miTch-Transparency-Layer/issues/15), and [#17](https://github.com/Late-bloomer420/miTch-Transparency-Layer/issues/17).

## Architecture and roadmap

- [Ecosystem role and authority boundaries](docs/ECOSYSTEM_ROLE_AND_BOUNDARIES.md)
- [Transparency Surface Receipt v1 draft](docs/TRANSPARENCY_RECEIPT_V1.md)
- [Evidence-gated v0.4 product roadmap](docs/PRODUCT_ROADMAP_V04.md)
- [v0.4 programme tracker](https://github.com/Late-bloomer420/miTch-Transparency-Layer/issues/20)
- [v0.3 Proof Bridge plan](docs/UPGRADE_PLAN_V03.md)
- [v0.2 observation upgrade plan](docs/UPGRADE_PLAN_V02.md)

## Release Package

The repository currently contains the historical package:

```text
release/mitch-transparency-layer-v0.1.zip
```

It does **not** represent the current v0.3 source and must not be uploaded as the current release. A revision-bound v0.3 package, test record, and release checklist are tracked in [#14](https://github.com/Late-bloomer420/miTch-Transparency-Layer/issues/14).

## Privacy Policy

The privacy policy is available in [PRIVACY_POLICY.md](PRIVACY_POLICY.md) and on GitHub Pages.
