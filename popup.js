const $ = (id) => document.getElementById(id);

const fingerprintLabels = {
  canvas: "Canvas API",
  webgl: "WebGL",
  audio: "AudioContext",
  webrtc: "WebRTC",
  evalAttempt: "Dynamic eval() Attempt"
};

const permissionQueries = [
  { key: "geolocation", label: "Geolocation", name: "geolocation" },
  { key: "notifications", label: "Notifications", name: "notifications" },
  { key: "camera", label: "Camera", name: "camera" },
  { key: "microphone", label: "Microphone", name: "microphone" },
  { key: "clipboard", label: "Clipboard", name: "clipboard-read" }
];

document.addEventListener("DOMContentLoaded", init);

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
  $("domain").textContent = url.hostname;
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
      canvas: typeof HTMLCanvasElement !== "undefined",
      webgl: Boolean(window.WebGLRenderingContext),
      audio: typeof window.AudioContext === "function" || typeof window.webkitAudioContext === "function",
      webrtc: typeof window.RTCPeerConnection === "function",
      evalAttempt: true
    },
    csp: {
      hasMetaCsp: true,
      metaBlocksEval: true,
      evalBlockedCount: 1,
      totalViolationCount: 1,
      violatedDirectives: ["script-src"]
    },
    visibilityLayer: {
      highestLayer: "VULNERABLE (High)",
      counts: { vulnerable: 1, grundversorgung: 1, welt: 1 }
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
      visibilityLayer: { highestLayer: "Unknown", counts: { vulnerable: 0, grundversorgung: 0, welt: 0 } },
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

function buildAnalysis(url, cookies, contentData, requestData, permissions) {
  const fingerprinting = contentData.fingerprinting || {};
  const csp = contentData.csp || { hasMetaCsp: false, metaBlocksEval: false, evalBlockedCount: 0, totalViolationCount: 0, violatedDirectives: [] };
  const visibilityLayer = contentData.visibilityLayer || { highestLayer: "None Detected", counts: { vulnerable: 0, grundversorgung: 0, welt: 0 } };
  const detectedFingerprintCount = Object.values(fingerprinting).filter(Boolean).length;
  const grantedPermissionCount = Object.values(permissions).filter((state) => state === "Granted").length;
  const promptPermissionCount = Object.values(permissions).filter((state) => state === "Prompt").length;
  const thirdPartyRequestCount = requestData.thirdPartyRequestCount || 0;

  const score = Math.min(100, Math.round(
    Math.min(30, cookies.total * 2) +
    Math.min(25, thirdPartyRequestCount * 3) +
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
    requestData,
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
  $("cookieTotal").textContent = analysis.cookies.total;
  $("firstPartyCookies").textContent = analysis.cookies.firstParty;
  $("thirdPartyCookies").textContent = analysis.cookies.thirdParty;
  $("localStorageUsage").textContent = analysis.storage.localStorage;
  $("sessionStorageUsage").textContent = analysis.storage.sessionStorage;

  renderSignals("fingerprintList", Object.entries(fingerprintLabels).map(([key, label]) => ({
    name: label,
    state: analysis.fingerprinting[key] ? "Detected" : "Not Detected",
    meta: key === "evalAttempt"
      ? (analysis.csp.metaBlocksEval
          ? "Blocked dynamic string evaluation (CSP active)."
          : "Passive CSP violation listener for dynamic eval() calls.")
      : "This technique may enable browser fingerprinting."
  })));

  renderSignals("permissionList", permissionQueries.map((item) => ({
    name: item.label,
    state: analysis.permissions[item.key] || "Unknown",
    meta: "Browser permission state visible to this extension."
  })));

  renderScore(analysis.score, analysis.category);
  renderReport(analysis);
}

function renderSignals(containerId, signals) {
  const container = $(containerId);
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
    state.className = `signal-state state-${signal.state.toLowerCase().replace(/\s+/g, "-")}`;
    state.textContent = signal.state;
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
  if ((analysis.requestData.thirdPartyRequestCount || 0) > 0) observed.push(`${analysis.requestData.thirdPartyRequestCount} third-party browser requests observed`);
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
  Object.entries(fingerprintLabels).forEach(([key, label]) => {
    if (key !== "evalAttempt" && analysis.fingerprinting[key]) observed.push(`${label} surface detected`);
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
