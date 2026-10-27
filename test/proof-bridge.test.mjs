import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  CLAIM_CONTRACT_VERSION,
  CANONICAL_CLAIMS,
  classifyFieldDescriptor,
  evaluateFieldsForVisibilityAndProof,
  buildProofSuggestionPayload,
  buildProofSuggestionMarkdown,
  isAllowedLocalWalletOrigin,
  buildLocalWalletDeepLink
} = require("../proof-bridge.js");

test("Item 6 — pins canonical contractVersion 1.0.0 and EUDI claim names", () => {
  assert.equal(CLAIM_CONTRACT_VERSION, "1.0.0");
  assert.deepEqual(CANONICAL_CLAIMS, ["birthdate", "age_over_18"]);
});

test("Item 6 — maps DOB-like fields onto canonical age_over_18 minimal claim and never suggests birthdate", () => {
  const dobVariants = [
    { name: "birthdate", type: "date" },
    { id: "user_dob", type: "text" },
    { autocomplete: "bday", type: "text" },
    { placeholder: "Geburtsdatum (TT.MM.JJJJ)", type: "text" },
    { ariaLabel: "Date of birth", type: "date" }
  ];

  for (const field of dobVariants) {
    const finding = classifyFieldDescriptor(field);
    assert.ok(finding, `Expected finding for ${JSON.stringify(field)}`);
    assert.deepEqual(finding.observedOverCollection, ["birthdate"]);
    assert.deepEqual(finding.suggestedMinimalClaims, ["age_over_18"]);
    assert.equal(finding.suggestedMinimalClaims.includes("birthdate"), false);
  }
});

test("Item 6 — fail-closed: generic date, health, financial, password, and contact fields emit no suggestedMinimalClaims", () => {
  const nonMappedFields = [
    { name: "appointment_date", type: "date" },
    { name: "delivery_date", type: "date" },
    { name: "iban", type: "text" },
    { name: "blood_group", type: "text" },
    { name: "password", type: "password" },
    { name: "phone_number", type: "tel" },
    { name: "email", type: "email" },
    { name: "csrf_token", type: "hidden" }
  ];

  const result = evaluateFieldsForVisibilityAndProof(nonMappedFields);
  assert.equal(result.proofSuggestion, null);
  for (const finding of result.findings) {
    assert.equal(finding.suggestedMinimalClaims, undefined);
  }
});

test("Item 7 — buildProofSuggestionPayload and buildProofSuggestionMarkdown emit exact v0.3 schema", () => {
  const result = evaluateFieldsForVisibilityAndProof([
    { name: "email", type: "email" },
    { name: "birth_date", type: "date" }
  ]);

  const payload = buildProofSuggestionPayload(result.proofSuggestion, {
    origin: "https://shop.example",
    title: "Checkout"
  });
  assert.ok(payload && payload.askmiProofSuggestion);
  assert.deepEqual(Object.keys(payload.askmiProofSuggestion), [
    "version",
    "contractVersion",
    "generatedAt",
    "page",
    "observedOverCollection",
    "suggestedMinimalClaims",
    "rationale",
    "note"
  ]);
  assert.equal(payload.askmiProofSuggestion.version, "0.3.0");
  assert.equal(payload.askmiProofSuggestion.contractVersion, "1.0.0");
  assert.deepEqual(payload.askmiProofSuggestion.observedOverCollection, ["birthdate"]);
  assert.deepEqual(payload.askmiProofSuggestion.suggestedMinimalClaims, ["age_over_18"]);

  const md = buildProofSuggestionMarkdown(result.proofSuggestion, {
    origin: "https://shop.example",
    title: "Checkout"
  });
  assert.ok(md && md.includes("# Suggested minimal AskMI proof"));
  assert.ok(md.includes("`age_over_18`"));
});

test("Item 8 — isAllowedLocalWalletOrigin strictly allows localhost and 127.0.0.1 and rejects remote or unsafe origins", () => {
  assert.equal(isAllowedLocalWalletOrigin("http://localhost:5174/"), true);
  assert.equal(isAllowedLocalWalletOrigin("https://localhost:5174/?demo=wallet"), true);
  assert.equal(isAllowedLocalWalletOrigin("http://127.0.0.1:5174/"), true);
  assert.equal(isAllowedLocalWalletOrigin("https://127.0.0.1:8443/"), true);

  assert.equal(isAllowedLocalWalletOrigin("https://wallet.askmi.example/"), false);
  assert.equal(isAllowedLocalWalletOrigin("http://localhost.evil.example/"), false);
  assert.equal(isAllowedLocalWalletOrigin("http://user:pass@localhost:5174/"), false);
  assert.equal(isAllowedLocalWalletOrigin("javascript:alert(1)"), false);
  assert.equal(isAllowedLocalWalletOrigin(""), false);
});

test("Item 8 — buildLocalWalletDeepLink requires explicit opt-in and localhost origin", () => {
  const { proofSuggestion } = evaluateFieldsForVisibilityAndProof([
    { name: "birthdate", type: "date" }
  ]);

  // Default off -> null
  assert.equal(buildLocalWalletDeepLink(proofSuggestion), null);
  assert.equal(buildLocalWalletDeepLink(proofSuggestion, { enabled: false }), null);

  // Remote host rejected even when enabled
  assert.equal(
    buildLocalWalletDeepLink(proofSuggestion, {
      enabled: true,
      baseUrl: "https://remote-wallet.example/"
    }),
    null
  );

  // Enabled + localhost -> constructs suggestion URL
  const urlStr = buildLocalWalletDeepLink(proofSuggestion, { enabled: true });
  assert.ok(urlStr);
  const parsed = new URL(urlStr);
  assert.equal(parsed.origin, "http://localhost:5174");
  assert.equal(parsed.searchParams.get("demo"), "wallet");
  assert.equal(parsed.searchParams.get("proofBridge"), "0.3.0");
  assert.equal(parsed.searchParams.get("contractVersion"), "1.0.0");
  assert.equal(parsed.searchParams.get("suggest"), "age_over_18");
});
