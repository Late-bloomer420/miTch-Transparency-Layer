import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { compareSnapshots, createTimelineStore } = require("../comparison-store.js");
const { buildSurfaceReceiptModel } = require("../surface-receipt.js");

function buildSampleReceipt({
  cookiesTotal = 1,
  thirdPartyReqs = 0,
  domains = {},
  fpCanvas = false,
  fields = [],
  scanStatus
} = {}) {
  return buildSurfaceReceiptModel({
    url: "https://service.example/page?secret=never_store_me",
    title: "Service Page",
    scanStatus,
    cookies:
      cookiesTotal === null
        ? { available: false }
        : { available: true, total: cookiesTotal, firstParty: cookiesTotal, thirdParty: 0 },
    content: {
      available: true,
      storage: { localStorage: "1 keys", sessionStorage: "Not Detected" },
      fingerprinting: { canvas: fpCanvas, webgl: false, audio: false, webrtc: false, evalAttempt: false },
      csp: { hasMetaCsp: false, metaBlocksEval: false, evalBlockedCount: 0, totalViolationCount: 0, violatedDirectives: [] },
      visibilityLayer: {
        highestLayer: fields.length > 0 ? "GRUNDVERSORGUNG (Medium)" : "None Detected",
        counts: { vulnerable: 0, grundversorgung: fields.length, welt: 0 },
        findings: fields.map((k) => ({ key: k, label: k, layer: "GRUNDVERSORGUNG (Medium)", hint: "Field" })),
        proofSuggestion: null
      },
      screen: "1920 × 1080",
      language: "en-US",
      timezone: "UTC",
      userAgent: "Mozilla/5.0"
    },
    network: {
      available: true,
      thirdPartyRequestCount: thirdPartyReqs,
      domainCounts: domains
    },
    permissions: {
      available: true,
      geolocation: "Denied",
      notifications: "Denied",
      camera: "Denied",
      microphone: "Denied",
      clipboard: "Denied"
    }
  });
}

test("#16 — local session timeline is OFF by default, stores only sanitized snapshots when opted in, and supports 1-click deletion", () => {
  const store = createTimelineStore();
  assert.equal(store.isOptInEnabled(), false);

  const r1 = buildSampleReceipt({ cookiesTotal: 2 });
  const blocked = store.recordSnapshot(r1, { scenario: "cookie-consent", stage: "before" });
  assert.equal(blocked.stored, false);
  assert.equal(blocked.reason, "opt-in-disabled");
  assert.equal(store.getSnapshots().length, 0);

  store.setOptInEnabled(true);
  assert.equal(store.isOptInEnabled(), true);

  const saved = store.recordSnapshot(r1, { scenario: "cookie-consent", stage: "before" });
  assert.equal(saved.stored, true);
  assert.equal(store.getSnapshots().length, 1);

  const exported = store.exportTimelineJson();
  assert.equal(exported.includes("never_store_me"), false, "Timeline must never store URL query secrets");
  const parsed = JSON.parse(exported);
  assert.equal(parsed.snapshots[0].urlIncluded, false);

  store.clearTimeline();
  assert.equal(store.getSnapshots().length, 0);
});

test("#16 — compareSnapshots computes accurate before/after deltas for cookie-consent, login-state, and page-change without collapsing unavailable to 0", () => {
  const beforeConsent = buildSampleReceipt({
    cookiesTotal: 1,
    thirdPartyReqs: 0,
    domains: {},
    fpCanvas: false,
    fields: []
  });
  const afterConsent = buildSampleReceipt({
    cookiesTotal: 8,
    thirdPartyReqs: 6,
    domains: { "doubleclick.net": 4, "google-analytics.com": 2 },
    fpCanvas: true,
    fields: ["birthdate"]
  });

  const diffEn = compareSnapshots(beforeConsent, afterConsent, {
    scenario: "cookie-consent",
    locale: "en"
  });
  assert.equal(diffEn.scenario, "cookie-consent");
  assert.equal(diffEn.cookiesDelta.delta, 7);
  assert.equal(diffEn.thirdPartyRequestsDelta.delta, 6);
  assert.equal(diffEn.trackerDomainsDelta.delta, 2);
  assert.deepEqual(diffEn.uniqueDomainsDelta.addedDomains, ["doubleclick.net", "google-analytics.com"]);
  assert.deepEqual(diffEn.addedFingerprinting, ["canvas"]);
  assert.deepEqual(diffEn.addedFormFields, ["birthdate"]);
  assert.ok(diffEn.summaryLines.some((l) => l.includes("Cookies: 1 → 8 (+7)")));

  const afterUnavail = buildSampleReceipt({ cookiesTotal: null, thirdPartyReqs: 6 });
  const diffDe = compareSnapshots(afterConsent, afterUnavail, {
    scenario: "login-state",
    locale: "de"
  });
  assert.equal(diffDe.cookiesDelta.status, "unavailable");
  assert.equal(diffDe.cookiesDelta.delta, null);
  assert.ok(diffDe.summaryLines.some((l) => l.includes("nicht verfügbar")));
});
