const $ = (id) => document.getElementById(id);

let latestAnalysis = null;

const fingerprintLabels = {
  canvas: "Canvas Readout (toDataURL / getImageData)",
  webgl: "WebGL Renderer / Pixel Readout",
  audio: "AudioContext Oscillator",
  webrtc: "WebRTC PeerConnection",
  evalAttempt: "Dynamic eval() Attempt"
};

const KNOWN_TRACKER_PATTERNS = [
  { pattern: /google-analytics\.com|googletagmanager\.com|analytics\.google\.com/i, category: "Analytics Tracker" },
  { pattern: /doubleclick\.net|googlesyndication\.com|googleadservices\.com|adservice\.google/i, category: "Ad-Tech Tracker" },
  { pattern: /facebook\.net|facebook\.com|fbcdn\.net/i, category: "Social / Ad Tracker" },
  { pattern: /clarity\.ms|hotjar\.com|fullstory\.com|mouseflow\.com|logrocket\.com/i, category: "Session Replay" },
  { pattern: /mixpanel\.com|segment\.io|segment\.com|amplitude\.com|posthog\.com|plausible\.io/i, category: "Product Telemetry" },
  { pattern: /criteo\.com|taboola\.com|outbrain\.com|adnxs\.com|rubiconproject\.com|pubmatic\.com/i, category: "Ad Exchange" },
  { pattern: /tiktok\.com|byteoversea\.com|snapchat\.com|sc-static\.net|linkedin\.com|licdn\.com|bat\.bing\.com/i, category: "Attribution Pixel" },
  { pattern: /sentry\.io|datadoghq\.com|newrelic\.com|nr-data\.net|bugsnag\.com/i, category: "Error / RUM Telemetry" }
];

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

function bindProofBridgeButtons() {
  const jsonBtn = $("copyProofJsonBtn");
  const mdBtn = $("copyProofMarkdownBtn");
  if (jsonBtn) {
    jsonBtn.addEventListener("click", () => copyProofSuggestion("json"));
  }
  if (mdBtn) {
    mdBtn.addEventListener("click", () => copyProofSuggestion("markdown"));
  }
}

async function copyProofSuggestion(format) {
  if (
    !latestAnalysis ||
    !latestAnalysis.visibilityLayer ||
    !latestAnalysis.visibilityLayer.proofSuggestion
  ) {
    return;
  }

  const statusEl = $("proofBridgeStatus");
  const pageContext = {
    origin: latestAnalysis.url ? latestAnalysis.url.origin : "unknown",
    title: $("pageTitle") ? $("pageTitle").textContent : "Untitled page"
  };

  try {
    const suggestion = latestAnalysis.visibilityLayer.proofSuggestion;
    const bridge = globalThis.MitchProofBridge;
    const text = format === "json"
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
  if (!latestAnalysis) return;
  const statusEl = $("exportStatus");
  try {
    const text = format === "json"
      ? buildJsonReceipt(latestAnalysis)
      : buildMarkdownReport(latestAnalysis);
    await navigator.clipboard.writeText(text);
    if (statusEl) {
      statusEl.textContent = format === "json" ? "JSON Copied ✓" : "Markdown Copied ✓";
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

function buildJsonReceipt(analysis) {
  const receipt = {
    schema: "askmi.transparency.surface-receipt.v0.2",
    capturedAt: new Date().toISOString(),
    website: {
      domain: analysis.url ? analysis.url.hostname : "unknown",
      protocol: analysis.url ? analysis.url.protocol.replace(":", "").toUpperCase() : "UNKNOWN",
      href: analysis.url ? analysis.url.href : null
    },
    score: {
      value: analysis.score,
      category: analysis.category
    },
    cookies: analysis.cookies,
    storage: analysis.storage,
    visibilityLayer: analysis.visibilityLayer,
    thirdPartyRequests: {
      count: analysis.requestData.thirdPartyRequestCount,
      knownTrackerCount: analysis.requestData.knownTrackerCount,
      domains: analysis.requestData.classifiedDomains
    },
    fingerprinting: analysis.fingerprinting,
    csp: analysis.csp,
    permissions: analysis.permissions
  };
  return JSON.stringify(receipt, null, 2);
}

function buildMarkdownReport(analysis) {
  const host = (analysis.url && analysis.url.hostname) || "unknown";
  const proto = (analysis.url && analysis.url.protocol.replace(":", "").toUpperCase()) || "UNKNOWN";
  const lines = [
    `# miTch Transparency Layer — Surface Report`,
    `- **Captured:** ${new Date().toISOString()}`,
    `- **Domain:** \`${host}\` (${proto})`,
    `- **Surface Score:** **${analysis.score}/100** (${analysis.category})`,
    `- **AskMI Visibility Layer:** \`${(analysis.visibilityLayer && analysis.visibilityLayer.highestLayer) || "None Detected"}\``,
    `- **Cookies:** ${analysis.cookies.total} total (${analysis.cookies.firstParty} first-party, ${analysis.cookies.thirdParty} third-party)`,
    `- **Storage:** localStorage=${analysis.storage.localStorage}, sessionStorage=${analysis.storage.sessionStorage}`,
    `- **Third-Party Domains (${analysis.requestData.thirdPartyRequestCount}):** ${
      analysis.requestData.thirdPartyDomains.length > 0
        ? analysis.requestData.thirdPartyDomains.join(", ")
        : "None"
    }`,
    `- **CSP Eval Protection:** ${analysis.csp && analysis.csp.metaBlocksEval ? "Active (blocks eval)" : "Not detected in meta"} (blocked violations: ${(analysis.csp && analysis.csp.evalBlockedCount) || 0})`
  ];
  return lines.join("\n");
}

async function init() {
  try {
    const hasExtensionTabs = typeof chrome !== "undefined" && chrome.tabs && typeof chrome.tabs.query === "function";
    if (!hasExtensionTabs) {
      await initStandalonePreview();
      return;
    }

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url || !/^https?:\/\//i.test(tab.url)) {
      renderUnsupported();
      return;
    }

    const url = new URL(tab.url);
    $("domain").textContent = url.hostname;
    $("protocol").textContent = url.protocol.replace(":", "").toUpperCase();
    $("pageTitle").textContent = tab.title || "Untitled page";

    const [cookies, contentData, requestData, permissions] = await Promise.all([
      getCookies(url),
      getContentData(tab.id),
      getRequestData(tab.id),
      getPermissions()
    ]);

    const combinedRequestData = combineRequestData(requestData, contentData.requests);
    const analysis = buildAnalysis(url, cookies, contentData, combinedRequestData, permissions);
    renderAnalysis(analysis);
    $("scanState").textContent = "Observed";
  } catch (error) {
    console.error(error);
    $("scanState").textContent = "Limited";
    $("scoreCategory").textContent = "Some browser-visible surfaces could not be read on this page.";
  }
}

async function initStandalonePreview() {
  const url = new URL(window.location.href);
  $("domain").textContent = url.hostname || "localhost";
  $("protocol").textContent = url.protocol.replace(":", "").toUpperCase();
  $("pageTitle").textContent = "AskMI Wallet / Live Preview";

  const cookieCount = document.cookie ? document.cookie.split(";").filter(Boolean).length : 0;
  const cookies = { total: cookieCount, firstParty: cookieCount, thirdParty: 0 };
  const localCount = window.localStorage ? window.localStorage.length : 0;
  const sessionCount = window.sessionStorage ? window.sessionStorage.length : 0;
  const contentData = {
    storage: {
      localStorage: localCount > 0 ? `${localCount} keys` : "Not Detected",
      sessionStorage: sessionCount > 0 ? `${sessionCount} keys` : "Not Detected"
    },
    fingerprinting: {
      canvas: false,
      webgl: false,
      audio: false,
      webrtc: false,
      evalAttempt: false
    },
    csp: {
      hasMetaCsp: true,
      metaBlocksEval: true,
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
  };
  const requestData = { thirdPartyRequestCount: 0, thirdPartyDomains: [] };
  const permissions = await getPermissions();
  const analysis = buildAnalysis(url, cookies, contentData, requestData, permissions);
  renderAnalysis(analysis);
  $("scanState").textContent = "Observed";
}

function renderUnsupported() {
  $("scanState").textContent = "Unsupported";
  $("scoreValue").textContent = "0";
  $("scoreCategory").textContent = "Open an HTTP or HTTPS page to inspect browser-visible surfaces.";
  $("scoreArc").style.strokeDashoffset = "326.73";
}

async function getCookies(url) {
  const cookies = await chrome.cookies.getAll({ url: url.href });
  const firstParty = cookies.filter((cookie) => sameRegistrableHost(cookie.domain, url.hostname)).length;
  return {
    total: cookies.length,
    firstParty,
    thirdParty: Math.max(0, cookies.length - firstParty)
  };
}

async function getContentData(tabId) {
  try {
    return await chrome.tabs.sendMessage(tabId, { type: "MITCH_COLLECT_SURFACES" });
  } catch {
    return {
      storage: { localStorage: "Unknown", sessionStorage: "Unknown" },
      fingerprinting: { canvas: false, webgl: false, audio: false, webrtc: false, evalAttempt: false },
      csp: { hasMetaCsp: false, metaBlocksEval: false, evalBlockedCount: 0, totalViolationCount: 0, violatedDirectives: [] },
      visibilityLayer: { highestLayer: "Unknown", counts: { vulnerable: 0, grundversorgung: 0, welt: 0 }, findings: [], proofSuggestion: null },
      screen: null,
      language: null,
      timezone: null,
      userAgent: null
    };
  }
}

async function getRequestData(tabId) {
  try {
    const response = await chrome.runtime.sendMessage({ type: "MITCH_GET_TAB_REQUESTS", tabId });
    return response || { thirdPartyRequestCount: 0, thirdPartyDomains: [] };
  } catch {
    return { thirdPartyRequestCount: 0, thirdPartyDomains: [] };
  }
}

async function getPermissions() {
  const results = {};
  await Promise.all(permissionQueries.map(async (item) => {
    try {
      const status = await navigator.permissions.query({ name: item.name });
      results[item.key] = normalizePermissionState(status.state);
    } catch {
      results[item.key] = "Unknown";
    }
  }));
  return results;
}

function classifyThirdPartyDomain(domain) {
  for (const rule of KNOWN_TRACKER_PATTERNS) {
    if (rule.pattern.test(domain)) {
      return { isTracker: true, category: rule.category, stateLabel: "Tracker", stateClass: "detected" };
    }
  }
  return { isTracker: false, category: "External Resource / CDN", stateLabel: "External", stateClass: "prompt" };
}

function buildAnalysis(url, cookies, contentData, requestData, permissions) {
  const fingerprinting = contentData.fingerprinting || {};
  const csp = contentData.csp || { hasMetaCsp: false, metaBlocksEval: false, evalBlockedCount: 0, totalViolationCount: 0, violatedDirectives: [] };
  const visibilityLayer = contentData.visibilityLayer || { highestLayer: "None Detected", counts: { vulnerable: 0, grundversorgung: 0, welt: 0 }, findings: [], proofSuggestion: null };
  const detectedFingerprintCount = Object.values(fingerprinting).filter(Boolean).length;
  const grantedPermissionCount = Object.values(permissions).filter((state) => state === "Granted").length;
  const promptPermissionCount = Object.values(permissions).filter((state) => state === "Prompt").length;
  const thirdPartyDomains = (requestData && requestData.thirdPartyDomains) || [];
  const thirdPartyRequestCount = requestData.thirdPartyRequestCount || thirdPartyDomains.length || 0;
  const classifiedDomains = thirdPartyDomains.map((domain) => ({
    domain,
    ...classifyThirdPartyDomain(domain)
  }));
  const knownTrackerCount = classifiedDomains.filter((d) => d.isTracker).length;

  const score = Math.min(100, Math.round(
    Math.min(30, cookies.total * 2) +
    Math.min(25, thirdPartyRequestCount * 3 + knownTrackerCount * 4) +
    detectedFingerprintCount * 10 +
    grantedPermissionCount * 8 +
    promptPermissionCount * 2
  ));

  return {
    url,
    cookies,
    storage: contentData.storage || { localStorage: "Unknown", sessionStorage: "Unknown" },
    fingerprinting,
    csp,
    visibilityLayer,
    permissions,
    requestData: {
      ...requestData,
      thirdPartyRequestCount,
      thirdPartyDomains,
      classifiedDomains,
      knownTrackerCount
    },
    score,
    category: scoreCategory(score),
    context: contentData
  };
}

function combineRequestData(backgroundData, contentData) {
  const domains = new Set([
    ...((backgroundData && backgroundData.thirdPartyDomains) || []),
    ...((contentData && contentData.thirdPartyDomains) || [])
  ]);
  return {
    thirdPartyRequestCount: Math.max(
      (backgroundData && backgroundData.thirdPartyRequestCount) || 0,
      (contentData && contentData.thirdPartyRequestCount) || 0,
      domains.size
    ),
    thirdPartyDomains: Array.from(domains).sort()
  };
}

function renderAnalysis(analysis) {
  latestAnalysis = analysis;
  $("cookieTotal").textContent = analysis.cookies.total;
  $("firstPartyCookies").textContent = analysis.cookies.firstParty;
  $("thirdPartyCookies").textContent = analysis.cookies.thirdParty;
  $("localStorageUsage").textContent = analysis.storage.localStorage;
  $("sessionStorageUsage").textContent = analysis.storage.sessionStorage;

  renderVisibilityLayer(analysis.visibilityLayer);
  renderThirdPartyDomains(analysis.requestData);

  renderSignals("fingerprintList", Object.entries(fingerprintLabels).map(([key, label]) => ({
    name: label,
    state: analysis.fingerprinting[key] ? "Detected" : "Not Detected",
    meta: key === "evalAttempt"
      ? (analysis.csp.metaBlocksEval
          ? "Blocked dynamic string evaluation (CSP active)."
          : "Passive CSP violation listener for dynamic eval() calls.")
      : "Active API invocation observed on this page."
  })));

  renderSignals("permissionList", permissionQueries.map((item) => ({
    name: item.label,
    state: analysis.permissions[item.key] || "Unknown",
    meta: "Browser permission state visible to this extension."
  })));

  renderScore(analysis.score, analysis.category);
  renderReport(analysis);
}

function renderVisibilityLayer(visibilityLayer) {
  const badgeEl = $("visibilityLayerBadge");
  const listEl = $("visibilityLayerList");
  const bridgeCard = $("proofBridgeCard");
  if (!badgeEl || !listEl) return;

  const highest = (visibilityLayer && visibilityLayer.highestLayer) || "None Detected";
  badgeEl.textContent = highest;

  const suggestion = visibilityLayer && visibilityLayer.proofSuggestion;
  if (bridgeCard) {
    const hasSuggestion = Boolean(
      suggestion &&
      Array.isArray(suggestion.suggestedMinimalClaims) &&
      suggestion.suggestedMinimalClaims.length > 0
    );
    bridgeCard.hidden = !hasSuggestion;
  }

  const findings = (visibilityLayer && visibilityLayer.findings) || [];
  if (findings.length === 0) {
    renderSignals("visibilityLayerList", [{
      name: "No sensitive data input forms detected",
      state: "Not Detected",
      stateText: "Clean",
      meta: "No WELT, GRUNDVERSORGUNG, or VULNERABLE form inputs found on this page."
    }]);
    return;
  }

  renderSignals("visibilityLayerList", findings.map((item) => ({
    name: item.label,
    state: item.state || "Prompt",
    stateText: item.layer.split(" ")[0],
    meta: item.hint
  })));
}

function renderThirdPartyDomains(requestData) {
  const countEl = $("thirdPartyDomainCount");
  const listEl = $("thirdPartyDomainList");
  if (!countEl || !listEl) return;

  const domains = (requestData && requestData.classifiedDomains) || [];
  const trackerCount = (requestData && requestData.knownTrackerCount) || 0;
  countEl.textContent = trackerCount > 0
    ? `${domains.length} domains (${trackerCount} tracker)`
    : `${domains.length} domain${domains.length === 1 ? "" : "s"}`;

  if (domains.length === 0) {
    renderSignals("thirdPartyDomainList", [{
      name: "Zero third-party domains contacted",
      state: "Not Detected",
      meta: "All observed requests stayed on the first-party origin."
    }]);
    return;
  }

  renderSignals("thirdPartyDomainList", domains.slice(0, 15).map((item) => ({
    name: item.domain,
    state: item.isTracker ? "Detected" : "Prompt",
    stateText: item.stateLabel,
    meta: item.category
  })));
}

function renderSignals(containerId, signals) {
  const container = $(containerId);
  if (!container) return;
  container.replaceChildren(...signals.map((signal) => {
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
  }));
}

function renderScore(score, category) {
  const circumference = 326.73;
  const offset = circumference - (score / 100) * circumference;
  const arc = $("scoreArc");
  $("scoreValue").textContent = score;
  $("scoreCategory").textContent = category;
  arc.style.strokeDashoffset = String(offset);
  arc.style.stroke = score > 75 ? "var(--danger)" : score > 50 ? "var(--warning)" : score > 25 ? "var(--accent-2)" : "var(--accent)";
}

function renderReport(analysis) {
  const observed = [];
  if (analysis.cookies.total > 0) observed.push(`${analysis.cookies.total} cookies detected`);
  if (analysis.cookies.thirdParty > 0) observed.push(`${analysis.cookies.thirdParty} third-party cookies detectable for this page`);
  if ((analysis.requestData.thirdPartyRequestCount || 0) > 0) {
    const trackerSuffix = analysis.requestData.knownTrackerCount > 0
      ? ` (${analysis.requestData.knownTrackerCount} known tracker domain(s))`
      : "";
    observed.push(`${analysis.requestData.thirdPartyRequestCount} third-party browser requests observed${trackerSuffix}`);
  }
  if (analysis.storage.localStorage !== "Not Detected") observed.push(`localStorage usage: ${analysis.storage.localStorage}`);
  if (analysis.storage.sessionStorage !== "Not Detected") observed.push(`sessionStorage usage: ${analysis.storage.sessionStorage}`);
  if (analysis.csp && analysis.csp.metaBlocksEval) {
    observed.push("Page CSP blocks dynamic eval() execution");
  }
  if (analysis.csp && analysis.csp.evalBlockedCount > 0) {
    observed.push(`${analysis.csp.evalBlockedCount} blocked eval() / script-src CSP violation(s) observed`);
  }
  if (analysis.visibilityLayer && analysis.visibilityLayer.highestLayer && analysis.visibilityLayer.highestLayer !== "None Detected" && analysis.visibilityLayer.highestLayer !== "Unknown") {
    observed.push(`Form input sensitivity (AskMI Visibility Layer): ${analysis.visibilityLayer.highestLayer}`);
  }
  if (
    analysis.visibilityLayer &&
    analysis.visibilityLayer.proofSuggestion &&
    Array.isArray(analysis.visibilityLayer.proofSuggestion.suggestedMinimalClaims)
  ) {
    observed.push(
      `AskMI Proof Bridge suggestion available: ${analysis.visibilityLayer.proofSuggestion.suggestedMinimalClaims.join(", ")}`
    );
  }
  Object.entries(fingerprintLabels).forEach(([key, label]) => {
    if (key !== "evalAttempt" && analysis.fingerprinting[key]) observed.push(`${label} call observed`);
  });
  permissionQueries.forEach((item) => {
    const state = analysis.permissions[item.key];
    if (state === "Granted") observed.push(`${item.label} permission granted`);
  });
  if (observed.length === 0) observed.push("No cookies, permission grants, storage usage, or listed fingerprinting surfaces detected");

  const potential = [
    "IP address visible to contacted servers",
    `Browser version via user agent: ${shorten(analysis.context.userAgent || "Unknown", 72)}`,
    `Screen resolution: ${analysis.context.screen || "Unknown"}`,
    `Language: ${analysis.context.language || "Unknown"}`,
    `Timezone: ${analysis.context.timezone || "Unknown"}`
  ];

  const unknown = [
    "What is stored on company servers",
    "Retention policies",
    "Internal profiling",
    "Data resale"
  ];

  fillList("observedFacts", observed, "observed", "✓");
  fillList("potentialAccess", potential, "observed", "✓");
  fillList("unknowns", unknown, "unknown", "✗");
}

function fillList(id, items, className, prefix) {
  $(id).replaceChildren(...items.map((item) => {
    const li = document.createElement("li");
    li.className = className;
    li.textContent = `${prefix} ${item}`;
    return li;
  }));
}

function scoreCategory(score) {
  if (score <= 25) return "Low Surface";
  if (score <= 50) return "Moderate Surface";
  if (score <= 75) return "High Surface";
  return "Very High Surface";
}

function normalizePermissionState(state) {
  if (state === "granted") return "Granted";
  if (state === "denied") return "Denied";
  if (state === "prompt") return "Prompt";
  return "Unknown";
}

function sameRegistrableHost(cookieDomain, pageHost) {
  const cleanCookieDomain = cookieDomain.replace(/^\./, "").toLowerCase();
  const cleanPageHost = pageHost.toLowerCase();
  return cleanPageHost === cleanCookieDomain || cleanPageHost.endsWith(`.${cleanCookieDomain}`);
}

function shorten(value, max) {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}
