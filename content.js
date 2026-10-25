const cspObservations = {
  evalBlockedCount: 0,
  totalViolationCount: 0,
  violatedDirectives: new Set()
};

document.addEventListener("securitypolicyviolation", (event) => {
  try {
    cspObservations.totalViolationCount += 1;
    const directive = event.violatedDirective || event.effectiveDirective || "unknown";
    cspObservations.violatedDirectives.add(directive);
    if (
      event.blockedURI === "eval" ||
      event.blockedURI === "wasm-eval" ||
      (directive.startsWith("script-src") && !event.blockedURI)
    ) {
      cspObservations.evalBlockedCount += 1;
    }
  } catch {
    // Ignore observer errors
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.type !== "MITCH_COLLECT_SURFACES") return false;

  sendResponse({
    storage: collectStorage(),
    fingerprinting: collectFingerprintingSurfaces(),
    csp: collectCspSurface(),
    visibilityLayer: collectVisibilityLayer(),
    requests: collectVisibleRequests(),
    screen: collectScreen(),
    language: navigator.language || "Unknown",
    timezone: collectTimezone(),
    userAgent: navigator.userAgent || "Unknown"
  });

  return true;
});

function collectStorage() {
  return {
    localStorage: describeStorage(window.localStorage),
    sessionStorage: describeStorage(window.sessionStorage)
  };
}

function describeStorage(storage) {
  try {
    if (!storage) return "Not Detected";
    const count = storage.length;
    return count > 0 ? `${count} keys` : "Not Detected";
  } catch {
    return "Unknown";
  }
}

function collectFingerprintingSurfaces() {
  return {
    canvas: detectCanvas(),
    webgl: detectWebGL(),
    audio: typeof window.AudioContext === "function" || typeof window.webkitAudioContext === "function",
    webrtc: typeof window.RTCPeerConnection === "function" || typeof window.webkitRTCPeerConnection === "function",
    evalAttempt: cspObservations.evalBlockedCount > 0
  };
}

function collectCspSurface() {
  try {
    const meta = document.querySelector('meta[http-equiv="Content-Security-Policy" i]');
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

/**
 * Passive DOM field inspection aligned with @askmi/layer-resolver VISIBILITY_LAYER_MAP.
 * Never reads input values (.value) — only inspects field names/types/autocomplete tokens.
 */
function collectVisibilityLayer() {
  const counts = {
    vulnerable: 0,
    grundversorgung: 0,
    welt: 0
  };
  const matchedClaims = [];

  try {
    const fields = document.querySelectorAll("input, select, textarea");
    fields.forEach((el) => {
      const type = (el.getAttribute("type") || "").toLowerCase();
      if (type === "hidden" || type === "submit" || type === "button" || type === "reset") return;

      const token = [
        el.getAttribute("name"),
        el.getAttribute("id"),
        el.getAttribute("autocomplete"),
        type
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      if (!token) return;

      if (
        /iban|bic|cc-|card|credit|bank|salary|tax|ssn|health|medical|diagnosis|prescription|blood|allerg|medication|password|passkey|biometric/.test(
          token
        )
      ) {
        counts.vulnerable += 1;
        if (matchedClaims.length < 6) matchedClaims.push("VULNERABLE (High)");
      } else if (/birth|dob|age|bday|phone|tel|address|street|postal|zip|school|education/.test(token)) {
        counts.grundversorgung += 1;
        if (matchedClaims.length < 6) matchedClaims.push("GRUNDVERSORGUNG (Medium)");
      } else if (/name|given|family|email|consent|public/.test(token)) {
        counts.welt += 1;
        if (matchedClaims.length < 6) matchedClaims.push("WELT (Low)");
      }
    });
  } catch {
    // Ignore DOM access errors
  }

  let highestLayer = "None Detected";
  if (counts.vulnerable > 0) {
    highestLayer = "VULNERABLE (High)";
  } else if (counts.grundversorgung > 0) {
    highestLayer = "GRUNDVERSORGUNG (Medium)";
  } else if (counts.welt > 0) {
    highestLayer = "WELT (Low)";
  }

  return {
    highestLayer,
    counts
  };
}

function collectVisibleRequests() {
  try {
    const pageHost = window.location.hostname;
    const domains = new Set();
    performance.getEntriesByType("resource").forEach((entry) => {
      try {
        const host = new URL(entry.name).hostname;
        if (host && !sameSite(host, pageHost)) domains.add(host);
      } catch {
        return;
      }
    });

    return {
      thirdPartyRequestCount: domains.size,
      thirdPartyDomains: Array.from(domains).sort()
    };
  } catch {
    return {
      thirdPartyRequestCount: 0,
      thirdPartyDomains: []
    };
  }
}

function detectCanvas() {
  try {
    return typeof HTMLCanvasElement !== "undefined" && typeof HTMLCanvasElement.prototype.getContext === "function";
  } catch {
    return false;
  }
}

function detectWebGL() {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(
      window.WebGLRenderingContext &&
      (canvas.getContext("webgl") || canvas.getContext("experimental-webgl"))
    );
  } catch {
    return false;
  }
}

function collectScreen() {
  try {
    if (!window.screen) return "Unknown";
    return `${window.screen.width} × ${window.screen.height}`;
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

function sameSite(a, b) {
  return registrableApproximation(a) === registrableApproximation(b);
}

function registrableApproximation(hostname) {
  const parts = hostname.toLowerCase().split(".").filter(Boolean);
  if (parts.length <= 2) return parts.join(".");
  return parts.slice(-2).join(".");
}
