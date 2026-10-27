/**
 * @module proof-bridge
 *
 * Pure, zero-dependency AskMI Proof Bridge mapping helper (v0.3).
 * Aligned with @askmi/shared-types/contracts/claim-contract (v1.0.0):
 *   - CLAIM_CONTRACT_VERSION = "1.0.0"
 *   - CANONICAL_CLAIMS = ["birthdate", "age_over_18"]
 *
 * Fail-closed: only high-confidence over-collection patterns emit a canonical
 * minimal-claim suggestion. Unknown, multi-purpose, or domain-specific fields
 * return no suggestion.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.MitchProofBridge = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const PROOF_BRIDGE_VERSION = "0.3.0";
  const CLAIM_CONTRACT_VERSION = "1.0.0";
  const CANONICAL_CLAIMS = Object.freeze(["birthdate", "age_over_18"]);

  const VISIBILITY_FIELD_RULES = Object.freeze([
    {
      key: "health",
      pattern: /health|medical|diagnosis|prescription|blood|allerg|medication|ehds/i,
      label: "Health / Medical Attribute",
      layer: "VULNERABLE (High)",
      state: "Detected",
      hint: "GDPR Art. 9 Special Category (VULNERABLE). Use selective disclosure instead of raw medical forms."
    },
    {
      key: "financial",
      pattern: /iban|bic|cc-|credit|card|bank|salary|tax|ssn/i,
      label: "Financial / Tax Identifier",
      layer: "VULNERABLE (High)",
      state: "Detected",
      hint: "High-risk financial attribute (VULNERABLE). Verify relying-party trust before disclosure."
    },
    {
      key: "secret",
      pattern: /password|passcode|pin|secret/i,
      label: "Shared Secret / Password Input",
      layer: "VULNERABLE (High)",
      state: "Detected",
      hint: "Shared secret requested. Hardware-bound AskMI passkeys avoid server-stored passwords."
    },
    {
      key: "dob",
      pattern: /birth|dob|bday|dateofbirth|geburtsdatum|geburtstag/i,
      label: "Full Date of Birth (birthdate)",
      layer: "GRUNDVERSORGUNG (Medium)",
      state: "Prompt",
      hint: "Over-collection warning: Full DOB requested. An AskMI age_over_18 predicate proof suffices.",
      observedOverCollection: Object.freeze(["birthdate"]),
      suggestedMinimalClaims: Object.freeze(["age_over_18"]),
      rationale: "Full date of birth requested; age >= 18 predicate is data-minimizing."
    },
    {
      key: "contact",
      pattern: /phone|tel|mobile|address|street|postal|zip|plz|wohnort/i,
      label: "Address / Phone Contact",
      layer: "GRUNDVERSORGUNG (Medium)",
      state: "Prompt",
      hint: "GRUNDVERSORGUNG attribute. Share only if physical delivery or direct contact is required."
    },
    {
      key: "identity_basic",
      pattern: /given_name|family_name|firstname|lastname|fullname|email|e-mail/i,
      label: "Basic Identity / Email (WELT)",
      layer: "WELT (Low)",
      state: "Not Detected",
      hint: "Standard Layer 0 (WELT) attribute. Pairwise pseudonymous identifiers prevent cross-site correlation."
    }
  ]);

  /**
   * Classify a single form field descriptor (attributes only, never field values).
   * @param {{ name?: string, id?: string, autocomplete?: string, placeholder?: string, ariaLabel?: string, type?: string }} field
   * @returns {object | null}
   */
  function classifyFieldDescriptor(field) {
    if (!field || typeof field !== "object") return null;
    const type = String(field.type || "").toLowerCase().trim();
    if (type === "hidden" || type === "submit" || type === "button" || type === "reset") {
      return null;
    }

    const attrTokens = [
      field.name,
      field.id,
      field.autocomplete,
      field.placeholder,
      field.ariaLabel
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .trim();

    const combinedToken = [attrTokens, type].filter(Boolean).join(" ").trim();
    if (!combinedToken) return null;

    for (const rule of VISIBILITY_FIELD_RULES) {
      // For DOB: match birth-related tokens (including type="date" when paired with birth tokens).
      // A generic type="date" without birth tokens (e.g. appointment_date) must NOT match DOB.
      const matched = rule.key === "dob"
        ? rule.pattern.test(attrTokens)
        : rule.pattern.test(combinedToken);

      if (matched) {
        const finding = {
          key: rule.key,
          label: rule.label,
          layer: rule.layer,
          state: rule.state,
          hint: rule.hint
        };
        if (
          Array.isArray(rule.suggestedMinimalClaims) &&
          rule.suggestedMinimalClaims.length > 0 &&
          rule.suggestedMinimalClaims.every((c) => CANONICAL_CLAIMS.includes(c) && c !== "birthdate")
        ) {
          finding.observedOverCollection = Array.from(rule.observedOverCollection || []);
          finding.suggestedMinimalClaims = Array.from(rule.suggestedMinimalClaims);
          finding.rationale = rule.rationale;
        }
        return finding;
      }
    }

    return null;
  }

  /**
   * Evaluate a list of field descriptors and return the AskMI Visibility Layer summary
   * plus a fail-closed canonical proofSuggestion when applicable.
   * @param {Array<object>} fieldDescriptors
   */
  function evaluateFieldsForVisibilityAndProof(fieldDescriptors) {
    const counts = {
      vulnerable: 0,
      grundversorgung: 0,
      welt: 0
    };
    const findingsByKey = new Map();

    if (Array.isArray(fieldDescriptors)) {
      for (const desc of fieldDescriptors) {
        const finding = classifyFieldDescriptor(desc);
        if (!finding) continue;

        if (finding.layer === "VULNERABLE (High)") counts.vulnerable += 1;
        else if (finding.layer === "GRUNDVERSORGUNG (Medium)") counts.grundversorgung += 1;
        else counts.welt += 1;

        if (!findingsByKey.has(finding.key)) {
          const entry = {
            label: finding.label,
            layer: finding.layer,
            state: finding.state,
            hint: finding.hint
          };
          if (finding.suggestedMinimalClaims) {
            entry.observedOverCollection = finding.observedOverCollection;
            entry.suggestedMinimalClaims = finding.suggestedMinimalClaims;
            entry.rationale = finding.rationale;
          }
          findingsByKey.set(finding.key, entry);
        }
      }
    }

    let highestLayer = "None Detected";
    if (counts.vulnerable > 0) {
      highestLayer = "VULNERABLE (High)";
    } else if (counts.grundversorgung > 0) {
      highestLayer = "GRUNDVERSORGUNG (Medium)";
    } else if (counts.welt > 0) {
      highestLayer = "WELT (Low)";
    }

    const findings = Array.from(findingsByKey.values());
    const observedSet = new Set();
    const suggestedSet = new Set();
    const rationales = [];

    for (const f of findings) {
      if (Array.isArray(f.suggestedMinimalClaims) && f.suggestedMinimalClaims.length > 0) {
        (f.observedOverCollection || []).forEach((c) => observedSet.add(c));
        f.suggestedMinimalClaims.forEach((c) => {
          if (CANONICAL_CLAIMS.includes(c) && c !== "birthdate") {
            suggestedSet.add(c);
          }
        });
        if (f.rationale) rationales.push(f.rationale);
      }
    }

    const proofSuggestion = suggestedSet.size > 0
      ? {
          version: PROOF_BRIDGE_VERSION,
          contractVersion: CLAIM_CONTRACT_VERSION,
          observedOverCollection: Array.from(observedSet),
          suggestedMinimalClaims: Array.from(suggestedSet),
          rationale: rationales[0] || "Full date of birth requested; age >= 18 predicate is data-minimizing.",
          note: "This is a local suggestion only. No presentation was started. Open your AskMI wallet to create a real proof."
        }
      : null;

    return {
      highestLayer,
      counts,
      findings,
      proofSuggestion
    };
  }

  /**
   * Build the full v0.3 JSON payload for copying/exporting a Proof Suggestion.
   */
  function buildProofSuggestionPayload(proofSuggestion, pageContext) {
    if (
      !proofSuggestion ||
      !Array.isArray(proofSuggestion.suggestedMinimalClaims) ||
      proofSuggestion.suggestedMinimalClaims.length === 0
    ) {
      return null;
    }

    return {
      askmiProofSuggestion: {
        version: PROOF_BRIDGE_VERSION,
        contractVersion: CLAIM_CONTRACT_VERSION,
        generatedAt: new Date().toISOString(),
        page: {
          origin: (pageContext && pageContext.origin) || "unknown",
          title: (pageContext && pageContext.title) || "Untitled page"
        },
        observedOverCollection: Array.from(proofSuggestion.observedOverCollection || ["birthdate"]),
        suggestedMinimalClaims: Array.from(proofSuggestion.suggestedMinimalClaims),
        rationale:
          proofSuggestion.rationale ||
          "Full date of birth requested; age >= 18 predicate is data-minimizing.",
        note:
          proofSuggestion.note ||
          "This is a local suggestion only. No presentation was started. Open your AskMI wallet to create a real proof."
      }
    };
  }

  /**
   * Build the human-readable Markdown representation of a Proof Suggestion (Item 7).
   */
  function buildProofSuggestionMarkdown(proofSuggestion, pageContext) {
    const payload = buildProofSuggestionPayload(proofSuggestion, pageContext);
    if (!payload) return null;
    const s = payload.askmiProofSuggestion;
    return [
      `# Suggested minimal AskMI proof`,
      `- **Version:** ${s.version} (Claim Contract \`${s.contractVersion}\`)`,
      `- **Generated At:** ${s.generatedAt}`,
      `- **Page:** \`${s.page.origin}\` (${s.page.title})`,
      `- **Observed Over-Collection:** \`${s.observedOverCollection.join(", ")}\``,
      `- **Suggested Minimal Claim(s):** \`${s.suggestedMinimalClaims.join(", ")}\``,
      `- **Rationale:** ${s.rationale}`,
      `- **Note:** ${s.note}`
    ].join("\n");
  }

  return {
    PROOF_BRIDGE_VERSION,
    CLAIM_CONTRACT_VERSION,
    CANONICAL_CLAIMS,
    VISIBILITY_FIELD_RULES,
    classifyFieldDescriptor,
    evaluateFieldsForVisibilityAndProof,
    buildProofSuggestionPayload,
    buildProofSuggestionMarkdown
  };
});
