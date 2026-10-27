import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  CLAIM_CONTRACT_VERSION,
  CANONICAL_CLAIMS,
  classifyFieldDescriptor,
  evaluateFieldsForVisibilityAndProof,
  buildProofSuggestionPayload
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

test("Item 6 — evaluateFieldsForVisibilityAndProof aggregates proofSuggestion when DOB over-collection is present", () => {
  const result = evaluateFieldsForVisibilityAndProof([
    { name: "email", type: "email" },
    { name: "birth_date", type: "date" }
  ]);

  assert.equal(result.highestLayer, "GRUNDVERSORGUNG (Medium)");
  assert.ok(result.proofSuggestion);
  assert.equal(result.proofSuggestion.contractVersion, "1.0.0");
  assert.deepEqual(result.proofSuggestion.observedOverCollection, ["birthdate"]);
  assert.deepEqual(result.proofSuggestion.suggestedMinimalClaims, ["age_over_18"]);

  const payload = buildProofSuggestionPayload(result.proofSuggestion, {
    origin: "https://shop.example",
    title: "Checkout"
  });
  assert.ok(payload && payload.askmiProofSuggestion);
  assert.equal(payload.askmiProofSuggestion.version, "0.3.0");
  assert.equal(payload.askmiProofSuggestion.contractVersion, "1.0.0");
  assert.deepEqual(payload.askmiProofSuggestion.observedOverCollection, ["birthdate"]);
  assert.deepEqual(payload.askmiProofSuggestion.suggestedMinimalClaims, ["age_over_18"]);
  assert.deepEqual(payload.askmiProofSuggestion.page, {
    origin: "https://shop.example",
    title: "Checkout"
  });
});
