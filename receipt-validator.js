(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.MitchReceiptValidator = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const RECEIPT_SCHEMA_V1 = "askmi.transparency.surface-receipt.v1";
  const PROOF_BRIDGE_VERSION = "0.3.0";
  const CLAIM_CONTRACT_VERSION = "1.0.0";
  const ALLOWED_CANONICAL_CLAIMS = new Set(["age_over_18"]);
  const ALLOWED_OVERCOLLECTION_CLAIMS = new Set(["birthdate"]);
  const VALID_SCAN_STATUSES = new Set(["complete", "limited", "unsupported", "preview", "error"]);
  const VALID_MODES = new Set(["extension", "preview", "cli"]);
  const VALID_COLLECTION_MODES = new Set(["continuous", "on-demand"]);

  const REQUIRED_TOP_KEYS = [
    "schema",
    "receiptId",
    "capturedAt",
    "collector",
    "page",
    "surfaceScore",
    "cookies",
    "storage",
    "network",
    "report",
    "visibility",
    "permissions",
    "fingerprinting",
    "csp",
    "integrity"
  ];

  const PROHIBITED_AUTHORITY_KEYS = new Set([
    "authorized",
    "authorizationDecision",
    "decision",
    "presentationStarted",
    "verdict",
    "userId",
    "walletId",
    "deviceId",
    "browsingHistory"
  ]);

  const PROHIBITED_VERDICT_REGEX =
    /\b(data was sold|sells your data|site is safe|guaranteed safe|gdpr compliant|legally compliant|certified|audit-ready|production-ready)\b/i;

  function getReceiptEngine() {
    if (typeof globalThis !== "undefined" && globalThis.MitchSurfaceReceipt) {
      return globalThis.MitchSurfaceReceipt;
    }
    if (typeof require === "function") {
      try {
        return require("./surface-receipt.js");
      } catch {
        return null;
      }
    }
    return null;
  }

  function validateSurfaceReceipt(receipt) {
    const errors = [];
    const warnings = [];

    if (!receipt || typeof receipt !== "object" || Array.isArray(receipt)) {
      return { valid: false, errors: ["Receipt must be a non-null JSON object."], warnings };
    }

    // Reject legacy v0.2 or unknown top-level keys
    for (const k of Object.keys(receipt)) {
      if (PROHIBITED_AUTHORITY_KEYS.has(k)) {
        errors.push(`Prohibited authority or tracking field present: "${k}".`);
      } else if (!REQUIRED_TOP_KEYS.includes(k)) {
        errors.push(`Unexpected top-level field "${k}" (legacy or unsupported schema).`);
      }
    }

    for (const reqKey of REQUIRED_TOP_KEYS) {
      if (!Object.prototype.hasOwnProperty.call(receipt, reqKey)) {
        errors.push(`Missing required top-level field: "${reqKey}".`);
      }
    }

    if (receipt.schema !== RECEIPT_SCHEMA_V1) {
      errors.push(`Unsupported or missing schema "${receipt.schema}" (expected "${RECEIPT_SCHEMA_V1}").`);
    }

    if (typeof receipt.receiptId !== "string" || receipt.receiptId.trim().length < 3) {
      errors.push("Invalid receiptId.");
    }
    if (typeof receipt.capturedAt !== "string" || Number.isNaN(Date.parse(receipt.capturedAt))) {
      errors.push("Invalid ISO-8601 capturedAt timestamp.");
    }

    // Collector provenance
    const col = receipt.collector;
    if (!col || typeof col !== "object") {
      errors.push("Missing collector object.");
    } else {
      if (!VALID_SCAN_STATUSES.has(col.scanStatus)) {
        errors.push(`Invalid collector.scanStatus: "${col.scanStatus}".`);
      }
      if (!VALID_MODES.has(col.mode)) {
        errors.push(`Invalid collector.mode: "${col.mode}".`);
      }
      if (!VALID_COLLECTION_MODES.has(col.collectionMode)) {
        errors.push(`Invalid collector.collectionMode: "${col.collectionMode}".`);
      }
      if (typeof col.version !== "string" || !col.version.trim()) {
        errors.push("Missing collector.version.");
      }
      if (typeof col.ruleSetVersion !== "string" || !col.ruleSetVersion.trim()) {
        errors.push("Missing collector.ruleSetVersion.");
      }
      if (typeof col.scoringRuleVersion !== "string" || !col.scoringRuleVersion.trim()) {
        errors.push("Missing collector.scoringRuleVersion.");
      }
      if (!Array.isArray(col.limitations)) {
        errors.push("collector.limitations must be an array.");
      } else if (col.scanStatus === "limited" && col.limitations.length === 0) {
        errors.push("collector.limitations must be non-empty when scanStatus is 'limited'.");
      }
    }

    // Page privacy & redaction rules (#21)
    const page = receipt.page;
    if (!page || typeof page !== "object") {
      errors.push("Missing page object.");
    } else {
      if (page.urlIncluded !== false) {
        errors.push("page.urlIncluded must be strictly false.");
      }
      const originStr = String(page.origin || "");
      if (/[?#]|@/.test(originStr)) {
        errors.push("page.origin leaked URL query, fragment, or user credentials.");
      }
      if (/^https?:\/\/[^/]+\/.+/.test(originStr)) {
        errors.push("page.origin must not include URL path segments beyond origin.");
      }
    }

    // Score & non-improvement invariants (#14)
    const score = receipt.surfaceScore;
    if (!score || typeof score !== "object") {
      errors.push("Missing surfaceScore object.");
    } else {
      if (score.semantics !== "informational-surface-summary") {
        errors.push("surfaceScore.semantics must be 'informational-surface-summary'.");
      }
      const status = col && col.scanStatus;
      if (status && status !== "complete" && score.value !== null) {
        errors.push(`surfaceScore.value must be null when scanStatus is '${status}' (got ${score.value}).`);
      }
      if (status === "complete") {
        if (typeof score.value !== "number" || score.value < 0 || score.value > 100) {
          errors.push("surfaceScore.value must be an integer 0..100 when scanStatus is 'complete'.");
        }
        if (score.observedMinimum !== score.value || score.unverifiedMaximum !== score.value) {
          errors.push("Complete scan must have observedMinimum === value === unverifiedMaximum.");
        }
      }
      if (
        typeof score.observedMinimum === "number" &&
        typeof score.unverifiedMaximum === "number" &&
        score.observedMinimum > score.unverifiedMaximum
      ) {
        errors.push("surfaceScore.observedMinimum cannot exceed surfaceScore.unverifiedMaximum.");
      }
      if (score.components && typeof score.components === "object") {
        if (receipt.cookies && receipt.cookies.available === false && score.components.cookies !== null) {
          errors.push("Unavailable cookies channel must have surfaceScore.components.cookies === null (never 0).");
        }
        if (
          receipt.network &&
          receipt.network.available === false &&
          (score.components.thirdPartyRequests !== null || score.components.knownTrackerDomains !== null)
        ) {
          errors.push("Unavailable network channel must have null score components (never 0).");
        }
        if (
          receipt.visibility &&
          receipt.visibility.available === false &&
          score.components.fingerprintingCalls !== null
        ) {
          errors.push("Unavailable content channel must have surfaceScore.components.fingerprintingCalls === null.");
        }
      }
    }

    // Cookies & Storage value non-inspection
    if (!receipt.cookies || receipt.cookies.valuesInspected !== false) {
      errors.push("cookies.valuesInspected must be strictly false.");
    }
    if (!receipt.storage || receipt.storage.valuesInspected !== false) {
      errors.push("storage.valuesInspected must be strictly false.");
    }
    if (!receipt.visibility || receipt.visibility.fieldMetadataOnly !== true) {
      errors.push("visibility.fieldMetadataOnly must be strictly true.");
    }

    // Five-State Report & Declarations provenance
    const rep = receipt.report;
    if (!rep || typeof rep !== "object") {
      errors.push("Missing report object.");
    } else {
      for (const state of ["observed", "declared", "potential", "unknown", "unavailable"]) {
        if (!Array.isArray(rep[state])) {
          errors.push(`report.${state} must be an array.`);
        }
      }
      if (Array.isArray(rep.declared)) {
        for (const decl of rep.declared) {
          if (!decl || typeof decl.sourceReference !== "string" || !/^https?:\/\//i.test(decl.sourceReference)) {
            errors.push("Every report.declared entry must have an HTTP(S) sourceReference.");
          }
          if (!decl || typeof decl.retrievedAt !== "string" || Number.isNaN(Date.parse(decl.retrievedAt))) {
            errors.push("Every report.declared entry must have a valid retrievedAt timestamp.");
          }
          if (!decl || typeof decl.independentlyVerified !== "boolean") {
            errors.push("Every report.declared entry must specify boolean independentlyVerified.");
          }
        }
      }
    }

    // Embedded Proof Suggestion compatibility
    if (receipt.visibility && receipt.visibility.proofSuggestion !== null) {
      const psCheck = validateProofSuggestion({
        askmiProofSuggestion: {
          ...receipt.visibility.proofSuggestion,
          page: {
            origin: (receipt.page && receipt.page.origin) || "unknown",
            title: (receipt.page && receipt.page.title) || "Untitled"
          }
        }
      });
      for (const e of psCheck.errors) {
        errors.push(`visibility.proofSuggestion: ${e}`);
      }
    }

    // Prohibited verdict language check
    const rawJson = JSON.stringify(receipt);
    if (PROHIBITED_VERDICT_REGEX.test(rawJson)) {
      errors.push("Receipt contains prohibited legal, safety, or data-sale verdict language.");
    }

    // Integrity hash verification
    const engine = getReceiptEngine();
    if (!receipt.integrity || typeof receipt.integrity !== "object") {
      errors.push("Missing integrity object.");
    } else if (engine && typeof engine.verifyReceiptIntegrity === "function") {
      if (!engine.verifyReceiptIntegrity(receipt)) {
        errors.push("integrity.contentHash does not match canonical SHA-256 of receipt content.");
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  function validateProofSuggestion(payload) {
    const errors = [];
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return { valid: false, errors: ["Proof suggestion payload must be an object."] };
    }

    for (const k of Object.keys(payload)) {
      if (k !== "askmiProofSuggestion") {
        errors.push(`Unexpected top-level key in Proof Suggestion payload: "${k}".`);
      }
    }

    const s = payload.askmiProofSuggestion;
    if (!s || typeof s !== "object") {
      return { valid: false, errors: ["Missing askmiProofSuggestion object."] };
    }

    const allowedKeys = new Set([
      "version",
      "contractVersion",
      "generatedAt",
      "page",
      "observedOverCollection",
      "suggestedMinimalClaims",
      "rationale",
      "note",
      "advisoryOnly"
    ]);
    for (const k of Object.keys(s)) {
      if (PROHIBITED_AUTHORITY_KEYS.has(k)) {
        errors.push(`Prohibited authority field in askmiProofSuggestion: "${k}".`);
      } else if (!allowedKeys.has(k)) {
        errors.push(`Unexpected field in askmiProofSuggestion: "${k}".`);
      }
    }

    if (s.version !== PROOF_BRIDGE_VERSION) {
      errors.push(`Unsupported Proof Bridge version "${s.version}" (expected "${PROOF_BRIDGE_VERSION}").`);
    }
    if (s.contractVersion !== CLAIM_CONTRACT_VERSION) {
      errors.push(`Unsupported Claim Contract version "${s.contractVersion}" (expected "${CLAIM_CONTRACT_VERSION}").`);
    }
    if (!s.page || typeof s.page !== "object" || typeof s.page.origin !== "string") {
      errors.push("Missing askmiProofSuggestion.page.origin.");
    } else if (/[?#]|@/.test(s.page.origin)) {
      errors.push("askmiProofSuggestion.page.origin must not contain query, fragment, or credentials.");
    }

    if (!Array.isArray(s.observedOverCollection) || s.observedOverCollection.length === 0) {
      errors.push("observedOverCollection must be a non-empty array.");
    } else {
      for (const c of s.observedOverCollection) {
        if (!ALLOWED_OVERCOLLECTION_CLAIMS.has(c)) {
          errors.push(`Unpinned over-collected claim name: "${c}".`);
        }
      }
    }

    if (!Array.isArray(s.suggestedMinimalClaims) || s.suggestedMinimalClaims.length === 0) {
      errors.push("suggestedMinimalClaims must be a non-empty array.");
    } else {
      for (const c of s.suggestedMinimalClaims) {
        if (!ALLOWED_CANONICAL_CLAIMS.has(c)) {
          errors.push(`Unpinned suggestedMinimalClaim: "${c}" (expected canonical "age_over_18").`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  return Object.freeze({
    RECEIPT_SCHEMA_V1,
    PROOF_BRIDGE_VERSION,
    CLAIM_CONTRACT_VERSION,
    validateSurfaceReceipt,
    validateProofSuggestion
  });
});
