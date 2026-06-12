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
    const entry = getEntry(sender.tab.id);
    entry.pageSurfaces = message.payload || {};
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
