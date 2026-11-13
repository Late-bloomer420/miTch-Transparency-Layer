/**
 * @module standards-mapping
 *
 * Standards & Vocabulary Alignment for miTch Transparency Layer:
 *   1. W3C Data Privacy Vocabulary (DPV v2.0) — honestly labelled as a W3C Community Group Report
 *      (`w3c-community-group-report`, `normativeW3cStandard: false`).
 *   2. ISO/IEC TS 27560:2023 — Technical Specification for consent and privacy notice receipt structure.
 *   3. W3C Global Privacy Control (GPC) Working Draft — `Sec-GPC: 1` / `navigator.globalPrivacyControl`
 *      technical user preference signal (`legallyBindingByItself: false`).
 *   4. W3C FedID Digital Credentials API Working Draft — `navigator.credentials.get({ digital })`.
 *   5. ToS;DR (Terms of Service; Didn't Read) declaration adapter — normalizes CC BY-SA 3.0 service
 *      declarations into `report.declared` (`independentlyVerified: false`, zero AGPL-3.0 code).
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.MitchStandardsMapping = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const DPV_SPEC_METADATA = Object.freeze({
    vocabulary: "W3C Data Privacy Vocabulary (DPV)",
    version: "2.0",
    uri: "https://w3id.org/dpv#",
    status: "w3c-community-group-report",
    normativeW3cStandard: false,
    note: "DPV is a W3C Data Privacy Vocabularies and Controls Community Group report (not a normative W3C Recommendation). Used here strictly as a descriptive taxonomy for observed browser surface categories."
  });

  const ISO_27560_METADATA = Object.freeze({
    specification: "ISO/IEC TS 27560:2023",
    status: "iso-technical-specification",
    role: "structural-reference-for-notice-and-receipt-records",
    note: "Provides structural alignment for receipt provenance, notice references, and evidence states without claiming legal consent validity."
  });

  const GPC_SPEC_METADATA = Object.freeze({
    specification: "W3C Global Privacy Control (GPC)",
    status: "w3c-working-draft",
    draftDate: "2026-09-24",
    legallyBindingByItself: false,
    note: "GPC (Sec-GPC: 1 / navigator.globalPrivacyControl) is a technical user preference signal. It is not legally binding by itself; legal obligations depend on applicable jurisdiction (such as CCPA regulations), and remote server compliance cannot be verified by this browser extension."
  });

  const DIGITAL_CREDENTIALS_SPEC_METADATA = Object.freeze({
    specification: "W3C FedID Digital Credentials API",
    status: "w3c-working-draft",
    note: "Allows websites to request selective verifiable credential presentations from a registered wallet provider via navigator.credentials.get({ digital })."
  });

  const FIELD_KEY_TO_DPV = Object.freeze({
    dob: Object.freeze({
      dpvDataCategory: "dpv:BirthDate",
      dpvBroaderCategory: "dpv:Identifying",
      dpvSensitivity: "dpv:PersonalData",
      dpvDataMinimisationAlternative: "age_over_18"
    }),
    birthdate: Object.freeze({
      dpvDataCategory: "dpv:BirthDate",
      dpvBroaderCategory: "dpv:Identifying",
      dpvSensitivity: "dpv:PersonalData",
      dpvDataMinimisationAlternative: "age_over_18"
    }),
    health: Object.freeze({
      dpvDataCategory: "dpv:HealthData",
      dpvBroaderCategory: "dpv:SpecialCategoryPersonalData",
      dpvSensitivity: "dpv:SensitivePersonalData",
      dpvDataMinimisationAlternative: null
    }),
    financial: Object.freeze({
      dpvDataCategory: "dpv:FinancialAccount",
      dpvBroaderCategory: "dpv:Financial",
      dpvSensitivity: "dpv:SensitivePersonalData",
      dpvDataMinimisationAlternative: null
    }),
    secret: Object.freeze({
      dpvDataCategory: "dpv:Password",
      dpvBroaderCategory: "dpv:AuthenticationHistory",
      dpvSensitivity: "dpv:SensitivePersonalData",
      dpvDataMinimisationAlternative: null
    }),
    contact: Object.freeze({
      dpvDataCategory: "dpv:Contact",
      dpvBroaderCategory: "dpv:Communication",
      dpvSensitivity: "dpv:PersonalData",
      dpvDataMinimisationAlternative: null
    }),
    identity_basic: Object.freeze({
      dpvDataCategory: "dpv:EmailAddress",
      dpvBroaderCategory: "dpv:Identifying",
      dpvSensitivity: "dpv:PersonalData",
      dpvDataMinimisationAlternative: null
    })
  });

  const CLASSIFICATION_TO_DPV = Object.freeze({
    "Analytics Tracker": Object.freeze({
      dpvRecipient: "dpv:ThirdParty",
      dpvPotentialPurpose: "dpv:ServiceOptimization",
      dpvProcessing: "dpv:Observe",
      purposeVerified: false
    }),
    "Ad-Tech Tracker": Object.freeze({
      dpvRecipient: "dpv:ThirdParty",
      dpvPotentialPurpose: "dpv:Marketing",
      dpvProcessing: "dpv:Observe",
      purposeVerified: false
    }),
    "Social / Ad Tracker": Object.freeze({
      dpvRecipient: "dpv:ThirdParty",
      dpvPotentialPurpose: "dpv:Marketing",
      dpvProcessing: "dpv:Observe",
      purposeVerified: false
    }),
    "Session Replay": Object.freeze({
      dpvRecipient: "dpv:ThirdParty",
      dpvPotentialPurpose: "dpv:ServiceOptimization",
      dpvProcessing: "dpv:Observe",
      purposeVerified: false
    }),
    "Product Telemetry": Object.freeze({
      dpvRecipient: "dpv:ThirdParty",
      dpvPotentialPurpose: "dpv:ServiceOptimization",
      dpvProcessing: "dpv:Observe",
      purposeVerified: false
    }),
    "Ad Exchange": Object.freeze({
      dpvRecipient: "dpv:ThirdParty",
      dpvPotentialPurpose: "dpv:Marketing",
      dpvProcessing: "dpv:Observe",
      purposeVerified: false
    }),
    "Attribution Pixel": Object.freeze({
      dpvRecipient: "dpv:ThirdParty",
      dpvPotentialPurpose: "dpv:Marketing",
      dpvProcessing: "dpv:Observe",
      purposeVerified: false
    }),
    "Error / RUM Telemetry": Object.freeze({
      dpvRecipient: "dpv:ThirdParty",
      dpvPotentialPurpose: "dpv:TechnicalServiceProvision",
      dpvProcessing: "dpv:Observe",
      purposeVerified: false
    }),
    "External Resource / CDN": Object.freeze({
      dpvRecipient: "dpv:ThirdParty",
      dpvPotentialPurpose: "dpv:TechnicalServiceProvision",
      dpvProcessing: "dpv:Transmit",
      purposeVerified: false
    })
  });

  function mapFieldKeyToDpv(fieldKey) {
    const key = String(fieldKey || "").toLowerCase().trim();
    return (
      FIELD_KEY_TO_DPV[key] || {
        dpvDataCategory: "dpv:PersonalData",
        dpvBroaderCategory: "dpv:PersonalData",
        dpvSensitivity: "dpv:PersonalData",
        dpvDataMinimisationAlternative: null
      }
    );
  }

  function mapDomainClassificationToDpv(classification) {
    return (
      CLASSIFICATION_TO_DPV[classification] ||
      CLASSIFICATION_TO_DPV["External Resource / CDN"]
    );
  }

  /**
   * Convert a ToS;DR service declaration/point into a normalized `report.declared` input object.
   * Complies with ToS;DR data license (CC BY-SA 3.0) via explicit attribution while using zero AGPL-3.0 code.
   */
  function normalizeTosdrDeclaration(entry) {
    if (!entry || typeof entry !== "object") return null;
    const title = typeof entry.title === "string" ? entry.title.trim() : "";
    const service = typeof entry.service === "string" ? entry.service.trim() : "";
    const sourceUrl =
      typeof entry.sourceUrl === "string" && /^https?:\/\//i.test(entry.sourceUrl.trim())
        ? entry.sourceUrl.trim()
        : typeof entry.sourceReference === "string" && /^https?:\/\//i.test(entry.sourceReference.trim())
          ? entry.sourceReference.trim()
          : null;
    const retrievedAt =
      typeof entry.retrievedAt === "string" && !Number.isNaN(Date.parse(entry.retrievedAt))
        ? new Date(entry.retrievedAt).toISOString()
        : null;

    if (!title || !sourceUrl || !retrievedAt) return null;

    const cleanId = String(entry.id || "point")
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .slice(0, 48);
    const prefix = service ? `[${service} / ToS;DR CC BY-SA 3.0] ` : "[ToS;DR CC BY-SA 3.0] ";

    return {
      id: `declared.tosdr.${cleanId}`,
      summary: `${prefix}${title}`,
      sourceReference: sourceUrl,
      retrievedAt,
      independentlyVerified: false,
      scopeLimitation:
        "Community-curated declaration from Terms of Service; Didn't Read (ToS;DR, licensed under CC BY-SA 3.0). Not independently verified against live server behavior by this browser extension."
    };
  }

  function buildStandardsSummary({ findings = [], domains = [], privacySignals = null } = {}) {
    const dpvDataCategories = Array.from(
      new Set(
        findings
          .map((f) => {
            const mapped = mapFieldKeyToDpv(f.key || f.id);
            return mapped.dpvDataCategory;
          })
          .filter(Boolean)
      )
    );

    const dpvPotentialPurposes = Array.from(
      new Set(
        domains
          .map((d) => {
            const mapped = mapDomainClassificationToDpv(d.classification);
            return mapped.dpvPotentialPurpose;
          })
          .filter(Boolean)
      )
    );

    const gpcEnabled =
      privacySignals && typeof privacySignals.gpcEnabled === "boolean"
        ? privacySignals.gpcEnabled
        : null;
    const digitalCredentialsCallObserved =
      privacySignals && typeof privacySignals.digitalCredentialsCallObserved === "boolean"
        ? privacySignals.digitalCredentialsCallObserved
        : false;
    const digitalCredentialsApiAvailable =
      privacySignals && typeof privacySignals.digitalCredentialsApiAvailable === "boolean"
        ? privacySignals.digitalCredentialsApiAvailable
        : null;

    return {
      dpv: {
        ...DPV_SPEC_METADATA,
        observedFieldDataCategories: dpvDataCategories,
        unverifiedThirdPartyPurposes: dpvPotentialPurposes
      },
      iso27560: ISO_27560_METADATA,
      gpc: {
        ...GPC_SPEC_METADATA,
        navigatorGlobalPrivacyControl: gpcEnabled
      },
      digitalCredentialsApi: {
        ...DIGITAL_CREDENTIALS_SPEC_METADATA,
        apiAvailableInBrowser: digitalCredentialsApiAvailable,
        invocationObserved: digitalCredentialsCallObserved
      }
    };
  }

  return Object.freeze({
    DPV_SPEC_METADATA,
    ISO_27560_METADATA,
    GPC_SPEC_METADATA,
    DIGITAL_CREDENTIALS_SPEC_METADATA,
    FIELD_KEY_TO_DPV,
    CLASSIFICATION_TO_DPV,
    mapFieldKeyToDpv,
    mapDomainClassificationToDpv,
    normalizeTosdrDeclaration,
    buildStandardsSummary
  });
});
