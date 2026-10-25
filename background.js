const tabRequests = new Map();
const MAX_DOMAINS_PER_TAB = 80;

chrome.webRequest.onCompleted.addListener(
  (details) => recordRequest(details),
  { urls: ["http://*/*", "https://*/*"] }
);

chrome.webRequest.onErrorOccurred.addListener(
  (details) => recordRequest(details),
  { urls: ["http://*/*", "https://*/*"] }
);

chrome.tabs.onRemoved.addListener((tabId) => {
  tabRequests.delete(tabId);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === "loading") {
    tabRequests.delete(tabId);
    clearTabBadge(tabId);
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message && message.type === "MITCH_GET_TAB_REQUESTS") {
    const entry = tabRequests.get(message.tabId);
    sendResponse({
      thirdPartyRequestCount: entry ? entry.thirdPartyCount : 0,
      thirdPartyDomains: entry ? Array.from(entry.thirdPartyDomains).sort() : []
    });
    return true;
  }

  if (message && message.type === "MITCH_PAGE_SURFACES" && sender.tab && sender.tab.id >= 0) {
    const tabId = sender.tab.id;
    const entry = getEntry(tabId);
    entry.pageSurfaces = message.payload || {};
    if (
      entry.pageSurfaces.requests &&
      Array.isArray(entry.pageSurfaces.requests.thirdPartyDomains)
    ) {
      entry.pageSurfaces.requests.thirdPartyDomains.forEach((domain) => {
        if (entry.thirdPartyDomains.size < MAX_DOMAINS_PER_TAB) {
          entry.thirdPartyDomains.add(domain);
        }
      });
    }
    updateTabBadge(tabId);
    sendResponse({ ok: true });
    return true;
  }

  return false;
});

function recordRequest(details) {
  if (details.tabId < 0 || !details.initiator) return;

  let requestHost;
  let initiatorHost;
  try {
    requestHost = new URL(details.url).hostname;
    initiatorHost = new URL(details.initiator).hostname;
  } catch {
    return;
  }

  if (!requestHost || !initiatorHost || sameSite(requestHost, initiatorHost)) return;

  const entry = getEntry(details.tabId);
  entry.thirdPartyCount += 1;
  if (entry.thirdPartyDomains.size < MAX_DOMAINS_PER_TAB) {
    entry.thirdPartyDomains.add(requestHost);
  }
  updateTabBadge(details.tabId);
}

function getEntry(tabId) {
  if (!tabRequests.has(tabId)) {
    tabRequests.set(tabId, {
      thirdPartyCount: 0,
      thirdPartyDomains: new Set(),
      pageSurfaces: {}
    });
  }
  return tabRequests.get(tabId);
}

function clearTabBadge(tabId) {
  try {
    chrome.action.setBadgeText({ tabId, text: "" });
  } catch {
    // Ignore if tab closed
  }
}

function updateTabBadge(tabId) {
  try {
    const entry = tabRequests.get(tabId);
    if (!entry) return;

    const surfaces = entry.pageSurfaces || {};
    const fp = surfaces.fingerprinting || {};
    const fpCount = Object.values(fp).filter(Boolean).length;
    const thirdPartyCount = Math.max(entry.thirdPartyCount, entry.thirdPartyDomains.size);
    const vis = surfaces.visibilityLayer || {};
    const highestLayer = vis.highestLayer || "None Detected";

    const estimatedScore = Math.min(
      100,
      Math.round(Math.min(25, thirdPartyCount * 3) + fpCount * 10 + (highestLayer === "VULNERABLE (High)" ? 25 : highestLayer === "GRUNDVERSORGUNG (Medium)" ? 10 : 0))
    );

    let color = "#46d9b5"; // Green (Low)
    if (highestLayer === "VULNERABLE (High)" || estimatedScore > 50) {
      color = "#ff6f8f"; // Red (High / Vulnerable)
    } else if (highestLayer === "GRUNDVERSORGUNG (Medium)" || estimatedScore > 25 || thirdPartyCount > 0) {
      color = "#f1c65b"; // Amber (Moderate)
    }

    const text = estimatedScore > 0 ? String(estimatedScore) : "0";
    chrome.action.setBadgeBackgroundColor({ tabId, color });
    chrome.action.setBadgeText({ tabId, text });
  } catch {
    // Ignore badge errors on closed tabs
  }
}

function sameSite(a, b) {
  const hostA = registrableApproximation(a);
  const hostB = registrableApproximation(b);
  return hostA === hostB;
}

function registrableApproximation(hostname) {
  const parts = hostname.toLowerCase().split(".").filter(Boolean);
  if (parts.length <= 2) return parts.join(".");
  return parts.slice(-2).join(".");
}
