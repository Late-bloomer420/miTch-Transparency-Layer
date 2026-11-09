# AskMI Ecosystem Integration Proposals & Cross-Repository Specifications

**Status:** Adopted v0.4 Ecosystem Contract Artifacts ([#19](https://github.com/Late-bloomer420/miTch-Transparency-Layer/issues/19))  
**Repository Boundary:** All cross-repository coordination specifications are authored and versioned in `miTch-Transparency-Layer` so sibling repositories can adopt them via explicit pull requests without out-of-band coupling.

---

## 1. Cross-Repository Authority & Data-Flow Matrix

| Source -> Target | Direction | Permitted Artifact / Signal | Forbidden Coupling / Hard Boundary |
|---|---|---|---|
| `miTch-Transparency-Layer` -> User / Reviewer | Local UI & user-triggered clipboard/file export | `askmi.transparency.surface-receipt.v1`, `askmiProofSuggestion` (`0.3.0`) | No background telemetry, no automatic upload, no typed form values, no raw query/fragment URLs |
| `miTch-Transparency-Layer` -> `miTch` (Wallet PWA) | Optional user-clicked localhost deep-link (`http://localhost:5174/?askmi_proof_suggestion=1...`) | Advisory `age_over_18` suggestion (`contractVersion: "1.0.0"`) | Never starts OID4VP, never bypasses wallet policy/consent, never supplies relying-party trust or authorization |
| `miTch` (`#220`) <- `miTch-Transparency-Layer` | Conceptual design pattern reuse (reference-only) | Three-layer presentation model (`Observed` / `Potential` / `Unknown`) | No runtime dependency on installed extension, no browsing history import, no backend audit logging of device surfaces |
| `AskMI Control` <- `miTch-Transparency-Layer` | Read-only repository & schema posture inspection | `release/release-manifest.json`, `schemas/*.schema.json`, CI workflow status | Must never ingest end-user Surface Receipts or browsing telemetry |
| `VeriCred` <-> `miTch-Transparency-Layer` | None at runtime (dev/test CLI scan only) | `mitch-scan` receipt over test issuer UI | Browser receipt is test evidence only; never issuer or credential truth |
| `askmi-workspace` -> `miTch-Transparency-Layer` | One-way public issue/work-item routing | Reviewed, non-personal engineering tasks | No private interview notes, customer identifiers, or operational secrets in public repo |

---

## 2. Independent Contract Versioning & Compatibility Rules

1. **Surface Receipt Schema (`askmi.transparency.surface-receipt.v1`):**
   - Validated by [`schemas/surface-receipt.v1.schema.json`](../schemas/surface-receipt.v1.schema.json) and [`receipt-validator.js`](../receipt-validator.js).
   - Unknown major versions (e.g. `v0`, `v2`) and legacy `v0.2` exports (which lack `schema`, `collector.scanStatus`, and 5-state `report`) are **rejected fail-closed** by `validateSurfaceReceipt()`.
2. **Proof Suggestion Contract (`askmiProofSuggestion` `version: "0.3.0"`, `contractVersion: "1.0.0"`):**
   - Validated by [`schemas/proof-suggestion.v0.3.schema.json`](../schemas/proof-suggestion.v0.3.schema.json) and `validateProofSuggestion()` in [`receipt-validator.js`](../receipt-validator.js).
   - Evolved independently of Surface Receipt v1.
   - Canonical claim names are pinned to `@askmi/shared-types/contracts/claim-contract` `1.0.0` (currently `birthdate` -> `age_over_18`).
   - Any payload containing authorization, identity, or decision fields (`authorized`, `allowDisclosure`, `verifierTrusted`, `complianceVerdict`, `holderDid`, `credentialJwt`, `typedValue`) is **rejected fail-closed**.

---

## 3. Ready-to-Apply `askmi-workspace` Routing Entry

Add the following routing entry to `askmi-workspace` work-intake routing configuration:

```yaml
repositories:
  mitch-transparency-layer:
    repo: "Late-bloomer420/miTch-Transparency-Layer"
    role: "Visibility & Evidence Companion (Browser Surface Collector & Receipt Tooling)"
    visibility: "public"
    authority_boundary:
      owns:
        - "browser-visible surface observation (DOM metadata, cookies, storage keys, permission states, network domain counts, main-world API call hooks)"
        - "5-state evidence classification (observed, declared, potential, unknown, unavailable)"
        - "Surface Receipt v1 (askmi.transparency.surface-receipt.v1) schema, validator, and diff CLI"
        - "advisory Proof Suggestion (0.3.0 / claim-contract 1.0.0) for high-confidence form over-collection"
      does_not_own:
        - "credential issuance (VeriCred)"
        - "policy evaluation, consent mediation, or OID4VP presentation (miTch)"
        - "relying-party trust, legal compliance verdicts, or fraud scoring"
    intake_sanitization_rules:
      - "Strip all customer/partner names, interview transcripts, and internal URLs before creating public GitHub issues."
      - "Express test cases using synthetic fixtures or public standards only."
```

---

## 4. Proposed One-Line Update for Canonical `miTch` `docs/REPOSITORY_ECOSYSTEM.md`

In `Late-bloomer420/miTch` (`docs/REPOSITORY_ECOSYSTEM.md`), update or append the companion repository table row as follows:

```markdown
| **miTch-Transparency-Layer** | Visibility & Evidence Companion (MV3 extension & CLI): local-only browser surface receipts (`askmi.transparency.surface-receipt.v1`) and advisory `age_over_18` proof suggestions (`claim-contract` `1.0.0`); non-authoritative, zero telemetry. |
```

---

## 5. Reference-Only Boundary Specification for `miTch` Issue `#220` (Pre-Login Visibility Panel)

When implementing the pre-login visibility introduction panel in `Late-bloomer420/miTch#220`:

1. **Pattern Reuse Only:** `miTch#220` may adopt the three-question vocabulary (*Observed by this page*, *Potentially visible to websites*, *Unknown / server-side*) and fixed non-colour state symbols (`●`, `◌`, `?`).
2. **Zero Extension Coupling:** The `miTch` wallet web app must **not** probe for the extension, require the extension to be installed, or read extension storage.
3. **Zero History / Receipt Ingestion:** The pre-login panel must only reflect standard first-party browser context available to the wallet tab itself and must never import browsing history or log device surfaces to a backend audit service.
4. **Honest Scope Disclosure:** The panel must state that it is an educational on-device preview inside the wallet tab, not a multi-site extension scan.
