# miTch Transparency Layer — v0.3 Upgrade Plan  
**AskMI Proof Bridge (Data-Minimization → Actionable Proof Suggestion)**

**Repository:** `Late-bloomer420/miTch-Transparency-Layer`  
**Canonical Ecosystem Reference:** [`Late-bloomer420/miTch`](https://github.com/Late-bloomer420/miTch)  
- `@askmi/layer-resolver` (VISIBILITY_LAYER_MAP)  
- `@askmi/shared-types` claim-contract (`age_over_18`, `birthdate`, …)  
- ADOPT-1 / `@askmi/connect` (“Sign in with AskMI”) — age/liquor-store first slice  
**Status:** Implemented as v0.3.0 through PRs #10–#13; remaining trust, evidence, and ecosystem work is tracked by the [v0.4 programme](https://github.com/Late-bloomer420/miTch-Transparency-Layer/issues/20)  
**Date:** 2026-10-27

---

## Overview

v0.2 turned the extension into an accurate observer of browser-visible surfaces and AskMI Visibility Layer over-collection.  
v0.3 closes the loop: when over-collection is detected, the user can act on it with a **one-click minimal-proof suggestion** that stays 100 % local, fail-closed, and aligned with the canonical claim contract.

Core principle remains unchanged:

> We show what is technically observable and technically possible.  
> We never claim what happens on remote servers.  
> We never send data off-device.

The Proof Bridge only **suggests** the minimal AskMI predicate the user *could* present instead of the raw attribute. It does not initiate any presentation, does not talk to a verifier, and does not require the wallet-pwa to be running.

---

## Design Constraints (non-negotiable)

1. **Local-only** — no network requests to AskMI services, wallet, or any third party from the extension.
2. **Fail-closed** — if the mapping from observed field → canonical claim is ambiguous or unknown → show no suggestion (or a neutral “manual review needed”).
3. **Canonical vocabulary only** — use `@askmi/shared-types` claim-contract names (`age_over_18`, `birthdate`, …). Never invent new claim IDs.
4. **No PII leakage** — the suggestion payload never contains the user’s actual values, only the *requested* minimal claim(s).
5. **Opt-in UX** — the bridge appears only when the Visibility Layer already surfaces an over-collection finding.

---

## Execution Sequence (Items 6 → 9)

### Item 6: Canonical Over-Collection → Minimal-Claim Mapping

- **Problem:** The existing `VISIBILITY_FIELD_RULES` already detect DOB / health / financial fields and show human hints. They do not yet produce a machine-readable, contract-aligned suggestion.
- **Solution:**
  - Extend `collectVisibilityLayer()` (or a sibling pure function) to emit, for each high-confidence finding, an optional `suggestedMinimalClaims: string[]` using only canonical names from the claim-contract.
  - First mapping (high confidence, zero ambiguity):
    - Full DOB / birthdate / geburtsdatum / `type=date` with birth-related tokens → `["age_over_18"]`
  - Later mappings (explicitly deferred or lower confidence):
    - Health attributes → no automatic suggestion in v0.3 (too domain-specific)
    - Password / secret → hint toward passkeys (text only, no claim)
  - Keep the mapping table small, versioned, and documented. Unknown or multi-meaning fields produce no suggestion.
- **Files:** `content.js` (or extracted pure helper), unit-testable pure function preferred.
- **Acceptance:**  
  - DOB-like field → suggestion contains exactly `age_over_18`.  
  - Non-mapped field → no `suggestedMinimalClaims`.  
  - Never suggests `birthdate` when the site asked for full DOB (that would defeat minimization).

---

### Item 7: Proof Suggestion UI in Popup

- **Problem:** Users see the over-collection warning but have no actionable next step inside the extension.
- **Solution:**
  - In the existing **AskMI Data-Minimization & Visibility Layer** panel, when `suggestedMinimalClaims` is present, render a new card/section:
    - Title: “Suggested minimal AskMI proof”
    - Body: human-readable explanation (“Instead of sharing your full date of birth, an AskMI `age_over_18` predicate proof is sufficient.”)
    - Primary action: **Copy Proof Suggestion (JSON)**
    - Secondary action: **Copy human-readable Markdown**
  - The JSON payload shape (v0.3):

    ```json
    {
      "askmiProofSuggestion": {
        "version": "0.3.0",
        "contractVersion": "1.0.0",
        "generatedAt": "ISO-8601",
        "page": { "origin": "...", "title": "..." },
        "observedOverCollection": ["birthdate"],
        "suggestedMinimalClaims": ["age_over_18"],
        "rationale": "Full date of birth requested; age >= 18 predicate is data-minimizing.",
        "note": "This is a local suggestion only. No presentation was started. Open your AskMI wallet to create a real proof."
      }
    }
    ```

  - Visual confirmation on copy (same pattern as the existing Markdown/JSON surface receipt).
- **Files:** `popup.html`, `popup.css`, `popup.js`
- **Acceptance:**
  - Button appears only when a high-confidence mapping exists.
  - Copied JSON is valid and contains only the fields above.
  - No network activity, no wallet deep-link yet.

---

### Item 8: Optional Local Wallet Deep-Link (opt-in, best-effort)

- **Problem:** Power users who already run the wallet-pwa locally want a faster hand-off.
- **Solution:**
  - Add a tertiary, clearly labelled button: “Open in local AskMI Wallet (experimental)”.
  - Construct a `http://localhost:5174/...` (or configurable) URL that the wallet can later interpret as a “suggestion only” hand-off (query param or hash).
  - Important: In v0.3 this is best-effort and documented as experimental. If the wallet does not yet understand the parameter, the page simply opens; no error is thrown.
  - **Guardrails:**
    - Only `http://localhost` / `https://localhost` / `127.0.0.1` (no remote hosts).
    - User must have explicitly enabled “Experimental wallet deep-links” in extension options (default off).
- **Files:** `popup.js`, new options page or section if needed, `manifest.json` (if `options_ui` is added).
- **Acceptance:**
  - Default behaviour = no deep-link attempted.
  - When enabled, opens only localhost.
  - Failure to open is silent / non-blocking.

---

### Item 9: Documentation, Privacy Policy, and Version Bump

- Update `README.md` with a short “Proof Bridge” section explaining what it does and what it deliberately does not do.
- Update `PRIVACY_POLICY.md` (still local-only; the new feature introduces no new data collection).
- Bump `manifest.json` version to `0.3.0`.
- Add `docs/UPGRADE_PLAN_V03.md` (this document) and a short changelog entry.
- Optional: add a one-line note in the main monorepo `docs/REPOSITORY_ECOSYSTEM.md` or `BACKLOG` pointing to the bridge as a consumer of the claim-contract.

---

## Out of Scope for v0.3 (explicit)

- Any real OID4VP / presentation flow started from the extension.
- Talking to a remote verifier or the production wallet.
- Automatic mapping for health, financial, or other `VULNERABLE` attributes.
- Changing enforcement behaviour of `@askmi/layer-resolver` or the `policy-engine`.
- Storing suggestion history across sessions (can be a later history feature).

---

## Delivered PR sequence

- **PR #9** — Plan document (`docs/UPGRADE_PLAN_V03.md`)
- **PR #10** — Item 6: canonical mapping and pure-function tests
- **PR #11** — Item 7: proof-suggestion UI and copy actions
- **PR #12** — Item 8: opt-in localhost-only experimental deep-link
- **PR #13** — Item 9: documentation, privacy policy, and v0.3.0 version bump

These merges establish the v0.3 feature baseline. They do not close the v0.4 receipt-integrity, observation, permission, accessibility, release, or ecosystem gates.

---

## Open Questions for Review

1. Is the first mapping (`DOB → age_over_18` only) the right beachhead, or should we also surface a generic “prefer predicate over raw attribute” text for other `GRUNDVERSORGUNG` fields?
2. Should the JSON suggestion already include a placeholder `presentation_definition`-style fragment (still local), or stay deliberately minimal until ADOPT-1 lands more surface area?
3. Preferred default for the experimental deep-link (`off` vs. `on` for developers)?
4. Any naming preference (`Proof Bridge`, `Minimal Proof Suggestion`, `AskMI Suggest`, …)?
