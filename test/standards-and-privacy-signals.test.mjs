import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const REPO_ROOT = path.resolve(import.meta.dirname, "..");

const standards = require("../standards-mapping.js");
const { buildSurfaceReceiptModel } = require("../surface-receipt.js");
const { evaluateFieldsForVisibilityAndProof, buildLocalWalletDeepLink } = require("../proof-bridge.js");
const { validateSurfaceReceipt } = require("../receipt-validator.js");
const { installPageObserver } = require("../page-observer.js");
const { initContentCollector } = require("../content.js");

test("Apache-2.0 LICENSE and package.json license metadata exist and match ecosystem policy", () => {
  const licensePath = path.join(REPO_ROOT, "LICENSE");
  const pkgPath = path.join(REPO_ROOT, "package.json");
  assert.ok(fs.existsSync(licensePath), "Root LICENSE file must exist");
  assert.ok(fs.existsSync(pkgPath), "Root package.json file must exist");

  const licenseText = fs.readFileSync(licensePath, "utf8");
  assert.ok(licenseText.includes("Apache License"));
  assert.ok(licenseText.includes("Version 2.0, January 2004"));

  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
  assert.equal(pkg.license, "Apache-2.0");
});

test("W3C DPV (Community Group Report) and ISO/IEC TS 27560:2023 mapping accurately classifies fields and third-party purposes without normative standard overclaims", () => {
  assert.equal(standards.DPV_SPEC_METADATA.status, "w3c-community-group-report");
  assert.equal(standards.DPV_SPEC_METADATA.normativeW3cStandard, false);
  assert.equal(standards.ISO_27560_METADATA.specification, "ISO/IEC TS 27560:2023");
  assert.equal(standards.GPC_SPEC_METADATA.legallyBindingByItself, false);

  const dobDpv = standards.mapFieldKeyToDpv("dob");
  assert.equal(dobDpv.dpvDataCategory, "dpv:BirthDate");
  assert.equal(dobDpv.dpvDataMinimisationAlternative, "age_over_18");

  const healthDpv = standards.mapFieldKeyToDpv("health");
  assert.equal(healthDpv.dpvDataCategory, "dpv:HealthData");
  assert.equal(healthDpv.dpvSensitivity, "dpv:SensitivePersonalData");

  const financialDpv = standards.mapFieldKeyToDpv("financial");
  assert.equal(financialDpv.dpvDataCategory, "dpv:FinancialAccount");

  const receipt = buildSurfaceReceiptModel({
    url: "https://portal.example.de/register",
    title: "Registrierung",
    cookies: { available: true, total: 1, firstParty: 1, thirdParty: 0 },
    content: {
      available: true,
      storage: { localStorage: "Not Detected", sessionStorage: "Not Detected" },
      fingerprinting: { canvas: false, webgl: false, audio: false, webrtc: false, evalAttempt: false },
      csp: { hasMetaCsp: true, metaBlocksEval: true, evalBlockedCount: 0, totalViolationCount: 0, violatedDirectives: [] },
      visibilityLayer: evaluateFieldsForVisibilityAndProof([
        { name: "birthdate", type: "date", autocomplete: "bday" },
        { name: "health_insurance_diagnosis", type: "text" }
      ]),
      privacySignals: {
        gpcEnabled: true,
        doNotTrack: false,
        digitalCredentialsApiAvailable: true,
        digitalCredentialsCallObserved: true
      },
      screen: "1920 x 1080",
      language: "de-DE",
      timezone: "Europe/Berlin",
      userAgent: "Mozilla/5.0"
    },
    network: {
      available: true,
      thirdPartyRequestCount: 2,
      domainCounts: { "www.google-analytics.com": 2 }
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

  const valRes = validateSurfaceReceipt(receipt);
  assert.equal(valRes.valid, true, valRes.errors.join("; "));

  assert.deepEqual(receipt.visibility.standards.dpv.observedFieldDataCategories, [
    "dpv:BirthDate",
    "dpv:HealthData"
  ]);
  assert.deepEqual(receipt.visibility.standards.dpv.unverifiedThirdPartyPurposes, [
    "dpv:ServiceOptimization"
  ]);
  assert.equal(receipt.visibility.standards.dpv.normativeW3cStandard, false);
  assert.equal(receipt.visibility.standards.gpc.navigatorGlobalPrivacyControl, true);
  assert.equal(receipt.visibility.standards.gpc.legallyBindingByItself, false);
  assert.equal(receipt.visibility.standards.digitalCredentialsApi.invocationObserved, true);

  assert.ok(receipt.report.observed.some((o) => o.id === "privacy.gpc.enabled"));
  assert.ok(receipt.report.observed.some((o) => o.id === "credentials.digital-credentials-api.call"));
});

test("ToS;DR CC BY-SA 3.0 declaration adapter normalizes service points into report.declared with attribution and independentlyVerified: false", () => {
  const receipt = buildSurfaceReceiptModel({
    url: "https://service.example.com/",
    title: "Example Service",
    cookies: { available: true, total: 0, firstParty: 0, thirdParty: 0 },
    content: {
      available: true,
      storage: { localStorage: "Not Detected", sessionStorage: "Not Detected" },
      fingerprinting: { canvas: false, webgl: false, audio: false, webrtc: false, evalAttempt: false },
      csp: { hasMetaCsp: true, metaBlocksEval: true, evalBlockedCount: 0, totalViolationCount: 0, violatedDirectives: [] },
      visibilityLayer: { highestLayer: "None Detected", counts: { vulnerable: 0, grundversorgung: 0, welt: 0 }, findings: [], proofSuggestion: null },
      screen: "1920 x 1080",
      language: "en-US",
      timezone: "UTC",
      userAgent: "Mozilla/5.0"
    },
    network: { available: true, thirdPartyRequestCount: 0, domainCounts: {} },
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
        tosdr: true,
        id: "tosdr_1042",
        service: "ExampleService",
        title: "This service states it may use third-party analytics cookies",
        sourceUrl: "https://tosdr.org/en/service/1042?ref=strip#section",
        retrievedAt: "2026-11-04T10:00:00.000Z"
      }
    ]
  });

  assert.equal(validateSurfaceReceipt(receipt).valid, true);
  assert.equal(receipt.report.declared.length, 1);
  const decl = receipt.report.declared[0];
  assert.equal(decl.id, "declared.tosdr.tosdr_1042");
  assert.ok(decl.summary.includes("[ExampleService / ToS;DR CC BY-SA 3.0]"));
  assert.equal(decl.sourceReference, "https://tosdr.org/en/service/1042");
  assert.equal(decl.independentlyVerified, false);
  assert.ok(decl.scopeLimitation.includes("CC BY-SA 3.0"));
});

test("MAIN-world observer hooks W3C Digital Credentials API and same-origin iframe contentWindow realms", async () => {
  const notified = [];

  function ChildCanvas() {}
  ChildCanvas.prototype.toDataURL = function toDataURL() {
    return "data:image/png;base64,CHILD";
  };

  const childWin = {
    Function,
    HTMLCanvasElement: ChildCanvas
  };

  function MockIFrame() {}
  Object.defineProperty(MockIFrame.prototype, "contentWindow", {
    get() {
      return childWin;
    },
    configurable: true,
    enumerable: true
  });

  function CredsContainer() {}
  CredsContainer.prototype.get = async function get(options) {
    return { type: "digital-credential", options };
  };

  const win = {
    Function,
    HTMLIFrameElement: MockIFrame,
    CredentialsContainer: CredsContainer,
    navigator: {
      globalPrivacyControl: true,
      doNotTrack: "1",
      credentials: new CredsContainer()
    }
  };

  installPageObserver(win, {
    onNotify(surface) {
      notified.push(surface);
    }
  });

  // 1. Accessing iframe.contentWindow hooks the child realm's HTMLCanvasElement.prototype.toDataURL
  const iframe = new win.HTMLIFrameElement();
  const cw = iframe.contentWindow;
  const childCanvas = new cw.HTMLCanvasElement();
  assert.equal(childCanvas.toDataURL(), "data:image/png;base64,CHILD");
  assert.ok(notified.includes("canvas"), "Child iframe Canvas call must be observed");

  // 2. Calling navigator.credentials.get({ password: true }) does NOT trigger digitalCredentials
  await win.navigator.credentials.get({ password: true });
  assert.equal(notified.includes("digitalCredentials"), false);

  // 3. Calling navigator.credentials.get({ digital: { providers: [...] } }) triggers digitalCredentials
  await win.navigator.credentials.get({ digital: { providers: [{ protocol: "openid4vp" }] } });
  assert.ok(notified.includes("digitalCredentials"), "Digital Credentials API call must be observed");
});

test("buildLocalWalletDeepLink supports URL hash fragment mode (#askmi_proof_suggestion=1) to avoid HTTP query logs", () => {
  const vis = evaluateFieldsForVisibilityAndProof([
    { name: "birthdate", type: "date", autocomplete: "bday" }
  ]);
  const hashLink = buildLocalWalletDeepLink(vis.proofSuggestion, {
    enabled: true,
    useHashFragment: true
  });
  assert.ok(hashLink);
  const parsed = new URL(hashLink);
  assert.equal(parsed.search, "", "Query string must be empty in hash-fragment mode");
  assert.ok(parsed.hash.includes("demo=wallet"));
  assert.ok(parsed.hash.includes("suggest=age_over_18"));
});
