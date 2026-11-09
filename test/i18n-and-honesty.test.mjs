import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  SUPPORTED_LOCALES,
  EVIDENCE_BADGES,
  UI_STRINGS,
  getEvidenceBadge,
  getPermissionExplanations,
  buildSignalExplanation,
  formatLocalizedReceiptMarkdown
} = require("../i18n.js");
const { buildSurfaceReceiptModel } = require("../surface-receipt.js");

test("#16 — German (DE) and English (EN) UI dictionaries and fixed evidence badges have 100% key parity and non-colour symbols", () => {
  assert.deepEqual(SUPPORTED_LOCALES, ["en", "de"]);
  const enKeys = Object.keys(UI_STRINGS.en).sort();
  const deKeys = Object.keys(UI_STRINGS.de).sort();
  assert.deepEqual(deKeys, enKeys);

  const requiredBadgeStates = [
    ["observed", "Observed", "Beobachtet", "●"],
    ["declared", "Declared", "Deklariert", "◈"],
    ["potential", "Potential", "Potenziell", "◌"],
    ["not_verified", "Not verified", "Nicht verifiziert", "◇"],
    ["unknown", "Unknown", "Unbekannt", "?"],
    ["unavailable", "Unavailable", "Nicht verfügbar", "⊘"],
    ["not_observed", "Not observed", "Nicht beobachtet", "○"]
  ];

  for (const [key, enLabel, deLabel, symbol] of requiredBadgeStates) {
    assert.ok(EVIDENCE_BADGES[key], `Missing badge state ${key}`);
    const enBadge = getEvidenceBadge(key, "en");
    const deBadge = getEvidenceBadge(key, "de");
    assert.equal(enBadge.label, enLabel);
    assert.equal(deBadge.label, deLabel);
    assert.equal(enBadge.symbol, symbol);
    assert.equal(deBadge.symbol, symbol);
    assert.ok(enBadge.badgeText.startsWith(symbol));
    assert.ok(deBadge.badgeText.startsWith(symbol));
  }

  assert.equal(getPermissionExplanations("en").length, 5);
  assert.equal(getPermissionExplanations("de").length, 5);
});

test("#16 — buildSignalExplanation provides bounded 6-part explanations in both EN and DE without legal or data-sale overclaims", () => {
  const signalTypes = [
    "thirdPartyDomain",
    "trackerDomain",
    "visibilityField",
    "fingerprinting",
    "permission",
    "cookies"
  ];
  const prohibitedClaims =
    /\b(illegal|gdpr violation|dsgvo-verstoß|rechtswidrig|sells your data|verkauft ihre daten|site is safe|seite ist sicher)\b/i;

  for (const locale of ["en", "de"]) {
    for (const type of signalTypes) {
      const exp = buildSignalExplanation(
        type,
        {
          domain: "analytics.example",
          requestCount: 3,
          isTracker: type === "trackerDomain",
          label: "Date of Birth",
          layer: "GRUNDVERSORGUNG (Medium)",
          hasProofSuggestion: true,
          observed: true,
          state: "Granted"
        },
        locale
      );

      for (const field of [
        "observed",
        "declared",
        "potential",
        "notVerified",
        "unknown",
        "whyItMatters",
        "userAction"
      ]) {
        assert.equal(typeof exp[field], "string", `Missing ${field} for ${type} (${locale})`);
        assert.ok(exp[field].length > 10, `Empty ${field} for ${type} (${locale})`);
        assert.equal(
          prohibitedClaims.test(exp[field]),
          false,
          `Prohibited claim in ${type}.${field} (${locale}): ${exp[field]}`
        );
      }
    }
  }

  const netEn = buildSignalExplanation("thirdPartyDomain", { domain: "cdn.example", requestCount: 2 }, "en");
  assert.ok(netEn.observed.includes("A connection to this domain"));
  assert.ok(netEn.notVerified.includes("The payload and later use were not verified."));

  const netDe = buildSignalExplanation("thirdPartyDomain", { domain: "cdn.example", requestCount: 2 }, "de");
  assert.ok(netDe.observed.includes("Eine Verbindung zu dieser Domain"));
  assert.ok(netDe.notVerified.includes("Übertragene Inhalte (Payloads) und spätere Nutzung wurden nicht verifiziert."));
});

test("#16 — formatLocalizedReceiptMarkdown renders full German and English receipts preserving all 5 evidence states and provider declarations", () => {
  const receipt = buildSurfaceReceiptModel({
    url: "https://shop.example.de/checkout?token=secret_123",
    title: "Kasse & Altersprüfung",
    cookies: { available: true, total: 2, firstParty: 2, thirdParty: 0 },
    content: {
      available: true,
      storage: { localStorage: "1 keys", sessionStorage: "Not Detected" },
      fingerprinting: { canvas: true, webgl: false, audio: false, webrtc: false, evalAttempt: false },
      csp: { hasMetaCsp: true, metaBlocksEval: true, evalBlockedCount: 0, totalViolationCount: 0, violatedDirectives: [] },
      visibilityLayer: {
        highestLayer: "GRUNDVERSORGUNG (Medium)",
        counts: { vulnerable: 0, grundversorgung: 1, welt: 0 },
        findings: [{ key: "birthdate", label: "Date of Birth", layer: "GRUNDVERSORGUNG (Medium)", hint: "DOB field" }],
        proofSuggestion: null
      },
      screen: "1920 × 1080",
      language: "de-DE",
      timezone: "Europe/Berlin",
      userAgent: "Mozilla/5.0"
    },
    network: { available: true, thirdPartyRequestCount: 2, domainCounts: { "analytics.example.de": 2 } },
    permissions: {
      available: true,
      geolocation: "Denied",
      notifications: "Denied",
      camera: "Denied",
      microphone: "Denied",
      clipboard: "Denied"
    },
    declarations: [
      {
        id: "decl.privacy",
        summary: "Anbieter erklärt pseudonyme Reichweitenmessung in der Datenschutzerklärung.",
        sourceReference: "https://shop.example.de/datenschutz",
        retrievedAt: "2026-11-09T08:00:00.000Z"
      }
    ]
  });

  const mdDe = formatLocalizedReceiptMarkdown(receipt, "de");
  const mdEn = formatLocalizedReceiptMarkdown(receipt, "en");

  assert.equal(mdDe.includes("secret_123"), false);
  assert.ok(mdDe.includes("### 1. ● Beobachtet"));
  assert.ok(mdDe.includes("### 2. ◈ Deklariert"));
  assert.ok(mdDe.includes("### 3. ◌ Potenziell"));
  assert.ok(mdDe.includes("### 4. ? Unbekannt"));
  assert.ok(mdDe.includes("### 5. ⊘ Nicht verfügbar"));
  assert.ok(mdDe.includes("unabhängigVerifiziert: `false`"));
  assert.ok(mdEn.includes("### 1. Observed"));
  assert.ok(mdEn.includes("### 2. Declared (Provider Notices)"));
});
