import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import proofBridge from "../proof-bridge.js";
import surfaceReceipt from "../surface-receipt.js";
import validator from "../receipt-validator.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

test("#19 — Proof Suggestion schema file is valid JSON Schema Draft 2020-12 and matches v0.3 contract", () => {
  const schemaPath = path.join(rootDir, "schemas", "proof-suggestion.v0.3.schema.json");
  assert.ok(fs.existsSync(schemaPath), "schemas/proof-suggestion.v0.3.schema.json must exist");
  const schema = JSON.parse(fs.readFileSync(schemaPath, "utf8"));
  assert.equal(schema.$schema, "https://json-schema.org/draft/2020-12/schema");
  assert.equal(
    schema.properties.askmiProofSuggestion.properties.version.const,
    proofBridge.PROOF_BRIDGE_VERSION
  );
  assert.equal(
    schema.properties.askmiProofSuggestion.properties.contractVersion.const,
    proofBridge.CLAIM_CONTRACT_VERSION
  );
});

test("#19 — Version-pinned claim contract (1.0.0): high-confidence birthdate maps to age_over_18 and passes validateProofSuggestion", () => {
  const visibilityLayer = proofBridge.evaluateFieldsForVisibilityAndProof([
    {
      type: "date",
      name: "birthdate",
      id: "user_dob",
      autocomplete: "bday",
      placeholder: "",
      ariaLabel: "Date of Birth"
    }
  ]);
  assert.ok(visibilityLayer.proofSuggestion);
  assert.deepEqual(visibilityLayer.proofSuggestion.observedOverCollection, ["birthdate"]);
  assert.deepEqual(visibilityLayer.proofSuggestion.suggestedMinimalClaims, ["age_over_18"]);

  const payload = proofBridge.buildProofSuggestionPayload(
    visibilityLayer.proofSuggestion,
    {
      origin: "https://shop.example.co.uk/checkout?token=secret#frag",
      title: "Age Check"
    },
    { generatedAt: "2026-10-27T14:00:00.000Z" }
  );
  assert.ok(payload);
  assert.equal(payload.askmiProofSuggestion.version, "0.3.0");
  assert.equal(payload.askmiProofSuggestion.contractVersion, "1.0.0");
  assert.equal(payload.askmiProofSuggestion.page.origin, "https://shop.example.co.uk");

  const valRes = validator.validateProofSuggestion(payload);
  assert.equal(valRes.valid, true, valRes.errors.join("; "));
});

test("#19 — Proof Suggestion and Surface Receipt evolve independently and cross-reference claimContractVersion 1.0.0", () => {
  const visibilityLayer = proofBridge.evaluateFieldsForVisibilityAndProof([
    { name: "birthdate", type: "date", autocomplete: "bday" }
  ]);
  const receipt = surfaceReceipt.buildSurfaceReceiptModel({
    receiptId: "eco-test-0001",
    capturedAt: "2026-10-27T14:00:00.000Z",
    url: "https://shop.example.co.uk/checkout?secret=1",
    title: "Checkout",
    cookies: { available: true, total: 0, firstParty: 0, thirdParty: 0 },
    content: {
      available: true,
      storage: { localStorage: "Not Detected", sessionStorage: "Not Detected" },
      fingerprinting: { canvas: false, webgl: false, audio: false, webrtc: false, evalAttempt: false },
      csp: { hasMetaCsp: true, metaBlocksEval: true, evalBlockedCount: 0, totalViolationCount: 0, violatedDirectives: [] },
      visibilityLayer,
      screen: "1920 x 1080",
      language: "en-GB",
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
    }
  });

  const res = validator.validateSurfaceReceipt(receipt);
  assert.equal(res.valid, true, res.errors.join("; "));
  assert.equal(receipt.schema, "askmi.transparency.surface-receipt.v1");
  assert.equal(
    receipt.visibility.findings[0].possibleMinimisation.claimContractVersion,
    proofBridge.CLAIM_CONTRACT_VERSION
  );
  assert.deepEqual(receipt.visibility.findings[0].possibleMinimisation.suggestedClaims, ["age_over_18"]);
  assert.equal(receipt.visibility.findings[0].possibleMinimisation.advisoryOnly, true);
});

test("#19 — Fail-closed rejection of legacy v0.2 receipts and unsupported major schema versions", () => {
  const legacyV02 = {
    domain: "example.com",
    score: 20,
    scoreCategory: "Minimal Surface",
    cookies: { total: 1, firstParty: 1, thirdParty: 0 },
    threeLayerReport: {
      observed: ["1 cookie detected"],
      potential: ["IP visible"],
      unknown: ["Server retention"]
    }
  };
  const v02Res = validator.validateSurfaceReceipt(legacyV02);
  assert.equal(v02Res.valid, false);
  assert.ok(v02Res.errors.some((e) => e.includes("schema")));

  const allowedFixture = JSON.parse(
    fs.readFileSync(path.join(rootDir, "fixtures", "receipts", "allowed.json"), "utf8")
  );
  for (const badSchema of [
    "askmi.transparency.surface-receipt.v0",
    "askmi.transparency.surface-receipt.v2",
    "askmi.transparency.surface-receipt.v1.beta"
  ]) {
    const mutated = { ...allowedFixture, schema: badSchema };
    const res = validator.validateSurfaceReceipt(mutated);
    assert.equal(res.valid, false, `Expected ${badSchema} to fail validation`);
  }
});

test("#19 — Authority boundary: Proof Suggestions and Surface Receipts reject unpinned claims or authorization/decision fields", () => {
  const badSuggestion = {
    askmiProofSuggestion: {
      version: "0.3.0",
      contractVersion: "1.0.0",
      generatedAt: "2026-10-27T14:00:00.000Z",
      page: { origin: "https://shop.example.co.uk", title: "Shop" },
      observedOverCollection: ["birthdate"],
      suggestedMinimalClaims: ["credit_score_over_700"],
      rationale: "Unpinned claim",
      note: "Advisory"
    }
  };
  const badClaimRes = validator.validateProofSuggestion(badSuggestion);
  assert.equal(badClaimRes.valid, false);
  assert.ok(badClaimRes.errors.some((e) => e.includes("Unpinned suggestedMinimalClaim")));

  const authInjectedSuggestion = {
    askmiProofSuggestion: {
      version: "0.3.0",
      contractVersion: "1.0.0",
      generatedAt: "2026-10-27T14:00:00.000Z",
      page: { origin: "https://shop.example.co.uk", title: "Shop" },
      observedOverCollection: ["birthdate"],
      suggestedMinimalClaims: ["age_over_18"],
      rationale: "DOB",
      note: "Advisory",
      authorized: true
    }
  };
  const authRes = validator.validateProofSuggestion(authInjectedSuggestion);
  assert.equal(authRes.valid, false);
  assert.ok(authRes.errors.some((e) => e.includes("authorized")));
});
