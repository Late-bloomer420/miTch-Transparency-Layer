/**
 * miTch Transparency Layer — ISOLATED-World Content Collector (#17, #22)
 *
 * - Captures private MessagePort from `page-observer.js` at `document_start` in capture phase
 *   and calls `event.stopImmediatePropagation()` before removing the handshake listener.
 * - Never reads `data-mitch-fp-*` DOM attributes or `mitch:surface-observed` CustomEvents.
 * - Uses PSL/eTLD+1 `MitchDomainBoundary` for third-party resource classification.
 * - Runs a throttled `MutationObserver` (600ms trailing cooldown) for dynamic SPA forms.
 * - Supports `continuous` and `on-demand` collection modes.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    const api = factory();
    if (typeof window !== "undefined" && typeof document !== "undefined") {
      api.initContentCollector(window, document, typeof chrome !== "undefined" ? chrome : null);
    }
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const COLLECTION_MODES = Object.freeze({
    CONTINUOUS: "continuous",
    ON_DEMAND: "on-demand"
  });

  const VALID_FP_SURFACES = new Set(["canvas", "webgl", "audio", "webrtc"]);
  const MUTATION_THROTTLE_MS = 600;
  const PUSH_DEBOUNCE_MS = 250;

  const OBSERVER_EVASION_CAVEAT =
    "MAIN-world API wrappers observe calls in the top-level realm since document_start; a determined site can still evade detection (e.g., via fresh same-origin iframe realms).";

  function getDomainBoundary() {
    if (typeof globalThis !== "undefined" && globalThis.MitchDomainBoundary) {
      return globalThis.MitchDomainBoundary;
    }
    if (typeof require === "function") {
      try {
        return require("./domain-boundary.js");
      } catch {
        // Fallback below
      }
    }
    return null;
  }

  function getProofBridge() {
    if (typeof globalThis !== "undefined" && globalThis.MitchProofBridge) {
      return globalThis.MitchProofBridge;
    }
    if (typeof require === "function") {
      try {
        return require("./proof-bridge.js");
      } catch {
        // Fallback below
      }
    }
    return null;
  }

  function sameSiteHost(a, b) {
    const boundary = getDomainBoundary();
    if (boundary && typeof boundary.sameSite === "function") {
      return boundary.sameSite(a, b);
    }
    const approx = (h) => {
      const parts = String(h || "").toLowerCase().split(".").filter(Boolean);
      return parts.length <= 2 ? parts.join(".") : parts.slice(-2).join(".");
    };
    return approx(a) === approx(b);
  }

  function extractFieldDescriptors(doc) {
    const descriptors = [];
    try {
      if (!doc || typeof doc.querySelectorAll !== "function") return descriptors;
      const fields = doc.querySelectorAll("input, select, textarea");
      fields.forEach((el) => {
        descriptors.push({
          name: el.getAttribute("name"),
          id: el.getAttribute("id"),
          autocomplete: el.getAttribute("autocomplete"),
          placeholder: el.getAttribute("placeholder"),
          ariaLabel: el.getAttribute("aria-label"),
          type: el.getAttribute("type")
        });
      });
    } catch {
      // Ignore DOM access errors
    }
    return descriptors;
  }

  function initContentCollector(win, doc, chromeApi, options = {}) {
    const collectorStartedAt = Date.now();
    const mutationThrottleMs =
      typeof options.mutationThrottleMs === "number" ? options.mutationThrottleMs : MUTATION_THROTTLE_MS;
    const pushDebounceMs =
      typeof options.pushDebounceMs === "number" ? options.pushDebounceMs : PUSH_DEBOUNCE_MS;

    let collectionMode =
      options.initialMode === COLLECTION_MODES.ON_DEMAND
        ? COLLECTION_MODES.ON_DEMAND
        : COLLECTION_MODES.CONTINUOUS;

    const cspObservations = {
      evalBlockedCount: 0,
      totalViolationCount: 0,
      violatedDirectives: new Set()
    };

    const activeFingerprinting = {
      canvas: false,
      webgl: false,
      audio: false,
      webrtc: false
    };

    let pushTimer = null;
    let mutationTimer = null;
    let mutationRescanCount = 0;

    function pushNow() {
      if (collectionMode === COLLECTION_MODES.ON_DEMAND) {
        return; // In on-demand mode, do not push passive background telemetry
      }
      try {
        if (chromeApi && chromeApi.runtime && typeof chromeApi.runtime.sendMessage === "function") {
          chromeApi.runtime.sendMessage({
            type: "MITCH_PAGE_SURFACES",
            payload: collectAllSurfaces()
          });
        }
      } catch {
        // Ignore when background worker is inactive
      }
    }

    function scheduleSurfacePush() {
      if (collectionMode === COLLECTION_MODES.ON_DEMAND) return;
      if (pushTimer) clearTimeout(pushTimer);
      pushTimer = setTimeout(() => {
        pushTimer = null;
        pushNow();
      }, pushDebounceMs);
    }

    // 1. One-shot capture-phase handshake for private MessageChannel (#22)
    function onPrivateChannelHandshake(event) {
      try {
        if (
          !event ||
          event.source !== win ||
          !event.data ||
          event.data.__mitchInitChannel !== true ||
          !event.ports ||
          !event.ports[0]
        ) {
          return;
        }
        if (typeof event.stopImmediatePropagation === "function") {
          event.stopImmediatePropagation();
        }
        win.removeEventListener("message", onPrivateChannelHandshake, true);

        const port = event.ports[0];
        port.onmessage = (msgEvent) => {
          try {
            const payload = msgEvent && msgEvent.data;
            if (
              payload &&
              payload.type === "MITCH_SURFACE_OBSERVED" &&
              typeof payload.surface === "string" &&
              VALID_FP_SURFACES.has(payload.surface)
            ) {
              if (!activeFingerprinting[payload.surface]) {
                activeFingerprinting[payload.surface] = true;
                scheduleSurfacePush();
              }
            }
          } catch {
            // Ignore malformed port message
          }
        };
        if (typeof port.start === "function") {
          port.start();
        }
        if (typeof port.unref === "function") {
          port.unref();
        }
      } catch {
        // Ignore handshake error
      }
    }

    if (win && typeof win.addEventListener === "function") {
      win.addEventListener("message", onPrivateChannelHandshake, true);
    }

    // 2. Passive CSP violation listener
    if (doc && typeof doc.addEventListener === "function") {
      doc.addEventListener("securitypolicyviolation", (event) => {
        try {
          cspObservations.totalViolationCount += 1;
          const directive = (event && (event.violatedDirective || event.effectiveDirective)) || "unknown";
          cspObservations.violatedDirectives.add(directive);
          if (
            event &&
            (event.blockedURI === "eval" ||
              event.blockedURI === "wasm-eval" ||
              (directive.startsWith("script-src") && !event.blockedURI))
          ) {
            cspObservations.evalBlockedCount += 1;
          }
          scheduleSurfacePush();
        } catch {
          // Ignore observer errors
        }
      });
    }

    // 3. Throttled MutationObserver for dynamic DOM forms/inputs (#17)
    function scheduleMutationRescan() {
      if (mutationTimer) return; // Trailing throttle: coalesce rapid DOM mutations
      mutationTimer = setTimeout(() => {
        mutationTimer = null;
        mutationRescanCount += 1;
        scheduleSurfacePush();
      }, mutationThrottleMs);
    }

    const MutationObserverCtor =
      options.MutationObserver || (win && win.MutationObserver) || globalThis.MutationObserver;
    let domObserver = null;
    if (typeof MutationObserverCtor === "function" && doc && doc.documentElement) {
      try {
        domObserver = new MutationObserverCtor((mutations) => {
          for (const m of mutations) {
            if (m.type === "attributes" || (m.addedNodes && m.addedNodes.length > 0)) {
              scheduleMutationRescan();
              break;
            }
          }
        });
        domObserver.observe(doc.documentElement, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ["name", "id", "autocomplete", "placeholder", "aria-label", "type"]
        });
      } catch {
        domObserver = null;
      }
    }

    // 4. Sync initial collection mode from background worker if available
    if (chromeApi && chromeApi.runtime && typeof chromeApi.runtime.sendMessage === "function") {
      try {
        chromeApi.runtime.sendMessage({ type: "MITCH_GET_COLLECTION_MODE" }, (res) => {
          if (res && res.collectionMode === COLLECTION_MODES.ON_DEMAND) {
            collectionMode = COLLECTION_MODES.ON_DEMAND;
          } else {
            collectionMode = COLLECTION_MODES.CONTINUOUS;
            scheduleSurfacePush();
          }
        });
      } catch {
        // Fallback to default mode
      }
    }

    if (doc && doc.readyState === "loading" && typeof doc.addEventListener === "function") {
      doc.addEventListener("DOMContentLoaded", scheduleSurfacePush, { once: true });
    } else {
      scheduleSurfacePush();
    }
    if (win && typeof win.addEventListener === "function") {
      win.addEventListener("load", scheduleSurfacePush, { once: true });
    }

    if (
      chromeApi &&
      chromeApi.runtime &&
      chromeApi.runtime.onMessage &&
      typeof chromeApi.runtime.onMessage.addListener === "function"
    ) {
      chromeApi.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (!message || typeof message !== "object") return false;
        if (message.type === "MITCH_SET_COLLECTION_MODE") {
          collectionMode =
            message.collectionMode === COLLECTION_MODES.ON_DEMAND
              ? COLLECTION_MODES.ON_DEMAND
              : COLLECTION_MODES.CONTINUOUS;
          if (collectionMode === COLLECTION_MODES.CONTINUOUS) {
            scheduleSurfacePush();
          }
          sendResponse({ ok: true, collectionMode });
          return true;
        }
        if (message.type === "MITCH_COLLECT_SURFACES") {
          sendResponse(collectAllSurfaces());
          return true;
        }
        return false;
      });
    }

    function collectStorage() {
      return {
        localStorage: describeStorage(win && win.localStorage),
        sessionStorage: describeStorage(win && win.sessionStorage)
      };
    }

    function describeStorage(storage) {
      try {
        if (!storage) return "Not Detected";
        const count = storage.length;
        return count > 0 ? `${count} keys` : "Not Detected";
      } catch {
        return "Unavailable";
      }
    }

    // Notice (#22): Strictly reports private MessagePort observations; NEVER reads DOM attributes!
    function collectFingerprintingSurfaces() {
      return {
        canvas: Boolean(activeFingerprinting.canvas),
        webgl: Boolean(activeFingerprinting.webgl),
        audio: Boolean(activeFingerprinting.audio),
        webrtc: Boolean(activeFingerprinting.webrtc),
        evalAttempt: cspObservations.evalBlockedCount > 0
      };
    }

    function collectCspSurface() {
      try {
        const meta =
          doc && typeof doc.querySelector === "function"
            ? doc.querySelector('meta[http-equiv="Content-Security-Policy" i]')
            : null;
        const content = meta ? meta.getAttribute("content") || "" : "";
        const hasMetaCsp = Boolean(content.trim());
        const metaAllowsUnsafeEval = /'unsafe-eval'/i.test(content);
        return {
          hasMetaCsp,
          metaBlocksEval: hasMetaCsp && !metaAllowsUnsafeEval,
          evalBlockedCount: cspObservations.evalBlockedCount,
          totalViolationCount: cspObservations.totalViolationCount,
          violatedDirectives: Array.from(cspObservations.violatedDirectives)
        };
      } catch {
        return {
          hasMetaCsp: false,
          metaBlocksEval: false,
          evalBlockedCount: cspObservations.evalBlockedCount,
          totalViolationCount: cspObservations.totalViolationCount,
          violatedDirectives: []
        };
      }
    }

    function collectVisibilityLayer() {
      const descriptors = extractFieldDescriptors(doc);
      const bridge = getProofBridge();
      if (bridge && typeof bridge.evaluateFieldsForVisibilityAndProof === "function") {
        return bridge.evaluateFieldsForVisibilityAndProof(descriptors);
      }
      return {
        highestLayer: "None Detected",
        counts: { vulnerable: 0, grundversorgung: 0, welt: 0 },
        findings: [],
        proofSuggestion: null
      };
    }

    function collectVisibleRequests() {
      try {
        const pageHost =
          win && win.location && win.location.hostname
            ? win.location.hostname.toLowerCase()
            : "";
        const domainCounts = {};
        let totalThirdParty = 0;

        const perf = (win && win.performance) || (typeof performance !== "undefined" ? performance : null);
        const entries =
          perf && typeof perf.getEntriesByType === "function"
            ? perf.getEntriesByType("resource")
            : [];

        entries.forEach((entry) => {
          try {
            const host = new URL(entry.name).hostname.toLowerCase();
            if (host && !sameSiteHost(host, pageHost)) {
              totalThirdParty += 1;
              domainCounts[host] = (domainCounts[host] || 0) + 1;
            }
          } catch {
            // Ignore non-URL resource entry
          }
        });

        return {
          available: true,
          thirdPartyRequestCount: totalThirdParty,
          thirdPartyDomains: Object.keys(domainCounts).sort(),
          domainCounts
        };
      } catch {
        return {
          available: false,
          thirdPartyRequestCount: 0,
          thirdPartyDomains: [],
          domainCounts: {}
        };
      }
    }

    function collectScreen() {
      try {
        if (!win || !win.screen) return "Unknown";
        return `${win.screen.width} × ${win.screen.height}`;
      } catch {
        return "Unknown";
      }
    }

    function collectTimezone() {
      try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone || "Unknown";
      } catch {
        return "Unknown";
      }
    }

    function collectAllSurfaces() {
      const nav = (win && win.navigator) || (typeof navigator !== "undefined" ? navigator : {});
      return {
        available: true,
        collectionMode,
        evasionCaveat: OBSERVER_EVASION_CAVEAT,
        mutationRescanCount,
        observationWindowMs: Math.max(0, Date.now() - collectorStartedAt),
        storage: collectStorage(),
        fingerprinting: collectFingerprintingSurfaces(),
        csp: collectCspSurface(),
        visibilityLayer: collectVisibilityLayer(),
        requests: collectVisibleRequests(),
        screen: collectScreen(),
        language: nav.language || "Unknown",
        timezone: collectTimezone(),
        userAgent: nav.userAgent || "Unknown"
      };
    }

    return {
      collectAllSurfaces,
      scheduleMutationRescan,
      getMutationRescanCount: () => mutationRescanCount,
      getCollectionMode: () => collectionMode,
      setCollectionMode: (mode) => {
        collectionMode =
          mode === COLLECTION_MODES.ON_DEMAND
            ? COLLECTION_MODES.ON_DEMAND
            : COLLECTION_MODES.CONTINUOUS;
      },
      disconnect: () => {
        if (domObserver) domObserver.disconnect();
        if (pushTimer) clearTimeout(pushTimer);
        if (mutationTimer) clearTimeout(mutationTimer);
      }
    };
  }

  return Object.freeze({
    COLLECTION_MODES,
    OBSERVER_EVASION_CAVEAT,
    extractFieldDescriptors,
    sameSiteHost,
    initContentCollector
  });
});
