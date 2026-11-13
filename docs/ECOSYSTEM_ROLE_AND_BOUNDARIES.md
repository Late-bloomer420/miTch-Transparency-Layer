# Ecosystem role and boundaries

**Status:** Adopted v0.4 Ecosystem Contract ([#19](https://github.com/Late-bloomer420/miTch-Transparency-Layer/issues/19))  
**Baseline date:** 2026-10-27  
**Programme tracker:** [Issue #20](https://github.com/Late-bloomer420/miTch-Transparency-Layer/issues/20)

> The Transparency Layer is the AskMI ecosystem's local **Visibility & Evidence Companion**. It observes and explains browser-visible surfaces. It is not an identity authority, verifier, policy authority, compliance oracle, fraud engine, or authorization component.

## Product role

The Transparency Layer helps a person or reviewer answer three separate questions:

1. **Observed facts:** What did this collector actually observe in the browser during this scan?
2. **Potential access:** What information could the contacted page or servers receive from normal browser interaction?
3. **Unknowns:** What cannot be established from a browser extension, especially remote retention, profiling, resale, and internal processing?

Its useful output is an understandable view and an explicitly exported, versioned receipt. The extension processes locally and does not automatically centralize its observations.

## Ecosystem map

```mermaid
flowchart LR
    VC["VeriCred<br/>credential issuance"] --> AM["miTch / AskMI<br/>policy, consent, proof"]
    TL["Transparency Layer<br/>visibility & evidence"] -. "advisory context" .-> AM
    AM --> RP["Relying Party<br/>verification"]
    CTL["AskMI Control<br/>engineering posture"] -. "repo/schema status" .-> VC
    CTL -. "repo/schema status" .-> AM
    CTL -. "repo/schema status" .-> TL
    WS["askmi-workspace<br/>private coordination"] -. "reviewed work intake" .-> VC
    WS -. "reviewed work intake" .-> AM
    WS -. "reviewed work intake" .-> TL
```

## Authority matrix

| Component | Owns | Does not own |
|---|---|---|
| VeriCred | Credential issuance and issuer-side OID4VCI behavior | Wallet consent, presentation authorization, browser-surface analysis |
| miTch / AskMI | Policy evaluation, request mediation, consent, holder/presentation behavior | Issuer authority, remote-site behavior claims |
| Transparency Layer | Browser-visible observations, evidence states, local explanations, advisory proof suggestions | Credential validity, verifier trust, authorization, legal necessity, fraud or compliance decisions |
| AskMI Control | Repository/engineering posture over a declared source surface | End-user browsing receipts, identity decisions |
| askmi-workspace | Private context, coordination and reviewed work-item routing | Public implementation truth or production runtime |
| Relying Party | Its own purpose, legal basis, request and retention duties | Automatic entitlement to raw attributes |

## Non-negotiable boundaries

### Observation is not proof

A field name, cookie, API call or network request is evidence of a browser-visible event or surface. It is not proof of:

- the site's legal basis;
- server-side storage or retention;
- data resale or profiling;
- malicious intent;
- identity, credential or verifier validity; or
- actual use of an available capability unless the collector observed the call.

### Potential is not observed

User agent, screen, language, timezone and IP visibility must stay in the potential-access layer unless an observation mechanism establishes a more specific event. The UI and exported receipt must preserve this distinction.

### Unknown does not mean safe

An unavailable or limited scan cannot be rendered as a clean page. Remote behavior that cannot be observed stays explicitly unknown.

### Surface Score is not a verdict

The score is an informational summary of configured surface inputs. It must never be used or described as:

- a trust score;
- a legal-compliance score;
- a fraud/suspicion score;
- proof that a low-scoring site is safe; or
- an input to credential disclosure.

### Local-only by default

The extension must not automatically send receipts, observations or proof suggestions to miTch, VeriCred, AskMI Control, askmi-workspace, a relying party or any backend. Export is a deliberate user action.

### No form values

Form inspection is limited to structural metadata such as name, id, type, autocomplete, placeholder and aria-label. Typed values, credentials and submitted payloads are outside scope.

## Integration contracts

See [ECOSYSTEM_INTEGRATION_PROPOSALS.md](ECOSYSTEM_INTEGRATION_PROPOSALS.md) for the cross-repository routing entries, schema pins, and compatibility specifications.

### 1. Surface Receipt

The versioned receipt contract is defined in [TRANSPARENCY_RECEIPT_V1.md](TRANSPARENCY_RECEIPT_V1.md) and validated by [`schemas/surface-receipt.v1.schema.json`](../schemas/surface-receipt.v1.schema.json).

It carries:

- collection provenance and coverage;
- observed facts;
- potential access;
- unknowns;
- separated domain/request counts;
- rule and collector versions;
- limitations; and
- no typed form values or credential contents.

### 2. Proof Suggestion

The v0.3 Proof Bridge (`schemas/proof-suggestion.v0.3.schema.json`) is advisory:

- high-confidence DOB-like form metadata may suggest canonical `age_over_18` (`contractVersion: "1.0.0"`);
- ambiguous, health and financial fields produce no automatic claim mapping;
- the suggestion never starts or authorizes OID4VP;
- the wallet independently validates request, relying party, policy, binding, consent and presentation state;
- the current localhost deep-link remains explicit opt-in and experimental.

A Proof Suggestion is not a proof and is not an authorization request.

### 3. miTch pre-login visibility

[miTch issue #220](https://github.com/Late-bloomer420/miTch/issues/220) may reuse the three-layer presentation pattern for an on-device introduction.

It must not:

- depend on the installed extension;
- import browsing history;
- send the panel output to an audit log or backend;
- turn device/browser data into a decision signal; or
- imply that the limited pre-login panel equals an extension scan.

### 4. AskMI Control

AskMI Control may monitor:

- repository revision;
- manifest and schema versions;
- open security/evidence gaps;
- test/CI status; and
- contract compatibility.

It must not ingest end-user receipts by default.

### 5. VeriCred

VeriCred has no runtime dependency on the Transparency Layer. Developer tooling may scan a VeriCred test UI, but the resulting receipt is test evidence rather than issuer or credential truth.

### 6. askmi-workspace

The workspace may route reviewed work items to this repository. Private interview, customer and operational context remains private; only implementation-safe, non-personal work items enter the public repository.

## Versioning

- Breaking receipt changes require a new schema version.
- Proof Suggestion and Receipt versions evolve independently.
- Canonical AskMI claim names must be version-pinned and compatibility-tested (`test/ecosystem-contracts.test.mjs`).
- Copying a vocabulary into this repository does not make this repository its authority.
- Unknown versions fail validation explicitly; they are not silently coerced.

## Verified v0.4 Programme Deliverables & Remaining Boundaries

All v0.4 programme gates (`G0`–`G4`, issues [#14–#22](https://github.com/Late-bloomer420/miTch-Transparency-Layer/issues/20)) are implemented and verified by deterministic tests:

- **Surface Receipt v1 (`#15`, `#21`):** Shared normalized builder (`surface-receipt.js`), URL query/fragment stripping, Markdown metacharacter escaping, and 5-state evidence model.
- **Scan Provenance & Release Integrity (`#14`):** `scanStatus` (`complete` / `limited` / `unsupported` / `preview` / `error`), non-improvement score bounds (`value: null` when incomplete), badge honesty, and deterministic zip verifier (`scripts/build-release.mjs`).
- **Observation Reliability & Stealth (`#17`, `#22`):** PSL/eTLD+1 domain boundary parser (`domain-boundary.js`), zero-DOM-footprint private `MessageChannel` observer (`page-observer.js`), throttled SPA `MutationObserver`, and `continuous` vs `on-demand` collection modes (`docs/PERMISSION_MODEL.md`).
- **Human-Centred DE/EN UX (`#16`):** Full English/German localization (`i18n.js`), fixed non-colour symbols, 6-part plain-language signal disclosures, local before/after snapshot comparisons, and opt-in deletable session timeline (`comparison-store.js`, `docs/ACCESSIBILITY_EVIDENCE.md`).
- **Developer & Auditor Tooling (`#18`):** JSON Schema (`schemas/surface-receipt.v1.schema.json`), standalone validator (`receipt-validator.js`), privacy-surface diff engine (`receipt-diff.js`), deterministic fixtures (`fixtures/receipts/*.json`), CLI (`cli/mitch-scan.mjs`), and optional sanitized CI workflow (`.github/workflows/surface-audit.yml`).
- **Experimental Status Boundary:** `v0.3.0` remains an experimental, local-only tool; it is not certified, independently audited, or a legal/compliance authority.

## Decision rule

No ecosystem integration may weaken the local-only boundary or turn browser observations into identity, trust, disclosure, fraud or legal decisions. When usefulness and authority conflict, the Transparency Layer remains informative and advisory.


## Blind Provider & Convener Posture ("Convener statt Autoritaet")

Aligned with the **miTch Policy Manifest** (*"miTch funktioniert nicht, weil es alles weiss — sondern weil es strukturell nichts wissen kann"*), the **Digital Rights Charter** (Articles 1 and 9), and the neutrality principle of **Section 26 TDDDG / EinwV**:

1. **Structurally Blind Provider (`BLIND_CONVENER_POSTURE.structuralBlindness`):**
   - **Never reads personal values:** `formValuesRead: false`, `cookieAndStorageValuesRead: false`.
   - **Never leaks URL secrets:** `urlQueryAndFragmentExported: false` (origin-only receipts).
   - **Zero remote network egress:** `connect-src 'none'` enforced in `manifest.json`; offline rulepack in `rules/known-surfaces.v1.json`.
   - **Blind wallet handoff:** Uses URL hash fragments (`#demo=wallet...`) so local or remote HTTP logs never receive proof suggestion parameters.
2. **Rule-Based Convener (`Convener statt Autoritaet`):**
   - Convenes open vocabularies (**W3C DPV v2.0** Community Group Report, **ISO/IEC TS 27560:2023**, **W3C GPC Working Draft**, **W3C FedID Digital Credentials API**, and **ToS;DR CC BY-SA 3.0** declarations) without acting as an identity authority or data broker.
   - Executes **Art. 9 AQDR** rule-based boundary and signal-vs-behavior checks (`evaluateSignalContradictions`) — such as flagging when `Sec-GPC: 1` is active while marketing/analytics tracker domains are contacted, or when raw `dpv:BirthDate` is requested where an ephemeral `age_over_18` predicate suffices — without ever inspecting personal data.
   - **Economic Neutrality:** Operates with zero economic self-interest in user consents or data monetization (aligned with the neutrality principle of § 26 TDDDG / EinwV, while honestly stating that `v0.3.0` is an experimental local companion and does not claim formal BfDI recognition).
