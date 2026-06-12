chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.type !== "MITCH_COLLECT_SURFACES") return false;

  sendResponse({
    storage: collectStorage(),
    fingerprinting: collectFingerprintingSurfaces(),
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
    webrtc: typeof window.RTCPeerConnection === "function" || typeof window.webkitRTCPeerConnection === "function"
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
