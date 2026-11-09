import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import {
  REPO_ROOT,
  verifyReleaseArtifacts,
  parseZipEntries
} from "../scripts/build-release.mjs";

const require = createRequire(import.meta.url);
const {
  SCORING_RULE_VERSION,
  RULE_SET_VERSION,
  buildSurfaceReceiptModel,
  serializeReceiptJson,
  serializeReceiptMarkdown
} = require("../surface-receipt.js");
const { computeBadgeState } = require("../background.js");
const { deriveScanBannerModel, deriveScoreViewModel } = require("../popup.js");

function makeCompleteInput(overrides = {}) {
  return {
    url: "https://portal.example/dashboard",
    title: "Customer Portal",
    observationWindowMs: 4200,
    cookies: { available: true, total: 4, firstParty: 3, thirdParty: 1 },
    content: {
      available: true,
      storage: { localStorage: "2 keys", sessionStorage: "1 keys" },
      fingerprinting: {
        canvas: true,
        webgl: true,
        audio: false,
        webrtc: false,
        evalAttempt: false
      },
      csp: {
        hasMetaCsp: true,
        metaBlocksEval: true,
        evalBlockedCount: 0,
        totalViolationCount: 0,
        violatedDirectives: []
      },
      visibilityLayer: {
        highestLayer: "GRUNDVERSORGUNG (Medium)",
        counts: { vulnerable: 0, grundversorgung: 1, welt: 0 },
        findings: [
          {
            key: "birthdate",
            label: "Date of Birth",
            layer: "GRUNDVERSORGUNG (Medium)",
            hint: "Form field requests date-of-birth metadata.",
            suggestedMinimalClaims: ["age_over_18"],
            observedOverCollection: ["birthdate"]
          }
        ],
        proofSuggestion: null
      },
      screen: "1920 × 1080",
      language: "en-US",
      timezone: "Europe/Berlin",
      userAgent: "Mozilla/5.0 Test"
    },
    network: {
      available: true,
      thirdPartyRequestCount: 3,
      domainCounts: {
        "www.google-analytics.com": 2,
        "cdn.portal.example.net": 1
      }
    },
    permissions: {
      available: true,
      geolocation: "Granted",
      notifications: "Denied",
      camera: "Prompt",
      microphone: "Denied",
      clipboard: "Prompt"
    },
    ...overrides
  };
}

test("#14 — failed content-script scan cannot render as 'clean' in receipt, popup UI, or extension badge", () => {
  const receipt = buildSurfaceReceiptModel({
    url: "https://bank.example/login",
    title: "Login",
    cookies: { available: true, total: 0, firstParty: 0, thirdParty: 0 },
    content: { available: false, reason: "content-script-unreachable" },
    network: { available: true, thirdPartyRequestCount: 0, domainCounts: {} },
    permissions: {
      available: true,
      geolocation: "Denied",
      notifications: "Denied",
      camera: "Denied",
      microphone: "Denied",
      clipboard: "Denied"
    }
  });

  assert.equal(receipt.collector.scanStatus, "limited");
  assert.ok(receipt.collector.limitations.length > 0);
  assert.equal(receipt.surfaceScore.value, null);
  assert.equal(receipt.surfaceScore.observedMinimum, 0);
  assert.ok(receipt.surfaceScore.unverifiedMaximum >= 30);
  assert.equal(/clean|minimal observed surface|safe/i.test(receipt.surfaceScore.category), false);

  const banner = deriveScanBannerModel(receipt);
  assert.equal(banner.hidden, false);
  assert.ok(banner.text.includes("Limited Scan"));

  const vm = deriveScoreViewModel(receipt);
  assert.notEqual(vm.scoreValue, "0");
  assert.equal(vm.scoreValue, `0–${receipt.surfaceScore.unverifiedMaximum}`);
  assert.equal(vm.ringStroke, "var(--warning)");

  // Service worker badge check when content script has not pushed surfaces
  const badgeNoTraffic = computeBadgeState({
    hasContentPush: false,
    thirdPartyCount: 0,
    domainCounts: new Map()
  });
  assert.equal(badgeNoTraffic.text, "");
  assert.notEqual(badgeNoTraffic.color, "#46d9b5");

  const badgeWithTraffic = computeBadgeState({
    hasContentPush: false,
    thirdPartyCount: 2,
    domainCounts: new Map([["analytics.example", 2]])
  });
  assert.equal(badgeWithTraffic.text, "?");
  assert.equal(badgeWithTraffic.color, "#f1c65b");
});

test("#14 — standalone preview is visibly distinct from a live extension observation", () => {
  const previewReceipt = buildSurfaceReceiptModel(
    makeCompleteInput({
      mode: "preview",
      scanStatus: "preview",
      title: "Standalone Preview (Local Tab)",
      observationWindowMs: 0
    })
  );

  assert.equal(previewReceipt.collector.mode, "preview");
  assert.equal(previewReceipt.collector.scanStatus, "preview");
  assert.equal(previewReceipt.surfaceScore.value, null);
  assert.equal(previewReceipt.surfaceScore.dimensions.evidenceQuality.summary, "preview-mock-data");
  assert.ok(
    previewReceipt.collector.limitations.some((l) => /Standalone preview mode/i.test(l))
  );

  const banner = deriveScanBannerModel(previewReceipt);
  assert.equal(banner.hidden, false);
  assert.ok(banner.cls.includes("banner-preview"));
  assert.ok(banner.text.includes("Standalone Preview Mode"));

  const vm = deriveScoreViewModel(previewReceipt);
  assert.equal(vm.scoreValue, "Preview");
  assert.equal(vm.scoreScale, "");
  assert.equal(vm.scoreExposure, "Preview Only");

  const md = serializeReceiptMarkdown(previewReceipt);
  assert.ok(md.includes("Preview Only"));
  assert.ok(md.includes("not a live extension scan"));
});

test("#14 — missing evidence NEVER improves Surface Score across all channel failure combinations", () => {
  const baseline = buildSurfaceReceiptModel(makeCompleteInput());
  assert.equal(baseline.collector.scanStatus, "complete");
  assert.equal(typeof baseline.surfaceScore.value, "number");
  const fullScore = baseline.surfaceScore.value;
  assert.ok(fullScore > 40, `Expected non-trivial baseline score, got ${fullScore}`);
  assert.equal(baseline.surfaceScore.observedMinimum, fullScore);
  assert.equal(baseline.surfaceScore.unverifiedMaximum, fullScore);

  const toggles = ["cookies", "network", "content", "allPerms", "singlePerm"];
  // Iterate through every non-empty failure mask (1..31)
  for (let mask = 1; mask < 1 << toggles.length; mask += 1) {
    const dropCookies = Boolean(mask & 1);
    const dropNetwork = Boolean(mask & 2);
    const dropContent = Boolean(mask & 4);
    const dropAllPerms = Boolean(mask & 8);
    const dropSinglePerm = Boolean(mask & 16);

    const baseInput = makeCompleteInput();
    if (dropCookies) baseInput.cookies = { available: false, reason: "cookies-unavailable" };
    if (dropNetwork) baseInput.network = { available: false, reason: "network-unavailable" };
    if (dropContent) baseInput.content = { available: false, reason: "content-unreachable" };
    if (dropAllPerms) {
      baseInput.permissions = { available: false };
    } else if (dropSinglePerm) {
      baseInput.permissions.geolocation = "Unavailable";
    }

    const degraded = buildSurfaceReceiptModel(baseInput);

    // Must never remain "complete" when any channel/permission failed
    assert.notEqual(
      degraded.collector.scanStatus,
      "complete",
      `Mask ${mask} unexpectedly stayed complete`
    );

    // Must never emit a lower numeric single score than fullScore
    assert.equal(
      degraded.surfaceScore.value,
      null,
      `Mask ${mask} emitted numeric value ${degraded.surfaceScore.value} despite missing evidence`
    );

    if (degraded.collector.scanStatus === "limited") {
      assert.ok(
        degraded.surfaceScore.unverifiedMaximum >= fullScore,
        `Mask ${mask} improved unverifiedMaximum (${degraded.surfaceScore.unverifiedMaximum} < ${fullScore})`
      );
      assert.ok(
        degraded.surfaceScore.observedMinimum <= degraded.surfaceScore.unverifiedMaximum
      );
    }
  }
});

test("#14 — three dimensions, component breakdown, rule versions, and prohibited claim boundaries hold across all score levels", () => {
  const prohibitedPattern =
    /\b(data was collected|data is collected|data was sold|sells your data|data was shared with|site is safe|guaranteed safe|gdpr compliant|legally compliant|certified|audit-ready|production-ready|fraudulent)\b/i;

  const scenarios = [
    // Score 0 (minimal)
    makeCompleteInput({
      cookies: { available: true, total: 0, firstParty: 0, thirdParty: 0 },
      network: { available: true, thirdPartyRequestCount: 0, domainCounts: {} },
      content: {
        ...makeCompleteInput().content,
        fingerprinting: { canvas: false, webgl: false, audio: false, webrtc: false, evalAttempt: false },
        visibilityLayer: { highestLayer: "None Detected", counts: { vulnerable: 0, grundversorgung: 0, welt: 0 }, findings: [], proofSuggestion: null }
      },
      permissions: { available: true, geolocation: "Denied", notifications: "Denied", camera: "Denied", microphone: "Denied", clipboard: "Denied" }
    }),
    // Moderate score
    makeCompleteInput(),
    // Maximum score (100)
    makeCompleteInput({
      cookies: { available: true, total: 25, firstParty: 10, thirdParty: 15 },
      network: {
        available: true,
        thirdPartyRequestCount: 15,
        domainCounts: { "doubleclick.net": 8, "google-analytics.com": 7 }
      },
      content: {
        ...makeCompleteInput().content,
        fingerprinting: { canvas: true, webgl: true, audio: true, webrtc: true, evalAttempt: true }
      },
      permissions: { available: true, geolocation: "Granted", notifications: "Granted", camera: "Granted", microphone: "Prompt", clipboard: "Prompt" }
    })
  ];

  for (const input of scenarios) {
    const receipt = buildSurfaceReceiptModel(input);
    const dims = receipt.surfaceScore.dimensions;

    assert.equal(receipt.surfaceScore.scoringRuleVersion, SCORING_RULE_VERSION);
    assert.equal(receipt.surfaceScore.ruleSetVersion, RULE_SET_VERSION);
    assert.ok(dims.observationCoverage);
    assert.ok(dims.technicalExposure);
    assert.ok(dims.evidenceQuality);
    assert.equal(dims.observationCoverage.percent, 100);
    assert.equal(typeof dims.technicalExposure.value, "number");
    assert.equal(typeof dims.evidenceQuality.directObservedCount, "number");

    const jsonText = serializeReceiptJson(receipt);
    const mdText = serializeReceiptMarkdown(receipt);
    assert.ok(mdText.includes(SCORING_RULE_VERSION));
    assert.ok(mdText.includes(RULE_SET_VERSION));
    assert.ok(mdText.includes("Observation Coverage:"));
    assert.ok(mdText.includes("Technical Exposure:"));
    assert.ok(mdText.includes("Evidence Quality:"));
    assert.ok(mdText.includes("Score Components:"));
    assert.equal(prohibitedPattern.test(jsonText), false, `Prohibited claim found in JSON: ${jsonText}`);
    assert.equal(prohibitedPattern.test(mdText), false, `Prohibited claim found in Markdown: ${mdText}`);
  }
});

test("#14 — release artifact matches v0.3.0 source tree, build-meta revision, and privacy policy parity", () => {
  const verified = verifyReleaseArtifacts(REPO_ROOT);
  assert.equal(verified.collectorVersion, "0.3.0");
  assert.match(verified.sourceRevision, /^v0\.3\.0\+tree\.[0-9a-f]{12}$/);

  // Stale v0.1 zip must not exist
  assert.equal(
    fs.existsSync(path.join(REPO_ROOT, "release", "mitch-transparency-layer-v0.1.zip")),
    false
  );

  // Verify build-meta.js wires revision into receipts when loaded on globalThis
  const buildMeta = require("../build-meta.js");
  assert.equal(buildMeta.collectorVersion, "0.3.0");
  assert.equal(buildMeta.sourceRevision, verified.sourceRevision);

  const prevMeta = globalThis.MITCH_BUILD_META;
  try {
    globalThis.MITCH_BUILD_META = buildMeta;
    const receipt = buildSurfaceReceiptModel(makeCompleteInput());
    assert.equal(receipt.collector.revision, verified.sourceRevision);
  } finally {
    globalThis.MITCH_BUILD_META = prevMeta;
  }

  // Parse zip entries and verify manifest.json inside archive matches 0.3.0
  const entries = parseZipEntries(verified.zipBuffer);
  const manifestEntry = entries.find((e) => e.path === "manifest.json");
  assert.ok(manifestEntry, "manifest.json missing from release zip");
  const archivedManifest = JSON.parse(manifestEntry.data.toString("utf8"));
  assert.equal(archivedManifest.version, "0.3.0");

  const metaEntry = entries.find((e) => e.path === "build-meta.js");
  assert.ok(metaEntry, "build-meta.js missing from release zip");
});
