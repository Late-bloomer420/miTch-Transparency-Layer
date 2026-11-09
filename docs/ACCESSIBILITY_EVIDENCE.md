# Accessibility Design & Verification Evidence (`#16`)

**Status:** Verified v0.4 Accessibility Record  
**Tracker:** [Issue #16](https://github.com/Late-bloomer420/miTch-Transparency-Layer/issues/16)

## 1. Non-Colour-Only State Encoding

Every evidence state and signal pill in `popup.html`, `popup.js`, and `i18n.js` pairs colour with a distinct prefix symbol and localized text badge in both English (`EN`) and German (`DE`), ensuring complete comprehension without colour perception:

| Evidence State | Symbol | English Label | German Label | CSS Token / Class |
|---|---|---|---|---|
| `observed` | `●` | `● Observed` | `● Beobachtet` | `.state-observed` / `li.observed` |
| `declared` | `◈` | `◈ Declared` | `◈ Deklariert` | `.state-declared` / `li.declared` |
| `potential` | `◌` | `◌ Potential` | `◌ Potenziell` | `.state-potential` / `li.potential` |
| `not_verified` | `◇` | `◇ Not verified` | `◇ Nicht verifiziert` | `.state-not-verified` |
| `unknown` | `?` | `? Unknown` | `? Unbekannt` | `.state-unknown` / `li.unknown` |
| `unavailable` | `⊘` | `⊘ Unavailable` | `⊘ Nicht verfügbar` | `.state-unavailable` / `li.unavailable` |
| `not_observed` | `○` | `○ Not observed` | `○ Nicht beobachtet` | `.state-not-observed` |

## 2. WCAG 2.1 AA Contrast Verification

Foreground and background token combinations in `popup.css` meet or exceed the WCAG 2.1 AA minimum contrast ratio of `4.5:1` for normal text:

| Foreground Token | Hex | Background Token | Hex | Contrast Ratio | WCAG 2.1 AA (`>= 4.5:1`) |
|---|---|---|---|---|---|
| `--text` | `#edf5ff` | `--bg` | `#080b10` | `17.6 : 1` | Pass (AAA) |
| `--text` | `#edf5ff` | `--panel` | `#111822` | `15.2 : 1` | Pass (AAA) |
| `--soft` | `#c8d5e5` | `--panel` | `#111822` | `11.3 : 1` | Pass (AAA) |
| `--muted` | `#9baabe` | `--panel` | `#111822` | `7.1 : 1` | Pass (AAA) |
| `--accent` | `#46d9b5` | `--panel` | `#111822` | `9.4 : 1` | Pass (AAA) |
| `.pill-warning` text | `#f3d27c` | `.pill-warning` bg | `#292820` (composited) | `9.8 : 1` | Pass (AAA) |
| `.pill-danger` text | `#ff9ab0` | `.pill-danger` bg | `#2c1b29` (composited) | `7.4 : 1` | Pass (AAA) |

## 3. Keyboard Navigation, Focus Visibility & ARIA Landmarks

1. **Sequential Keyboard Order (`Tab` / `Shift+Tab`):**
   - Language selector (`#langSelect`: `EN` / `DE`) and Observation Mode selector (`#collectionModeSelect`: `Continuous` / `On-Demand`).
   - Expandable plain-language signal disclosures (`<details class="signal-details"><summary>...</summary>...</details>`), operable via `Enter` and `Space` natively without custom focus traps.
   - AskMI Proof Bridge copy/wallet buttons (`#copyProofJsonBtn`, `copyProofMarkdownBtn`, `#enableWalletDeepLinkToggle`, `#openLocalWalletBtn`).
   - Expandable permission necessity disclosure (`#permissionExplainDetails`).
   - Local comparison & opt-in timeline controls (`#enableTimelineToggle`, `#comparisonScenarioSelect`, `#saveBeforeSnapBtn`, `#saveAfterSnapBtn`, `#clearTimelineBtn`).
   - Five-State Evidence Report export buttons (`#copyMarkdownBtn`, `#copyJsonBtn`).
2. **Focus Ring (`:focus-visible`):**
   - Every interactive control (`.action-btn`, `select`, `input[type="checkbox"]`, `summary`) defines `outline: 2px solid var(--accent); outline-offset: 2px;` on `:focus-visible`.
3. **Screen Reader & Live Regions:**
   - Top-level scan status banner (`#scanModeBanner`), Proof Bridge copy status (`#proofBridgeStatus`), comparison status (`#comparisonStatus`), and receipt export status (`#exportStatus`) declare `role="status"` / `aria-live="polite"`.
   - Every section uses `<section aria-labelledby="...">` and semantic description lists (`<dl>`, `<dt>`, `<dd>`).
4. **Reduced Motion:**
   - `@media (prefers-reduced-motion: reduce)` disables SVG ring stroke transitions and button hover transitions.
