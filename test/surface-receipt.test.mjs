import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  RECEIPT_SCHEMA_V1,
  EVIDENCE_STATES,
  sha256Hex,
  escapeMarkdownInline,
  sanitizePageContext,
  combineNetworkSources,
  buildSurfaceReceiptModel,
  verifyReceiptIntegrity,
  serializeReceiptJson,
  serializeReceiptMarkdown
} = require("../surface-receipt.js");

const {
  evaluateFieldsForVisibilityAndProof,
  buildProofSuggestionPayload,
  buildProofSuggestionMarkdown
} = require("../proof-bridge.js");

test("SHA-256 pure helper matches node:crypto across empty, multi-block, and UTF-8 inputs", () => {
  const vectors = [
    "",
    "abc",
    "askmi.transparency.surface-receipt.v1",
    "Größe, Geburtsdatum & Überprüfung — 🧪🔒",
    "a".repeat(250)
  ];

  for (const input of vectors) {
    const expected = crypto.createHash("sha256").update(input, "utf8").digest("hex");
    assert.equal(sha256Hex(input), expected);
  }
});

test("#21 — strips URL query, fragment, path, and credentials from Surface Receipt and Proof Suggestion", () => {
  const sensitiveUrl =
    "https://alice:hunter2@shop.example:8443/account/reset?token=reset_secret_999&code=oauth_code_777#access_token=bearer_jwt_555";

  const pageCtx = sanitizePageContext(sensitiveUrl, "Account Reset");
  assert.equal(pageCtx.origin, "https://shop.example:8443");
  assert.equal(pageCtx.domain, "shop.example");
  assert.equal(pageCtx.protocol, "HTTPS");
  assert.equal(pageCtx.urlIncluded, false);

  const receipt = buildSurfaceReceiptModel({
    url: sensitiveUrl,
    title: "Account Reset",
    cookies: { available: true, total: 1, firstParty: 1, thirdParty: 0 },
    content: {
      available: true,
      storage: { localStorage: "Not Detected", sessionStorage: "Not Detected" },
      fingerprinting: { canvas: false, webgl: false, audio: false, webrtc: false, evalAttempt: false },
      csp: { hasMetaCsp: false, metaBlocksEval: false, evalBlockedCount: 0, totalViolationCount: 0, violatedDirectives: [] },
      visibilityLayer: evaluateFieldsForVisibilityAndProof([{ name: "birthdate", type: "date" }]),
      screen: "1920 × 1080",
      language: "en-US",
      timezone: "Europe/Berlin",
      userAgent: "Mozilla/5.0 Test"
    },
    network: { available: true, thirdPartyRequestCount: 0, domainCounts: {} },
    permissions: { available: true, geolocation: "Prompt", notifications: "Prompt", camera: "Prompt", microphone: "Prompt", clipboard: "Prompt" }
  });

  const jsonText = serializeReceiptJson(receipt);
  const mdText = serializeReceiptMarkdown(receipt);

  for (const secret of [
    "reset_secret_999",
    "oauth_code_777",
    "bearer_jwt_555",
    "hunter2",
    "alice",
    "/account/reset"
  ]) {
    assert.equal(jsonText.includes(secret), false, `JSON receipt leaked ${secret}`);
    assert.equal(mdText.includes(secret), false, `Markdown receipt leaked ${secret}`);
  }

  const parsed = JSON.parse(jsonText);
  assert.equal(parsed.website, undefined);
  assert.equal(parsed.page.href, undefined);
  assert.equal(parsed.page.urlIncluded, false);
  assert.equal(parsed.page.origin, "https://shop.example:8443");

  // Also check Proof Bridge payload & Markdown when handed a full URL with query/fragment
  const proofJson = JSON.stringify(
    buildProofSuggestionPayload(receipt.visibility.proofSuggestion, {
      origin: sensitiveUrl,
      title: "Account Reset"
    })
  );
  const proofMd = buildProofSuggestionMarkdown(receipt.visibility.proofSuggestion, {
    origin: sensitiveUrl,
    title: "Account Reset"
  });
  assert.equal(proofJson.includes("reset_secret_999"), false);
  assert.equal(proofJson.includes("bearer_jwt_555"), false);
  assert.equal(proofMd.includes("reset_secret_999"), false);
  assert.ok(proofJson.includes("https://shop.example:8443"));
});

test("#21 — escapes hostile Markdown metacharacters and newlines in page-controlled titles", () => {
  const hostileTitle =
    "x) ![beacon](https://tracker.example/p.gif?u=victim) [phish](https://evil.example) `code`\n# Injected Heading";

  const escaped = escapeMarkdownInline(hostileTitle);
  assert.equal(escaped.includes("\n"), false);
  // Ensure unescaped image/link sequences cannot survive
  assert.equal(/(?<!\\)!\[/.test(escaped), false);
  assert.equal(/(?<!\\)\]\(/.test(escaped), false);
  assert.equal(/(?<!\\)`/.test(escaped), false);

  const receipt = buildSurfaceReceiptModel({
    url: "https://news.example/article",
    title: hostileTitle,
    cookies: { available: true, total: 0, firstParty: 0, thirdParty: 0 },
    content: {
      available: true,
      storage: { localStorage: "Not Detected", sessionStorage: "Not Detected" },
      fingerprinting: {},
      csp: {},
      visibilityLayer: evaluateFieldsForVisibilityAndProof([{ name: "dob", type: "date" }]),
      screen: "1440 × 900",
      language: "de-DE",
      timezone: "Europe/Berlin",
      userAgent: "Mozilla/5.0"
    },
    network: { available: true, thirdPartyRequestCount: 0, domainCounts: {} },
    permissions: { available: true, geolocation: "Prompt", notifications: "Prompt", camera: "Prompt", microphone: "Prompt", clipboard: "Prompt" }
  });

  const receiptMd = serializeReceiptMarkdown(receipt);
  assert.equal(/(?<!\\)!\[beacon\]\(/.test(receiptMd), false);
  assert.equal(/(?<!\\)\[phish\]\(/.test(receiptMd), false);
  assert.equal(receiptMd.includes("\n# Injected Heading"), false);

  const proofMd = buildProofSuggestionMarkdown(receipt.visibility.proofSuggestion, {
    origin: "https://news.example",
    title: hostileTitle
  });
  assert.equal(/(?<!\\)!\[beacon\]\(/.test(proofMd), false);
  assert.equal(/(?<!\\)\[phish\]\(/.test(proofMd), false);
  assert.equal(proofMd.includes("\n# Injected Heading"), false);
});

test("#15 & #8 review — one domain receiving 20 requests exports uniqueThirdPartyDomainCount=1 and thirdPartyRequestCount=20", () => {
  const combined = combineNetworkSources(
    {
      available: true,
      thirdPartyRequestCount: 20,
      domainCounts: { "www.google-analytics.com": 20 }
    },
    {
      available: true,
      thirdPartyRequestCount: 4,
      domainCounts: { "www.google-analytics.com": 4 }
    }
  );

  const receipt = buildSurfaceReceiptModel({
    url: "https://merchant.example/checkout",
    title: "Merchant Checkout",
    cookies: { available: true, total: 2, firstParty: 2, thirdParty: 0 },
    content: {
      available: true,
      storage: { localStorage: "1 keys", sessionStorage: "Not Detected" },
      fingerprinting: { canvas: false, webgl: false, audio: false, webrtc: false, evalAttempt: false },
      csp: { hasMetaCsp: true, metaBlocksEval: true, evalBlockedCount: 0, totalViolationCount: 0, violatedDirectives: [] },
      visibilityLayer: { highestLayer: "None Detected", counts: { vulnerable: 0, grundversorgung: 0, welt: 0 }, findings: [], proofSuggestion: null },
      screen: "1920 × 1080",
      language: "en-GB",
      timezone: "UTC",
      userAgent: "Mozilla/5.0"
    },
    network: combined,
    permissions: { available: true, geolocation: "Prompt", notifications: "Prompt", camera: "Prompt", microphone: "Prompt", clipboard: "Prompt" }
  });

  assert.equal(receipt.network.uniqueThirdPartyDomainCount, 1);
  assert.equal(receipt.network.thirdPartyRequestCount, 20);
  assert.equal(receipt.network.knownTrackerDomainCount, 1);
  assert.equal(receipt.network.domains.length, 1);
  assert.equal(receipt.network.domains[0].domain, "www.google-analytics.com");
  assert.equal(receipt.network.domains[0].requestCount, 20);

  const md = serializeReceiptMarkdown(receipt);
  assert.ok(md.includes("1 unique domain(s), 20 total request(s), 1 matching local tracker rules"));
  assert.ok(md.includes("`www.google-analytics.com` — 20 request(s)"));
});

test("#15 — round-trip JSON & Markdown preserve all 5 evidence states, provider declarations, fingerprinting, permissions, and honest claim boundaries", () => {
  const vis = evaluateFieldsForVisibilityAndProof([
    { name: "birthdate", type: "date", value: "1990-01-01" }, // value must be ignored
    { name: "iban", type: "text", value: "DE89370400440532013000" }
  ]);

  const receipt = buildSurfaceReceiptModel({
    capturedAt: "2026-11-01T12:00:00.000Z",
    receiptId: "tsr_fixture_high",
    url: "https://liquor.example/verify",
    title: "Age Gate",
    cookies: { available: true, total: 3, firstParty: 2, thirdParty: 1 },
    content: {
      available: true,
      storage: { localStorage: "2 keys", sessionStorage: "1 keys" },
      fingerprinting: { canvas: true, webgl: true, audio: false, webrtc: false, evalAttempt: true },
      csp: { hasMetaCsp: true, metaBlocksEval: true, evalBlockedCount: 2, totalViolationCount: 2, violatedDirectives: ["script-src"] },
      visibilityLayer: vis,
      screen: "2560 × 1440",
      language: "de-DE",
      timezone: "Europe/Berlin",
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
    },
    network: {
      available: true,
      thirdPartyRequestCount: 5,
      domainCounts: {
        "doubleclick.net": 4,
        "cdn.liquor.example.net": 1
      }
    },
    permissions: {
      available: true,
      geolocation: "Granted",
      notifications: "Denied",
      camera: "Prompt",
      microphone: "Prompt",
      clipboard: "Unavailable" // triggers 1 unavailable permission entry
    },
    declarations: [
      {
        id: "provider.purpose.ads",
        summary: "The provider states in its privacy notice that pseudonymous telemetry may be used for advertising measurement.",
        sourceReference: "https://liquor.example/privacy?session=strip_me#section-4",
        retrievedAt: "2026-11-01T11:59:00.000Z"
      },
      {
        // Invalid declaration without sourceReference -> must be rejected fail-closed
        id: "invalid.unverified",
        summary: "Unverified rumor without source",
        retrievedAt: "2026-11-01T11:59:00.000Z"
      }
    ]
  });

  assert.equal(receipt.schema, RECEIPT_SCHEMA_V1);
  assert.equal(verifyReceiptIntegrity(receipt), true);

  // Round-trip JSON check
  const roundTrip = JSON.parse(serializeReceiptJson(receipt));
  assert.equal(verifyReceiptIntegrity(roundTrip), true);

  for (const state of EVIDENCE_STATES) {
    assert.ok(Array.isArray(roundTrip.report[state]), `Missing report.${state}`);
    assert.ok(roundTrip.report[state].length > 0, `Expected non-empty report.${state} in fixture`);
  }

  // Provider declaration checks
  assert.equal(roundTrip.report.declared.length, 1);
  assert.equal(roundTrip.report.declared[0].independentlyVerified, false);
  assert.equal(roundTrip.report.declared[0].sourceReference, "https://liquor.example/privacy");

  // Never leaks simulated typed values
  const serializedJson = serializeReceiptJson(receipt);
  const serializedMd = serializeReceiptMarkdown(receipt);
  assert.equal(serializedJson.includes("1990-01-01"), false);
  assert.equal(serializedJson.includes("DE89370400440532013000"), false);
  assert.equal(serializedMd.includes("1990-01-01"), false);
  assert.equal(serializedMd.includes("DE89370400440532013000"), false);

  // Never claims data was sold or proven illegal
  assert.equal(/data was sold|sells your data|illegal|gdpr violation/i.test(serializedJson), false);
  assert.equal(/data was sold|sells your data|illegal|gdpr violation/i.test(serializedMd), false);

  // Markdown preserves all 5 sections + fingerprinting + granted permission + potential + unknowns
  assert.ok(serializedMd.includes("### 1. Observed"));
  assert.ok(serializedMd.includes("### 2. Declared (Provider Notices)"));
  assert.ok(serializedMd.includes("### 3. Potential Access"));
  assert.ok(serializedMd.includes("### 4. Unknown (Outside Browser Collector Boundary)"));
  assert.ok(serializedMd.includes("### 5. Unavailable Checks"));
  assert.ok(serializedMd.includes("Canvas Readout"));
  assert.ok(serializedMd.includes("Geolocation permission state is Granted"));
  assert.ok(serializedMd.includes("independentlyVerified: `false`"));
});

test("#15 — empty scan states 'Not observed' (never 'does not happen'), and failed content script produces 'limited' scan with unavailable items", () => {
  const emptyComplete = buildSurfaceReceiptModel({
    url: "https://minimal.example/",
    title: "Minimal Page",
    cookies: { available: true, total: 0, firstParty: 0, thirdParty: 0 },
    content: {
      available: true,
      storage: { localStorage: "Not Detected", sessionStorage: "Not Detected" },
      fingerprinting: { canvas: false, webgl: false, audio: false, webrtc: false, evalAttempt: false },
      csp: { hasMetaCsp: false, metaBlocksEval: false, evalBlockedCount: 0, totalViolationCount: 0, violatedDirectives: [] },
      visibilityLayer: { highestLayer: "None Detected", counts: { vulnerable: 0, grundversorgung: 0, welt: 0 }, findings: [], proofSuggestion: null },
      screen: "1920 × 1080",
      language: "en-US",
      timezone: "UTC",
      userAgent: "Mozilla/5.0"
    },
    network: { available: true, thirdPartyRequestCount: 0, domainCounts: {} },
    permissions: { available: true, geolocation: "Denied", notifications: "Denied", camera: "Denied", microphone: "Denied", clipboard: "Denied" }
  });

  assert.equal(emptyComplete.collector.scanStatus, "complete");
  assert.equal(emptyComplete.report.observed.length, 0);
  const emptyMd = serializeReceiptMarkdown(emptyComplete);
  assert.ok(emptyMd.includes("Not observed during this scan (not observed ≠ absent)."));
  assert.equal(/does not happen|no tracking occurs|site is safe/i.test(emptyMd), false);

  // Content script unreachable -> limited scan, never clean!
  const limited = buildSurfaceReceiptModel({
    url: "https://restricted.example/",
    title: "Restricted Page",
    cookies: { available: true, total: 0, firstParty: 0, thirdParty: 0 },
    content: { available: false, reason: "content-script-unreachable" },
    network: { available: true, thirdPartyRequestCount: 0, domainCounts: {} },
    permissions: { available: true, geolocation: "Prompt", notifications: "Prompt", camera: "Prompt", microphone: "Prompt", clipboard: "Prompt" }
  });

  assert.equal(limited.collector.scanStatus, "limited");
  assert.ok(limited.surfaceScore.dimensions.observationCoverage.percent < 100);
  assert.equal(limited.surfaceScore.components.fingerprintingCalls, null);
  assert.equal(limited.visibility.available, false);
  assert.equal(limited.visibility.highestLayer, "Unavailable");
  assert.ok(limited.report.unavailable.some((u) => u.id === "collector.content-surfaces"));

  // Unsupported chrome:// page -> score is null, never 0
  const unsupported = buildSurfaceReceiptModel({
    url: "chrome://extensions/",
    title: "Extensions"
  });
  assert.equal(unsupported.collector.scanStatus, "unsupported");
  assert.equal(unsupported.surfaceScore.value, null);
  assert.equal(unsupported.surfaceScore.category, "Unavailable");
});
