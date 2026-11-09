# Developer & Auditor Tooling (`#18`)

**Status:** Adopted v0.4 Tooling Specification  
**Schema:** [`schemas/surface-receipt.v1.schema.json`](../schemas/surface-receipt.v1.schema.json)  
**Tracker:** [Issue #18](https://github.com/Late-bloomer420/miTch-Transparency-Layer/issues/18)

> **Non-certification & non-authority notice:** `mitch-scan.mjs`, `receipt-validator.js`, `receipt-diff.js`, and the optional GitHub Actions workflow produce bounded technical surface evidence for developers and privacy reviewers. Their outputs are **not** legal compliance audits, safety verdicts, or security certifications.

## 1. JSON Schema & Standalone Validator

- **Schema:** [`schemas/surface-receipt.v1.schema.json`](../schemas/surface-receipt.v1.schema.json) (JSON Schema Draft 2020-12) defines the canonical `askmi.transparency.surface-receipt.v1` contract.
- **Standalone Validator:** [`receipt-validator.js`](../receipt-validator.js) (`MitchReceiptValidator.validateSurfaceReceipt`) validates any receipt object without depending on browser/popup DOM APIs:
  - Enforces exact schema version (`askmi.transparency.surface-receipt.v1`) and rejects legacy `v0.2` exports or unknown major versions fail-closed.
  - Verifies `page.urlIncluded === false` and rejects any `page.origin` containing query strings (`?...`), fragments (`#...`), credentials, or paths.
  - Verifies Surface Score invariants (`value === null` whenever `scanStatus !== "complete"`; `observedMinimum <= unverifiedMaximum`; `null` components for unavailable channels).
  - Verifies canonical SHA-256 integrity (`integrity.contentHash`).

\`\`\`bash
node cli/mitch-scan.mjs validate fixtures/receipts/high-surface.json
\`\`\`

## 2. Deterministic Receipt Fixtures

Located in [`fixtures/receipts/`](../fixtures/receipts/):

1. [`allowed.json`](../fixtures/receipts/allowed.json) — Complete scan with minimal surface (`surfaceScore.value: 0`, zero third-party requests, zero fingerprinting calls).
2. [`limited.json`](../fixtures/receipts/limited.json) — Partial scan where the content script did not respond (`scanStatus: "limited"`, `surfaceScore.value: null`, `observedMinimum: 5`, `unverifiedMaximum: 35`, `collector.content-surfaces` in `report.unavailable`).
3. [`high-surface.json`](../fixtures/receipts/high-surface.json) — Complete scan with third-party tracker domains, Canvas/WebGL/CSP-eval observations, DOB + IBAN form metadata, `age_over_18` Proof Suggestion, and a cited provider declaration.
4. [`unavailable.json`](../fixtures/receipts/unavailable.json) — Restricted `chrome://extensions/` tab (`scanStatus: "unsupported"`, `surfaceScore.value: null`).

## 3. Privacy-Surface Diff & Allowlist Semantics

[`receipt-diff.js`](../receipt-diff.js) (`MitchReceiptDiff.diffSurfaceReceipts`) compares a baseline receipt and a candidate receipt across 4 distinct categories:

- `added`: Newly observed third-party domains, fingerprinting calls, form field metadata, or granted permissions.
- `removed`: Surfaces present in the baseline that were observed as absent in a complete candidate check.
- `changed`: Shifts in `scanStatus`, `surfaceScore` / exposure range, or per-domain request/cookie counts.
- `unavailable`: Checks that were unavailable in either snapshot (**never** collapsed into `removed` or reported as fixed).

### Baseline / Allowlist Annotations

Developers can pass `--allowlist <allowlist.json>`:

\`\`\`json
{
  "rationale": "Expected first-party payment gateway & age-gate fields",
  "allowedDomains": ["cdn.checkout-assets.example.net"],
  "allowedFormFields": ["birthdate"]
}
\`\`\`

Matching additions receive an `annotatedAllowlist` tag and do not trigger `--fail-on-regression`, **but remain visible in `diff.added` and never alter `surfaceScore`**.

## 4. Local CLI & Controlled Browser Profile

- **Fixture & Static HTML Inspection:**
  \`\`\`bash
  node cli/mitch-scan.mjs scan --fixture high-surface --format markdown
  node cli/mitch-scan.mjs scan --html-file path/to/page.html --origin https://app.example.test
  \`\`\`
- **Live Headless Inspection (`--url`):**
  When `--url <https://...>` is invoked with a local Chromium/Edge binary, `cli/mitch-scan.mjs` creates a fresh temporary directory (`os.tmpdir()`), launches `--headless --incognito --user-data-dir=<temp>` with zero user cookies, credentials, or extensions, inspects the rendered DOM metadata, and deletes the temporary profile immediately on exit.

## 5. Coverage Boundaries, False Positives & False Negatives

| Limitation Category | Technical Cause | How the Receipt Represents It |
|---|---|---|
| **False Positive (Heuristic Field Match)** | An `<input>` attribute token matches a pattern (e.g. `name="dob_reference"`) on a non-personal form. | Reported as field attribute metadata only (`purposeKnown: false`, `valueInspected: false`), with `Not verified` stating that actual submission and purpose were not verified. |
| **False Negative (Dynamic / Delayed Surface)** | A page loads third-party scripts or fingerprinting calls only after deep user interaction not triggered during the scan window. | Explicitly bounded by `observationWindowMs` and `report.notObservedNote` (`"Not observed during this scan does not mean absent"`). |
| **False Negative (MAIN-World Evasion)** | A site creates a fresh same-origin iframe realm to call unwrapped Canvas/WebGL methods. | Documented in `collector.limitations` and `OBSERVER_EVASION_CAVEAT`. |
| **Server-Side Processing Boundary** | Backend databases, server-to-server sharing, retention, and data sale occur outside the browser. | Always placed in `report.unknown` — never inferred from score or tracker rules. |
