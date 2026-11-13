/**
 * @module surface-receipt
 *
 * Pure, zero-dependency normalized report model & serializer for
 * Transparency Surface Receipt v1 (`askmi.transparency.surface-receipt.v1`).
 *
 * Shared single source of truth for:
 *   - Extension popup UI rendering
 *   - JSON receipt export
 *   - Markdown report export
 *   - Deterministic CLI / CI fixture validation & diffing
 *
 * Enforces:
 *   - Five non-collapsed evidence states: observed, declared, potential, unknown, unavailable
 *   - Strict separation of uniqueThirdPartyDomainCount, thirdPartyRequestCount, and knownTrackerDomainCount
 *   - Lifecycle claim boundaries (field presence != value entered; request != payload verified or data sold)
 *   - Explicit "not observed != absent" semantics
 *   - Origin-only URL redaction (no query/fragment/credentials) and Markdown metacharacter escaping (#21)
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.MitchSurfaceReceipt = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const RECEIPT_SCHEMA_V1 = "askmi.transparency.surface-receipt.v1";
  const COLLECTOR_NAME = "miTch Transparency Layer";
  const COLLECTOR_VERSION = "0.3.0";
  const RULE_SET_VERSION = "visibility-rules-v1";
  const SCORING_RULE_VERSION = "surface-score-v1";
  const NORMALIZATION_VERSION = "1";

  function getStandardsMapping() {
    if (typeof globalThis !== "undefined" && globalThis.MitchStandardsMapping) {
      return globalThis.MitchStandardsMapping;
    }
    if (typeof require === "function") {
      try {
        return require("./standards-mapping.js");
      } catch {
        return null;
      }
    }
    return null;
  }

  const EVIDENCE_STATES = Object.freeze([
    "observed",
    "declared",
    "potential",
    "unknown",
    "unavailable"
  ]);

  const SCAN_STATUSES = Object.freeze([
    "complete",
    "limited",
    "unsupported",
    "preview",
    "error"
  ]);

  const FINGERPRINT_SURFACES = Object.freeze({
    canvas: "Canvas Readout (toDataURL / toBlob / getImageData)",
    webgl: "WebGL Unmasked Renderer / Pixel Readout",
    audio: "AudioContext / OfflineAudioContext Oscillator",
    webrtc: "WebRTC RTCPeerConnection",
    evalAttempt: "Blocked Dynamic eval() CSP Violation"
  });

  const PERMISSION_SURFACES = Object.freeze([
    { key: "geolocation", label: "Geolocation", queryName: "geolocation" },
    { key: "notifications", label: "Notifications", queryName: "notifications" },
    { key: "camera", label: "Camera", queryName: "camera" },
    { key: "microphone", label: "Microphone", queryName: "microphone" },
    { key: "clipboard", label: "Clipboard", queryName: "clipboard-read" }
  ]);

  const KNOWN_TRACKER_PATTERNS = Object.freeze([
    {
      pattern: /(^|\.)(google-analytics\.com|googletagmanager\.com|analytics\.google\.com)$/i,
      classification: "Analytics Tracker"
    },
    {
      pattern: /(^|\.)(doubleclick\.net|googlesyndication\.com|googleadservices\.com|adservice\.google\.com)$/i,
      classification: "Ad-Tech Tracker"
    },
    {
      pattern: /(^|\.)(facebook\.net|facebook\.com|fbcdn\.net)$/i,
      classification: "Social / Ad Tracker"
    },
    {
      pattern: /(^|\.)(clarity\.ms|hotjar\.com|fullstory\.com|mouseflow\.com|logrocket\.com)$/i,
      classification: "Session Replay"
    },
    {
      pattern: /(^|\.)(mixpanel\.com|segment\.io|segment\.com|amplitude\.com|posthog\.com|plausible\.io)$/i,
      classification: "Product Telemetry"
    },
    {
      pattern: /(^|\.)(criteo\.com|taboola\.com|outbrain\.com|adnxs\.com|rubiconproject\.com|pubmatic\.com)$/i,
      classification: "Ad Exchange"
    },
    {
      pattern: /(^|\.)(tiktok\.com|byteoversea\.com|snapchat\.com|sc-static\.net|linkedin\.com|licdn\.com|bat\.bing\.com)$/i,
      classification: "Attribution Pixel"
    },
    {
      pattern: /(^|\.)(sentry\.io|datadoghq\.com|newrelic\.com|nr-data\.net|bugsnag\.com)$/i,
      classification: "Error / RUM Telemetry"
    }
  ]);

  // --- Pure-JS FIPS 180-4 SHA-256 for synchronous deterministic receipt integrity ---
  const SHA256_K = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ]);

  function rotr(x, n) {
    return (x >>> n) | (x << (32 - n));
  }

  function utf8Bytes(str) {
    if (typeof TextEncoder !== "undefined") {
      return new TextEncoder().encode(str);
    }
    const out = [];
    for (let i = 0; i < str.length; i += 1) {
      let c = str.charCodeAt(i);
      if (c < 0x80) {
        out.push(c);
      } else if (c < 0x800) {
        out.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
      } else if (c >= 0xd800 && c <= 0xdbff && i + 1 < str.length) {
        const c2 = str.charCodeAt(i + 1);
        if (c2 >= 0xdc00 && c2 <= 0xdfff) {
          c = 0x10000 + (((c & 0x3ff) << 10) | (c2 & 0x3ff));
          out.push(
            0xf0 | (c >> 18),
            0x80 | ((c >> 12) & 0x3f),
            0x80 | ((c >> 6) & 0x3f),
            0x80 | (c & 0x3f)
          );
          i += 1;
        }
      } else {
        out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
      }
    }
    return Uint8Array.from(out);
  }

  function sha256Hex(input) {
    const msg = utf8Bytes(String(input));
    const bitLenHi = Math.floor((msg.length * 8) / 0x100000000);
    const bitLenLo = (msg.length * 8) >>> 0;
    const padLen = ((msg.length + 9 + 63) & ~63);
    const buf = new Uint8Array(padLen);
    buf.set(msg);
    buf[msg.length] = 0x80;
    const view = new DataView(buf.buffer);
    view.setUint32(padLen - 8, bitLenHi, false);
    view.setUint32(padLen - 4, bitLenLo, false);

    let h0 = 0x6a09e667;
    let h1 = 0xbb67ae85;
    let h2 = 0x3c6ef372;
    let h3 = 0xa54ff53a;
    let h4 = 0x510e527f;
    let h5 = 0x9b05688c;
    let h6 = 0x1f83d9ab;
    let h7 = 0x5be0cd19;
    const w = new Uint32Array(64);

    for (let offset = 0; offset < padLen; offset += 64) {
      for (let i = 0; i < 16; i += 1) {
        w[i] = view.getUint32(offset + i * 4, false);
      }
      for (let i = 16; i < 64; i += 1) {
        const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
        const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
      }

      let a = h0;
      let b = h1;
      let c = h2;
      let d = h3;
      let e = h4;
      let f = h5;
      let g = h6;
      let h = h7;

      for (let i = 0; i < 64; i += 1) {
        const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
        const ch = (e & f) ^ (~e & g);
        const temp1 = (h + S1 + ch + SHA256_K[i] + w[i]) >>> 0;
        const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
        const maj = (a & b) ^ (a & c) ^ (b & c);
        const temp2 = (S0 + maj) >>> 0;

        h = g;
        g = f;
        f = e;
        e = (d + temp1) >>> 0;
        d = c;
        c = b;
        b = a;
        a = (temp1 + temp2) >>> 0;
      }

      h0 = (h0 + a) >>> 0;
      h1 = (h1 + b) >>> 0;
      h2 = (h2 + c) >>> 0;
      h3 = (h3 + d) >>> 0;
      h4 = (h4 + e) >>> 0;
      h5 = (h5 + f) >>> 0;
      h6 = (h6 + g) >>> 0;
      h7 = (h7 + h) >>> 0;
    }

    return [h0, h1, h2, h3, h4, h5, h6, h7]
      .map((v) => v.toString(16).padStart(8, "0"))
      .join("");
  }

  function canonicalizeJson(value) {
    if (value === null || typeof value !== "object") {
      return JSON.stringify(value);
    }
    if (Array.isArray(value)) {
      return `[${value.map((item) => canonicalizeJson(item === undefined ? null : item)).join(",")}]`;
    }
    const keys = Object.keys(value)
      .filter((k) => value[k] !== undefined)
      .sort();
    const pairs = keys.map((k) => `${JSON.stringify(k)}:${canonicalizeJson(value[k])}`);
    return `{${pairs.join(",")}}`;
  }

  function generateReceiptId() {
    try {
      if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
        return `tsr_${crypto.randomUUID()}`;
      }
      if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
        const bytes = new Uint8Array(16);
        crypto.getRandomValues(bytes);
        return `tsr_${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}`;
      }
    } catch {
      // Fallback below
    }
    return `tsr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  }

  function sanitizePlainText(raw, fallback, maxLen = 200) {
    if (typeof raw !== "string") return fallback;
    const cleaned = raw
      .replace(/[\x00-\x1F\x7F]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, maxLen);
    return cleaned || fallback;
  }

  function escapeMarkdownInline(raw) {
    const clean = sanitizePlainText(String(raw == null ? "" : raw), "", 500);
    return clean.replace(/([\\`*_{}[\]()#+!<>|~])/g, "\\$1");
  }

  function sanitizeCodeSpan(raw) {
    return sanitizePlainText(String(raw == null ? "" : raw), "", 500).replace(/`/g, "'");
  }

  /**
   * Sanitize page reference so query strings (?token=...), fragments (#access_token=...),
   * user:pass credentials, and full paths are never exported (#21).
   */
  function sanitizePageContext(rawUrl, rawTitle) {
    const safeTitle = sanitizePlainText(rawTitle, "Untitled page", 200);
    if (!rawUrl) {
      return {
        origin: "unavailable",
        domain: "unavailable",
        protocol: "UNSUPPORTED",
        title: safeTitle,
        urlIncluded: false
      };
    }

    try {
      const parsed = rawUrl instanceof URL ? new URL(rawUrl.href) : new URL(String(rawUrl));
      if (parsed.protocol === "http:" || parsed.protocol === "https:") {
        return {
          origin: parsed.origin,
          domain: parsed.hostname.toLowerCase(),
          protocol: parsed.protocol.replace(":", "").toUpperCase(),
          title: safeTitle,
          urlIncluded: false
        };
      }
      return {
        origin: "unavailable",
        domain: parsed.hostname ? parsed.hostname.toLowerCase() : "unavailable",
        protocol: parsed.protocol.replace(":", "").toUpperCase() || "UNSUPPORTED",
        title: safeTitle,
        urlIncluded: false
      };
    } catch {
      return {
        origin: "unavailable",
        domain: "unavailable",
        protocol: "UNSUPPORTED",
        title: safeTitle,
        urlIncluded: false
      };
    }
  }

  function classifyThirdPartyDomain(domain) {
    const normalized = sanitizePlainText(String(domain || "").toLowerCase(), "unknown", 253);
    for (const rule of KNOWN_TRACKER_PATTERNS) {
      if (rule.pattern.test(normalized)) {
        return {
          domain: normalized,
          isTracker: true,
          classification: rule.classification,
          classificationSource: "local-rule"
        };
      }
    }
    return {
      domain: normalized,
      isTracker: false,
      classification: "External Resource / CDN",
      classificationSource: "local-rule"
    };
  }

  /**
   * Normalize third-party network observations, strictly keeping:
   *   - uniqueThirdPartyDomainCount
   *   - thirdPartyRequestCount
   *   - knownTrackerDomainCount
   * separate (#15).
   */
  function normalizeNetworkData(rawNetwork) {
    if (!rawNetwork || rawNetwork.available === false) {
      return {
        available: false,
        thirdPartyRequestCount: null,
        uniqueThirdPartyDomainCount: null,
        knownTrackerDomainCount: null,
        unattributedRequestCount: 0,
        domains: []
      };
    }

    const countsMap = new Map();

    // 1. Explicit domains array [{ domain, requestCount }]
    if (Array.isArray(rawNetwork.domains)) {
      for (const entry of rawNetwork.domains) {
        if (!entry) continue;
        const d = typeof entry === "string" ? entry : entry.domain;
        if (!d || typeof d !== "string") continue;
        const key = d.toLowerCase().trim();
        if (!key) continue;
        const count =
          typeof entry === "object" && Number.isFinite(entry.requestCount) && entry.requestCount > 0
            ? Math.floor(entry.requestCount)
            : 1;
        countsMap.set(key, Math.max(countsMap.get(key) || 0, count));
      }
    }

    // 2. domainCounts map { "analytics.example": 20 }
    if (rawNetwork.domainCounts && typeof rawNetwork.domainCounts === "object") {
      for (const [rawHost, rawCount] of Object.entries(rawNetwork.domainCounts)) {
        const key = String(rawHost || "").toLowerCase().trim();
        if (!key) continue;
        const count = Number.isFinite(rawCount) && rawCount > 0 ? Math.floor(rawCount) : 1;
        countsMap.set(key, Math.max(countsMap.get(key) || 0, count));
      }
    }

    // 3. Legacy thirdPartyDomains string array
    if (Array.isArray(rawNetwork.thirdPartyDomains)) {
      for (const rawHost of rawNetwork.thirdPartyDomains) {
        const key = String(rawHost || "").toLowerCase().trim();
        if (!key) continue;
        if (!countsMap.has(key)) {
          countsMap.set(key, 1);
        }
      }
    }

    const sortedHosts = Array.from(countsMap.keys()).sort();
    let sumDomainRequests = 0;
    const domains = sortedHosts.map((host) => {
      const requestCount = countsMap.get(host) || 1;
      sumDomainRequests += requestCount;
      const meta = classifyThirdPartyDomain(host);
      return {
        domain: meta.domain,
        classification: meta.classification,
        classificationSource: meta.classificationSource,
        isTracker: meta.isTracker,
        requestCount
      };
    });

    const explicitTotal = Number.isFinite(rawNetwork.thirdPartyRequestCount)
      ? Math.max(0, Math.floor(rawNetwork.thirdPartyRequestCount))
      : 0;

    // If only 1 domain exists and explicitTotal > sumDomainRequests (e.g. legacy caller passed count=20 and thirdPartyDomains=["a.example"]),
    // attribute the total to that sole domain so domain.requestCount stays consistent.
    if (domains.length === 1 && explicitTotal > sumDomainRequests) {
      domains[0].requestCount = explicitTotal;
      sumDomainRequests = explicitTotal;
    }

    const thirdPartyRequestCount = Math.max(explicitTotal, sumDomainRequests);
    const uniqueThirdPartyDomainCount = domains.length;
    const knownTrackerDomainCount = domains.filter((d) => d.isTracker).length;
    const unattributedRequestCount = Number.isFinite(rawNetwork.unattributedRequestCount)
      ? Math.max(0, Math.floor(rawNetwork.unattributedRequestCount))
      : 0;

    return {
      available: true,
      thirdPartyRequestCount,
      uniqueThirdPartyDomainCount,
      knownTrackerDomainCount,
      unattributedRequestCount,
      domains
    };
  }

  /**
   * Combine background webRequest observations with content-script ResourceTiming observations
   * without double-counting requests observed by both channels.
   */
  function combineNetworkSources(backgroundData, contentRequests) {
    const bgUnavailable = !backgroundData || backgroundData.available === false;
    const csUnavailable = !contentRequests || contentRequests.available === false;
    if (bgUnavailable && csUnavailable) {
      return { available: false };
    }

    const mergedCounts = {};
    const applySource = (src) => {
      if (!src || src.available === false) return;
      if (src.domainCounts && typeof src.domainCounts === "object") {
        for (const [host, cnt] of Object.entries(src.domainCounts)) {
          const key = String(host || "").toLowerCase().trim();
          if (!key) continue;
          const n = Number.isFinite(cnt) && cnt > 0 ? Math.floor(cnt) : 1;
          mergedCounts[key] = Math.max(mergedCounts[key] || 0, n);
        }
      }
      if (Array.isArray(src.thirdPartyDomains)) {
        for (const host of src.thirdPartyDomains) {
          const key = String(host || "").toLowerCase().trim();
          if (!key) continue;
          mergedCounts[key] = Math.max(mergedCounts[key] || 0, 1);
        }
      }
    };

    applySource(backgroundData);
    applySource(contentRequests);

    const sumMerged = Object.values(mergedCounts).reduce((acc, n) => acc + n, 0);
    const maxReported = Math.max(
      (backgroundData && Number.isFinite(backgroundData.thirdPartyRequestCount)
        ? backgroundData.thirdPartyRequestCount
        : 0),
      (contentRequests && Number.isFinite(contentRequests.thirdPartyRequestCount)
        ? contentRequests.thirdPartyRequestCount
        : 0),
      sumMerged
    );

    return {
      available: true,
      thirdPartyRequestCount: maxReported,
      domainCounts: mergedCounts,
      unattributedRequestCount:
        (backgroundData && Number.isFinite(backgroundData.unattributedRequestCount)
          ? backgroundData.unattributedRequestCount
          : 0)
    };
  }

  function scoreCategory(score) {
    if (score === null || score === undefined || !Number.isFinite(score)) {
      return "Unavailable";
    }
    if (score <= 25) return "Low Surface";
    if (score <= 50) return "Moderate Surface";
    if (score <= 75) return "High Surface";
    return "Very High Surface";
  }

  /**
   * Validate and normalize cited first-party provider declarations (#15).
   * Rejects any declaration lacking a sourceReference or valid retrievedAt timestamp.
   */
  function normalizeDeclarations(rawDeclarations) {
    if (!Array.isArray(rawDeclarations)) return [];
    const normalized = [];
    const standards = getStandardsMapping();
    for (let i = 0; i < rawDeclarations.length; i += 1) {
      let item = rawDeclarations[i];
      if (!item || typeof item !== "object") continue;
      if (item.tosdr === true && standards && typeof standards.normalizeTosdrDeclaration === "function") {
        item = standards.normalizeTosdrDeclaration(item);
        if (!item) continue;
      }
      const summary = sanitizePlainText(item.summary, "", 300);
      const sourceReference = sanitizeOriginOrUrlRef(item.sourceReference);
      const retrievedAt = typeof item.retrievedAt === "string" && !Number.isNaN(Date.parse(item.retrievedAt))
        ? new Date(item.retrievedAt).toISOString()
        : null;
      if (!summary || !sourceReference || !retrievedAt) {
        continue;
      }
      const independentlyVerified =
        item.independentlyVerified === true && Boolean(item.verificationEvidence);
      const scopeLimitation = sanitizePlainText(
        item.scopeLimitation,
        "Provider statement recorded from cited notice; server-side adherence is not verified by this browser extension.",
        260
      );
      normalized.push({
        id: sanitizePlainText(item.id, `provider.declaration.${i + 1}`, 80),
        evidenceState: "declared",
        summary,
        source: "provider-notice",
        sourceReference,
        retrievedAt,
        independentlyVerified,
        scopeLimitation,
        confidence: "not-applicable",
        bounded: {
          observed: `First-party notice reference recorded (${sourceReference}).`,
          declaredOrPossible: summary,
          notVerified: independentlyVerified
            ? "Verified against cited independent evidence."
            : "The collector has not independently verified whether server-side processing matches this declaration.",
          unknown: scopeLimitation
        }
      });
    }
    return normalized;
  }

  function sanitizeOriginOrUrlRef(rawRef) {
    if (typeof rawRef !== "string" || !rawRef.trim()) return null;
    try {
      const parsed = new URL(rawRef.trim());
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
      // Keep origin + pathname for public policy citations, stripping query/hash secrets
      return `${parsed.origin}${parsed.pathname}`;
    } catch {
      return null;
    }
  }

  /**
   * Build the normalized Transparency Surface Receipt v1 model.
   * Single source of truth for UI rendering, JSON export, Markdown export, and CLI diffing.
   */
  function buildSurfaceReceiptModel(input = {}) {
    const capturedAt =
      typeof input.capturedAt === "string" && !Number.isNaN(Date.parse(input.capturedAt))
        ? new Date(input.capturedAt).toISOString()
        : new Date().toISOString();
    const receiptId =
      typeof input.receiptId === "string" && input.receiptId.trim()
        ? sanitizePlainText(input.receiptId, generateReceiptId(), 80)
        : generateReceiptId();

    const mode = input.mode === "preview" || input.mode === "cli" ? input.mode : "extension";
    const page = sanitizePageContext(input.url, input.title);

    const explicitScanStatus = SCAN_STATUSES.includes(input.scanStatus) ? input.scanStatus : null;
    const isUnsupportedProtocol =
      explicitScanStatus === "unsupported" ||
      (mode !== "preview" && page.protocol !== "HTTP" && page.protocol !== "HTTPS");

    const cookiesAvailable =
      !isUnsupportedProtocol &&
      Boolean(input.cookies) &&
      input.cookies.available !== false &&
      Number.isFinite(input.cookies.total);

    const contentAvailable =
      !isUnsupportedProtocol &&
      Boolean(input.content) &&
      input.content.available !== false;

    const networkNorm = isUnsupportedProtocol
      ? normalizeNetworkData({ available: false })
      : normalizeNetworkData(input.network);

    const rawPermissions = (input.permissions && typeof input.permissions === "object")
      ? input.permissions
      : null;
    const permissionsAvailable = !isUnsupportedProtocol && Boolean(rawPermissions) && rawPermissions.available !== false;

    const limitations = Array.isArray(input.limitations)
      ? input.limitations.map((l) => sanitizePlainText(l, "", 240)).filter(Boolean)
      : [];

    const observed = [];
    const declared = normalizeDeclarations(input.declarations);
    const potential = [];
    const unknown = [];
    const unavailable = [];

    // Check channel availability and populate `unavailable` (never collapsing to 0 / false / clean!)
    if (isUnsupportedProtocol) {
      unavailable.push({
        id: "collector.tab-context",
        evidenceState: "unavailable",
        summary: "Browser restricts extension inspection on non-HTTP(S) or privileged pages",
        source: "extension-runtime",
        reason: "unsupported-page-protocol"
      });
      limitations.push("Target tab is not an inspectable HTTP/HTTPS document.");
    } else {
      if (!cookiesAvailable) {
        unavailable.push({
          id: "collector.cookies",
          evidenceState: "unavailable",
          summary: "Cookie inspection did not return a result for this tab",
          source: "cookies-api",
          reason: (input.cookies && input.cookies.reason) || "cookies-unavailable"
        });
        limitations.push("Cookie counts could not be read from chrome.cookies.");
      }
      if (!contentAvailable) {
        unavailable.push({
          id: "collector.content-surfaces",
          evidenceState: "unavailable",
          summary: "DOM form metadata, Web Storage, CSP, browser context, and MAIN-world API checks were unavailable",
          source: "content-script",
          reason: (input.content && input.content.reason) || "content-script-unreachable"
        });
        limitations.push(
          "Content script did not respond (page may have loaded before extension activation or blocked script injection)."
        );
      }
      if (!networkNorm.available) {
        unavailable.push({
          id: "collector.network",
          evidenceState: "unavailable",
          summary: "Third-party network request log was unavailable for this tab",
          source: "webRequest-api",
          reason: (input.network && input.network.reason) || "network-log-unavailable"
        });
        limitations.push("Background network request counter was unavailable.");
      }
      if (!permissionsAvailable) {
        unavailable.push({
          id: "collector.permissions",
          evidenceState: "unavailable",
          summary: "Browser Permissions API states could not be queried",
          source: "permissions-api",
          reason: "permissions-api-unavailable"
        });
        limitations.push("Permission state queries were unavailable.");
      }
    }

    if (mode === "preview") {
      limitations.push(
        "Standalone preview mode: displays local preview/mock context rather than live cross-origin extension telemetry."
      );
    }

    // Always note the honest MAIN-world observation boundary when content script ran
    if (contentAvailable) {
      limitations.push(
        "MAIN-world API observations reflect calls seen since document_start unless the host page interfered via realm/prototype techniques."
      );
    }

    // Determine explicit scanStatus
    let scanStatus = explicitScanStatus;
    if (!scanStatus) {
      if (mode === "preview") {
        scanStatus = "preview";
      } else if (isUnsupportedProtocol) {
        scanStatus = "unsupported";
      } else if (!cookiesAvailable && !contentAvailable && !networkNorm.available) {
        scanStatus = "error";
      } else if (!cookiesAvailable || !contentAvailable || !networkNorm.available || !permissionsAvailable) {
        scanStatus = "limited";
      } else {
        scanStatus = "complete";
      }
    }

    // --- 1. Cookies ---
    const cookiesModel = cookiesAvailable
      ? {
          available: true,
          total: Math.max(0, Math.floor(input.cookies.total)),
          firstParty: Math.max(0, Math.floor(input.cookies.firstParty || 0)),
          thirdParty: Math.max(0, Math.floor(input.cookies.thirdParty || 0)),
          valuesInspected: false
        }
      : {
          available: false,
          total: null,
          firstParty: null,
          thirdParty: null,
          valuesInspected: false
        };

    if (cookiesModel.available && cookiesModel.total > 0) {
      observed.push({
        id: "cookies.present",
        evidenceState: "observed",
        summary: `Observed ${cookiesModel.total} cookie(s) (${cookiesModel.firstParty} first-party, ${cookiesModel.thirdParty} third-party domain scope)`,
        source: "cookies-api",
        confidence: "high",
        bounded: {
          observed: `${cookiesModel.total} browser cookie entry/entries present for this URL scope (names/counts only; cookie values are never exported).`,
          declaredOrPossible: "Cookies can maintain session state, preferences, or cross-request identifiers.",
          notVerified: "Cookie contents, purpose, and whether identifiers are linked across sites were not verified.",
          unknown: "Server-side session binding, retention duration, onward sharing, and sale cannot be determined from cookie presence."
        }
      });
    }

    // --- 2. Network ---
    const networkModel = {
      available: networkNorm.available,
      thirdPartyRequestCount: networkNorm.thirdPartyRequestCount,
      uniqueThirdPartyDomainCount: networkNorm.uniqueThirdPartyDomainCount,
      knownTrackerDomainCount: networkNorm.knownTrackerDomainCount,
      unattributedRequestCount: networkNorm.unattributedRequestCount,
      domains: networkNorm.domains.map((d) => ({
        domain: d.domain,
        classification: d.classification,
        classificationSource: d.classificationSource,
        isTracker: d.isTracker,
        requestCount: d.requestCount
      }))
    };

    if (networkModel.available && networkModel.thirdPartyRequestCount > 0) {
      const trackerNote = networkModel.knownTrackerDomainCount > 0
        ? ` (${networkModel.knownTrackerDomainCount} matching local tracker/telemetry domain rules)`
        : "";
      observed.push({
        id: "network.third-party-traffic",
        evidenceState: "observed",
        summary: `Observed ${networkModel.thirdPartyRequestCount} third-party request(s) across ${networkModel.uniqueThirdPartyDomainCount} unique domain(s)${trackerNote}`,
        source: "webRequest-and-resource-timing",
        confidence: "high",
        bounded: {
          observed: `${networkModel.thirdPartyRequestCount} request(s) to ${networkModel.uniqueThirdPartyDomainCount} external domain(s) occurred during this scan.`,
          declaredOrPossible:
            networkModel.knownTrackerDomainCount > 0
              ? `${networkModel.knownTrackerDomainCount} contacted domain(s) match local analytics/advertising/telemetry rules; contacted hosts receive standard HTTP request metadata.`
              : "Contacted external hosts receive standard HTTP connection metadata (such as IP address and user agent).",
          notVerified: "Request payloads, whether any form/user data was transmitted, and recipient use were not verified.",
          unknown: "Retention, onward sharing, contractual relationships, and data sale cannot be determined from network requests or tracker labels alone."
        }
      });
    }

    // --- 3. Content surfaces (Storage, CSP, Fingerprinting, Visibility Layer, Context) ---
    const contentObj = contentAvailable ? input.content : {};
    const rawStorage = contentAvailable && contentObj.storage ? contentObj.storage : null;

    const parseStorageSide = (val, sideId, sideLabel) => {
      if (!contentAvailable || !rawStorage || val === "Unavailable" || val === "Unknown" || val == null) {
        if (contentAvailable) {
          unavailable.push({
            id: `storage.${sideId}`,
            evidenceState: "unavailable",
            summary: `${sideLabel} key count could not be read (access blocked by browser/page security policy)`,
            source: "web-storage-api",
            reason: "storage-access-restricted"
          });
        }
        return { available: false, keyCount: null, label: "Unavailable" };
      }
      if (typeof val === "number" && Number.isFinite(val)) {
        const count = Math.max(0, Math.floor(val));
        return {
          available: true,
          keyCount: count,
          label: count > 0 ? `${count} key(s)` : "0 keys (not observed)"
        };
      }
      const str = String(val);
      if (/^not detected$/i.test(str) || /^0\b/.test(str)) {
        return { available: true, keyCount: 0, label: "0 keys (not observed)" };
      }
      const match = str.match(/(\d+)/);
      if (match) {
        const count = Number.parseInt(match[1], 10);
        return { available: true, keyCount: count, label: `${count} key(s)` };
      }
      return { available: false, keyCount: null, label: "Unavailable" };
    };

    const localStore = parseStorageSide(rawStorage && rawStorage.localStorage, "local", "localStorage");
    const sessionStore = parseStorageSide(rawStorage && rawStorage.sessionStorage, "session", "sessionStorage");

    const storageModel = {
      available: localStore.available || sessionStore.available,
      valuesInspected: false,
      localStorage: localStore,
      sessionStorage: sessionStore
    };

    if (localStore.available && localStore.keyCount > 0) {
      observed.push({
        id: "storage.local.keys",
        evidenceState: "observed",
        summary: `Observed ${localStore.keyCount} key(s) in client-side localStorage`,
        source: "web-storage-api",
        confidence: "high",
        bounded: {
          observed: `window.localStorage contains ${localStore.keyCount} key(s) on this origin (key values are never read or exported).`,
          declaredOrPossible: "Client-side localStorage persists across browser restarts until cleared.",
          notVerified: "Stored values and whether any entry holds a tracking or session identifier were not verified.",
          unknown: "Whether stored values are later synchronized to remote servers is unknown."
        }
      });
    }
    if (sessionStore.available && sessionStore.keyCount > 0) {
      observed.push({
        id: "storage.session.keys",
        evidenceState: "observed",
        summary: `Observed ${sessionStore.keyCount} key(s) in client-side sessionStorage`,
        source: "web-storage-api",
        confidence: "high",
        bounded: {
          observed: `window.sessionStorage contains ${sessionStore.keyCount} key(s) for this tab session (values never read).`,
          declaredOrPossible: "Client-side sessionStorage persists for the lifetime of the current tab.",
          notVerified: "Stored values and their purpose were not verified.",
          unknown: "Whether session values are mirrored to remote servers is unknown."
        }
      });
    }

    // CSP
    const rawCsp = contentAvailable && contentObj.csp ? contentObj.csp : null;
    const cspModel = rawCsp
      ? {
          available: true,
          hasMetaCsp: Boolean(rawCsp.hasMetaCsp),
          metaBlocksEval: Boolean(rawCsp.metaBlocksEval),
          evalBlockedCount: Math.max(0, Math.floor(rawCsp.evalBlockedCount || 0)),
          totalViolationCount: Math.max(0, Math.floor(rawCsp.totalViolationCount || 0)),
          violatedDirectives: Array.isArray(rawCsp.violatedDirectives)
            ? rawCsp.violatedDirectives.map((d) => sanitizePlainText(d, "", 80)).filter(Boolean)
            : []
        }
      : {
          available: false,
          hasMetaCsp: null,
          metaBlocksEval: null,
          evalBlockedCount: null,
          totalViolationCount: null,
          violatedDirectives: []
        };

    if (cspModel.available && cspModel.metaBlocksEval) {
      observed.push({
        id: "csp.meta.blocks-eval",
        evidenceState: "observed",
        summary: "Observed <meta> Content-Security-Policy without 'unsafe-eval'",
        source: "dom-csp-meta",
        confidence: "high",
        bounded: {
          observed: "A document <meta http-equiv=\"Content-Security-Policy\"> tag without 'unsafe-eval' was observed.",
          declaredOrPossible: "Restricts dynamic string evaluation (eval / new Function) in page scripts.",
          notVerified: "HTTP response CSP headers were not directly inspected by the DOM check.",
          unknown: "Server-side script integrity and backend security controls remain unknown."
        }
      });
    }
    if (cspModel.available && cspModel.evalBlockedCount > 0) {
      observed.push({
        id: "csp.violation.eval-blocked",
        evidenceState: "observed",
        summary: `Observed ${cspModel.evalBlockedCount} blocked eval()/script-src CSP violation event(s)`,
        source: "securitypolicyviolation-listener",
        confidence: "high",
        bounded: {
          observed: `${cspModel.evalBlockedCount} securitypolicyviolation event(s) for dynamic code evaluation were recorded.`,
          declaredOrPossible: "Page CSP prevented dynamic string execution (could originate from site scripts or other extensions).",
          notVerified: "Which script or extension triggered the blocked eval() attempt was not verified.",
          unknown: "Downstream server behavior is unknown."
        }
      });
    }

    // Fingerprinting
    const rawFp = contentAvailable && contentObj.fingerprinting ? contentObj.fingerprinting : null;
    const fingerprintingList = Object.entries(FINGERPRINT_SURFACES).map(([key, label]) => {
      if (!rawFp) {
        return {
          id: `fingerprinting.${key}`,
          key,
          label,
          evidenceState: "unavailable",
          observed: null,
          source: key === "evalAttempt" ? "securitypolicyviolation-listener" : "main-world-observer"
        };
      }
      const isObserved = key === "evalAttempt"
        ? Boolean(rawFp.evalAttempt || (cspModel.available && cspModel.evalBlockedCount > 0))
        : Boolean(rawFp[key]);

      if (isObserved && key !== "evalAttempt") {
        observed.push({
          id: `fingerprinting.${key}.call`,
          evidenceState: "observed",
          summary: `${label} call observed during this scan`,
          source: "main-world-observer",
          confidence: "medium",
          bounded: {
            observed: `At least one call to ${label} was observed in the page MAIN world (unless forged/interfered by host scripts).`,
            declaredOrPossible: "This API can be used for legitimate rendering/media/diagnostics or to derive browser/device fingerprint signals.",
            notVerified: "Whether the returned output was hashed, combined into a fingerprint, or transmitted off-device was not verified.",
            unknown: "Server-side device recognition, retention, sharing, and commercial use cannot be determined."
          }
        });
      }

      return {
        id: `fingerprinting.${key}`,
        key,
        label,
        evidenceState: isObserved ? "observed" : "not-observed",
        observed: isObserved,
        source: key === "evalAttempt" ? "securitypolicyviolation-listener" : "main-world-observer"
      };
    });

    // Visibility Layer & Proof Bridge
    const rawVis = contentAvailable && contentObj.visibilityLayer ? contentObj.visibilityLayer : null;
    const visFindings = [];
    if (rawVis && Array.isArray(rawVis.findings)) {
      for (let i = 0; i < rawVis.findings.length; i += 1) {
        const f = rawVis.findings[i];
        if (!f || typeof f !== "object") continue;
        const key = sanitizePlainText(f.key || f.id || `field_${i + 1}`, `field_${i + 1}`, 50);
        const label = sanitizePlainText(f.label, "Form input", 120);
        const layer = sanitizePlainText(f.layer, "WELT (Low)", 40);
        const hint = sanitizePlainText(f.hint, "", 280);
        const suggestedClaims = Array.isArray(f.suggestedMinimalClaims)
          ? f.suggestedMinimalClaims.filter((c) => typeof c === "string")
          : [];

        const standards = getStandardsMapping();
        const dpvMeta = standards ? standards.mapFieldKeyToDpv(key) : null;
        const entry = {
          id: `form.${key}`,
          key,
          label,
          evidenceState: "observed",
          summary: `${label} input field metadata observed`,
          layer,
          dpvDataCategory: dpvMeta ? dpvMeta.dpvDataCategory : "dpv:PersonalData",
          hint,
          purposeKnown: false,
          valueInspected: false,
          possibleMinimisation: suggestedClaims.length > 0
            ? {
                claimContractVersion: "1.0.0",
                observedOverCollection: Array.isArray(f.observedOverCollection)
                  ? Array.from(f.observedOverCollection)
                  : ["birthdate"],
                suggestedClaims,
                rationale: sanitizePlainText(
                  f.rationale,
                  "Full date of birth requested; age >= 18 predicate is data-minimizing.",
                  200
                ),
                advisoryOnly: true
              }
            : null
        };
        visFindings.push(entry);

        observed.push({
          id: `form.${key}.surface`,
          evidenceState: "observed",
          summary: `Observed form input metadata matching ${label} (${layer})`,
          source: "dom-field-metadata",
          confidence: "high",
          bounded: {
            observed: `DOM input attribute metadata (${label}) is present on this page. Typed field values were never read.`,
            declaredOrPossible: hint || "Form fields allow the user to enter data that the page could read or submit.",
            notVerified: "Whether any value was entered, whether submission occurred, and whether the site's purpose requires raw attributes were not verified.",
            unknown: "Server-side validation, storage, retention, onward sharing, and sale are unknown."
          }
        });
      }
    }

    const proofSuggestion =
      rawVis &&
      rawVis.proofSuggestion &&
      Array.isArray(rawVis.proofSuggestion.suggestedMinimalClaims) &&
      rawVis.proofSuggestion.suggestedMinimalClaims.length > 0
        ? {
            version: sanitizePlainText(rawVis.proofSuggestion.version, "0.3.0", 20),
            contractVersion: sanitizePlainText(rawVis.proofSuggestion.contractVersion, "1.0.0", 20),
            observedOverCollection: Array.from(rawVis.proofSuggestion.observedOverCollection || ["birthdate"]),
            suggestedMinimalClaims: Array.from(rawVis.proofSuggestion.suggestedMinimalClaims),
            rationale: sanitizePlainText(
              rawVis.proofSuggestion.rationale,
              "Full date of birth requested; age >= 18 predicate is data-minimizing.",
              240
            ),
            note: sanitizePlainText(
              rawVis.proofSuggestion.note,
              "This is a local suggestion only. No presentation was started. Open your AskMI wallet to create a real proof.",
              240
            ),
            advisoryOnly: true
          }
        : null;

    const rawPrivacySignals =
      contentAvailable && contentObj.privacySignals && typeof contentObj.privacySignals === "object"
        ? contentObj.privacySignals
        : null;

    if (rawPrivacySignals && rawPrivacySignals.gpcEnabled === true) {
      observed.push({
        id: "privacy.gpc.enabled",
        evidenceState: "observed",
        summary: "Browser Global Privacy Control signal (navigator.globalPrivacyControl = true) is active",
        source: "navigator-gpc",
        confidence: "high",
        bounded: {
          observed: "navigator.globalPrivacyControl is true in this browser context (Sec-GPC: 1 preference signal).",
          declaredOrPossible: "W3C Global Privacy Control Working Draft signal expresses a user preference against cross-site data sale or sharing.",
          notVerified: "GPC is not legally binding by itself; applicable legal obligations depend on jurisdiction (e.g., CCPA), and remote server adherence was not verified.",
          unknown: "Whether the contacted server honours or ignores Sec-GPC: 1 is unknown."
        }
      });
    }

    if (rawPrivacySignals && rawPrivacySignals.digitalCredentialsCallObserved === true) {
      observed.push({
        id: "credentials.digital-credentials-api.call",
        evidenceState: "observed",
        summary: "Page invoked W3C Digital Credentials API (navigator.credentials.get({ digital }))",
        source: "main-world-observer",
        confidence: "high",
        bounded: {
          observed: "A call to navigator.credentials.get({ digital }) was observed in the page MAIN world.",
          declaredOrPossible: "The site requested a verifiable credential presentation via the W3C FedID Digital Credentials API.",
          notVerified: "Which credential claims were disclosed or whether the user approved the wallet prompt was not verified.",
          unknown: "Relying-party backend verification and retention of presented proofs remain unknown."
        }
      });
    }

    const standardsHelper = getStandardsMapping();
    const standardsSummary = standardsHelper
      ? standardsHelper.buildStandardsSummary({
          findings: visFindings,
          domains: networkModel.domains,
          privacySignals: rawPrivacySignals
        })
      : null;

    const visibilityModel = rawVis
      ? {
          available: true,
          highestLayer: sanitizePlainText(rawVis.highestLayer, "None Detected", 40),
          fieldMetadataOnly: true,
          counts: {
            vulnerable: Math.max(0, Math.floor((rawVis.counts && rawVis.counts.vulnerable) || 0)),
            grundversorgung: Math.max(0, Math.floor((rawVis.counts && rawVis.counts.grundversorgung) || 0)),
            welt: Math.max(0, Math.floor((rawVis.counts && rawVis.counts.welt) || 0))
          },
          findings: visFindings,
          proofSuggestion,
          ...(standardsSummary ? { standards: standardsSummary } : {})
        }
      : {
          available: false,
          highestLayer: "Unavailable",
          fieldMetadataOnly: true,
          counts: null,
          findings: [],
          proofSuggestion: null,
          ...(standardsSummary ? { standards: standardsSummary } : {})
        };

    // --- 4. Permissions ---
    const permissionsList = PERMISSION_SURFACES.map((item) => {
      if (!permissionsAvailable) {
        return {
          key: item.key,
          label: item.label,
          state: "Unavailable",
          evidenceState: "unavailable"
        };
      }
      const rawState = String(rawPermissions[item.key] || "Unavailable").trim();
      const norm = normalizePermissionLabel(rawState);
      if (norm === "Unavailable") {
        unavailable.push({
          id: `permission.${item.key}`,
          evidenceState: "unavailable",
          summary: `${item.label} permission state could not be queried in this browser context`,
          source: "permissions-api",
          reason: "permission-query-unsupported"
        });
        return {
          key: item.key,
          label: item.label,
          state: "Unavailable",
          evidenceState: "unavailable"
        };
      }
      if (norm === "Granted") {
        observed.push({
          id: `permission.${item.key}.granted`,
          evidenceState: "observed",
          summary: `${item.label} permission state is Granted`,
          source: "permissions-api",
          confidence: "high",
          bounded: {
            observed: `Browser Permissions API reports "${item.label}" as Granted.`,
            declaredOrPossible: `Scripts in an allowed origin context can invoke ${item.label} APIs without an additional prompt.`,
            notVerified: `Whether this page actively read ${item.label} data during this session was not verified.`,
            unknown: "Whether any resulting capability data was stored or shared server-side is unknown."
          }
        });
      }
      return {
        key: item.key,
        label: item.label,
        state: norm,
        evidenceState: norm === "Granted" ? "observed" : "potential"
      };
    });

    // --- 5. Potential Access ---
    if (!isUnsupportedProtocol && scanStatus !== "error") {
      potential.push({
        id: "network.ip-address",
        evidenceState: "potential",
        summary: "Client IP address is normally visible to contacted first- and third-party servers",
        source: "protocol-architecture",
        confidence: "high",
        bounded: {
          observed: "Page uses standard HTTP/HTTPS networking.",
          declaredOrPossible: "Every contacted server normally receives the client's network IP address (or VPN/proxy egress IP).",
          notVerified: "Exact IP logging or geolocation lookup on remote servers was not verified.",
          unknown: "Server-side IP retention and correlation remain unknown."
        }
      });

      if (contentAvailable) {
        const ua = sanitizePlainText(contentObj.userAgent, "", 160);
        const screenVal = sanitizePlainText(contentObj.screen, "", 60);
        const langVal = sanitizePlainText(contentObj.language, "", 40);
        const tzVal = sanitizePlainText(contentObj.timezone, "", 80);

        if (ua && ua !== "Unknown") {
          potential.push({
            id: "browser.user-agent",
            evidenceState: "potential",
            summary: `Browser user agent available to scripts/headers: ${shortenText(ua, 76)}`,
            source: "browser-context",
            confidence: "high"
          });
        } else {
          unavailable.push({
            id: "browser.user-agent",
            evidenceState: "unavailable",
            summary: "Navigator userAgent string was unavailable",
            source: "browser-context",
            reason: "context-missing"
          });
        }

        if (screenVal && screenVal !== "Unknown") {
          potential.push({
            id: "browser.screen-resolution",
            evidenceState: "potential",
            summary: `Screen dimensions readable by scripts: ${screenVal}`,
            source: "browser-context",
            confidence: "high"
          });
        } else {
          unavailable.push({
            id: "browser.screen-resolution",
            evidenceState: "unavailable",
            summary: "Screen resolution context was unavailable",
            source: "browser-context",
            reason: "context-missing"
          });
        }

        if (langVal && langVal !== "Unknown") {
          potential.push({
            id: "browser.language",
            evidenceState: "potential",
            summary: `Preferred browser language readable by scripts/headers: ${langVal}`,
            source: "browser-context",
            confidence: "high"
          });
        } else {
          unavailable.push({
            id: "browser.language",
            evidenceState: "unavailable",
            summary: "Browser language setting was unavailable",
            source: "browser-context",
            reason: "context-missing"
          });
        }

        if (tzVal && tzVal !== "Unknown") {
          potential.push({
            id: "browser.timezone",
            evidenceState: "potential",
            summary: `System timezone readable via Intl API: ${tzVal}`,
            source: "browser-context",
            confidence: "high"
          });
        } else {
          unavailable.push({
            id: "browser.timezone",
            evidenceState: "unavailable",
            summary: "Browser timezone setting was unavailable",
            source: "browser-context",
            reason: "context-missing"
          });
        }
      }
    }

    // Promote scanStatus to "limited" if any individual surface check reported unavailable
    if (!explicitScanStatus && scanStatus === "complete" && unavailable.length > 0) {
      scanStatus = "limited";
      limitations.push("One or more individual browser surface checks returned unavailable results.");
    }
    if (scanStatus === "limited" && limitations.length === 0) {
      limitations.push("Scan completed with partial browser surface coverage.");
    }

    // --- 6. Unknowns (Remote / Downstream Boundaries — always explicit) ---
    unknown.push(
      {
        id: "server.storage",
        evidenceState: "unknown",
        summary: "What data is stored on first-party or third-party servers cannot be determined by this browser extension",
        source: "boundary-statement",
        confidence: "not-applicable"
      },
      {
        id: "server.retention",
        evidenceState: "unknown",
        summary: "Server-side retention periods and deletion practices cannot be determined from browser observation",
        source: "boundary-statement",
        confidence: "not-applicable"
      },
      {
        id: "server.profiling",
        evidenceState: "unknown",
        summary: "Internal profiling, identity linking, or automated decision-making on remote servers cannot be determined",
        source: "boundary-statement",
        confidence: "not-applicable"
      },
      {
        id: "server.onward-sharing",
        evidenceState: "unknown",
        summary: "Server-to-server onward data sharing cannot be determined from browser observation alone",
        source: "boundary-statement",
        confidence: "not-applicable"
      },
      {
        id: "server.data-sale",
        evidenceState: "unknown",
        summary: "Commercial resale or monetization of data cannot be inferred from cookies, tracker domains, request counts, or Surface Score",
        source: "boundary-statement",
        confidence: "not-applicable"
      }
    );

    // --- 7. Surface Score & Three Dimensions (Coverage, Exposure, Evidence Quality) ---
    const surfaceScore = computeSurfaceScore({
      scanStatus,
      cookiesModel,
      networkModel,
      storageModel,
      fingerprintingList,
      permissionsList,
      visibilityModel,
      contentAvailable,
      permissionsAvailable,
      observedCount: observed.length,
      declaredCount: declared.length,
      potentialCount: potential.length,
      unavailableCount: unavailable.length
    });

    const defaultRevision =
      typeof globalThis !== "undefined" &&
      globalThis.MITCH_BUILD_META &&
      typeof globalThis.MITCH_BUILD_META.sourceRevision === "string"
        ? globalThis.MITCH_BUILD_META.sourceRevision
        : "working-tree";

    const baseReceipt = {
      schema: RECEIPT_SCHEMA_V1,
      receiptId,
      capturedAt,
      collector: {
        name: COLLECTOR_NAME,
        version: sanitizePlainText(input.collectorVersion, COLLECTOR_VERSION, 32),
        revision: sanitizePlainText(input.collectorRevision, defaultRevision, 64),
        ruleSetVersion: RULE_SET_VERSION,
        scoringRuleVersion: SCORING_RULE_VERSION,
        mode,
        collectionMode: input.collectionMode === "on-demand" ? "on-demand" : "continuous",
        scanStatus,
        observationWindowMs: Number.isFinite(input.observationWindowMs)
          ? Math.max(0, Math.floor(input.observationWindowMs))
          : 0,
        limitations: Array.from(new Set(limitations))
      },
      page,
      surfaceScore,
      cookies: cookiesModel,
      storage: storageModel,
      network: networkModel,
      report: {
        notObservedNote: "Not observed during this scan does not mean absent on the site or its servers.",
        observed,
        declared,
        potential,
        unknown,
        unavailable
      },
      visibility: visibilityModel,
      permissions: permissionsList,
      fingerprinting: fingerprintingList,
      csp: cspModel
    };

    const contentHash = sha256Hex(canonicalizeJson(baseReceipt));
    return {
      ...baseReceipt,
      integrity: {
        normalizationVersion: NORMALIZATION_VERSION,
        contentHashAlgorithm: "sha-256",
        contentHash,
        signature: null
      }
    };
  }

  /**
   * Compute Surface Score with strict unavailable-vs-zero and non-improvement semantics (#14):
   *   - Unsupported or error scans return value: null ("Unavailable"), NEVER 0.
   *   - Limited or preview scans return value: null and expose [observedMinimum, unverifiedMaximum]
   *     so missing evidence never collapses into a lower/reassuring single score.
   *   - Score never emits claims about data collection, storage, sharing, sale, safety, or compliance.
   */
  function computeSurfaceScore(ctx) {
    const unavailablePermCount = ctx.permissionsAvailable
      ? ctx.permissionsList.filter((p) => p.state === "Unavailable").length
      : PERMISSION_SURFACES.length;

    const storageFullyAvailable = Boolean(
      ctx.contentAvailable &&
      ctx.storageModel &&
      ctx.storageModel.localStorage &&
      ctx.storageModel.localStorage.available &&
      ctx.storageModel.sessionStorage &&
      ctx.storageModel.sessionStorage.available
    );

    const sourceChecks = [
      { key: "cookies", ok: ctx.cookiesModel.available },
      { key: "network", ok: ctx.networkModel.available },
      { key: "storage", ok: storageFullyAvailable },
      { key: "fingerprinting", ok: ctx.contentAvailable },
      { key: "visibility", ok: ctx.contentAvailable },
      { key: "permissions", ok: ctx.permissionsAvailable && unavailablePermCount === 0 }
    ];
    const checkedSources = sourceChecks.filter((s) => s.ok).length;
    const totalSources = sourceChecks.length;
    const unavailableSources = sourceChecks.filter((s) => !s.ok).map((s) => s.key);
    const hasAnyEvidenceChannel =
      ctx.cookiesModel.available ||
      ctx.networkModel.available ||
      ctx.contentAvailable ||
      (ctx.permissionsAvailable && unavailablePermCount < PERMISSION_SURFACES.length);

    const coveragePercent =
      ctx.scanStatus === "unsupported" || ctx.scanStatus === "error" || !hasAnyEvidenceChannel
        ? 0
        : Math.round((checkedSources / totalSources) * 100);

    if (ctx.scanStatus === "unsupported" || ctx.scanStatus === "error" || !hasAnyEvidenceChannel) {
      return {
        value: null,
        observedMinimum: null,
        unverifiedMaximum: null,
        category: "Unavailable",
        semantics: "informational-surface-summary",
        scoringRuleVersion: SCORING_RULE_VERSION,
        ruleSetVersion: RULE_SET_VERSION,
        nonVerdictNotice:
          "Surface Score summarizes observed browser-visible surfaces only. Low score does not mean safe; unavailable inputs are never counted as zero.",
        dimensions: {
          observationCoverage: {
            checkedSources: 0,
            totalSources,
            percent: 0,
            status: ctx.scanStatus,
            unavailableSources: sourceChecks.map((s) => s.key)
          },
          technicalExposure: {
            value: null,
            observedMinimum: null,
            unverifiedMaximum: null,
            maxValue: 100,
            category: "Unavailable"
          },
          evidenceQuality: {
            directObservedCount: ctx.observedCount,
            declaredCount: ctx.declaredCount,
            potentialCount: ctx.potentialCount,
            unavailableCount: ctx.unavailableCount,
            summary: "no-reliable-observation"
          }
        },
        components: {
          cookies: null,
          thirdPartyRequests: null,
          knownTrackerDomains: null,
          fingerprintingCalls: null,
          grantedPermissions: null,
          promptPermissions: null
        }
      };
    }

    const cookiesPts = ctx.cookiesModel.available
      ? Math.min(30, ctx.cookiesModel.total * 2)
      : null;
    const cookiesMin = cookiesPts === null ? 0 : cookiesPts;
    const cookiesMissingMax = cookiesPts === null ? 30 : 0;

    const thirdPartyReqPts = ctx.networkModel.available
      ? Math.min(17, ctx.networkModel.thirdPartyRequestCount * 3)
      : null;
    const thirdPartyReqMin = thirdPartyReqPts === null ? 0 : thirdPartyReqPts;
    const thirdPartyReqMissingMax = thirdPartyReqPts === null ? 17 : 0;

    const trackerPts = ctx.networkModel.available
      ? Math.min(8, ctx.networkModel.knownTrackerDomainCount * 4)
      : null;
    const trackerMin = trackerPts === null ? 0 : trackerPts;
    const trackerMissingMax = trackerPts === null ? 8 : 0;

    const fpCount = ctx.contentAvailable
      ? ctx.fingerprintingList.filter((f) => f.observed === true).length
      : null;
    const fpPts = fpCount !== null ? Math.min(30, fpCount * 10) : null;
    const fpMin = fpPts === null ? 0 : fpPts;
    const fpMissingMax = fpPts === null ? 30 : 0;

    const knownGranted = ctx.permissionsAvailable
      ? ctx.permissionsList.filter((p) => p.state === "Granted").length
      : 0;
    const knownPrompt = ctx.permissionsAvailable
      ? ctx.permissionsList.filter((p) => p.state === "Prompt").length
      : 0;

    const permsComplete = ctx.permissionsAvailable && unavailablePermCount === 0;
    const grantedPts = permsComplete ? Math.min(24, knownGranted * 8) : null;
    const promptPts = permsComplete ? Math.min(10, knownPrompt * 2) : null;

    const permMin = Math.min(24, knownGranted * 8) + Math.min(10, knownPrompt * 2);
    let permMaxTotal = permMin;
    for (let dg = 0; dg <= unavailablePermCount; dg += 1) {
      const dp = unavailablePermCount - dg;
      const candidate =
        Math.min(24, (knownGranted + dg) * 8) +
        Math.min(10, (knownPrompt + dp) * 2);
      if (candidate > permMaxTotal) {
        permMaxTotal = candidate;
      }
    }

    const observedMinimum = Math.min(
      100,
      Math.round(cookiesMin + thirdPartyReqMin + trackerMin + fpMin + permMin)
    );
    const rawUnverifiedMax =
      cookiesMin +
      cookiesMissingMax +
      thirdPartyReqMin +
      thirdPartyReqMissingMax +
      trackerMin +
      trackerMissingMax +
      fpMin +
      fpMissingMax +
      permMaxTotal;

    const unverifiedMaximum =
      ctx.scanStatus === "preview"
        ? 100
        : Math.min(100, Math.round(Math.max(observedMinimum, rawUnverifiedMax)));

    const isComplete = ctx.scanStatus === "complete" && unavailableSources.length === 0;
    const value = isComplete ? observedMinimum : null;

    let category;
    if (ctx.scanStatus === "preview") {
      category = "Standalone Preview (Not a Live Extension Scan)";
    } else if (!isComplete) {
      category = "Incomplete Scan (Limited Coverage)";
    } else {
      category = scoreCategory(value);
    }

    const qualitySummary =
      ctx.scanStatus === "preview"
        ? "preview-mock-data"
        : isComplete
          ? "complete-browser-window-observation"
          : "partial-observation-with-unavailable-sources";

    return {
      value,
      observedMinimum,
      unverifiedMaximum,
      category,
      semantics: "informational-surface-summary",
      scoringRuleVersion: SCORING_RULE_VERSION,
      ruleSetVersion: RULE_SET_VERSION,
      nonVerdictNotice:
        "Surface Score summarizes observed browser-visible surfaces only. Low score does not mean safe; unavailable inputs are never counted as zero.",
      dimensions: {
        observationCoverage: {
          checkedSources,
          totalSources,
          percent: coveragePercent,
          status: ctx.scanStatus,
          unavailableSources
        },
        technicalExposure: {
          value,
          observedMinimum,
          unverifiedMaximum,
          maxValue: 100,
          category
        },
        evidenceQuality: {
          directObservedCount: ctx.observedCount,
          declaredCount: ctx.declaredCount,
          potentialCount: ctx.potentialCount,
          unavailableCount: ctx.unavailableCount,
          summary: qualitySummary
        }
      },
      components: {
        cookies: cookiesPts,
        thirdPartyRequests: thirdPartyReqPts,
        knownTrackerDomains: trackerPts,
        fingerprintingCalls: fpPts,
        grantedPermissions: grantedPts,
        promptPermissions: promptPts
      }
    };
  }

  function normalizePermissionLabel(rawState) {
    const lower = String(rawState || "").toLowerCase().trim();
    if (lower === "granted") return "Granted";
    if (lower === "denied") return "Denied";
    if (lower === "prompt") return "Prompt";
    return "Unavailable";
  }

  function shortenText(value, max) {
    const s = String(value || "");
    return s.length > max ? `${s.slice(0, max - 1)}…` : s;
  }

  /**
   * Recompute integrity hash of an existing receipt object (verifies round-trip integrity).
   */
  function verifyReceiptIntegrity(receipt) {
    if (!receipt || typeof receipt !== "object" || !receipt.integrity) return false;
    const copy = { ...receipt };
    delete copy.integrity;
    const expected = sha256Hex(canonicalizeJson(copy));
    return expected === receipt.integrity.contentHash;
  }

  /**
   * Serialize a normalized receipt model to pretty JSON.
   */
  function serializeReceiptJson(receipt) {
    return JSON.stringify(receipt, null, 2);
  }

  /**
   * Serialize a normalized receipt model to bounded, Markdown-escaped human-readable Markdown (#15, #21).
   * Preserves all 5 evidence states, distinct domain vs request counts, score dimensions, and limitations.
   */
  function serializeReceiptMarkdown(receipt) {
    if (!receipt || receipt.schema !== RECEIPT_SCHEMA_V1) {
      throw new Error("Invalid Surface Receipt v1 model");
    }

    const esc = escapeMarkdownInline;
    const code = sanitizeCodeSpan;
    const exp = receipt.surfaceScore.dimensions.technicalExposure;

    let scoreText;
    if (receipt.surfaceScore.value !== null) {
      scoreText = `${receipt.surfaceScore.value}/100 — ${esc(receipt.surfaceScore.category)}`;
    } else if (
      receipt.collector.scanStatus === "limited" &&
      receipt.surfaceScore.observedMinimum !== null &&
      receipt.surfaceScore.unverifiedMaximum !== null
    ) {
      scoreText = `Incomplete (${receipt.surfaceScore.observedMinimum}–${receipt.surfaceScore.unverifiedMaximum}/100 unverified range) — ${esc(receipt.surfaceScore.category)}`;
    } else if (
      receipt.collector.scanStatus === "preview" &&
      receipt.surfaceScore.observedMinimum !== null
    ) {
      scoreText = `Preview Only (local preview floor ${receipt.surfaceScore.observedMinimum}/100; not a live extension scan)`;
    } else {
      scoreText = `Unavailable (${esc(receipt.collector.scanStatus)})`;
    }

    let exposureText;
    if (exp.value !== null) {
      exposureText = `${exp.value}/100 (${esc(exp.category)})`;
    } else if (
      receipt.collector.scanStatus === "limited" &&
      exp.observedMinimum !== null &&
      exp.unverifiedMaximum !== null
    ) {
      exposureText = `${exp.observedMinimum}–${exp.unverifiedMaximum}/100 unverified range (${esc(exp.category)})`;
    } else if (receipt.collector.scanStatus === "preview") {
      exposureText = `Preview Only (${esc(exp.category)})`;
    } else {
      exposureText = `Unavailable (${esc(exp.category)})`;
    }

    const cov = receipt.surfaceScore.dimensions.observationCoverage;
    const qual = receipt.surfaceScore.dimensions.evidenceQuality;

    const cookieLine = receipt.cookies.available
      ? `${receipt.cookies.total} total (${receipt.cookies.firstParty} first-party, ${receipt.cookies.thirdParty} third-party; values not inspected)`
      : "Unavailable";

    const localLabel = receipt.storage.localStorage ? esc(receipt.storage.localStorage.label) : "Unavailable";
    const sessionLabel = receipt.storage.sessionStorage ? esc(receipt.storage.sessionStorage.label) : "Unavailable";

    const networkSummaryLine = receipt.network.available
      ? `${receipt.network.uniqueThirdPartyDomainCount} unique domain(s), ${receipt.network.thirdPartyRequestCount} total request(s), ${receipt.network.knownTrackerDomainCount} matching local tracker rules`
      : "Unavailable";

    const domainBullets =
      receipt.network.available && receipt.network.domains.length > 0
        ? receipt.network.domains.map(
            (d) =>
              `  - \`${code(d.domain)}\` — ${d.requestCount} request(s), classification: ${esc(d.classification)} (\`${code(d.classificationSource)}\`)`
          )
        : ["  - Not observed during this scan (not observed ≠ absent)."];

    const formatComponent = (v) => (v === null || v === undefined ? "unavailable" : `+${v}`);
    const comp = receipt.surfaceScore.components;

    const lines = [
      `# miTch Transparency Layer — Surface Receipt (v1)`,
      ``,
      `> ${esc(receipt.surfaceScore.nonVerdictNotice)}`,
      ``,
      `## Scan Provenance & Status`,
      `- **Schema:** \`${code(receipt.schema)}\``,
      `- **Receipt ID:** \`${code(receipt.receiptId)}\``,
      `- **Captured At:** ${esc(receipt.capturedAt)}`,
      `- **Collector:** ${esc(receipt.collector.name)} \`v${code(receipt.collector.version)}\` (revision: \`${code(receipt.collector.revision)}\`, rules: \`${code(receipt.collector.ruleSetVersion)}\`, mode: \`${code(receipt.collector.mode)}\`)`,
      `- **Scan Status:** \`${code(receipt.collector.scanStatus)}\` (window: \`${receipt.collector.observationWindowMs}ms\`)`,
      `- **Page Origin:** \`${code(receipt.page.origin)}\` (${esc(receipt.page.protocol)})`,
      `- **Page Title (untrusted page metadata):** ${esc(receipt.page.title)}`,
      `- **Full URL Included:** \`false\` (query and fragment redacted)`,
      ``,
      `## Surface Score & Dimensions`,
      `- **Surface Score:** **${scoreText}** (scoring: \`${code(receipt.surfaceScore.scoringRuleVersion)}\`, rules: \`${code(receipt.collector.ruleSetVersion)}\`)`,
      `- **Observation Coverage:** ${cov.percent}% (${cov.checkedSources}/${cov.totalSources} sources available${cov.unavailableSources.length > 0 ? `; unavailable: ${cov.unavailableSources.map(esc).join(", ")}` : ""})`,
      `- **Technical Exposure:** ${exposureText}`,
      `- **Evidence Quality:** ${qual.directObservedCount} observed, ${qual.declaredCount} declared, ${qual.potentialCount} potential, ${qual.unavailableCount} unavailable (\`${code(qual.summary)}\`)`,
      `- **Score Components:** cookies=${formatComponent(comp.cookies)}, thirdPartyRequests=${formatComponent(comp.thirdPartyRequests)}, knownTrackerDomains=${formatComponent(comp.knownTrackerDomains)}, fingerprintingCalls=${formatComponent(comp.fingerprintingCalls)}, grantedPermissions=${formatComponent(comp.grantedPermissions)}, promptPermissions=${formatComponent(comp.promptPermissions)}`,
      ``,
      `## Browser Surface Summary`,
      `- **Cookies:** ${cookieLine}`,
      `- **Client Storage:** localStorage=${localLabel}, sessionStorage=${sessionLabel} (values not inspected)`,
      `- **Third-Party Network Activity:** ${networkSummaryLine}`,
      ...domainBullets,
      `- **AskMI Visibility Layer:** \`${code(receipt.visibility.highestLayer)}\` (field attribute metadata only: \`${receipt.visibility.fieldMetadataOnly}\`)`,
      `- **CSP Eval Policy:** ${receipt.csp.available ? (receipt.csp.metaBlocksEval ? "Meta CSP blocks eval()" : "Not detected in <meta>") : "Unavailable"} (blocked violations observed: ${receipt.csp.available ? receipt.csp.evalBlockedCount : "unavailable"})`,
      ``
    ];

    if (receipt.visibility.proofSuggestion) {
      const ps = receipt.visibility.proofSuggestion;
      lines.push(
        `## Advisory AskMI Proof Suggestion`,
        `- **Observed Over-Collection:** \`${ps.observedOverCollection.map(code).join(", ")}\``,
        `- **Suggested Minimal Claim(s):** \`${ps.suggestedMinimalClaims.map(code).join(", ")}\` (Claim Contract \`${code(ps.contractVersion)}\`)`,
        `- **Rationale:** ${esc(ps.rationale)}`,
        `- **Advisory Boundary:** ${esc(ps.note)}`,
        ``
      );
    }

    lines.push(`## Five-State Evidence Report`);
    lines.push(`_${esc(receipt.report.notObservedNote)}_`);
    lines.push(``);

    lines.push(`### 1. Observed`);
    if (receipt.report.observed.length === 0) {
      lines.push(`- Not observed during this scan (not observed ≠ absent).`);
    } else {
      for (const item of receipt.report.observed) {
        lines.push(`- **${esc(item.summary)}** _(source: \`${code(item.source)}\`, confidence: \`${code(item.confidence)}\`)_`);
        if (item.bounded) {
          lines.push(`  - Observed: ${esc(item.bounded.observed)}`);
          lines.push(`  - Possible: ${esc(item.bounded.declaredOrPossible)}`);
          lines.push(`  - Not verified: ${esc(item.bounded.notVerified)}`);
          lines.push(`  - Unknown: ${esc(item.bounded.unknown)}`);
        }
      }
    }
    lines.push(``);

    lines.push(`### 2. Declared (Provider Notices)`);
    if (receipt.report.declared.length === 0) {
      lines.push(`- None recorded in this scan.`);
    } else {
      for (const item of receipt.report.declared) {
        lines.push(
          `- **${esc(item.summary)}** _(source: \`${code(item.sourceReference)}\`, retrieved: ${esc(item.retrievedAt)}, independentlyVerified: \`${item.independentlyVerified}\`)_`
        );
        lines.push(`  - Scope limitation: ${esc(item.scopeLimitation)}`);
      }
    }
    lines.push(``);

    lines.push(`### 3. Potential Access`);
    if (receipt.report.potential.length === 0) {
      lines.push(`- Unavailable for this scan status.`);
    } else {
      for (const item of receipt.report.potential) {
        lines.push(`- ${esc(item.summary)} _(source: \`${code(item.source)}\`)_`);
      }
    }
    lines.push(``);

    lines.push(`### 4. Unknown (Outside Browser Collector Boundary)`);
    for (const item of receipt.report.unknown) {
      lines.push(`- ${esc(item.summary)}`);
    }
    lines.push(``);

    lines.push(`### 5. Unavailable Checks`);
    if (receipt.report.unavailable.length === 0) {
      lines.push(`- None — all configured browser checks responded.`);
    } else {
      for (const item of receipt.report.unavailable) {
        lines.push(`- **${esc(item.summary)}** _(source: \`${code(item.source)}\`, reason: \`${code(item.reason || "unavailable")}\`)_`);
      }
    }
    lines.push(``);

    if (receipt.collector.limitations.length > 0) {
      lines.push(`## Collector Limitations`);
      for (const lim of receipt.collector.limitations) {
        lines.push(`- ${esc(lim)}`);
      }
      lines.push(``);
    }

    lines.push(`## Receipt Integrity`);
    lines.push(`- **Normalization Version:** \`${code(receipt.integrity.normalizationVersion)}\``);
    lines.push(`- **SHA-256 Content Hash:** \`${code(receipt.integrity.contentHash)}\``);

    return lines.join("\n");
  }

  return {
    RECEIPT_SCHEMA_V1,
    COLLECTOR_NAME,
    COLLECTOR_VERSION,
    RULE_SET_VERSION,
    SCORING_RULE_VERSION,
    NORMALIZATION_VERSION,
    EVIDENCE_STATES,
    SCAN_STATUSES,
    FINGERPRINT_SURFACES,
    PERMISSION_SURFACES,
    KNOWN_TRACKER_PATTERNS,
    sha256Hex,
    canonicalizeJson,
    sanitizePlainText,
    escapeMarkdownInline,
    sanitizePageContext,
    classifyThirdPartyDomain,
    normalizeNetworkData,
    combineNetworkSources,
    normalizeDeclarations,
    buildSurfaceReceiptModel,
    verifyReceiptIntegrity,
    serializeReceiptJson,
    serializeReceiptMarkdown
  };
});
