# Permission & Collection Mode Model (`#17`)

**Status:** Adopted v0.4 Least-Privilege & Collection-Mode Specification  
**Tracker:** [Issue #17](https://github.com/Late-bloomer420/miTch-Transparency-Layer/issues/17) and [Issue #22](https://github.com/Late-bloomer420/miTch-Transparency-Layer/issues/22)

## 1. Principle of Least Privilege & Data Minimisation

`miTch Transparency Layer` requests only the Manifest V3 permissions required to observe browser-visible surfaces locally. No permission is used to read user-entered form values, cookie values, storage values, request bodies, or credentials, and no data is transmitted off-device.

## 2. Manifest Permission Inventory

| Permission / Host Scope | Why it is requested | What is read | What is NEVER read or exported |
|---|---|---|---|
| `activeTab` | Allows user-initiated inspection of the currently active tab when opening the popup or running an on-demand scan. | Active tab origin, protocol, and page title. | Full URL query/fragment secrets (`urlIncluded: false`). |
| `cookies` | Counts cookies scoped to the inspected origin and distinguishes first-party vs. third-party cookie domains via `MitchDomainBoundary`. | Cookie count and `cookie.domain` attribute only. | Cookie `value`, session tokens, or authentication secrets (`valuesInspected: false`). |
| `tabs` | Queries the active tab ID/URL to request `MITCH_COLLECT_SURFACES` and resets per-tab counters on navigation (`tabs.onUpdated` / `tabs.onRemoved`). | Active tab ID, navigation loading status, origin, and title. | Cross-tab browsing history or inactive background tabs. |
| `webRequest` | Observes outbound HTTP(S) request hostnames for the active tab to count third-party domains, per-domain request volume, and unattributed requests. | Request URL hostname and initiator hostname (`onCompleted` / `onErrorOccurred`). | Request headers, cookies, POST bodies, response bodies, or query parameters. |
| `host_permissions` (`http://*/*`, `https://*/*`) | Required by Chromium MV3 for (a) `webRequest` hostname attribution across sites and (b) injecting the `document_start` MAIN-world API wrappers (`page-observer.js`) before page scripts execute. | DOM input attribute metadata (`name`, `id`, `type`, `autocomplete`, `placeholder`, `aria-label`), `<meta>` CSP presence, storage key counts (`length`), and MAIN-world API invocation booleans. | Typed input `.value`, DOM text content, `localStorage` / `sessionStorage` values, or passwords. |

## 3. Collection Modes: Continuous Observation vs. On-Demand Inspection

Users can switch between two explicit collection modes inside the extension popup:

1. **Continuous Observation Mode (`continuous`, default):**
   - `background.js` records per-tab third-party request hostnames as the page loads and updates the tab badge once `content.js` has pushed its initial surface snapshot.
   - `content.js` listens for private `MessagePort` fingerprinting notifications, CSP `securitypolicyviolation` events, and throttled `MutationObserver` form changes (`600ms` trailing cooldown), pushing bounded updates to the service worker for the current tab only.
2. **On-Demand Mode (`on-demand` — "Inspect this page only when opened"):**
   - Passive background `webRequest` counting and automatic `MITCH_PAGE_SURFACES` pushes are paused (`background.js` clears tab badges and does not accumulate background tab request maps).
   - Surface inspection runs only when the user opens the popup or clicks **Inspect this page** (`MITCH_COLLECT_SURFACES`), combining `performance.getEntriesByType("resource")`, DOM metadata, storage key counts, cookies, and permissions at inspection time.

## 4. Assessment of `optional_host_permissions` in Manifest V3

During `#17`, we evaluated moving `http://*/*` and `https://*/*` from `host_permissions` to `optional_host_permissions`:

- **Technical trade-off:** In Chromium MV3, `content_scripts` declared with `"run_at": "document_start"` and `"world": "MAIN"` (`page-observer.js`) only execute before page scripts when host permission for the origin is already granted prior to navigation. Under `activeTab`-only injection (`chrome.scripting.executeScript` when the popup is clicked), early page-load Canvas/WebGL/Audio/WebRTC calls and early network requests have already completed and cannot be observed retroactively.
- **Mitigation adopted:** We retain `http://*/*` and `https://*/*` in `manifest.json` so `document_start` observation works reliably when needed, and provide the in-popup **On-Demand (`on-demand`) vs. Continuous (`continuous`)** toggle so users who prefer zero background tab tracking can disable passive collection with one click.

## 5. MAIN-World Observer Hygiene & Evasion Caveat (`#22`)

- **Zero page-writable or page-detectable DOM/event channels:** `page-observer.js` never writes `data-mitch-fp-*` attributes to `document.documentElement` and never dispatches `CustomEvent("mitch:surface-observed")` on `window`. Instead, `content.js` (loaded first in `ISOLATED` world at `document_start`) registers a one-shot capture-phase `message` listener, captures `MessagePort` (`port2`) from `page-observer.js` via `event.stopImmediatePropagation()`, immediately removes the window listener, and receives all subsequent observations over the private `MessageChannel`.
- **Honest evasion boundary:** Because `page-observer.js` runs in the page's `MAIN` world, a determined site can still evade observation (for example, by creating a fresh same-origin `<iframe>` realm and invoking unwrapped prototype methods from that realm). Both the popup UI and exported Surface Receipts state this limitation explicitly (`not observed ≠ absent`).
