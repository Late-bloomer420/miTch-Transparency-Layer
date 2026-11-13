import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const REPO_ROOT = path.resolve(import.meta.dirname, "..");

const standards = require("../standards-mapping.js");
const { buildSurfaceReceiptModel } = require("../surface-receipt.js");
const { evaluateFieldsForVisibilityAndProof } = require("../proof-bridge.js");
const { validateSurfaceReceipt } = require("../receipt-validator.js");
const { installPageObserver } = require("../page-observer.js");

test("Blind Provider & Convener posture is embedded in standards summary and enforces structural blindness invariants", () => {
  const posture = standards.BLIND_CONVENER_POSTURE;
  assert.equal(posture.role, "blind-provider-and-convener");
  assert.ok(posture.principle.includes("Rule over Authority"));
  assert.equal(posture.tdddgNeutralityModel.economicSelfInterestInConsentOrData, false);
  assert.equal(posture.tdddgNeutralityModel.formalBfdiRecognitionClaimed, false);
  assert.deepEqual(posture.structuralBlindness, {
    formValuesRead: false,
    cookieAndStorageValuesRead: false,
    urlQueryAndFragmentExported: false,
    remoteNetworkEgressAllowed: false,
    centralDatabaseOrProfiling: false,
    walletHandoffTransport: "url-hash-fragment"
  });
});

test("AQDR Art. 9 signal-vs-behavior contradiction detector flags GPC vs tracker contact, high-entropy probes, and raw BirthDate over-collection", () => {
  const receipt = buildSurfaceReceiptModel({
    url: "https://youtube.com/watch?v=secret123",
    title: "Video Page",
    useOfflineTosdr: true,
    cookies: { available: true, total: 2, firstParty: 1, thirdParty: 1 },
    content: {
      available: true,
      storage: { localStorage: "2 keys", sessionStorage: "Not Detected" },
      fingerprinting: { canvas: true, webgl: true, audio: false, webrtc: false, evalAttempt: false },
      csp: { hasMetaCsp: true, metaBlocksEval: true, evalBlockedCount: 0, totalViolationCount: 0, violatedDirectives: [] },
      visibilityLayer: evaluateFieldsForVisibilityAndProof([
        { name: "birthdate", type: "date", autocomplete: "bday" }
      ]),
      privacySignals: {
        gpcEnabled: true,
        doNotTrack: true,
        digitalCredentialsApiAvailable: true,
        digitalCredentialsCallObserved: false,
        highEntropyClientHintsObserved: true,
        storageEstimateObserved: true
      },
      screen: "1920 x 1080",
      language: "de-DE",
      timezone: "Europe/Berlin",
      userAgent: "Mozilla/5.0"
    },
    network: {
      available: true,
      thirdPartyRequestCount: 3,
      domainCounts: {
        "www.google-analytics.com": 2,
        "doubleclick.net": 1
      }
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

  const val = validateSurfaceReceipt(receipt);
  assert.equal(val.valid, true, val.errors.join("; "));

  // 1. Offline ToS;DR catalog automatically attached YouTube CC BY-SA 3.0 declaration
  assert.equal(receipt.report.declared.length, 1);
  assert.equal(receipt.report.declared[0].id, "declared.tosdr.youtube_274");
  assert.equal(receipt.report.declared[0].independentlyVerified, false);

  // 2. Modern high-entropy probes & AQDR GPC contradiction recorded in report.observed
  assert.ok(receipt.report.observed.some((o) => o.id === "fingerprinting.client-hints-high-entropy.call"));
  assert.ok(receipt.report.observed.some((o) => o.id === "fingerprinting.storage-quota-estimate.call"));
  assert.ok(receipt.report.observed.some((o) => o.id === "aqdr.gpc.tracker-contact-discrepancy"));

  // 3. AQDR contradictions populated in receipt.visibility.standards.aqdrContradictions
  const aqdr = receipt.visibility.standards.aqdrContradictions;
  assert.equal(aqdr.length, 3);
  assert.ok(aqdr.some((c) => c.id === "aqdr.gpc-vs-tracker-contact"));
  assert.ok(aqdr.some((c) => c.id === "aqdr.high-entropy-surface-probing"));
  assert.ok(aqdr.some((c) => c.id === "aqdr.raw-birthdate-vs-predicate"));
});

test("MAIN-world observer hooks NavigatorUAData.getHighEntropyValues and StorageManager.estimate while preserving Function.prototype.toString", async () => {
  const notified = [];

  function UAData() {}
  UAData.prototype.getHighEntropyValues = async function getHighEntropyValues(hints) {
    return { platform: "Windows", hints };
  };

  function StorageMgr() {}
  StorageMgr.prototype.estimate = async function estimate() {
    return { quota: 1000000, usage: 0 };
  };

  const origUaToString = UAData.prototype.getHighEntropyValues.toString();
  const origStorageToString = StorageMgr.prototype.estimate.toString();

  const win = {
    Function,
    NavigatorUAData: UAData,
    StorageManager: StorageMgr,
    navigator: {
      userAgentData: new UAData(),
      storage: new StorageMgr()
    }
  };

  installPageObserver(win, {
    onNotify(surface) {
      notified.push(surface);
    }
  });

  await win.navigator.userAgentData.getHighEntropyValues(["architecture", "model"]);
  await win.navigator.storage.estimate();

  assert.ok(notified.includes("clientHints"), "getHighEntropyValues must notify clientHints");
  assert.ok(notified.includes("storageQuota"), "storage.estimate must notify storageQuota");
  assert.equal(win.navigator.userAgentData.getHighEntropyValues.toString(), origUaToString);
  assert.equal(win.navigator.storage.estimate.toString(), origStorageToString);
});

test("Offline rulepack rules/known-surfaces.v1.json and CLI analyze-html & inspect commands work end-to-end", () => {
  const rulepackPath = path.join(REPO_ROOT, "rules", "known-surfaces.v1.json");
  assert.ok(fs.existsSync(rulepackPath), "rules/known-surfaces.v1.json must exist");
  const rulepack = JSON.parse(fs.readFileSync(rulepackPath, "utf8"));
  assert.equal(rulepack.schema, "askmi.transparency.known-surfaces.v1");
  assert.ok(Array.isArray(rulepack.trackerCategories) && rulepack.trackerCategories.length >= 8);

  const cliPath = path.join(REPO_ROOT, "cli", "mitch-scan.mjs");
  const inspectOut = execFileSync(
    process.execPath,
    [cliPath, "inspect", path.join(REPO_ROOT, "fixtures", "receipts", "allowed.json")],
    { encoding: "utf8" }
  );
  assert.ok(inspectOut.includes("# miTch Transparency Layer — Surface Receipt (v1)"));
});
