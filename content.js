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

function scheduleSurfacePush() {
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    pushTimer = null;
    try {
      chrome.runtime.sendMessage({
        type: "MITCH_PAGE_SURFACES",
        payload: collectAllSurfaces()
      });
    } catch {
      // Ignore when background worker is inactive
    }
  }, 250);
}

window.addEventListener("mitch:surface-observed", (event) => {
  try {
    const surface = event && event.detail && event.detail.surface;
    if (surface && Object.prototype.hasOwnProperty.call(activeFingerprinting, surface)) {
      activeFingerprinting[surface] = true;
      scheduleSurfacePush();
    }
  } catch {
    // Ignore custom event errors
  }
});

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
    scheduleSurfacePush();
  } catch {
    // Ignore observer errors
  }
});

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", scheduleSurfacePush, { once: true });
} else {
  scheduleSurfacePush();
}
window.addEventListener("load", scheduleSurfacePush, { once: true });

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.type !== "MITCH_COLLECT_SURFACES") return false;

  sendResponse(collectAllSurfaces());
  return true;
});

function collectAllSurfaces() {
  return {
    storage: collectStorage(),
    fingerprinting: collectFingerprintingSurfaces(),
    csp: collectCspSurface(),
    visibilityLayer: collectVisibilityLayer(),
    requests: collectVisibleRequests(),
    screen: collectScreen(),
    language: navigator.language || "Unknown",
    timezone: collectTimezone(),
    userAgent: navigator.userAgent || "Unknown"
  };
}

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

function hasObservedAttr(surface) {
  try {
    return Boolean(
      document.documentElement &&
      document.documentElement.getAttribute(`data-mitch-fp-${surface}`) === "1"
    );
  } catch {
    return false;
  }
}

function collectFingerprintingSurfaces() {
  return {
    canvas: activeFingerprinting.canvas || hasObservedAttr("canvas"),
    webgl: activeFingerprinting.webgl || hasObservedAttr("webgl"),
    audio: activeFingerprinting.audio || hasObservedAttr("audio"),
    webrtc: activeFingerprinting.webrtc || hasObservedAttr("webrtc"),
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

const VISIBILITY_FIELD_RULES = [
  {
    key: "health",
    pattern: /health|medical|diagnosis|prescription|blood|allerg|medication|ehds/i,
    label: "Health / Medical Attribute",
    layer: "VULNERABLE (High)",
    state: "Detected",
    hint: "GDPR Art. 9 Special Category (VULNERABLE). Use selective disclosure instead of raw medical forms."
  },
  {
    key: "financial",
    pattern: /iban|bic|cc-|credit|card|bank|salary|tax|ssn/i,
    label: "Financial / Tax Identifier",
    layer: "VULNERABLE (High)",
    state: "Detected",
    hint: "High-risk financial attribute (VULNERABLE). Verify relying-party trust before disclosure."
  },
  {
    key: "secret",
    pattern: /password|passcode|pin|secret/i,
    label: "Shared Secret / Password Input",
    layer: "VULNERABLE (High)",
    state: "Detected",
    hint: "Shared secret requested. Hardware-bound AskMI passkeys avoid server-stored passwords."
  },
  {
    key: "dob",
    pattern: /birth|dob|bday|dateofbirth|geburtsdatum/i,
    label: "Full Date of Birth (birth_date)",
    layer: "GRUNDVERSORGUNG (Medium)",
    state: "Prompt",
    hint: "Over-collection warning: Full DOB requested. An AskMI age >= 18 predicate proof suffices."
  },
  {
    key: "contact",
    pattern: /phone|tel|mobile|address|street|postal|zip|plz|wohnort/i,
    label: "Address / Phone Contact",
    layer: "GRUNDVERSORGUNG (Medium)",
    state: "Prompt",
    hint: "GRUNDVERSORGUNG attribute. Share only if physical delivery or direct contact is required."
  },
  {
    key: "identity_basic",
    pattern: /given_name|family_name|firstname|lastname|fullname|email|e-mail/i,
    label: "Basic Identity / Email (WELT)",
    layer: "WELT (Low)",
    state: "Not Detected",
    hint: "Standard Layer 0 (WELT) attribute. Pairwise pseudonymous identifiers prevent cross-site correlation."
  }
];

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
  const findingsByKey = new Map();

  try {
    const fields = document.querySelectorAll("input, select, textarea");
    fields.forEach((el) => {
      const type = (el.getAttribute("type") || "").toLowerCase();
      if (type === "hidden" || type === "submit" || type === "button" || type === "reset") return;

      const token = [
        el.getAttribute("name"),
        el.getAttribute("id"),
        el.getAttribute("autocomplete"),
        el.getAttribute("placeholder"),
        el.getAttribute("aria-label"),
        type
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      if (!token) return;

      for (const rule of VISIBILITY_FIELD_RULES) {
        if (rule.pattern.test(token)) {
          if (rule.layer === "VULNERABLE (High)") counts.vulnerable += 1;
          else if (rule.layer === "GRUNDVERSORGUNG (Medium)") counts.grundversorgung += 1;
          else counts.welt += 1;

          if (!findingsByKey.has(rule.key)) {
            findingsByKey.set(rule.key, {
              label: rule.label,
              layer: rule.layer,
              state: rule.state,
              hint: rule.hint
            });
          }
          break;
        }
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
    counts,
    findings: Array.from(findingsByKey.values())
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
