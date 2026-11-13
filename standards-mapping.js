/**
 * @module standards-mapping
 *
 * Standards, Vocabulary & Blind Provider / Convener Alignment for miTch Transparency Layer:
 *   1. Blind Provider & Convener ("Convener statt Autoritaet"):
 *      - Structurally blind to user content (never reads form values, cookie values, or storage contents).
 *      - Zero network egress (connect-src 'none'), zero central database, zero economic self-interest in user data.
 *      - Performs rule-based boundary checks (Digital Rights Charter Art. 9 AQDR) without inspecting personal data.
 *   2. W3C Data Privacy Vocabulary (DPV v2.0) — honestly labelled as a W3C Community Group Report
 *      (w3c-community-group-report, normativeW3cStandard: false).
 *   3. ISO/IEC TS 27560:2023 — Technical Specification for consent and privacy notice receipt structure.
 *   4. W3C Global Privacy Control (GPC) Working Draft — Sec-GPC: 1 / navigator.globalPrivacyControl
 *      technical user preference signal (legallyBindingByItself: false).
 *   5. W3C FedID Digital Credentials API Working Draft — navigator.credentials.get({ digital }).
 *   6. ToS;DR (Terms of Service; Didn't Read) offline declaration catalog & adapter (CC BY-SA 3.0 attribution,
 *      independentlyVerified: false, zero AGPL-3.0 code).
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.MitchStandardsMapping = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const BLIND_CONVENER_POSTURE = Object.freeze({
    role: "blind-provider-and-convener",
    principle: "Rule over Authority — structurally unable to know user content",
    charterArticles: Object.freeze([
      "Art. 1 (Right to Forgetting / Ephemeral Minimization)",
      "Art. 9 (AQDR Rule-Based Boundary Verification without Data Inspection)"
    ]),
    tdddgNeutralityModel: Object.freeze({
      reference: "Section 26 TDDDG / EinwV neutrality principle",
      economicSelfInterestInConsentOrData: false,
      formalBfdiRecognitionClaimed: false,
      note: "Operates with zero economic self-interest in user consents or data monetization. Experimental local companion; does not claim formal regulatory recognition."
    }),
    structuralBlindness: Object.freeze({
      formValuesRead: false,
      cookieAndStorageValuesRead: false,
      urlQueryAndFragmentExported: false,
      remoteNetworkEgressAllowed: false,
      centralDatabaseOrProfiling: false,
      walletHandoffTransport: "url-hash-fragment"
    })
  });

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
    note: "GPC (Sec-GPC: 1 / navigator.globalPrivacyControl) is a technical user preference signal. It is not legally binding by itself; legal obligations depend on applicable jurisdiction (such as CCPA regulations), and remote server adherence cannot be verified by this browser extension."
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

  const OFFLINE_TOSDR_CATALOG = Object.freeze({
    "google.com": Object.freeze([
      Object.freeze({
        tosdr: true,
        id: "google_217",
        service: "Google",
        title: "Service states it may collect and combine activity across integrated services and third-party partners",
        sourceUrl: "https://tosdr.org/en/service/217",
        retrievedAt: "2026-11-04T00:00:00.000Z"
      })
    ]),
    "youtube.com": Object.freeze([
      Object.freeze({
        tosdr: true,
        id: "youtube_274",
        service: "YouTube",
        title: "Service states viewing history and device identifiers may be used for personalized recommendations and advertising",
        sourceUrl: "https://tosdr.org/en/service/274",
        retrievedAt: "2026-11-04T00:00:00.000Z"
      })
    ]),
    "facebook.com": Object.freeze([
      Object.freeze({
        tosdr: true,
        id: "facebook_182",
        service: "Facebook",
        title: "Service states it may receive activity information from third-party websites using its social plugins and pixels",
        sourceUrl: "https://tosdr.org/en/service/182",
        retrievedAt: "2026-11-04T00:00:00.000Z"
      })
    ]),
    "amazon.com": Object.freeze([
      Object.freeze({
        tosdr: true,
        id: "amazon_190",
        service: "Amazon",
        title: "Service states it uses cookies and device identifiers to provide and measure interest-based ads",
        sourceUrl: "https://tosdr.org/en/service/190",
        retrievedAt: "2026-11-04T00:00:00.000Z"
      })
    ]),
    "github.com": Object.freeze([
      Object.freeze({
        tosdr: true,
        id: "github_296",
        service: "GitHub",
        title: "Service states it limits non-essential tracking cookies and publishes transparent privacy documentation",
        sourceUrl: "https://tosdr.org/en/service/296",
        retrievedAt: "2026-11-04T00:00:00.000Z"
      })
    ]),
    "wikipedia.org": Object.freeze([
      Object.freeze({
        tosdr: true,
        id: "wikipedia_265",
        service: "Wikipedia",
        title: "Service states it does not sell personal information or rely on behavioral third-party advertising",
        sourceUrl: "https://tosdr.org/en/service/265",
        retrievedAt: "2026-11-04T00:00:00.000Z"
      })
    ])
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
   * Look up curated offline ToS;DR declarations (CC BY-SA 3.0) by hostname or URL.
   * Performs zero network calls.
   */
  function lookupOfflineTosdrDeclarations(hostOrUrl) {
    if (typeof hostOrUrl !== "string" || !hostOrUrl.trim()) return [];
    let host = hostOrUrl.trim().toLowerCase();
    try {
      if (/^https?:\/\//i.test(host)) {
        host = new URL(host).hostname.toLowerCase();
      }
    } catch {
      // Treat as hostname
    }
    host = host.replace(/^www./, "");
    for (const [domainKey, entries] of Object.entries(OFFLINE_TOSDR_CATALOG)) {
      if (host === domainKey || host.endsWith("." + domainKey)) {
        return entries.map((e) => ({ ...e }));
      }
    }
    return [];
  }

  /**
   * Convert a ToS;DR service declaration/point into a normalized report.declared input object.
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

  /**
   * Digital Rights Charter Art. 9 (AQDR) — Rule-based boundary & signal-vs-behavior check
   * executed locally without reading any personal data values.
   */
  function evaluateSignalContradictions({
    findings = [],
    domains = [],
    privacySignals = null,
    fingerprinting = []
  } = {}) {
    const contradictions = [];

    const gpcEnabled = Boolean(privacySignals && privacySignals.gpcEnabled === true);
    const trackerDomains = Array.isArray(domains)
      ? domains.filter((d) => d && d.isTracker)
      : [];

    if (gpcEnabled && trackerDomains.length > 0) {
      contradictions.push({
        id: "aqdr.gpc-vs-tracker-contact",
        type: "signal-vs-network-contact",
        charterArticle: "Art. 9 AQDR",
        observedSignal: "navigator.globalPrivacyControl === true (Sec-GPC: 1)",
        observedSurface: `${trackerDomains.length} analytics/marketing tracker domain(s) contacted (${trackerDomains.slice(0, 3).map((d) => d.domain).join(", ")})`,
        summary: `Browser sends Sec-GPC: 1 preference signal, yet ${trackerDomains.length} third-party tracker/telemetry domain(s) were contacted during load.`,
        unverifiedBoundary:
          "GPC legal bindingness depends on jurisdiction, and whether contacted servers restrict downstream processing when Sec-GPC: 1 is present cannot be verified from browser observation."
      });
    }

    const observedFpKeys = Array.isArray(fingerprinting)
      ? fingerprinting.filter((f) => f && f.observed === true && f.key !== "evalAttempt").map((f) => f.key)
      : [];
    if (privacySignals && privacySignals.highEntropyClientHintsObserved === true) {
      observedFpKeys.push("clientHints");
    }
    if (privacySignals && privacySignals.storageEstimateObserved === true) {
      observedFpKeys.push("storageQuota");
    }

    if (observedFpKeys.length > 0) {
      contradictions.push({
        id: "aqdr.high-entropy-surface-probing",
        type: "proactive-device-surface-probing",
        charterArticle: "Art. 9 AQDR",
        observedSignal: "Initial page load (pre-submission)",
        observedSurface: `Active MAIN-world probes: ${observedFpKeys.join(", ")}`,
        summary: `Observed ${observedFpKeys.length} high-entropy device/browser probe API(s) (${observedFpKeys.join(", ")}) invoked in page MAIN world.`,
        unverifiedBoundary:
          "Whether the returned values are used for legitimate rendering/diagnostics or combined into a cross-session device fingerprint is not verified."
      });
    }

    const dobFindings = Array.isArray(findings)
      ? findings.filter(
          (f) =>
            f &&
            (f.dpvDataCategory === "dpv:BirthDate" ||
              f.key === "dob" ||
              f.key === "birthdate")
        )
      : [];

    if (dobFindings.length > 0) {
      contradictions.push({
        id: "aqdr.raw-birthdate-vs-predicate",
        type: "data-minimization-boundary",
        charterArticle: "Art. 1 & Art. 9 AQDR",
        observedSignal: "Form requests full date of birth (dpv:BirthDate)",
        observedSurface: "Advisory zero-knowledge predicate alternative: age_over_18",
        summary:
          "Page form metadata requests raw birth date (dpv:BirthDate) where an ephemeral age_over_18 predicate proof could satisfy age eligibility without raw PII disclosure.",
        unverifiedBoundary:
          "Whether the relying party legally requires a full birth date or supports verifiable credential predicates is not verified."
      });
    }

    return contradictions;
  }

  function buildStandardsSummary({
    findings = [],
    domains = [],
    privacySignals = null,
    fingerprinting = []
  } = {}) {
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
    const highEntropyClientHintsObserved =
      privacySignals && typeof privacySignals.highEntropyClientHintsObserved === "boolean"
        ? privacySignals.highEntropyClientHintsObserved
        : false;
    const storageEstimateObserved =
      privacySignals && typeof privacySignals.storageEstimateObserved === "boolean"
        ? privacySignals.storageEstimateObserved
        : false;

    const aqdrContradictions = evaluateSignalContradictions({
      findings,
      domains,
      privacySignals,
      fingerprinting
    });

    return {
      blindConvener: BLIND_CONVENER_POSTURE,
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
      },
      modernSurfaceProbes: {
        highEntropyClientHintsObserved,
        storageEstimateObserved
      },
      aqdrContradictions
    };
  }

  return Object.freeze({
    BLIND_CONVENER_POSTURE,
    DPV_SPEC_METADATA,
    ISO_27560_METADATA,
    GPC_SPEC_METADATA,
    DIGITAL_CREDENTIALS_SPEC_METADATA,
    FIELD_KEY_TO_DPV,
    CLASSIFICATION_TO_DPV,
    OFFLINE_TOSDR_CATALOG,
    mapFieldKeyToDpv,
    mapDomainClassificationToDpv,
    lookupOfflineTosdrDeclarations,
    normalizeTosdrDeclaration,
    evaluateSignalContradictions,
    buildStandardsSummary
  });
});
