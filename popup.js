const $ = (id) => document.getElementById(id);

let latestReceipt = null;

const WALLET_DEEPLINK_OPTIN_KEY = "mitch_experimental_wallet_deeplink";

const permissionQueries = [
  { key: "geolocation", label: "Geolocation", name: "geolocation" },
  { key: "notifications", label: "Notifications", name: "notifications" },
  { key: "camera", label: "Camera", name: "camera" },
  { key: "microphone", label: "Microphone", name: "microphone" },
  { key: "clipboard", label: "Clipboard", name: "clipboard-read" }
];

document.addEventListener("DOMContentLoaded", () => {
  bindExportButtons();
  bindProofBridgeButtons();
  init();
});

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
  if (!receiptEngine) return;

  try {
    const text =
      format === "json"
        ? receiptEngine.serializeReceiptJson(latestReceipt)
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
  } catch {
    // Fallback below
  }
  return "0.3.0";
}

async function init() {
  const receiptEngine = globalThis.MitchSurfaceReceipt;
  const collectorVersion = getManifestVersion();

  try {
    const hasExtensionTabs =
      typeof chrome !== "undefined" &&
      chrome.tabs &&
      typeof chrome.tabs.query === "function" &&
      chrome.runtime &&
      Boolean(chrome.runtime.id);

    if (!hasExtensionTabs) {
      await initStandalonePreview(collectorVersion);
      return;
    }

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url || !/^https?:\/\//i.test(tab.url)) {
      const unsupportedReceipt = receiptEngine.buildSurfaceReceiptModel({
        collectorVersion,
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
      mode: "extension",
      url,
      title: tab.title || "Untitled page",
      cookies,
      content: contentData,
      network: combinedNetwork,
      permissions,
      observationWindowMs
    });

    renderReceipt(receipt);
  } catch (error) {
    console.error(error);
    if (receiptEngine) {
      const errReceipt = receiptEngine.buildSurfaceReceiptModel({
        collectorVersion,
        mode: "extension",
        scanStatus: "error",
        limitations: ["Unexpected error during popup scan orchestration."]
      });
      renderReceipt(errReceipt);
    }
  }
}

async function initStandalonePreview(collectorVersion) {
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

function renderReceipt(receipt) {
  latestReceipt = receipt;

  // 1. Scan State Pill & Website Provenance
  const scanPill = $("scanState");
  const statusMap = {
    complete: { text: "Complete Scan", cls: "status-pill" },
    limited: { text: "Limited Scan", cls: "status-pill pill-warning" },
    preview: { text: "Preview (Mock)", cls: "status-pill pill-warning" },
    unsupported: { text: "Unsupported Tab", cls: "status-pill pill-danger" },
    error: { text: "Scan Error", cls: "status-pill pill-danger" }
  };
  const pillMeta = statusMap[receipt.collector.scanStatus] || statusMap.limited;
  scanPill.textContent = pillMeta.text;
  scanPill.className = pillMeta.cls;

  $("domain").textContent = receipt.page.origin;
  $("protocol").textContent = receipt.page.protocol;
  $("pageTitle").textContent = receipt.page.title;
  $("collectorProvenance").textContent = `v${receipt.collector.version} · ${receipt.collector.ruleSetVersion} · ${receipt.collector.mode}`;

  // 2. Cookies & Storage (never displaying 0 when unavailable!)
  $("cookieTotal").textContent = receipt.cookies.available ? String(receipt.cookies.total) : "Unavailable";
  $("firstPartyCookies").textContent = receipt.cookies.available ? String(receipt.cookies.firstParty) : "Unavailable";
  $("thirdPartyCookies").textContent = receipt.cookies.available ? String(receipt.cookies.thirdParty) : "Unavailable";

  $("localStorageUsage").textContent = receipt.storage.localStorage.label;
  $("sessionStorageUsage").textContent = receipt.storage.sessionStorage.label;

  // 3. Visibility Layer & Proof Bridge
  renderVisibilityLayer(receipt.visibility);

  // 4. Third-Party Network Activity (separated domains vs requests vs trackers)
  renderThirdPartyDomains(receipt.network);

  // 5. Fingerprinting
  renderSignals(
    "fingerprintList",
    receipt.fingerprinting.map((fp) => {
      if (fp.evidenceState === "unavailable") {
        return {
          name: fp.label,
          state: "Unavailable",
          stateText: "Unavailable",
          meta: "Check could not run because the page content script was unreachable."
        };
      }
      const isObserved = fp.observed === true;
      return {
        name: fp.label,
        state: isObserved ? "Observed" : "Not Observed",
        stateText: isObserved ? "Observed" : "Not Observed",
        meta:
          fp.key === "evalAttempt"
            ? receipt.csp.metaBlocksEval
              ? "Meta CSP restricts dynamic eval(); violation counter active."
              : "Passive listener for blocked eval()/script-src CSP events (not observed ≠ absent)."
            : isObserved
              ? "Call observed in MAIN world (payload/purpose not verified)."
              : "No call observed during this scan (not observed ≠ absent)."
      };
    })
  );

  // 6. Permissions
  renderSignals(
    "permissionList",
    receipt.permissions.map((perm) => ({
      name: perm.label,
      state: perm.state,
      stateText: perm.state,
      meta:
        perm.state === "Unavailable"
          ? "Permission query not supported or unavailable in this browser context."
          : "Browser Permissions API state (Granted ≠ active readout verified)."
    }))
  );

  // 7. Score & Dimensions
  renderScoreSection(receipt.surfaceScore);

  // 8. Five-State Evidence Report
  renderFiveStateReport(receipt.report);
}

function renderVisibilityLayer(visibility) {
  const badgeEl = $("visibilityLayerBadge");
  const bridgeCard = $("proofBridgeCard");
  if (!badgeEl) return;

  if (!visibility || !visibility.available) {
    badgeEl.textContent = "Unavailable";
    badgeEl.className = "status-pill pill-warning";
    if (bridgeCard) bridgeCard.hidden = true;
    syncWalletDeepLinkButtonVisibility();
    renderSignals("visibilityLayerList", [
      {
        name: "Form field inspection unavailable",
        state: "Unavailable",
        stateText: "Unavailable",
        meta: "DOM input metadata could not be inspected on this tab (never treated as clean)."
      }
    ]);
    return;
  }

  const highest = visibility.highestLayer === "None Detected" ? "None Observed" : visibility.highestLayer;
  badgeEl.textContent = highest;
  badgeEl.className =
    visibility.highestLayer === "VULNERABLE (High)"
      ? "status-pill pill-danger"
      : visibility.highestLayer === "GRUNDVERSORGUNG (Medium)"
        ? "status-pill pill-warning"
        : "status-pill";

  const suggestion = visibility.proofSuggestion;
  if (bridgeCard) {
    const hasSuggestion = Boolean(
      suggestion &&
        Array.isArray(suggestion.suggestedMinimalClaims) &&
        suggestion.suggestedMinimalClaims.length > 0
    );
    bridgeCard.hidden = !hasSuggestion;
  }
  syncWalletDeepLinkButtonVisibility();

  if (!visibility.findings || visibility.findings.length === 0) {
    renderSignals("visibilityLayerList", [
      {
        name: "No matching form input metadata observed",
        state: "Not Observed",
        stateText: "Not Observed",
        meta: "No WELT, GRUNDVERSORGUNG, or VULNERABLE input attributes observed at scan time (not observed ≠ absent)."
      }
    ]);
    return;
  }

  renderSignals(
    "visibilityLayerList",
    visibility.findings.map((item) => ({
      name: item.label,
      state: item.layer.startsWith("VULNERABLE") ? "Observed" : "Potential",
      stateText: item.layer.split(" ")[0],
      meta: `${item.hint} (Source: DOM field metadata; entered values not read.)`
    }))
  );
}

function renderThirdPartyDomains(network) {
  const countEl = $("thirdPartyDomainCount");
  if (!countEl) return;

  if (!network || !network.available) {
    countEl.textContent = "Unavailable";
    countEl.className = "status-pill pill-warning";
    renderSignals("thirdPartyDomainList", [
      {
        name: "Third-party network log unavailable",
        state: "Unavailable",
        stateText: "Unavailable",
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
        name: "No third-party requests observed during this window",
        state: "Not Observed",
        stateText: "Not Observed",
        meta: "No external domain requests were recorded during this scan window (not observed ≠ absent)."
      }
    ]);
    return;
  }

  renderSignals(
    "thirdPartyDomainList",
    network.domains.slice(0, 15).map((item) => ({
      name: `${item.domain} (${item.requestCount} req)`,
      state: item.isTracker ? "Observed" : "Potential",
      stateText: item.isTracker ? "Rule Match" : "External",
      meta: `${item.classification} (${item.classificationSource}). Payload, retention, and sale not verified.`
    }))
  );
}

function renderSignals(containerId, signals) {
  const container = $(containerId);
  if (!container) return;
  container.replaceChildren(
    ...signals.map((signal) => {
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
      return row;
    })
  );
}

function renderScoreSection(surfaceScore) {
  const circumference = 326.73;
  const arc = $("scoreArc");
  const cov = surfaceScore.dimensions.observationCoverage;
  const exp = surfaceScore.dimensions.technicalExposure;
  const qual = surfaceScore.dimensions.evidenceQuality;

  $("scoreCoverage").textContent = `${cov.percent}% (${cov.checkedSources}/${cov.totalSources})`;
  $("scoreExposure").textContent = exp.value === null ? "Unavailable" : `${exp.value}/100`;
  $("scoreEvidence").textContent = `${qual.directObservedCount} obs · ${qual.unavailableCount} unavail`;

  if (surfaceScore.value === null) {
    $("scoreValue").textContent = "--";
    $("scoreCategory").textContent = "Unavailable — scan did not inspect an HTTP/HTTPS page.";
    arc.style.strokeDashoffset = String(circumference);
    arc.style.stroke = "var(--muted)";
    $("scoreComponents").textContent = "Components unavailable (missing evidence is never counted as zero).";
    return;
  }

  const offset = circumference - (surfaceScore.value / 100) * circumference;
  $("scoreValue").textContent = String(surfaceScore.value);
  $("scoreCategory").textContent = surfaceScore.category;
  arc.style.strokeDashoffset = String(offset);
  arc.style.stroke =
    surfaceScore.value > 75
      ? "var(--danger)"
      : surfaceScore.value > 50
        ? "var(--warning)"
        : surfaceScore.value > 25
          ? "var(--accent-2)"
          : "var(--accent)";

  const c = surfaceScore.components;
  const fmt = (v) => (v === null ? "n/a" : `+${v}`);
  $("scoreComponents").textContent = `Components: cookies ${fmt(c.cookies)} · 3P req ${fmt(c.thirdPartyRequests)} · tracker rules ${fmt(c.knownTrackerDomains)} · FP calls ${fmt(c.fingerprintingCalls)} · perms ${fmt(c.grantedPermissions)}/${fmt(c.promptPermissions)}`;
}

function renderFiveStateReport(report) {
  const obsItems =
    report.observed.length > 0
      ? report.observed.map((i) => i.summary)
      : ["Not observed during this scan (not observed ≠ absent)."];
  fillList("observedFacts", obsItems, "observed", "●");

  const declItems =
    report.declared.length > 0
      ? report.declared.map(
          (i) => `${i.summary} [source: ${i.sourceReference}, verified: ${i.independentlyVerified ? "yes" : "no"}]`
        )
      : ["No cited provider declarations recorded in this scan."];
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
  const cleanCookieDomain = cookieDomain.replace(/^\./, "").toLowerCase();
  const cleanPageHost = pageHost.toLowerCase();
  return cleanPageHost === cleanCookieDomain || cleanPageHost.endsWith(`.${cleanCookieDomain}`);
}
