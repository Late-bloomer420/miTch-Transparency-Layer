(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.MitchI18n = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const SUPPORTED_LOCALES = Object.freeze(["en", "de"]);

  const EVIDENCE_BADGES = Object.freeze({
    observed: Object.freeze({ key: "observed", symbol: "●", en: "Observed", de: "Beobachtet" }),
    declared: Object.freeze({ key: "declared", symbol: "◈", en: "Declared", de: "Deklariert" }),
    potential: Object.freeze({ key: "potential", symbol: "◌", en: "Potential", de: "Potenziell" }),
    not_verified: Object.freeze({ key: "not_verified", symbol: "◇", en: "Not verified", de: "Nicht verifiziert" }),
    unknown: Object.freeze({ key: "unknown", symbol: "?", en: "Unknown", de: "Unbekannt" }),
    unavailable: Object.freeze({ key: "unavailable", symbol: "⊘", en: "Unavailable", de: "Nicht verfügbar" }),
    not_observed: Object.freeze({ key: "not_observed", symbol: "○", en: "Not observed", de: "Nicht beobachtet" })
  });

  const UI_STRINGS = Object.freeze({
    en: Object.freeze({
      heroSubtitle: "See what websites can know before deciding what to share.",
      langSwitchLabel: "Language",
      modeSwitchLabel: "Observation mode",
      modeContinuous: "Continuous observation",
      modeOnDemand: "Inspect on demand",
      surfaceScoreKicker: "Surface Score",
      scoreSemantics:
        "Informational surface summary (surface-score-v1 · visibility-rules-v1). Low score ≠ safe; does not measure server collection, sharing, or sale; unavailable checks are never counted as zero.",
      dimCoverage: "Coverage",
      dimExposure: "Exposure",
      dimEvidence: "Evidence",
      siteTitle: "Current Website",
      labelOrigin: "Origin",
      labelProtocol: "Protocol",
      labelPageTitle: "Page Title",
      labelCollector: "Collector",
      labelWindow: "Observed Window",
      cookiesTitle: "Cookie Presence",
      labelTotalCookies: "Total cookies",
      labelFirstPartyCookies: "First-party",
      labelThirdPartyCookies: "Third-party scope",
      storageTitle: "Client Storage",
      visibilityTitle: "AskMI Data-Minimization & Visibility Layer",
      visibilityGuardrail:
        "Inspects form input attribute metadata only (WELT, GRUNDVERSORGUNG, VULNERABLE). Entered values are never read.",
      proofBridgeHeading: "Suggested minimal AskMI proof",
      proofBridgeBody:
        "Advisory option: Instead of sharing your full date of birth, an AskMI age_over_18 predicate proof is sufficient where only age eligibility is needed.",
      copyProofJsonBtn: "Copy Proof Suggestion (JSON)",
      copyProofMdBtn: "Copy human-readable Markdown",
      walletOptInLabel: "Experimental wallet deep-links (localhost only)",
      openLocalWalletBtn: "Open in local AskMI Wallet (experimental)",
      thirdPartyTitle: "Third-Party Network Activity",
      thirdPartyGuardrail:
        "Separates unique contacted domains, observed request counts, and local tracker-rule matches. Network contact ≠ verified payload or data sale.",
      fingerprintTitle: "Fingerprinting Surface Observation",
      fingerprintGuardrail:
        "API calls observed in page MAIN world since load (a determined site can still evade via iframe realms). Not observed ≠ absent.",
      permissionsTitle: "Permission Surface & Extension Permissions",
      permissionExplainToggle: "Why this extension requests browser permissions",
      comparisonTitle: "Before / After Comparison & Local Session Timeline",
      comparisonGuardrail:
        "Opt-in local session timeline (off by default). Stores sanitized counts only; 1-click deletable.",
      timelineOptInLabel: "Enable local session timeline (opt-in, off by default)",
      scenarioLabel: "Comparison scenario",
      scenarioLogin: "Before vs. after login",
      scenarioConsent: "Before vs. after cookie consent",
      scenarioPageChange: "Page change",
      saveBeforeBtn: "Save 'Before' snapshot",
      saveAfterBtn: "Save 'After' & compare",
      clearTimelineBtn: "Delete all local snapshots",
      reportTitle: "Five-State Evidence Report",
      reportGuardrail:
        "Not observed during this scan ≠ absent. Provider declarations are separated from observed technical events. URL query and fragment tokens are redacted.",
      headingObserved: "● Observed (Technical Events)",
      headingDeclared: "◈ Declared (Provider Notices — Unverified)",
      headingPotential: "◌ Potential Access",
      headingUnknown: "? Unknown (Server / Downstream)",
      headingUnavailable: "⊘ Unavailable Checks",
      copyMarkdownBtn: "Copy Markdown Receipt",
      copyJsonBtn: "Copy JSON Receipt (v1)",
      footerText:
        "We show what is technically observable and technically possible. We do not claim what happens on remote servers.",
      detailWhatObserved: "Observed",
      detailDeclared: "Declared (Provider Notice)",
      detailPotential: "Potential Access",
      detailNotVerified: "Not Verified",
      detailUnknown: "Unknown (Server Boundary)",
      detailWhyItMatters: "Why this matters",
      detailUserAction: "What you can do",
      notObservedNote: "Not observed during this scan (not observed ≠ absent).",
      noDeclarationsNote: "No cited provider declarations recorded in this scan."
    }),
    de: Object.freeze({
      heroSubtitle: "Sehen, was Websites technisch erfahren können, bevor Sie Daten teilen.",
      langSwitchLabel: "Sprache",
      modeSwitchLabel: "Beobachtungsmodus",
      modeContinuous: "Fortlaufende Beobachtung",
      modeOnDemand: "Nur bei Aufruf prüfen",
      surfaceScoreKicker: "Surface Score (Oberflächenwert)",
      scoreSemantics:
        "Informativer Oberflächen-Überblick (surface-score-v1 · visibility-rules-v1). Niedriger Wert ≠ sicher; misst keine Server-Speicherung, Weitergabe oder Datenverkauf; nicht verfügbare Prüfungen zählen nie als null.",
      dimCoverage: "Abdeckung",
      dimExposure: "Exposition",
      dimEvidence: "Evidenz",
      siteTitle: "Aktuelle Website",
      labelOrigin: "Herkunft (Origin)",
      labelProtocol: "Protokoll",
      labelPageTitle: "Seitentitel",
      labelCollector: "Kollektor",
      labelWindow: "Zeitfenster",
      cookiesTitle: "Cookie-Präsenz",
      labelTotalCookies: "Cookies gesamt",
      labelFirstPartyCookies: "Erstanbieter",
      labelThirdPartyCookies: "Drittanbieter-Bereich",
      storageTitle: "Client-Speicher",
      visibilityTitle: "AskMI Datenminimierung & Sichtbarkeitsschicht",
      visibilityGuardrail:
        "Prüft ausschließlich Formularfeld-Metadaten (WELT, GRUNDVERSORGUNG, VULNERABLE). Eingegebene Werte werden niemals gelesen.",
      proofBridgeHeading: "Vorgeschlagener minimaler AskMI-Nachweis",
      proofBridgeBody:
        "Unverbindlicher Hinweis: Statt Ihr vollständiges Geburtsdatum preiszugeben, genügt ein AskMI-Prädikatsnachweis age_over_18, sofern nur die Volljährigkeit geprüft wird.",
      copyProofJsonBtn: "Nachweis-Vorschlag kopieren (JSON)",
      copyProofMdBtn: "Lesbares Markdown kopieren",
      walletOptInLabel: "Experimentelle Wallet-Deep-Links (nur localhost)",
      openLocalWalletBtn: "In lokaler AskMI Wallet öffnen (experimentell)",
      thirdPartyTitle: "Drittanbieter-Netzwerkaktivität",
      thirdPartyGuardrail:
        "Trennt kontaktierte Domains, beobachtete Anfragezahlen und lokale Tracker-Regeltreffer. Netzwerkkontakt ≠ verifizierter Inhalt oder Datenverkauf.",
      fingerprintTitle: "Fingerprinting-Oberflächenbeobachtung",
      fingerprintGuardrail:
        "Im MAIN-World-Kontext beobachtete API-Aufrufe seit Seitenstart (Umgehung über Iframe-Kontexte bleibt technisch möglich). Nicht beobachtet ≠ nicht vorhanden.",
      permissionsTitle: "Berechtigungsoberfläche & Erweiterungsrechte",
      permissionExplainToggle: "Warum diese Erweiterung Browser-Berechtigungen anfordert",
      comparisonTitle: "Vorher/Nachher-Vergleich & Lokaler Sitzungsverlauf",
      comparisonGuardrail:
        "Lokaler Sitzungsverlauf (Opt-in, standardmäßig aus). Speichert nur bereinigte Zählerstände; mit 1 Klick löschbar.",
      timelineOptInLabel: "Lokalen Sitzungsverlauf aktivieren (Opt-in, standardmäßig aus)",
      scenarioLabel: "Vergleichsszenario",
      scenarioLogin: "Vor vs. nach Login",
      scenarioConsent: "Vor vs. nach Cookie-Einwilligung",
      scenarioPageChange: "Seitenwechsel",
      saveBeforeBtn: "'Vorher'-Stand speichern",
      saveAfterBtn: "'Nachher' speichern & vergleichen",
      clearTimelineBtn: "Alle lokalen Stände löschen",
      reportTitle: "Fünf-Stufen-Evidenzbericht",
      reportGuardrail:
        "In diesem Scan nicht beobachtet ≠ nicht vorhanden. Anbietererklärungen sind strikt von beobachteten technischen Ereignissen getrennt. URL-Parameter und Fragmente werden entfernt.",
      headingObserved: "● Beobachtet (Technische Ereignisse)",
      headingDeclared: "◈ Deklariert (Anbieterangaben — Nicht verifiziert)",
      headingPotential: "◌ Potenzieller Zugriff",
      headingUnknown: "? Unbekannt (Server / Nachgelagert)",
      headingUnavailable: "⊘ Nicht verfügbare Prüfungen",
      copyMarkdownBtn: "Markdown-Beleg kopieren",
      copyJsonBtn: "JSON-Beleg kopieren (v1)",
      footerText:
        "Wir zeigen, was im Browser technisch beobachtbar und möglich ist. Wir treffen keine Aussagen über fremde Server.",
      detailWhatObserved: "Beobachtet",
      detailDeclared: "Deklariert (Anbieterangabe)",
      detailPotential: "Potenzieller Zugriff",
      detailNotVerified: "Nicht verifiziert",
      detailUnknown: "Unbekannt (Server-Grenze)",
      detailWhyItMatters: "Warum das relevant ist",
      detailUserAction: "Was Sie tun können",
      notObservedNote: "Während dieses Scans nicht beobachtet (nicht beobachtet ≠ nicht vorhanden).",
      noDeclarationsNote: "Keine zitierten Anbietererklärungen in diesem Scan erfasst."
    })
  });

  const PERMISSION_EXPLANATIONS = Object.freeze({
    en: Object.freeze([
      {
        permission: "activeTab",
        reason: "Inspects the currently active tab origin and title when you open the popup.",
        neverReads: "Never exports URL query parameters, fragments, or credentials."
      },
      {
        permission: "cookies",
        reason: "Counts cookies for the current origin and separates first-party vs. third-party cookie domains.",
        neverReads: "Never reads or exports cookie values or session tokens."
      },
      {
        permission: "tabs",
        reason: "Identifies the active tab ID to request DOM surface metadata and resets counters on navigation.",
        neverReads: "Never records cross-tab browsing history."
      },
      {
        permission: "webRequest",
        reason: "Counts outbound request hostnames to distinguish first-party vs. third-party domains.",
        neverReads: "Never inspects request bodies, POST payloads, or auth headers."
      },
      {
        permission: "host_permissions (http/https)",
        reason: "Injects early document_start observers so Canvas/WebGL/Audio/WebRTC calls and form metadata can be observed.",
        neverReads: "Never reads typed form input values or storage contents. Can be paused via On-Demand mode."
      }
    ]),
    de: Object.freeze([
      {
        permission: "activeTab",
        reason: "Prüft Origin und Titel des aktiven Tabs, wenn Sie das Popup öffnen.",
        neverReads: "Exportiert niemals URL-Suchparameter, Fragmente oder Zugangsdaten."
      },
      {
        permission: "cookies",
        reason: "Zählt Cookies für die aktuelle Origin und trennt Erst- und Drittanbieter-Domains.",
        neverReads: "Liest oder exportiert niemals Cookie-Werte oder Sitzungs-Tokens."
      },
      {
        permission: "tabs",
        reason: "Ermittelt die aktive Tab-ID für DOM-Metadatenabfragen und setzt Zähler bei Navigation zurück.",
        neverReads: "Speichert niemals eine tab-übergreifende Browser-Chronik."
      },
      {
        permission: "webRequest",
        reason: "Zählt kontaktierte Hostnamen zur Trennung von Erst- und Drittanbieter-Domains.",
        neverReads: "Liest niemals Request-Bodies, POST-Daten oder Authentifizierungs-Header."
      },
      {
        permission: "host_permissions (http/https)",
        reason: "Ermöglicht frühe document_start-Beobachtung für Canvas/WebGL/Audio/WebRTC und Formular-Metadaten.",
        neverReads: "Liest niemals eingegebene Formularwerte oder Speicherinhalte. Über 'Nur bei Aufruf prüfen' pausierbar."
      }
    ])
  });

  function normalizeLocale(lang) {
    if (typeof lang === "string" && lang.trim().toLowerCase().startsWith("de")) {
      return "de";
    }
    return "en";
  }

  function t(key, locale = "en") {
    const loc = normalizeLocale(locale);
    const dict = UI_STRINGS[loc] || UI_STRINGS.en;
    return dict[key] || UI_STRINGS.en[key] || key;
  }

  function getEvidenceBadge(stateKey, locale = "en") {
    const loc = normalizeLocale(locale);
    const normalizedKey = String(stateKey || "unknown")
      .toLowerCase()
      .replace(/[-\s]+/g, "_");
    const entry = EVIDENCE_BADGES[normalizedKey] || EVIDENCE_BADGES.unknown;
    const label = entry[loc] || entry.en;
    return {
      key: entry.key,
      symbol: entry.symbol,
      label,
      badgeText: `${entry.symbol} ${label}`
    };
  }

  function getPermissionExplanations(locale = "en") {
    const loc = normalizeLocale(locale);
    return PERMISSION_EXPLANATIONS[loc] || PERMISSION_EXPLANATIONS.en;
  }

  function buildSignalExplanation(signalType, context = {}, locale = "en") {
    const loc = normalizeLocale(locale);
    const isDe = loc === "de";

    if (signalType === "thirdPartyDomain" || signalType === "trackerDomain") {
      const domain = context.domain || "external.example";
      const reqCount = Number.isFinite(context.requestCount) ? context.requestCount : 1;
      const isTracker = Boolean(context.isTracker);
      const badge = getEvidenceBadge(isTracker ? "observed" : "potential", loc);
      return {
        badge,
        observed: isDe
          ? `Eine Verbindung zu dieser Domain (${domain}, ${reqCount} Anfrage(n)) wurde beobachtet.`
          : `A connection to this domain (${domain}, ${reqCount} request(s)) was observed.`,
        declared: context.declaredSummary
          ? String(context.declaredSummary)
          : isDe
            ? "Keine zitierte Anbietererklärung in diesem Scan erfasst."
            : "No cited provider declaration recorded in this scan.",
        potential: isDe
          ? isTracker
            ? "Die Domain entspricht einer lokalen Analyse-/Werbe-Regel; beim Verbindungsaufbau werden standardmäßig IP-Adresse und Browser-Metadaten übermittelt."
            : "Kontaktierte Drittanbieter-Server erhalten technisch standardmäßige HTTP-Verbindungsdaten (z. B. IP-Adresse und User-Agent)."
          : isTracker
            ? "This domain matches a local analytics/advertising rule; contacted servers receive standard HTTP connection metadata."
            : "Contacted third-party servers technically receive standard HTTP connection metadata (such as IP address and user agent).",
        notVerified: isDe
          ? "Übertragene Inhalte (Payloads) und spätere Nutzung wurden nicht verifiziert."
          : "The payload and later use were not verified.",
        unknown: isDe
          ? "Server-seitige Speicherdauer, Profilbildung, Weitergabe und Datenverkauf können aus Netzwerkverbindungen allein nicht bestimmt werden."
          : "Server-side retention, profiling, onward sharing, and data sale cannot be determined from network connections alone.",
        whyItMatters: isDe
          ? "Jede eingebundene Drittanbieter-Domain erfährt zumindest, dass Ihr Browser diese Seite aufgerufen hat."
          : "Every contacted third-party domain learns at least that your browser loaded resources while visiting this page.",
        userAction: isDe
          ? "Prüfen Sie vor dem Absenden sensibler Formulare, ob Sie optionale Einwilligungen (Consent) ablehnen oder Inhaltsblocker nutzen möchten."
          : "Consider reviewing cookie/consent settings or content-blocking controls before submitting sensitive forms on pages with many external contacts."
      };
    }

    if (signalType === "visibilityField") {
      const label = context.label || (isDe ? "Formularfeld" : "Form field");
      const layer = context.layer || "GRUNDVERSORGUNG (Medium)";
      const hasProof = Boolean(context.hasProofSuggestion);
      const badge = getEvidenceBadge(layer.startsWith("VULNERABLE") ? "observed" : "potential", loc);
      return {
        badge,
        observed: isDe
          ? `Formularfeld-Metadaten (${label}, Schicht ${layer}) wurden im DOM beobachtet. Eingegebene Werte wurden nicht gelesen.`
          : `Form input attribute metadata (${label}, layer ${layer}) was observed in the DOM. Typed values were never read.`,
        declared: context.declaredSummary
          ? String(context.declaredSummary)
          : isDe
            ? "Keine zitierte Anbietererklärung zum Verarbeitungszweck in diesem Scan erfasst."
            : "No cited provider declaration of purpose recorded in this scan.",
        potential: isDe
          ? "Wenn Sie hier Daten eingeben und absenden, kann die Seite den eingegebenen Rohwert auslesen."
          : "If you type and submit data into this field, the page can read and transmit the entered raw attribute.",
        notVerified: isDe
          ? "Ob ein Wert eingegeben, abgesendet oder für den Dienst tatsächlich erforderlich ist, wurde nicht verifiziert."
          : "Whether a value was entered, submitted, or strictly required for the service's purpose was not verified.",
        unknown: isDe
          ? "Server-seitige Speicherung, Aufbewahrungsfristen, Weitergabe und Verkauf sind unbekannt."
          : "Server-side storage, retention periods, onward sharing, and sale remain unknown.",
        whyItMatters: isDe
          ? "Vollständige Attribute (wie das genaue Geburtsdatum) legen oft mehr offen als für eine bloße Berechtigungsprüfung nötig ist."
          : "Raw attributes (such as a full date of birth) often disclose more personal detail than needed for a simple eligibility check.",
        userAction: hasProof
          ? isDe
            ? "Wo unterstützt, können Sie statt des vollen Geburtsdatums einen datensparsamen AskMI-Prädikatsnachweis (age_over_18) verwenden."
            : "Where supported, consider using a data-minimizing AskMI predicate proof (age_over_18) instead of sharing your full date of birth."
          : isDe
            ? "Geben Sie sensible Attribute nur ein, wenn Sie dem Zweck des Dienstes vertrauen und die Angabe erforderlich ist."
            : "Only enter sensitive attributes when you understand why the service requests them and intend to share them."
      };
    }

    if (signalType === "fingerprinting") {
      const label = context.label || "Browser API";
      const isUnavailable = context.evidenceState === "unavailable";
      const isObserved = context.observed === true;
      const badge = getEvidenceBadge(
        isUnavailable ? "unavailable" : isObserved ? "observed" : "not_observed",
        loc
      );
      return {
        badge,
        observed: isUnavailable
          ? isDe
            ? `Prüfung für ${label} war in diesem Tab nicht verfügbar (wird niemals als sauber gewertet).`
            : `Check for ${label} was unavailable on this tab (never counted as clean).`
          : isObserved
            ? isDe
              ? `Mindestens ein Aufruf von ${label} wurde im MAIN-World-Kontext beobachtet.`
              : `At least one call to ${label} was observed in the page MAIN world.`
            : isDe
              ? `Kein Aufruf von ${label} während dieses Scans beobachtet (nicht beobachtet ≠ nicht vorhanden).`
              : `No call to ${label} observed during this scan (not observed ≠ absent).`,
        declared: isDe
          ? "Keine zitierte Anbietererklärung zu dieser API erfasst."
          : "No cited provider declaration recorded for this API.",
        potential: isDe
          ? `${label} kann für reguläre Darstellung/Medien oder zur Berechnung von Geräte-Merkmalen genutzt werden.`
          : `${label} can be used for legitimate rendering/media features or to derive device/browser characteristics.`,
        notVerified: isDe
          ? "Ob das API-Ergebnis gehasht, zu einem Fingerprint verknüpft oder an Server gesendet wurde, wurde nicht verifiziert."
          : "Whether the API output was hashed, combined into a fingerprint, or transmitted off-device was not verified.",
        unknown: isDe
          ? "Server-seitige Wiedererkennung, Profilbildung und kommerzielle Nutzung bleiben unbekannt."
          : "Server-side device recognition, profiling, and commercial use remain unknown.",
        whyItMatters: isDe
          ? "Grafik-, Audio- und Netzwerk-APIs können Geräteeigenschaften preisgeben, die auch ohne Cookies konstant bleiben."
          : "Graphics, audio, and network APIs can expose device characteristics that persist even when cookies are cleared.",
        userAction: isDe
          ? "Nutzen Sie bei erhöhtem Schutzbedarf Browser-Fingerprinting-Schutzfunktionen oder prüfen Sie die Seite vor einer Anmeldung."
          : "Use browser fingerprinting protections or inspect the page before logging in when visiting untrusted sites."
      };
    }

    if (signalType === "permission") {
      const label = context.label || "Permission";
      const state = context.state || "Unavailable";
      const badge = getEvidenceBadge(
        state === "Unavailable" ? "unavailable" : state === "Granted" ? "observed" : "potential",
        loc
      );
      return {
        badge,
        observed: isDe
          ? `Browser-Berechtigungsstatus für ${label}: ${state}.`
          : `Browser permission state for ${label}: ${state}.`,
        declared: isDe
          ? "Keine zitierte Anbietererklärung erfasst."
          : "No cited provider declaration recorded.",
        potential: isDe
          ? state === "Granted"
            ? `Skripte dieser Origin können ${label} ohne erneute Rückfrage ansprechen.`
            : `Die Seite müsste vor dem Zugriff auf ${label} eine Browser-Freigabe anfordern oder ist blockiert.`
          : state === "Granted"
            ? `Scripts on this origin can invoke ${label} without an additional browser prompt.`
            : `The site must prompt for permission or is blocked from accessing ${label}.`,
        notVerified: isDe
          ? `Ob während dieser Sitzung tatsächlich Daten über ${label} ausgelesen wurden, wurde nicht verifiziert.`
          : `Whether ${label} data was actively read during this session was not verified.`,
        unknown: isDe
          ? "Ob abgerufene Sensordaten auf Servern gespeichert oder weitergegeben werden, ist unbekannt."
          : "Whether any resulting capability data is stored or shared on remote servers is unknown.",
        whyItMatters: isDe
          ? "Dauerhaft erteilte Berechtigungen ('Granted') erlauben Zugriff im Hintergrund, solange der Tab geöffnet ist."
          : "Persistently granted permissions allow the site to access that capability whenever the tab is open.",
        userAction: isDe
          ? "Entziehen Sie nicht mehr benötigte Berechtigungen über das Symbol neben der Adressleiste Ihres Browsers."
          : "Revoke permissions you no longer need using your browser's address-bar site settings."
      };
    }

    const badge = getEvidenceBadge(context.evidenceState || "observed", loc);
    return {
      badge,
      observed:
        typeof context.observed === "string" && context.observed
          ? context.observed
          : isDe
            ? "Technischer Zustand im Browser beobachtet."
            : "Browser-visible technical state observed.",
      declared:
        context.declared ||
        (isDe ? "Keine zitierte Anbietererklärung erfasst." : "No cited provider declaration recorded."),
      potential:
        context.potential ||
        (isDe
          ? "Kann zur Sitzungs- oder Zustandsverwaltung im Browser dienen."
          : "Can maintain browser session or preference state."),
      notVerified:
        context.notVerified ||
        (isDe
          ? "Inhalte, Zweck und Übertragung wurden nicht verifiziert."
          : "Contents, purpose, and transmission were not verified."),
      unknown:
        context.unknown ||
        (isDe
          ? "Server-seitige Speicherung, Weitergabe und Verkauf sind unbekannt."
          : "Server-side retention, sharing, and sale are unknown."),
      whyItMatters: isDe
        ? "Lokale Speicher- und Cookie-Einträge ermöglichen das Wiedererkennen einer Sitzung über Seitenaufrufe hinweg."
        : "Local storage and cookie entries allow a site or embedded service to recognize a session across page loads.",
      userAction: isDe
        ? "Sie können Website-Daten in den Browser-Einstellungen löschen oder vor/nach der Einwilligung vergleichen."
        : "You can clear site data in browser settings or compare surface changes before and after consent."
    };
  }

  function formatLocalizedReceiptMarkdown(receipt, locale = "en") {
    const loc = normalizeLocale(locale);
    const receiptEngine =
      (typeof globalThis !== "undefined" && globalThis.MitchSurfaceReceipt) ||
      (typeof require === "function" ? require("./surface-receipt.js") : null);

    if (!receiptEngine) {
      throw new Error("MitchSurfaceReceipt engine is required to serialize Markdown receipts.");
    }
    if (loc === "en") {
      return receiptEngine.serializeReceiptMarkdown(receipt);
    }

    const esc = receiptEngine.escapeMarkdownInline;
    const code = (v) =>
      String(v || "")
        .replace(/[\u0000-\u001f\u007f]/g, " ")
        .replace(/`/g, "'")
        .trim();
    const cov = receipt.surfaceScore.dimensions.observationCoverage;
    const exp = receipt.surfaceScore.dimensions.technicalExposure;
    const qual = receipt.surfaceScore.dimensions.evidenceQuality;
    const comp = receipt.surfaceScore.components;
    const fmtComp = (v) => (v === null || v === undefined ? "nicht verfügbar" : `+${v}`);

    let scoreText;
    if (receipt.surfaceScore.value !== null) {
      scoreText = `${receipt.surfaceScore.value}/100 — ${esc(receipt.surfaceScore.category)}`;
    } else if (
      receipt.collector.scanStatus === "limited" &&
      receipt.surfaceScore.observedMinimum !== null &&
      receipt.surfaceScore.unverifiedMaximum !== null
    ) {
      scoreText = `Unvollständig (${receipt.surfaceScore.observedMinimum}–${receipt.surfaceScore.unverifiedMaximum}/100 nicht verifizierter Bereich) — ${esc(receipt.surfaceScore.category)}`;
    } else if (receipt.collector.scanStatus === "preview") {
      scoreText = `Nur Vorschau (lokaler Vorschauwert ${receipt.surfaceScore.observedMinimum}/100; kein aktiver Erweiterungs-Scan)`;
    } else {
      scoreText = `Nicht verfügbar (${esc(receipt.collector.scanStatus)})`;
    }

    const lines = [
      `# miTch Transparency Layer — Oberflächen-Beleg (Surface Receipt v1, DE)`,
      ``,
      `> Informativer Oberflächen-Überblick (\`${code(receipt.surfaceScore.scoringRuleVersion)}\` · \`${code(receipt.collector.ruleSetVersion)}\`). Niedriger Wert ≠ sicher; nicht verfügbare Prüfungen werden niemals als null gewertet. In diesem Scan nicht beobachtet ≠ nicht vorhanden.`,
      ``,
      `## Scan-Herkunft & Status`,
      `- **Schema:** \`${code(receipt.schema)}\``,
      `- **Beleg-ID:** \`${code(receipt.receiptId)}\``,
      `- **Erfasst am:** ${esc(receipt.capturedAt)}`,
      `- **Kollektor:** ${esc(receipt.collector.name)} \`v${code(receipt.collector.version)}\` (Revision: \`${code(receipt.collector.revision)}\`, Regeln: \`${code(receipt.collector.ruleSetVersion)}\`, Modus: \`${code(receipt.collector.mode)}\`)`,
      `- **Scan-Status:** \`${code(receipt.collector.scanStatus)}\` (Zeitfenster: \`${receipt.collector.observationWindowMs}ms\`)`,
      `- **Seiten-Origin:** \`${code(receipt.page.origin)}\` (${esc(receipt.page.protocol)})`,
      `- **Seitentitel (nicht vertrauenswürdige Seiten-Metadaten):** ${esc(receipt.page.title)}`,
      `- **Vollständige URL enthalten:** \`false\` (Suchparameter und Fragmente entfernt)`,
      ``,
      `## Surface Score & Dimensionen`,
      `- **Surface Score:** **${scoreText}**`,
      `- **Beobachtungsabdeckung (Coverage):** ${cov.percent}% (${cov.checkedSources}/${cov.totalSources} Quellen verfügbar)`,
      `- **Technische Exposition (Exposure):** ${exp.value !== null ? `${exp.value}/100` : exp.observedMinimum !== null ? `${exp.observedMinimum}–${exp.unverifiedMaximum}/100` : "Nicht verfügbar"} (${esc(exp.category)})`,
      `- **Evidenzqualität (Evidence):** ${qual.directObservedCount} beobachtet, ${qual.declaredCount} deklariert, ${qual.potentialCount} potenziell, ${qual.unavailableCount} nicht verfügbar (\`${code(qual.summary)}\`)`,
      `- **Komponenten:** cookies=${fmtComp(comp.cookies)}, thirdPartyRequests=${fmtComp(comp.thirdPartyRequests)}, knownTrackerDomains=${fmtComp(comp.knownTrackerDomains)}, fingerprintingCalls=${fmtComp(comp.fingerprintingCalls)}, grantedPermissions=${fmtComp(comp.grantedPermissions)}, promptPermissions=${fmtComp(comp.promptPermissions)}`,
      ``,
      `## Fünf-Stufen-Evidenzbericht`,
      `_Während dieses Scans nicht beobachtet bedeutet nicht, dass eine Verarbeitung auf der Seite oder auf Servern fehlt._`,
      ``,
      `### 1. ${getEvidenceBadge("observed", "de").badgeText}`
    ];

    if (receipt.report.observed.length === 0) {
      lines.push(`- Während dieses Scans nicht beobachtet (nicht beobachtet ≠ nicht vorhanden).`);
    } else {
      for (const item of receipt.report.observed) {
        lines.push(
          `- **${esc(item.summary)}** _(Quelle: \`${code(item.source)}\`, Konfidenz: \`${code(item.confidence)}\`)_`
        );
        if (item.bounded) {
          lines.push(`  - Beobachtet: ${esc(item.bounded.observed)}`);
          lines.push(`  - Deklariert / Potenziell: ${esc(item.bounded.declaredOrPossible)}`);
          lines.push(`  - Nicht verifiziert: ${esc(item.bounded.notVerified)}`);
          lines.push(`  - Unbekannt: ${esc(item.bounded.unknown)}`);
        }
      }
    }
    lines.push(``);

    lines.push(`### 2. ${getEvidenceBadge("declared", "de").badgeText}`);
    if (receipt.report.declared.length === 0) {
      lines.push(`- Keine zitierten Anbietererklärungen in diesem Scan erfasst.`);
    } else {
      for (const item of receipt.report.declared) {
        lines.push(
          `- **${esc(item.summary)}** _(Quelle: \`${code(item.sourceReference)}\`, abgerufen: ${esc(item.retrievedAt)}, unabhängigVerifiziert: \`${item.independentlyVerified}\`)_`
        );
      }
    }
    lines.push(``);

    lines.push(`### 3. ${getEvidenceBadge("potential", "de").badgeText}`);
    if (receipt.report.potential.length === 0) {
      lines.push(`- Für diesen Scan-Status nicht verfügbar.`);
    } else {
      for (const item of receipt.report.potential) {
        lines.push(`- ${esc(item.summary)} _(Quelle: \`${code(item.source)}\`)_`);
      }
    }
    lines.push(``);

    lines.push(`### 4. ${getEvidenceBadge("unknown", "de").badgeText}`);
    for (const item of receipt.report.unknown) {
      lines.push(`- ${esc(item.summary)}`);
    }
    lines.push(``);

    lines.push(`### 5. ${getEvidenceBadge("unavailable", "de").badgeText}`);
    if (receipt.report.unavailable.length === 0) {
      lines.push(`- Keine — alle konfigurierten Browser-Prüfungen haben geantwortet.`);
    } else {
      for (const item of receipt.report.unavailable) {
        lines.push(
          `- **${esc(item.summary)}** _(Quelle: \`${code(item.source)}\`, Grund: \`${code(item.reason || "unavailable")}\`)_`
        );
      }
    }
    lines.push(``);
    lines.push(`## Beleg-Integrität`);
    lines.push(`- **Normalisierungs-Version:** \`${code(receipt.integrity.normalizationVersion)}\``);
    lines.push(`- **SHA-256 Content-Hash:** \`${code(receipt.integrity.contentHash)}\``);

    return lines.join("\n");
  }

  return Object.freeze({
    SUPPORTED_LOCALES,
    EVIDENCE_BADGES,
    UI_STRINGS,
    PERMISSION_EXPLANATIONS,
    normalizeLocale,
    t,
    getEvidenceBadge,
    getPermissionExplanations,
    buildSignalExplanation,
    formatLocalizedReceiptMarkdown
  });
});
