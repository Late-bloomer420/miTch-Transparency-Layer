if (typeof importScripts === "function") {
  try {
    importScripts("domain-boundary.js");
  } catch {
    // Fallback below if running in test environment
  }
}

const domainBoundary =
  (typeof globalThis !== "undefined" && globalThis.MitchDomainBoundary) ||
  (typeof require === "function" ? require("./domain-boundary.js") : null);

const tabRequests = new Map();
const MAX_DOMAINS_PER_TAB = 80;
let collectionMode = "continuous"; // "continuous" | "on-demand"

if (typeof chrome !== "undefined" && chrome.webRequest && chrome.tabs && chrome.runtime) {
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
    if (!message || typeof message !== "object") return false;

    if (message.type === "MITCH_GET_COLLECTION_MODE") {
      sendResponse({ collectionMode });
      return true;
    }

    if (message.type === "MITCH_SET_COLLECTION_MODE") {
      collectionMode = message.collectionMode === "on-demand" ? "on-demand" : "continuous";
      if (collectionMode === "on-demand") {
        for (const tabId of tabRequests.keys()) {
          clearTabBadge(tabId);
        }
        tabRequests.clear();
      }
      sendResponse({ ok: true, collectionMode });
      return true;
    }

    if (message.type === "MITCH_GET_TAB_REQUESTS") {
      const entry = tabRequests.get(message.tabId);
      if (!entry) {
        sendResponse({
          available: true,
          collectionMode,
          hasContentPush: false,
          thirdPartyRequestCount: 0,
          thirdPartyDomains: [],
          domainCounts: {},
          unattributedRequestCount: 0,
          observationWindowMs: 0
        });
        return true;
      }
      sendResponse({
        available: true,
        collectionMode,
        hasContentPush: Boolean(entry.hasContentPush),
        thirdPartyRequestCount: entry.thirdPartyCount,
        thirdPartyDomains: Array.from(entry.domainCounts.keys()).sort(),
        domainCounts: Object.fromEntries(entry.domainCounts),
        unattributedRequestCount: entry.unattributedCount,
        observationWindowMs: Math.max(0, Date.now() - entry.startedAt)
      });
      return true;
    }

    if (message.type === "MITCH_PAGE_SURFACES" && sender.tab && sender.tab.id >= 0) {
      if (collectionMode === "on-demand") {
        sendResponse({ ok: true, skipped: true });
        return true;
      }
      const tabId = sender.tab.id;
      const entry = getEntry(tabId);
      entry.hasContentPush = true;
      entry.pageSurfaces = message.payload || {};
      if (entry.pageSurfaces.requests) {
        const reqs = entry.pageSurfaces.requests;
        if (reqs.domainCounts && typeof reqs.domainCounts === "object") {
          for (const [domain, count] of Object.entries(reqs.domainCounts)) {
            if (entry.domainCounts.has(domain) || entry.domainCounts.size < MAX_DOMAINS_PER_TAB) {
              const prev = entry.domainCounts.get(domain) || 0;
              const next = Number.isFinite(count) && count > 0 ? Math.floor(count) : 1;
              entry.domainCounts.set(domain, Math.max(prev, next));
            }
          }
        } else if (Array.isArray(reqs.thirdPartyDomains)) {
          reqs.thirdPartyDomains.forEach((domain) => {
            if (entry.domainCounts.has(domain) || entry.domainCounts.size < MAX_DOMAINS_PER_TAB) {
              entry.domainCounts.set(domain, Math.max(entry.domainCounts.get(domain) || 0, 1));
            }
          });
        }
      }
      updateTabBadge(tabId);
      sendResponse({ ok: true });
      return true;
    }

    return false;
  });
}

function recordRequest(details) {
  if (collectionMode === "on-demand") return;
  if (!details || details.tabId < 0) return;

  if (domainBoundary && typeof domainBoundary.classifyRequestRelation === "function") {
    const rel = domainBoundary.classifyRequestRelation({
      requestUrl: details.url,
      initiator: details.initiator,
      documentUrl: details.documentUrl
    });
    if (rel.relation === "invalid" || rel.relation === "first-party") {
      return;
    }
    const entry = getEntry(details.tabId);
    if (rel.relation === "unattributed") {
      entry.unattributedCount += 1;
      return;
    }
    if (rel.relation === "third-party" && rel.requestHost) {
      entry.thirdPartyCount += 1;
      if (entry.domainCounts.has(rel.requestHost) || entry.domainCounts.size < MAX_DOMAINS_PER_TAB) {
        entry.domainCounts.set(rel.requestHost, (entry.domainCounts.get(rel.requestHost) || 0) + 1);
      }
      updateTabBadge(details.tabId);
    }
    return;
  }

  if (!details.initiator || details.initiator === "null") {
    const entry = getEntry(details.tabId);
    entry.unattributedCount += 1;
    return;
  }

  let requestHost;
  let initiatorHost;
  try {
    requestHost = new URL(details.url).hostname.toLowerCase();
    initiatorHost = new URL(details.initiator).hostname.toLowerCase();
  } catch {
    return;
  }

  if (!requestHost || !initiatorHost || sameSite(requestHost, initiatorHost)) return;

  const entry = getEntry(details.tabId);
  entry.thirdPartyCount += 1;
  if (entry.domainCounts.has(requestHost) || entry.domainCounts.size < MAX_DOMAINS_PER_TAB) {
    entry.domainCounts.set(requestHost, (entry.domainCounts.get(requestHost) || 0) + 1);
  }
  updateTabBadge(details.tabId);
}

function getEntry(tabId) {
  if (!tabRequests.has(tabId)) {
    tabRequests.set(tabId, {
      startedAt: Date.now(),
      hasContentPush: false,
      thirdPartyCount: 0,
      unattributedCount: 0,
      domainCounts: new Map(),
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

/**
 * Pure badge state evaluator (#14):
 * Never renders a failed or missing content-script scan as green/"0" ("clean").
 */
function computeBadgeState(entry) {
  if (!entry) {
    return { text: "", color: null, partial: true };
  }

  let sumDomainCounts = 0;
  if (entry.domainCounts instanceof Map) {
    for (const c of entry.domainCounts.values()) sumDomainCounts += c;
  } else if (entry.domainCounts && typeof entry.domainCounts === "object") {
    for (const c of Object.values(entry.domainCounts)) sumDomainCounts += Number(c) || 0;
  }
  const thirdPartyCount = Math.max(entry.thirdPartyCount || 0, sumDomainCounts);

  if (!entry.hasContentPush) {
    if (thirdPartyCount > 0) {
      return { text: "?", color: "#f1c65b", partial: true };
    }
    return { text: "", color: null, partial: true };
  }

  const surfaces = entry.pageSurfaces || {};
  const fp = surfaces.fingerprinting || {};
  const fpCount = Object.values(fp).filter(Boolean).length;
  const vis = surfaces.visibilityLayer || {};
  const highestLayer = vis.highestLayer || "None Detected";

  const estimatedScore = Math.min(
    100,
    Math.round(
      Math.min(25, thirdPartyCount * 3) +
        fpCount * 10 +
        (highestLayer === "VULNERABLE (High)" ? 25 : highestLayer === "GRUNDVERSORGUNG (Medium)" ? 10 : 0)
    )
  );

  let color = "#46d9b5"; // Green (Minimal observed in complete push)
  if (highestLayer === "VULNERABLE (High)" || estimatedScore > 50) {
    color = "#ff6f8f"; // Red (Elevated / Vulnerable)
  } else if (highestLayer === "GRUNDVERSORGUNG (Medium)" || estimatedScore > 25 || thirdPartyCount > 0) {
    color = "#f1c65b"; // Amber (Moderate)
  }

  const text = estimatedScore > 0 ? String(estimatedScore) : "0";
  return { text, color, partial: false };
}

function updateTabBadge(tabId) {
  try {
    const entry = tabRequests.get(tabId);
    const badge = computeBadgeState(entry);
    if (!badge.text) {
      clearTabBadge(tabId);
      return;
    }
    if (badge.color) {
      chrome.action.setBadgeBackgroundColor({ tabId, color: badge.color });
    }
    chrome.action.setBadgeText({ tabId, text: badge.text });
  } catch {
    // Ignore badge errors on closed tabs
  }
}

function sameSite(a, b) {
  if (domainBoundary && typeof domainBoundary.sameSite === "function") {
    return domainBoundary.sameSite(a, b);
  }
  const hostA = registrableApproximation(a);
  const hostB = registrableApproximation(b);
  return hostA === hostB;
}

function registrableApproximation(hostname) {
  if (domainBoundary && typeof domainBoundary.getRegistrableDomain === "function") {
    return domainBoundary.getRegistrableDomain(hostname) || "";
  }
  const parts = String(hostname || "").toLowerCase().split(".").filter(Boolean);
  if (parts.length <= 2) return parts.join(".");
  return parts.slice(-2).join(".");
}

if (typeof module === "object" && module.exports) {
  module.exports = {
    computeBadgeState,
    sameSite,
    registrableApproximation,
    recordRequest,
    getTabEntry: (tabId) => tabRequests.get(tabId),
    setCollectionModeForTest: (mode) => {
      collectionMode = mode === "on-demand" ? "on-demand" : "continuous";
    }
  };
}
