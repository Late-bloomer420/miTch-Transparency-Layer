# miTch Transparency Layer — v0.2 Upgrade Plan

**Repository:** `Late-bloomer420/miTch-Transparency-Layer`  
**Canonical Ecosystem Reference:** [`Late-bloomer420/miTch`](https://github.com/Late-bloomer420/miTch) (`@askmi/layer-resolver`)  
**Status:** Active Execution Plan (PR-by-PR sequential delivery)

---

## Overview

This plan sequences five concrete upgrades to transform `miTch Transparency Layer` from a static capability checker into an accurate, AskMI-aligned privacy and data-minimization companion. Each item lands via its own focused Pull Request.

---

## Execution Sequence (Items 1 → 5)

### Item 1: Active Fingerprinting Call Observation (vs. Mere API Existence)
- **Problem:** `content.js` previously checked whether `HTMLCanvasElement`, `WebGLRenderingContext`, `AudioContext`, and `RTCPeerConnection` existed on `window` — which is true on every modern browser, causing false-positive "Detected" badges on every page.
- **Solution:**
  - Inject a lightweight main-world observer (or passive prototype/event instrumentation without `eval()`) that detects when page scripts **actually invoke** fingerprinting primitives (`HTMLCanvasElement.prototype.toDataURL`, `CanvasRenderingContext2D.prototype.getImageData`, `WebGLRenderingContext.prototype.getParameter` with unmasked vendor/renderer constants, `AudioContext` / `OfflineAudioContext` instantiation, and `RTCPeerConnection` instantiation).
  - Distinguish between **API Available** (potential surface) and **Active Call Observed** (`Detected`).
- **Files:** `manifest.json`, `content.js`, `popup.js`

---

### Item 2: Third-Party Tracker Domain Breakdown & Classification
- **Problem:** `background.js` collects `thirdPartyDomains`, but `popup.html` / `popup.js` only showed the numeric count and discarded the domain names.
- **Solution:**
  - Add a dedicated **Third-Party Domains Contacted** section in `popup.html`, `popup.css`, and `popup.js`.
  - Display the exact third-party hostnames observed on the active tab and tag known analytics, advertising, and telemetry domains (e.g., `google-analytics.com`, `googletagmanager.com`, `doubleclick.net`, `connect.facebook.net`, `clarity.ms`, `hotjar.com`).
- **Files:** `popup.html`, `popup.css`, `popup.js`

---

### Item 3: Live Toolbar Badge (`chrome.action.setBadgeText` & Risk Color)
- **Problem:** Users must click the extension icon on every tab to know whether a page has a high tracking or data-collection surface.
- **Solution:**
  - Have `content.js` push surface snapshots (`MITCH_PAGE_SURFACES`) to `background.js` on load and DOM/CSP changes.
  - Have `background.js` compute the tab's surface score and update `chrome.action.setBadgeText` + `chrome.action.setBadgeBackgroundColor` per tab:
    - `#46d9b5` (Green) for Low Surface (`0–25`)
    - `#f1c65b` (Amber) for Moderate Surface / `GRUNDVERSORGUNG` inputs (`26–50`)
    - `#ff6f8f` (Red) for High/Very High Surface or `VULNERABLE` inputs (`51+`)
- **Files:** `content.js`, `background.js`

---

### Item 4: AskMI Over-Collection & Data-Minimization Warnings on Forms
- **Problem:** Websites routinely ask for raw over-collected personal attributes (e.g., full `birth_date` when `age >= 18` suffices, or raw `iban` / `health` / `identity` fields).
- **Solution:**
  - Extend `collectVisibilityLayer()` in `content.js` to return structured field-level findings and over-collection hints mapped to `@askmi/layer-resolver` (`WELT`, `GRUNDVERSORGUNG`, `VULNERABLE`).
  - Render an **AskMI Data-Minimization & Visibility Layer** panel in `popup.html` / `popup.js` that highlights over-collection warnings (e.g., *"Full birth date requested (`GRUNDVERSORGUNG`) — an AskMI `age >= 18` predicate proof avoids sharing exact DOB"*).
- **Files:** `content.js`, `popup.html`, `popup.css`, `popup.js`

---

### Item 5: 1-Click "Copy Surface Report (JSON / Markdown)" Export
- **Problem:** Users and auditors cannot easily save or share an auditable snapshot of a website's observed privacy surface.
- **Solution:**
  - Add **Copy Markdown Report** and **Copy JSON Receipt** action buttons in `popup.html` / `popup.js` with visual confirmation feedback.
  - Include timestamp, domain, protocol, score, cookie/storage counts, third-party domains, CSP/eval status, AskMI Visibility Layer classification, and Three-Layer Report items.
- **Files:** `popup.html`, `popup.css`, `popup.js`
