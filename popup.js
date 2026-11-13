const $ = (id) => (typeof document !== "undefined" ? document.getElementById(id) : null);

let latestReceipt = null;
let currentLocale = "en";
let baselineComparisonSnapshot = null;

const WALLET_DEEPLINK_OPTIN_KEY = "mitch_experimental_wallet_deeplink";
const LOCALE_STORAGE_KEY = "mitch_ui_locale";

const timelineStore =
  typeof globalThis !== "undefined" &&
  globalThis.MitchComparisonStore &&
  typeof globalThis.MitchComparisonStore.createTimelineStore === "function"
    ? globalThis.MitchComparisonStore.createTimelineStore({
        storage: typeof window !== "undefined" ? window.localStorage : null
      })
    : null;

const permissionQueries = [
  { key: "geolocation", label: "Geolocation", name: "geolocation" },
  { key: "notifications", label: "Notifications", name: "notifications" },
  { key: "camera", label: "Camera", name: "camera" },
  { key: "microphone", label: "Microphone", name: "microphone" },
  { key: "clipboard", label: "Clipboard", name: "clipboard-read" }
];

if (typeof document !== "undefined" && typeof document.addEventListener === "function") {
  document.addEventListener("DOMContentLoaded", () => {
    initLocaleAndModeControls();
    bindExportButtons();
    bindProofBridgeButtons();
    bindComparisonControls();
    init();
  });
}

function getI18n() {
  if (typeof globalThis !== "undefined" && globalThis.MitchI18n) {
    return globalThis.MitchI18n;
  }
  if (typeof require === "function") {
    try {
      return require("./i18n.js");
    } catch {
      return null;
    }
  }
  return null;
}

function getDomainBoundary() {
  if (typeof globalThis !== "undefined" && globalThis.MitchDomainBoundary) {
    return globalThis.MitchDomainBoundary;
  }
  if (typeof require === "function") {
    try {
      return require("./domain-boundary.js");
    } catch {
      return null;
    }
  }
  return null;
}

function initLocaleAndModeControls() {
  const i18n = getI18n();
  try {
    const saved = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    currentLocale = i18n ? i18n.normalizeLocale(saved || navigator.language || "en") : "en";
  } catch {
    currentLocale = "en";
  }

  const langSelect = $("langSelect");
  if (langSelect) {
    langSelect.value = currentLocale;
    langSelect.addEventListener("change", () => {
      currentLocale = i18n ? i18n.normalizeLocale(langSelect.value) : langSelect.value;
      try {
        window.localStorage.setItem(LOCALE_STORAGE_KEY, currentLocale);
      } catch {
        // Ignore storage write errors
      }
      applyStaticTranslations(currentLocale);
      if (latestReceipt) renderReceipt(latestReceipt);
    });
  }

  const modeSelect = $("collectionModeSelect");
  if (modeSelect) {
    if (typeof chrome !== "undefined" && chrome.runtime && typeof chrome.runtime.sendMessage === "function") {
      try {
        chrome.runtime.sendMessage({ type: "MITCH_GET_COLLECTION_MODE" }, (res) => {
          if (res && res.collectionMode) {
            modeSelect.value = res.collectionMode;
          }
        });
      } catch {
        // Ignore
      }
    }
    modeSelect.addEventListener("change", () => {
      const nextMode = modeSelect.value === "on-demand" ? "on-demand" : "continuous";
      if (typeof chrome !== "undefined" && chrome.runtime && typeof chrome.runtime.sendMessage === "function") {
        try {
          chrome.runtime.sendMessage({ type: "MITCH_SET_COLLECTION_MODE", collectionMode: nextMode });
        } catch {
          // Ignore
        }
      }
    });
  }

  applyStaticTranslations(currentLocale);
}

function applyStaticTranslations(locale = currentLocale) {
  const i18n = getI18n();
  if (!i18n) return;
  if (typeof document !== "undefined" && document.documentElement) {
    document.documentElement.lang = locale;
  }

  const mapIds = [
    ["heroSubtitle", "heroSubtitle"],
    ["langSwitchLabel", "langSwitchLabel"],
    ["modeSwitchLabel", "modeSwitchLabel"],
    ["modeContinuousOpt", "modeContinuous"],
    ["modeOnDemandOpt", "modeOnDemand"],
    ["surfaceScoreKicker", "surfaceScoreKicker"],
    ["scoreSemantics", "scoreSemantics"],
    ["dimCoverage", "dimCoverage"],
    ["dimExposure", "dimExposure"],
    ["dimEvidence", "dimEvidence"],
    ["site-title", "siteTitle"],
    ["labelOrigin", "labelOrigin"],
    ["labelProtocol", "labelProtocol"],
    ["labelPageTitle", "labelPageTitle"],
    ["labelCollector", "labelCollector"],
    ["labelWindow", "labelWindow"],
    ["cookies-title", "cookiesTitle"],
    ["labelTotalCookies", "labelTotalCookies"],
    ["labelFirstPartyCookies", "labelFirstPartyCookies"],
    ["labelThirdPartyCookies", "labelThirdPartyCookies"],
    ["storage-title", "storageTitle"],
    ["convener-signals-title", "convenerTitle"],
    ["convenerGuardrail", "convenerGuardrail"],
    ["visibility-layer-title", "visibilityTitle"],
    ["visibilityGuardrail", "visibilityGuardrail"],
    ["proofBridgeHeading", "proofBridgeHeading"],
    ["proofBridgeBody", "proofBridgeBody"],
    ["copyProofJsonBtn", "copyProofJsonBtn"],
    ["copyProofMarkdownBtn", "copyProofMdBtn"],
    ["walletOptInLabel", "walletOptInLabel"],
    ["openLocalWalletBtn", "openLocalWalletBtn"],
    ["third-party-title", "thirdPartyTitle"],
    ["thirdPartyGuardrail", "thirdPartyGuardrail"],
    ["fingerprint-title", "fingerprintTitle"],
    ["fingerprintGuardrail", "fingerprintGuardrail"],
    ["permissions-title", "permissionsTitle"],
    ["permissionExplainToggle", "permissionExplainToggle"],
    ["comparison-title", "comparisonTitle"],
    ["comparisonGuardrail", "comparisonGuardrail"],
    ["timelineOptInLabel", "timelineOptInLabel"],
    ["scenarioLabel", "scenarioLabel"],
    ["scenarioConsentOpt", "scenarioConsent"],
    ["scenarioLoginOpt", "scenarioLogin"],
    ["scenarioPageChangeOpt", "scenarioPageChange"],
    ["saveBeforeSnapBtn", "saveBeforeBtn"],
    ["saveAfterSnapBtn", "saveAfterBtn"],
    ["clearTimelineBtn", "clearTimelineBtn"],
    ["report-title", "reportTitle"],
    ["reportGuardrail", "reportGuardrail"],
    ["headingObserved", "headingObserved"],
    ["headingDeclared", "headingDeclared"],
    ["headingPotential", "headingPotential"],
    ["headingUnknown", "headingUnknown"],
    ["headingUnavailable", "headingUnavailable"],
    ["copyMarkdownBtn", "copyMarkdownBtn"],
    ["copyJsonBtn", "copyJsonBtn"],
    ["footerText", "footerText"]
  ];

  for (const [elId, key] of mapIds) {
    const el = $(elId);
    if (el) el.textContent = i18n.t(key, locale);
  }

  renderExtensionPermissionExplanations(locale);
}

function renderExtensionPermissionExplanations(locale = currentLocale) {
  const i18n = getI18n();
  const listEl = $("extensionPermissionExplainList");
  if (!i18n || !listEl) return;
  const items = i18n.getPermissionExplanations(locale);
  listEl.replaceChildren(
    ...items.map((item) => {
      const li = document.createElement("li");
      li.className = "potential";
      li.textContent = `${item.permission}: ${item.reason} (${item.neverReads})`;
      return li;
    })
  );
}

function bindComparisonControls() {
  const optInToggle = $("enableTimelineToggle");
  const beforeBtn = $("saveBeforeSnapBtn");
  const afterBtn = $("saveAfterSnapBtn");
  const clearBtn = $("clearTimelineBtn");
  const statusEl = $("comparisonStatus");

  if (optInToggle && timelineStore) {
    optInToggle.checked = timelineStore.isOptInEnabled();
    optInToggle.addEventListener("change", () => {
      timelineStore.setOptInEnabled(Boolean(optInToggle.checked));
      if (!optInToggle.checked) {
        baselineComparisonSnapshot = null;
        const diffList = $("comparisonDiffList");
        if (diffList) diffList.replaceChildren();
      }
    });
  }

  if (beforeBtn) {
    beforeBtn.addEventListener("click", () => {
      if (!latestReceipt || !globalThis.MitchComparisonStore) return;
      const scenario = ($("comparisonScenarioSelect") && $("comparisonScenarioSelect").value) || "cookie-consent";
      baselineComparisonSnapshot = globalThis.MitchComparisonStore.sanitizeSnapshotFromReceipt(latestReceipt, {
        scenario,
        stage: "before"
      });
      if (timelineStore && timelineStore.isOptInEnabled()) {
        timelineStore.recordSnapshot(baselineComparisonSnapshot);
      }
      if (statusEl) {
        statusEl.textContent = currentLocale === "de" ? "'Vorher'-Stand gespeichert ✓" : "'Before' snapshot saved ✓";
      }
    });
  }

  if (afterBtn) {
    afterBtn.addEventListener("click", () => {
      if (!latestReceipt || !globalThis.MitchComparisonStore) return;
      const scenario = ($("comparisonScenarioSelect") && $("comparisonScenarioSelect").value) || "cookie-consent";
      const afterSnap = globalThis.MitchComparisonStore.sanitizeSnapshotFromReceipt(latestReceipt, {
        scenario,
        stage: "after"
      });
      if (timelineStore && timelineStore.isOptInEnabled()) {
        timelineStore.recordSnapshot(afterSnap);
      }
      const base =
        baselineComparisonSnapshot ||
        (timelineStore && timelineStore.getSnapshots().length > 1
          ? timelineStore.getSnapshots()[0]
          : afterSnap);
      const diff = globalThis.MitchComparisonStore.compareSnapshots(base, afterSnap, {
        scenario,
        locale: currentLocale
      });
      fillList("comparisonDiffList", diff.summaryLines, "observed", "Δ");
      if (statusEl) {
        statusEl.textContent = currentLocale === "de" ? "Vergleich aktualisiert ✓" : "Comparison updated ✓";
      }
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      baselineComparisonSnapshot = null;
      if (timelineStore) timelineStore.clearTimeline();
      const diffList = $("comparisonDiffList");
      if (diffList) diffList.replaceChildren();
      if (statusEl) {
        statusEl.textContent = currentLocale === "de" ? "Lokale Daten gelöscht ✓" : "Local snapshots deleted ✓";
      }
    });
  }
}

function bindExportButtons() {
  const mdBtn = $("copyMarkdownBtn");
  const jsonBtn = $("copyJsonBtn");
  if (mdBtn) {
    mdBtn.addEventListener("click", () => copySurfaceReport("markdown"));
  }
  if (jsonBtn) {
    jsonBtn.addEventListener("click", () => copySurfaceReport("json"));
  }
}

function isWalletDeepLinkEnabled() {
  try {
    return window.localStorage.getItem(WALLET_DEEPLINK_OPTIN_KEY) === "1";
  } catch {
    return false;
  }
}

function setWalletDeepLinkEnabled(enabled) {
  try {
    if (enabled) {
      window.localStorage.setItem(WALLET_DEEPLINK_OPTIN_KEY, "1");
    } else {
      window.localStorage.removeItem(WALLET_DEEPLINK_OPTIN_KEY);
    }
  } catch {
    // Ignore storage write errors (fail-closed)
  }
}

function syncWalletDeepLinkButtonVisibility() {
  const openBtn = $("openLocalWalletBtn");
  const toggleEl = $("enableWalletDeepLinkToggle");
  if (!openBtn) return;

  const optedIn = toggleEl ? Boolean(toggleEl.checked) : isWalletDeepLinkEnabled();
  const hasSuggestion = Boolean(
    latestReceipt &&
      latestReceipt.visibility &&
      latestReceipt.visibility.proofSuggestion &&
      Array.isArray(latestReceipt.visibility.proofSuggestion.suggestedMinimalClaims) &&
      latestReceipt.visibility.proofSuggestion.suggestedMinimalClaims.length > 0
  );
  openBtn.hidden = !(optedIn && hasSuggestion);
}

function bindProofBridgeButtons() {
  const jsonBtn = $("copyProofJsonBtn");
  const mdBtn = $("copyProofMarkdownBtn");
  const toggleEl = $("enableWalletDeepLinkToggle");
  const openBtn = $("openLocalWalletBtn");

  if (jsonBtn) {
    jsonBtn.addEventListener("click", () => copyProofSuggestion("json"));
  }
  if (mdBtn) {
    mdBtn.addEventListener("click", () => copyProofSuggestion("markdown"));
  }
  if (toggleEl) {
    toggleEl.checked = isWalletDeepLinkEnabled();
    toggleEl.addEventListener("change", () => {
      setWalletDeepLinkEnabled(Boolean(toggleEl.checked));
      syncWalletDeepLinkButtonVisibility();
    });
  }
  if (openBtn) {
    openBtn.addEventListener("click", () => openLocalWalletSuggestion());
  }
}

function openLocalWalletSuggestion() {
  try {
    const toggleEl = $("enableWalletDeepLinkToggle");
    const enabled = toggleEl ? Boolean(toggleEl.checked) : isWalletDeepLinkEnabled();
    if (!enabled) return;

    const suggestion =
      latestReceipt &&
      latestReceipt.visibility &&
      latestReceipt.visibility.proofSuggestion;
    const bridge = globalThis.MitchProofBridge;
    if (!bridge || !suggestion) return;

    const targetUrl = bridge.buildLocalWalletDeepLink(suggestion, { enabled: true });
    if (!targetUrl || !bridge.isAllowedLocalWalletOrigin(targetUrl)) {
      return;
    }

    if (typeof chrome !== "undefined" && chrome.tabs && typeof chrome.tabs.create === "function") {
      chrome.tabs.create({ url: targetUrl }).catch(() => {});
    } else if (typeof window !== "undefined" && typeof window.open === "function") {
      window.open(targetUrl, "_blank", "noopener,noreferrer");
    }
  } catch {
    // Silent / non-blocking per Item 8 specification
  }
}

async function copyProofSuggestion(format) {
  if (
    !latestReceipt ||
    !latestReceipt.visibility ||
    !latestReceipt.visibility.proofSuggestion
  ) {
    return;
  }

  const statusEl = $("proofBridgeStatus");
  const pageContext = {
    origin: latestReceipt.page ? latestReceipt.page.origin : "unknown",
    title: latestReceipt.page ? latestReceipt.page.title : "Untitled page"
  };

  try {
    const suggestion = latestReceipt.visibility.proofSuggestion;
    const bridge = globalThis.MitchProofBridge;
    const text =
      format === "json"
        ? JSON.stringify(
            bridge
              ? bridge.buildProofSuggestionPayload(suggestion, pageContext)
              : { askmiProofSuggestion: suggestion },
            null,
            2
          )
        : (bridge && bridge.buildProofSuggestionMarkdown(suggestion, pageContext)) || "";

    if (!text) return;
    await navigator.clipboard.writeText(text);
    if (statusEl) {
      statusEl.textContent = format === "json" ? "Proof JSON Copied ✓" : "Proof Markdown Copied ✓";
      setTimeout(() => {
        statusEl.textContent = "";
      }, 2200);
    }
  } catch {
    if (statusEl) {
      statusEl.textContent = "Copy failed";
    }
  }
}

async function copySurfaceReport(format) {
  if (!latestReceipt) return;
  const statusEl = $("exportStatus");
  const receiptEngine = globalThis.MitchSurfaceReceipt;
  const i18n = getI18n();
  if (!receiptEngine) return;

  try {
    const text =
      format === "json"
        ? receiptEngine.serializeReceiptJson(latestReceipt)
        : i18n && typeof i18n.formatLocalizedReceiptMarkdown === "function"
          ? i18n.formatLocalizedReceiptMarkdown(latestReceipt, currentLocale)
          : receiptEngine.serializeReceiptMarkdown(latestReceipt);
    await navigator.clipboard.writeText(text);
    if (statusEl) {
      statusEl.textContent = format === "json" ? "JSON (v1) Copied ✓" : "Markdown Copied ✓";
      setTimeout(() => {
        statusEl.textContent = "";
      }, 2200);
    }
  } catch {
    if (statusEl) {
      statusEl.textContent = "Copy failed";
    }
  }
}

function getManifestVersion() {
  try {
    if (
      typeof chrome !== "undefined" &&
      chrome.runtime &&
      typeof chrome.runtime.getManifest === "function"
    ) {
      const m = chrome.runtime.getManifest();
      if (m && m.version) return m.version;
    }
    if (
      typeof globalThis !== "undefined" &&
      globalThis.MITCH_BUILD_META &&
      globalThis.MITCH_BUILD_META.collectorVersion
    ) {
      return globalThis.MITCH_BUILD_META.collectorVersion;
    }
  } catch {
    // Fallback below
  }
  return "0.3.0";
}

function getCollectorRevision() {
  if (
    typeof globalThis !== "undefined" &&
    globalThis.MITCH_BUILD_META &&
    typeof globalThis.MITCH_BUILD_META.sourceRevision === "string"
  ) {
    return globalThis.MITCH_BUILD_META.sourceRevision;
  }
  return "working-tree";
}

async function init() {
  const receiptEngine = globalThis.MitchSurfaceReceipt;
  const collectorVersion = getManifestVersion();
  const collectorRevision = getCollectorRevision();

  try {
    const hasExtensionTabs =
      typeof chrome !== "undefined" &&
      chrome.tabs &&
      typeof chrome.tabs.query === "function" &&
      chrome.runtime &&
      Boolean(chrome.runtime.id);

    if (!hasExtensionTabs) {
      await initStandalonePreview(collectorVersion, collectorRevision);
      return;
    }

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url || !/^https?:\/\//i.test(tab.url)) {
      const unsupportedReceipt = receiptEngine.buildSurfaceReceiptModel({
        collectorVersion,
        collectorRevision,
        mode: "extension",
        scanStatus: "unsupported",
        url: (tab && tab.url) || null,
        title: (tab && tab.title) || "Restricted browser page"
      });
      renderReceipt(unsupportedReceipt);
      return;
    }

    const url = new URL(tab.url);
    const [cookies, contentData, requestData, permissions] = await Promise.all([
      getCookies(url),
      getContentData(tab.id),
      getRequestData(tab.id),
      getPermissions()
    ]);

    const combinedNetwork = receiptEngine.combineNetworkSources(
      requestData,
      contentData && contentData.available ? contentData.requests : { available: false }
    );
    const observationWindowMs = Math.max(
      (requestData && requestData.observationWindowMs) || 0,
      (contentData && contentData.observationWindowMs) || 0
    );

    const receipt = receiptEngine.buildSurfaceReceiptModel({
      collectorVersion,
      collectorRevision,
      mode: "extension",
      collectionMode: (requestData && requestData.collectionMode) || (contentData && contentData.collectionMode) || "continuous",
      url,
      title: tab.title || "Untitled page",
      cookies,
      content: contentData,
      network: combinedNetwork,
      permissions,
      observationWindowMs,
      useOfflineTosdr: true
    });

    renderReceipt(receipt);
  } catch (error) {
    console.error(error);
    if (receiptEngine) {
      const errReceipt = receiptEngine.buildSurfaceReceiptModel({
        collectorVersion,
        collectorRevision,
        mode: "extension",
        scanStatus: "error",
        limitations: ["Unexpected error during popup scan orchestration."]
      });
      renderReceipt(errReceipt);
    }
  }
}

async function initStandalonePreview(collectorVersion, collectorRevision = getCollectorRevision()) {
  const receiptEngine = globalThis.MitchSurfaceReceipt;
  const url = new URL(window.location.href);
  let cookieAvailable = true;
  let cookieCount = 0;
  try {
    cookieCount = document.cookie ? document.cookie.split(";").filter(Boolean).length : 0;
  } catch {
    cookieAvailable = false;
  }

  let localVal = "Unavailable";
  let sessionVal = "Unavailable";
  try {
    const lc = window.localStorage ? window.localStorage.length : 0;
    localVal = lc > 0 ? `${lc} keys` : "Not Detected";
  } catch {
    localVal = "Unavailable";
  }
  try {
    const sc = window.sessionStorage ? window.sessionStorage.length : 0;
    sessionVal = sc > 0 ? `${sc} keys` : "Not Detected";
  } catch {
    sessionVal = "Unavailable";
  }

  const permissions = await getPermissions();
  const receipt = receiptEngine.buildSurfaceReceiptModel({
    collectorVersion,
    collectorRevision,
    mode: "preview",
    scanStatus: "preview",
    url: /^https?:\/\//i.test(url.href) ? url : "http://localhost/",
    title: "Standalone Preview (Local Tab)",
    cookies: cookieAvailable
      ? { available: true, total: cookieCount, firstParty: cookieCount, thirdParty: 0 }
      : { available: false, reason: "document-cookie-unavailable" },
    content: {
      available: true,
      storage: { localStorage: localVal, sessionStorage: sessionVal },
      fingerprinting: {
        canvas: false,
        webgl: false,
        audio: false,
        webrtc: false,
        evalAttempt: false
      },
      csp: {
        hasMetaCsp: false,
        metaBlocksEval: false,
        evalBlockedCount: 0,
        totalViolationCount: 0,
        violatedDirectives: []
      },
      visibilityLayer: {
        highestLayer: "None Detected",
        counts: { vulnerable: 0, grundversorgung: 0, welt: 0 },
        findings: [],
        proofSuggestion: null
      },
      privacySignals: {
        gpcEnabled: navigator.globalPrivacyControl === true,
        doNotTrack: navigator.doNotTrack === "1",
        digitalCredentialsApiAvailable: Boolean(window.DigitalCredential || (navigator.credentials && typeof navigator.credentials.get === "function")),
        digitalCredentialsCallObserved: false,
        highEntropyClientHintsObserved: false,
        storageEstimateObserved: false
      },
      screen: window.screen ? `${window.screen.width} × ${window.screen.height}` : "Unknown",
      language: navigator.language || "Unknown",
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Unknown",
      userAgent: navigator.userAgent || "Unknown"
    },
    network: {
      available: true,
      thirdPartyRequestCount: 0,
      domainCounts: {}
    },
    permissions,
    observationWindowMs: 0
  });

  renderReceipt(receipt);
}

async function getCookies(url) {
  try {
    if (!chrome.cookies || typeof chrome.cookies.getAll !== "function") {
      return { available: false, reason: "cookies-api-missing" };
    }
    const cookies = await chrome.cookies.getAll({ url: url.href });
    const firstParty = cookies.filter((cookie) => sameRegistrableHost(cookie.domain, url.hostname)).length;
    return {
      available: true,
      total: cookies.length,
      firstParty,
      thirdParty: Math.max(0, cookies.length - firstParty)
    };
  } catch {
    return { available: false, reason: "cookies-query-failed" };
  }
}

async function getContentData(tabId) {
  try {
    const response = await chrome.tabs.sendMessage(tabId, { type: "MITCH_COLLECT_SURFACES" });
    if (!response || typeof response !== "object") {
      return { available: false, reason: "empty-content-response" };
    }
    return { ...response, available: response.available !== false };
  } catch {
    return { available: false, reason: "content-script-unreachable" };
  }
}

async function getRequestData(tabId) {
  try {
    const response = await chrome.runtime.sendMessage({ type: "MITCH_GET_TAB_REQUESTS", tabId });
    if (!response || typeof response !== "object") {
      return { available: false, reason: "empty-background-response" };
    }
    return { ...response, available: response.available !== false };
  } catch {
    return { available: false, reason: "background-worker-unreachable" };
  }
}

async function getPermissions() {
  if (typeof navigator === "undefined" || !navigator.permissions || typeof navigator.permissions.query !== "function") {
    return { available: false };
  }
  const results = { available: true };
  await Promise.all(
    permissionQueries.map(async (item) => {
      try {
        const status = await navigator.permissions.query({ name: item.name });
        results[item.key] = normalizePermissionState(status.state);
      } catch {
        results[item.key] = "Unavailable";
      }
    })
  );
  return results;
}

function deriveScanBannerModel(receipt, locale = currentLocale) {
  const isDe = String(locale || "").toLowerCase().startsWith("de");
  const status = receipt && receipt.collector ? receipt.collector.scanStatus : "error";
  if (status === "complete") {
    return { hidden: true, cls: "scan-mode-banner", text: "" };
  }
  if (status === "preview") {
    return {
      hidden: false,
      cls: "scan-mode-banner banner-preview",
      text: isDe
        ? "Standalone-Vorschaumodus — Zeigt nur lokale Vorschau-Daten (kein aktiver Browser-Tab-Scan)."
        : "Standalone Preview Mode — Displaying local preview context only (not a live cross-origin browser tab scan)."
    };
  }
  if (status === "limited") {
    return {
      hidden: false,
      cls: "scan-mode-banner",
      text: isDe
        ? "Eingeschränkter Scan — Mindestens eine Browser-Prüfung war nicht verfügbar. Fehlende Prüfungen werden als 'Nicht verfügbar' ausgewiesen und nie als 0 oder sauber gewertet."
        : "Limited Scan — One or more browser surface checks were unavailable. Missing checks are reported as Unavailable and never counted as zero or clean."
    };
  }
  if (status === "unsupported") {
    return {
      hidden: false,
      cls: "scan-mode-banner banner-danger",
      text: isDe
        ? "Nicht unterstützter Tab — Browser-Richtlinien beschränken die Prüfung auf Nicht-HTTP(S)-Seiten."
        : "Unsupported Tab — Browser policy restricts extension inspection on non-HTTP(S) or privileged pages."
    };
  }
  return {
    hidden: false,
    cls: "scan-mode-banner banner-danger",
    text: isDe
      ? "Scan-Fehler — Browser-Oberflächenprüfungen konnten in diesem Tab nicht zuverlässig ausgeführt werden."
      : "Scan Error — Browser surface checks could not complete reliably on this tab."
  };
}

function deriveScoreViewModel(receipt) {
  const surfaceScore = receipt.surfaceScore;
  const status = receipt.collector.scanStatus;
  const cov = surfaceScore.dimensions.observationCoverage;
  const exp = surfaceScore.dimensions.technicalExposure;
  const qual = surfaceScore.dimensions.evidenceQuality;
  const c = surfaceScore.components;
  const fmt = (v) => (v === null || v === undefined ? "unavail" : `+${v}`);
  const componentsLine = `Components (${surfaceScore.scoringRuleVersion}): cookies ${fmt(c.cookies)} · 3P req ${fmt(c.thirdPartyRequests)} · tracker rules ${fmt(c.knownTrackerDomains)} · FP calls ${fmt(c.fingerprintingCalls)} · perms ${fmt(c.grantedPermissions)}/${fmt(c.promptPermissions)}`;

  const coverageText = `${cov.percent}% (${cov.checkedSources}/${cov.totalSources})`;
  const evidenceText = `${qual.directObservedCount} obs · ${qual.unavailableCount} unavail`;

  if (status === "preview") {
    return {
      scoreValue: "Preview",
      scoreScale: "",
      titleClass: "is-preview",
      scoreCategory: surfaceScore.category,
      scoreCoverage: coverageText,
      scoreExposure: "Preview Only",
      scoreEvidence: evidenceText,
      scoreComponents: `${componentsLine} (local preview context only)`,
      ringPercent: 0,
      ringStroke: "var(--accent-2)"
    };
  }

  if (
    status === "limited" &&
    surfaceScore.observedMinimum !== null &&
    surfaceScore.unverifiedMaximum !== null
  ) {
    const rangeStr = `${surfaceScore.observedMinimum}–${surfaceScore.unverifiedMaximum}`;
    return {
      scoreValue: rangeStr,
      scoreScale: "/100",
      titleClass: "is-range",
      scoreCategory: surfaceScore.category,
      scoreCoverage: coverageText,
      scoreExposure: `${exp.observedMinimum}–${exp.unverifiedMaximum}/100`,
      scoreEvidence: evidenceText,
      scoreComponents: componentsLine,
      ringPercent: surfaceScore.unverifiedMaximum,
      ringStroke: surfaceScore.unverifiedMaximum > 75 ? "var(--danger)" : "var(--warning)"
    };
  }

  if (surfaceScore.value === null) {
    return {
      scoreValue: "--",
      scoreScale: "/100",
      titleClass: "",
      scoreCategory:
        status === "error"
          ? "Unavailable — scan failed without reliable evidence."
          : "Unavailable — scan did not inspect an HTTP/HTTPS page.",
      scoreCoverage: coverageText,
      scoreExposure: "Unavailable",
      scoreEvidence: evidenceText,
      scoreComponents: "Components unavailable (missing evidence is never counted as zero).",
      ringPercent: 0,
      ringStroke: "var(--muted)"
    };
  }

  return {
    scoreValue: String(surfaceScore.value),
    scoreScale: "/100",
    titleClass: "",
    scoreCategory: surfaceScore.category,
    scoreCoverage: coverageText,
    scoreExposure: `${exp.value}/100`,
    scoreEvidence: evidenceText,
    scoreComponents: componentsLine,
    ringPercent: surfaceScore.value,
    ringStroke:
      surfaceScore.value > 75
        ? "var(--danger)"
        : surfaceScore.value > 50
          ? "var(--warning)"
          : surfaceScore.value > 25
            ? "var(--accent-2)"
            : "var(--accent)"
  };
}

function renderReceipt(receipt) {
  latestReceipt = receipt;
  const i18n = getI18n();
  const unavailText = i18n ? i18n.getEvidenceBadge("unavailable", currentLocale).badgeText : "⊘ Unavailable";

  if (typeof document !== "undefined" && document.body) {
    document.body.dataset.scanStatus = receipt.collector.scanStatus;
    document.body.dataset.collectorMode = receipt.collector.mode;
  }

  const bannerEl = $("scanModeBanner");
  if (bannerEl) {
    const banner = deriveScanBannerModel(receipt, currentLocale);
    bannerEl.hidden = banner.hidden;
    bannerEl.className = banner.cls;
    bannerEl.textContent = banner.text;
  }

  const scanPill = $("scanState");
  const statusMap = {
    complete: { text: currentLocale === "de" ? "● Vollständig" : "● Complete Scan", cls: "status-pill" },
    limited: { text: currentLocale === "de" ? "⊘ Eingeschränkt" : "⊘ Limited Scan", cls: "status-pill pill-warning" },
    preview: { text: currentLocale === "de" ? "◌ Vorschau" : "◌ Standalone Preview", cls: "status-pill pill-warning" },
    unsupported: { text: currentLocale === "de" ? "⊘ Nicht unterstützt" : "⊘ Unsupported Tab", cls: "status-pill pill-danger" },
    error: { text: currentLocale === "de" ? "⊘ Fehler" : "⊘ Scan Error", cls: "status-pill pill-danger" }
  };
  const pillMeta = statusMap[receipt.collector.scanStatus] || statusMap.limited;
  if (scanPill) {
    scanPill.textContent = pillMeta.text;
    scanPill.className = pillMeta.cls;
  }

  $("domain").textContent = receipt.page.origin;
  $("protocol").textContent = receipt.page.protocol;
  $("pageTitle").textContent = receipt.page.title;
  $("collectorProvenance").textContent = `v${receipt.collector.version} (${receipt.collector.revision}) · ${receipt.collector.ruleSetVersion} · ${receipt.collector.mode}`;
  const windowEl = $("observationWindow");
  if (windowEl) {
    windowEl.textContent =
      receipt.collector.scanStatus === "preview"
        ? "Preview (no live tab)"
        : receipt.collector.scanStatus === "unsupported" || receipt.collector.scanStatus === "error"
          ? unavailText
          : `${receipt.collector.observationWindowMs} ms (${receipt.collector.collectionMode})`;
  }

  $("cookieTotal").textContent = receipt.cookies.available ? String(receipt.cookies.total) : unavailText;
  $("firstPartyCookies").textContent = receipt.cookies.available ? String(receipt.cookies.firstParty) : unavailText;
  $("thirdPartyCookies").textContent = receipt.cookies.available ? String(receipt.cookies.thirdParty) : unavailText;

  $("localStorageUsage").textContent = receipt.storage.localStorage.label;
  $("sessionStorageUsage").textContent = receipt.storage.sessionStorage.label;

  renderConvenerAndPrivacySignals(receipt);
  renderVisibilityLayer(receipt.visibility);
  renderThirdPartyDomains(receipt.network);

  renderSignals(
    "fingerprintList",
    receipt.fingerprinting.map((fp) => {
      const explain = i18n
        ? i18n.buildSignalExplanation("fingerprinting", fp, currentLocale)
        : null;
      if (fp.evidenceState === "unavailable") {
        return {
          name: fp.label,
          state: "Unavailable",
          stateText: explain ? explain.badge.badgeText : "⊘ Unavailable",
          meta: explain ? explain.observed : "Check could not run because the page content script was unreachable.",
          explanation: explain
        };
      }
      const isObserved = fp.observed === true;
      return {
        name: fp.label,
        state: isObserved ? "Observed" : "Not Observed",
        stateText: explain ? explain.badge.badgeText : isObserved ? "● Observed" : "○ Not Observed",
        meta: explain ? explain.observed : "No call observed during this scan (not observed ≠ absent).",
        explanation: explain
      };
    })
  );

  renderSignals(
    "permissionList",
    receipt.permissions.map((perm) => {
      const explain = i18n
        ? i18n.buildSignalExplanation("permission", perm, currentLocale)
        : null;
      return {
        name: perm.label,
        state: perm.state,
        stateText: explain ? explain.badge.badgeText : perm.state,
        meta: explain ? explain.observed : "Browser Permissions API state.",
        explanation: explain
      };
    })
  );

  renderScoreSection(receipt);
  renderFiveStateReport(receipt.report);
}


function renderConvenerAndPrivacySignals(receipt) {
  const listEl = $("privacySignalsList");
  const badgeEl = $("convenerRoleBadge");
  const i18n = getI18n();
  const isDe = currentLocale === "de";
  if (badgeEl) {
    badgeEl.textContent = isDe ? "● Blinder Convener" : "● Blind Convener";
  }
  if (!listEl) return;

  const standards = receipt && receipt.visibility && receipt.visibility.standards;
  if (!standards) {
    renderSignals("privacySignalsList", [
      {
        name: isDe ? "Standards & Signal-Prüfung nicht verfügbar" : "Standards & signal check unavailable",
        state: "Unavailable",
        stateText: i18n ? i18n.getEvidenceBadge("unavailable", currentLocale).badgeText : "⊘ Unavailable",
        meta: isDe
          ? "Keine Standards-Metadaten für diesen Tab verfügbar."
          : "No standards metadata available for this tab."
      }
    ]);
    return;
  }

  const gpcActive = standards.gpc && standards.gpc.navigatorGlobalPrivacyControl === true;
  const dcObserved = standards.digitalCredentialsApi && standards.digitalCredentialsApi.invocationObserved === true;
  const dcAvailable = standards.digitalCredentialsApi && standards.digitalCredentialsApi.apiAvailableInBrowser === true;
  const modern = standards.modernSurfaceProbes || {};
  const modernObserved = Boolean(modern.highEntropyClientHintsObserved || modern.storageEstimateObserved);
  const contradictions = Array.isArray(standards.aqdrContradictions) ? standards.aqdrContradictions : [];

  const items = [
    {
      name: isDe
        ? "Blinder Provider & Convener (Strukturelle Blindheit)"
        : "Blind Provider & Convener (Structural Blindness)",
      state: "Observed",
      stateText: i18n ? i18n.getEvidenceBadge("observed", currentLocale).badgeText : "● Observed",
      meta: isDe
        ? "Formular-/Cookie-/Speicherwerte: nie gelesen · Netzwerk-Egress: blockiert (connect-src 'none') · § 26 TDDDG Neutralität: kein wirtschaftliches Eigeninteresse."
        : "Form/cookie/storage values: never read · Network egress: blocked (connect-src 'none') · § 26 TDDDG neutrality: zero economic self-interest."
    },
    {
      name: "W3C Global Privacy Control (Sec-GPC: 1)",
      state: gpcActive ? "Observed" : "Not Observed",
      stateText: gpcActive
        ? (i18n ? i18n.getEvidenceBadge("observed", currentLocale).badgeText : "● Active")
        : (i18n ? i18n.getEvidenceBadge("not_observed", currentLocale).badgeText : "○ Not Enabled"),
      meta: gpcActive
        ? (isDe
            ? "navigator.globalPrivacyControl = true. Technisches Präferenzsignal aktiv (allein nicht rechtsverbindlich; Server-Einhaltung nicht verifiziert)."
            : "navigator.globalPrivacyControl = true. Technical preference signal active (not legally binding by itself; server adherence not verified).")
        : (isDe
            ? "Kein aktives Sec-GPC: 1 Signal im Browser erkannt."
            : "No active Sec-GPC: 1 signal detected in this browser.")
    },
    {
      name: "W3C FedID Digital Credentials API",
      state: dcObserved ? "Observed" : "Potential",
      stateText: dcObserved
        ? (i18n ? i18n.getEvidenceBadge("observed", currentLocale).badgeText : "● Observed")
        : (i18n ? i18n.getEvidenceBadge("not_observed", currentLocale).badgeText : "○ Not Observed"),
      meta: dcObserved
        ? (isDe
            ? "Aufruf von navigator.credentials.get({ digital }) beobachtet — Website fragt Wallet-Nachweis direkt an."
            : "Call to navigator.credentials.get({ digital }) observed — site requested a wallet credential presentation.")
        : (isDe
            ? `Kein Digital-Credentials-Aufruf während dieses Scans beobachtet (Browser-API verfügbar: ${dcAvailable ? "ja" : "nein"}).`
            : `No Digital Credentials invocation observed during this scan (browser API available: ${dcAvailable ? "yes" : "no"}).`)
    },
    {
      name: isDe
        ? "Moderne High-Entropy-Probes (Client Hints / Storage Quota)"
        : "Modern High-Entropy Probes (Client Hints / Storage Quota)",
      state: modernObserved ? "Observed" : "Not Observed",
      stateText: modernObserved
        ? (i18n ? i18n.getEvidenceBadge("observed", currentLocale).badgeText : "● Observed")
        : (i18n ? i18n.getEvidenceBadge("not_observed", currentLocale).badgeText : "○ Not Observed"),
      meta: modernObserved
        ? (isDe
            ? `Beobachtet: ${[modern.highEntropyClientHintsObserved ? "userAgentData.getHighEntropyValues()" : "", modern.storageEstimateObserved ? "navigator.storage.estimate()" : ""].filter(Boolean).join(", ")}.`
            : `Observed: ${[modern.highEntropyClientHintsObserved ? "userAgentData.getHighEntropyValues()" : "", modern.storageEstimateObserved ? "navigator.storage.estimate()" : ""].filter(Boolean).join(", ")}.`)
        : (isDe
            ? "Keine Aufrufe von getHighEntropyValues() oder storage.estimate() in diesem Scan beobachtet."
            : "No calls to getHighEntropyValues() or storage.estimate() observed during this scan.")
    }
  ];

  for (const c of contradictions) {
    items.push({
      name: `AQDR Art. 9 · ${c.id}`,
      state: "Observed",
      stateText: i18n ? i18n.getEvidenceBadge("observed", currentLocale).badgeText : "● Observed",
      meta: `${c.summary} (${c.unverifiedBoundary})`
    });
  }

  renderSignals("privacySignalsList", items);
}

function renderVisibilityLayer(visibility) {
  const badgeEl = $("visibilityLayerBadge");
  const bridgeCard = $("proofBridgeCard");
  const i18n = getI18n();
  if (!badgeEl) return;

  if (!visibility || !visibility.available) {
    badgeEl.textContent = i18n ? i18n.getEvidenceBadge("unavailable", currentLocale).badgeText : "⊘ Unavailable";
    badgeEl.className = "status-pill pill-warning";
    if (bridgeCard) bridgeCard.hidden = true;
    syncWalletDeepLinkButtonVisibility();
    renderSignals("visibilityLayerList", [
      {
        name: currentLocale === "de" ? "Formularfeld-Prüfung nicht verfügbar" : "Form field inspection unavailable",
        state: "Unavailable",
        stateText: i18n ? i18n.getEvidenceBadge("unavailable", currentLocale).badgeText : "⊘ Unavailable",
        meta:
          currentLocale === "de"
            ? "DOM-Metadaten konnten in diesem Tab nicht geprüft werden (wird nie als sauber gewertet)."
            : "DOM input metadata could not be inspected on this tab (never treated as clean)."
      }
    ]);
    return;
  }

  const highest =
    visibility.highestLayer === "None Detected"
      ? i18n
        ? i18n.getEvidenceBadge("not_observed", currentLocale).badgeText
        : "○ None Observed"
      : visibility.highestLayer;
  badgeEl.textContent = highest;
  badgeEl.className =
    visibility.highestLayer === "VULNERABLE (High)"
      ? "status-pill pill-danger"
      : visibility.highestLayer === "GRUNDVERSORGUNG (Medium)"
        ? "status-pill pill-warning"
        : "status-pill";

  const suggestion = visibility.proofSuggestion;
  const hasSuggestion = Boolean(
    suggestion &&
      Array.isArray(suggestion.suggestedMinimalClaims) &&
      suggestion.suggestedMinimalClaims.length > 0
  );
  if (bridgeCard) {
    bridgeCard.hidden = !hasSuggestion;
  }
  syncWalletDeepLinkButtonVisibility();

  if (!visibility.findings || visibility.findings.length === 0) {
    renderSignals("visibilityLayerList", [
      {
        name:
          currentLocale === "de"
            ? "Keine passenden Formularfeld-Metadaten beobachtet"
            : "No matching form input metadata observed",
        state: "Not Observed",
        stateText: i18n ? i18n.getEvidenceBadge("not_observed", currentLocale).badgeText : "○ Not Observed",
        meta:
          currentLocale === "de"
            ? "Keine WELT-, GRUNDVERSORGUNG- oder VULNERABLE-Attribute zum Scan-Zeitpunkt beobachtet (nicht beobachtet ≠ nicht vorhanden)."
            : "No WELT, GRUNDVERSORGUNG, or VULNERABLE input attributes observed at scan time (not observed ≠ absent)."
      }
    ]);
    return;
  }

  renderSignals(
    "visibilityLayerList",
    visibility.findings.map((item) => {
      const explain = i18n
        ? i18n.buildSignalExplanation(
            "visibilityField",
            {
              label: item.label,
              layer: item.layer,
              hasProofSuggestion: Boolean(item.possibleMinimisation)
            },
            currentLocale
          )
        : null;
      const dpvTag = item.dpvDataCategory ? ` [${item.dpvDataCategory}]` : "";
      return {
        name: `${item.label}${dpvTag}`,
        state: item.layer.startsWith("VULNERABLE") ? "Observed" : "Potential",
        stateText: explain ? explain.badge.badgeText : item.layer.split(" ")[0],
        meta: `${item.hint} (DOM metadata only; entered values not read.)`,
        explanation: explain
      };
    })
  );
}

function renderThirdPartyDomains(network) {
  const countEl = $("thirdPartyDomainCount");
  const i18n = getI18n();
  if (!countEl) return;

  if (!network || !network.available) {
    countEl.textContent = i18n ? i18n.getEvidenceBadge("unavailable", currentLocale).badgeText : "⊘ Unavailable";
    countEl.className = "status-pill pill-warning";
    renderSignals("thirdPartyDomainList", [
      {
        name: currentLocale === "de" ? "Netzwerkprotokoll nicht verfügbar" : "Third-party network log unavailable",
        state: "Unavailable",
        stateText: i18n ? i18n.getEvidenceBadge("unavailable", currentLocale).badgeText : "⊘ Unavailable",
        meta: "Network request counts could not be retrieved for this tab."
      }
    ]);
    return;
  }

  countEl.className = network.knownTrackerDomainCount > 0 ? "status-pill pill-warning" : "status-pill";
  const trackerPart = network.knownTrackerDomainCount > 0 ? ` · ${network.knownTrackerDomainCount} tracker-rule` : "";
  countEl.textContent = `${network.uniqueThirdPartyDomainCount} domain${network.uniqueThirdPartyDomainCount === 1 ? "" : "s"} · ${network.thirdPartyRequestCount} req${trackerPart}`;

  if (network.domains.length === 0) {
    renderSignals("thirdPartyDomainList", [
      {
        name:
          currentLocale === "de"
            ? "Keine Drittanbieter-Anfragen in diesem Zeitfenster beobachtet"
            : "No third-party requests observed during this window",
        state: "Not Observed",
        stateText: i18n ? i18n.getEvidenceBadge("not_observed", currentLocale).badgeText : "○ Not Observed",
        meta:
          currentLocale === "de"
            ? "Während dieses Scans wurden keine externen Domains kontaktiert (nicht beobachtet ≠ nicht vorhanden)."
            : "No external domain requests were recorded during this scan window (not observed ≠ absent)."
      }
    ]);
    return;
  }

  renderSignals(
    "thirdPartyDomainList",
    network.domains.slice(0, 15).map((item) => {
      const explain = i18n
        ? i18n.buildSignalExplanation(
            item.isTracker ? "trackerDomain" : "thirdPartyDomain",
            item,
            currentLocale
          )
        : null;
      return {
        name: `${item.domain} (${item.requestCount} req)`,
        state: item.isTracker ? "Observed" : "Potential",
        stateText: explain ? explain.badge.badgeText : item.isTracker ? "● Observed" : "◌ Potential",
        meta: explain
          ? `${explain.observed} ${explain.notVerified}`
          : `${item.classification} (${item.classificationSource}). Payload, retention, and sale not verified.`,
        explanation: explain
      };
    })
  );
}

function renderSignals(containerId, signals) {
  const container = $(containerId);
  const i18n = getI18n();
  if (!container) return;
  container.replaceChildren(
    ...signals.map((signal) => {
      const wrapper = document.createElement("div");
      wrapper.className = "signal-item-wrap";

      const row = document.createElement("div");
      row.className = "signal-item";

      const text = document.createElement("div");
      const name = document.createElement("div");
      const meta = document.createElement("div");
      name.className = "signal-name";
      meta.className = "signal-meta";
      name.textContent = signal.name;
      meta.textContent = signal.meta;
      text.append(name, meta);

      const state = document.createElement("span");
      const cssKey = signal.state.toLowerCase().replace(/\s+/g, "-");
      state.className = `signal-state state-${cssKey}`;
      state.textContent = signal.stateText || signal.state;
      row.append(text, state);

      if (signal.explanation && i18n) {
        const details = document.createElement("details");
        details.className = "signal-details";
        const summary = document.createElement("summary");
        summary.textContent =
          currentLocale === "de"
            ? "Details: Beobachtet · Potenziell · Nicht verifiziert · Unbekannt · Handlung"
            : "Details: Observed · Potential · Not verified · Unknown · What you can do";
        const dl = document.createElement("dl");
        dl.className = "signal-explain-dl";
        const parts = [
          [i18n.t("detailWhatObserved", currentLocale), signal.explanation.observed],
          [i18n.t("detailDeclared", currentLocale), signal.explanation.declared],
          [i18n.t("detailPotential", currentLocale), signal.explanation.potential],
          [i18n.t("detailNotVerified", currentLocale), signal.explanation.notVerified],
          [i18n.t("detailUnknown", currentLocale), signal.explanation.unknown],
          [i18n.t("detailWhyItMatters", currentLocale), signal.explanation.whyItMatters],
          [i18n.t("detailUserAction", currentLocale), signal.explanation.userAction]
        ];
        for (const [dtLabel, ddVal] of parts) {
          const d = document.createElement("div");
          const dt = document.createElement("dt");
          const dd = document.createElement("dd");
          dt.textContent = dtLabel;
          dd.textContent = ddVal;
          d.append(dt, dd);
          dl.append(d);
        }
        details.append(summary, dl);
        text.append(details);
      }

      wrapper.append(row);
      return wrapper;
    })
  );
}

function renderScoreSection(receipt) {
  const circumference = 326.73;
  const arc = $("scoreArc");
  const vm = deriveScoreViewModel(receipt);

  const titleEl = $("score-title");
  if (titleEl) {
    titleEl.className = vm.titleClass;
  }
  const scaleEl = $("scoreScale");
  if (scaleEl) {
    scaleEl.textContent = vm.scoreScale;
  }

  $("scoreCoverage").textContent = vm.scoreCoverage;
  $("scoreExposure").textContent = vm.scoreExposure;
  $("scoreEvidence").textContent = vm.scoreEvidence;
  $("scoreValue").textContent = vm.scoreValue;
  $("scoreCategory").textContent = vm.scoreCategory;
  $("scoreComponents").textContent = vm.scoreComponents;

  if (arc) {
    const offset = circumference - (vm.ringPercent / 100) * circumference;
    arc.style.strokeDashoffset = String(offset);
    arc.style.stroke = vm.ringStroke;
  }
}

function renderFiveStateReport(report) {
  const i18n = getI18n();
  const obsItems =
    report.observed.length > 0
      ? report.observed.map((i) => i.summary)
      : [i18n ? i18n.t("notObservedNote", currentLocale) : "Not observed during this scan (not observed ≠ absent)."];
  fillList("observedFacts", obsItems, "observed", "●");

  const declItems =
    report.declared.length > 0
      ? report.declared.map(
          (i) => `${i.summary} [source: ${i.sourceReference}, verified: ${i.independentlyVerified ? "yes" : "no"}]`
        )
      : [i18n ? i18n.t("noDeclarationsNote", currentLocale) : "No cited provider declarations recorded in this scan."];
  fillList("declaredStatements", declItems, "declared", "◈");

  const potItems =
    report.potential.length > 0
      ? report.potential.map((i) => i.summary)
      : ["Unavailable for this scan status."];
  fillList("potentialAccess", potItems, "potential", "◌");

  const unkItems = report.unknown.map((i) => i.summary);
  fillList("unknowns", unkItems, "unknown", "?");

  const unavailItems =
    report.unavailable.length > 0
      ? report.unavailable.map((i) => `${i.summary} (${i.reason || "unavailable"})`)
      : ["None — all configured browser checks responded."];
  fillList("unavailableChecks", unavailItems, "unavailable", "⊘");
}

function fillList(id, items, className, prefix) {
  const el = $(id);
  if (!el) return;
  el.replaceChildren(
    ...items.map((item) => {
      const li = document.createElement("li");
      li.className = className;
      li.textContent = `${prefix} ${item}`;
      return li;
    })
  );
}

function normalizePermissionState(state) {
  if (state === "granted") return "Granted";
  if (state === "denied") return "Denied";
  if (state === "prompt") return "Prompt";
  return "Unavailable";
}

function sameRegistrableHost(cookieDomain, pageHost) {
  const boundary = getDomainBoundary();
  if (boundary && typeof boundary.sameCookieDomain === "function") {
    return boundary.sameCookieDomain(cookieDomain, pageHost);
  }
  const cleanCookieDomain = cookieDomain.replace(/^\./, "").toLowerCase();
  const cleanPageHost = pageHost.toLowerCase();
  return cleanPageHost === cleanCookieDomain || cleanPageHost.endsWith(`.${cleanCookieDomain}`);
}

if (typeof module === "object" && module.exports) {
  module.exports = {
    deriveScanBannerModel,
    deriveScoreViewModel,
    normalizePermissionState,
    sameRegistrableHost
  };
}
