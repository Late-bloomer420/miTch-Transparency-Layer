(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.MitchDomainBoundary = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const MULTI_PART_PUBLIC_SUFFIXES = new Set([
    "co.uk", "org.uk", "gov.uk", "ac.uk", "me.uk", "net.uk", "plc.uk", "ltd.uk", "sch.uk",
    "com.au", "net.au", "org.au", "edu.au", "gov.au", "asn.au", "id.au",
    "co.nz", "org.nz", "govt.nz", "ac.nz", "net.nz",
    "co.jp", "ne.jp", "or.jp", "ac.jp", "go.jp", "ed.jp", "gr.jp", "lg.jp",
    "com.br", "org.br", "gov.br", "net.br", "edu.br",
    "co.za", "org.za", "gov.za", "ac.za", "net.za",
    "co.in", "net.in", "org.in", "gen.in", "firm.in", "ind.in", "ac.in", "gov.in",
    "co.kr", "or.kr", "go.kr", "ac.kr", "ne.kr",
    "com.cn", "net.cn", "org.cn", "gov.cn", "edu.cn", "ac.cn",
    "com.tw", "org.tw", "gov.tw", "edu.tw", "net.tw",
    "com.hk", "org.hk", "gov.hk", "edu.hk", "net.hk",
    "com.sg", "org.sg", "gov.sg", "edu.sg", "net.sg",
    "co.il", "org.il", "gov.il", "ac.il", "net.il",
    "com.tr", "gov.tr", "org.tr", "edu.tr", "net.tr",
    "com.mx", "gob.mx", "org.mx", "edu.mx", "net.mx",
    "com.ar", "gob.ar", "org.ar", "edu.ar", "net.ar",
    "com.pl", "net.pl", "org.pl", "gov.pl", "edu.pl",
    "co.at", "or.at", "gv.at", "ac.at",
    // Shared hosting / multi-tenant public suffixes (isolated per tenant)
    "github.io", "gitlab.io", "vercel.app", "pages.dev", "netlify.app",
    "web.app", "firebaseapp.com", "onrender.com", "workers.dev",
    "herokuapp.com", "cloudfront.net", "azurewebsites.net"
  ]);

  function normalizeHostname(input) {
    if (typeof input !== "string") return "";
    let raw = input.trim();
    if (!raw || raw === "null" || raw === "opaque") return "";

    if (raw.includes("://")) {
      try {
        const parsed = new URL(raw);
        if (!/^https?:$|^wss?:$/i.test(parsed.protocol)) return "";
        raw = parsed.hostname || "";
      } catch {
        return "";
      }
    } else if (raw.startsWith("[") && raw.includes("]")) {
      raw = raw.slice(1, raw.indexOf("]"));
    } else if (raw.includes("/") || raw.includes("?") || raw.includes("#")) {
      try {
        const parsed = new URL("https://" + raw);
        raw = parsed.hostname || "";
      } catch {
        return "";
      }
    } else if (/^[^:]+:\d+$/.test(raw)) {
      raw = raw.slice(0, raw.lastIndexOf(":"));
    }

    if (raw.startsWith("[") && raw.endsWith("]")) {
      raw = raw.slice(1, -1);
    }
    raw = raw.replace(/^\.+|\.+$/g, "").toLowerCase();
    if (!raw || /\s/.test(raw)) return "";
    return raw;
  }

  function isIpv4Address(host) {
    if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return false;
    return host.split(".").every((octet) => {
      const n = Number(octet);
      return Number.isInteger(n) && n >= 0 && n <= 255;
    });
  }

  function isIpv6Address(host) {
    if (!host.includes(":")) return false;
    return /^[0-9a-f:]+$/i.test(host);
  }

  function isIpAddress(input) {
    const host = normalizeHostname(input);
    if (!host) return false;
    return isIpv4Address(host) || isIpv6Address(host);
  }

  function getRegistrableDomain(input) {
    const host = normalizeHostname(input);
    if (!host) return null;

    if (host === "localhost" || host.endsWith(".localhost")) {
      return "localhost";
    }
    if (isIpv4Address(host) || isIpv6Address(host)) {
      return host;
    }

    const labels = host.split(".").filter(Boolean);
    if (labels.length === 0) return null;
    if (labels.length === 1) return labels[0];

    const lastTwo = labels.slice(-2).join(".");
    if (MULTI_PART_PUBLIC_SUFFIXES.has(lastTwo)) {
      if (labels.length < 3) {
        return null; // Host is the public suffix itself (e.g. "co.uk" or "github.io")
      }
      return labels.slice(-3).join(".");
    }

    const lastThree = labels.length >= 3 ? labels.slice(-3).join(".") : "";
    if (lastThree && MULTI_PART_PUBLIC_SUFFIXES.has(lastThree)) {
      if (labels.length < 4) return null;
      return labels.slice(-4).join(".");
    }

    return lastTwo;
  }

  function sameSite(hostOrUrlA, hostOrUrlB) {
    const regA = getRegistrableDomain(hostOrUrlA);
    const regB = getRegistrableDomain(hostOrUrlB);
    if (!regA || !regB) return false;
    return regA === regB;
  }

  function sameCookieDomain(cookieDomain, pageHostOrUrl) {
    const cleanCookie = normalizeHostname(String(cookieDomain || "").replace(/^\.+/, ""));
    const cleanPage = normalizeHostname(pageHostOrUrl);
    if (!cleanCookie || !cleanPage) return false;
    if (cleanPage === cleanCookie || cleanPage.endsWith("." + cleanCookie)) {
      return true;
    }
    return sameSite(cleanCookie, cleanPage);
  }

  function classifyRequestRelation(details = {}) {
    const reqUrl = details.requestUrl || details.url || "";
    const reqHost = normalizeHostname(reqUrl);
    if (!reqHost) {
      return {
        relation: "invalid",
        requestHost: null,
        requestRegistrableDomain: null,
        contextHost: null,
        contextRegistrableDomain: null,
        reason: "non-network-url"
      };
    }

    const reqReg = getRegistrableDomain(reqHost);
    const rawInitiator = details.initiator;
    const rawDocUrl = details.documentUrl || details.tabUrl || "";

    if (rawInitiator === "null" || rawInitiator === "opaque") {
      return {
        relation: "unattributed",
        requestHost: reqHost,
        requestRegistrableDomain: reqReg,
        contextHost: null,
        contextRegistrableDomain: null,
        reason: "opaque-initiator"
      };
    }

    const contextHost = normalizeHostname(rawInitiator || "") || normalizeHostname(rawDocUrl || "");
    if (!contextHost) {
      return {
        relation: "unattributed",
        requestHost: reqHost,
        requestRegistrableDomain: reqReg,
        contextHost: null,
        contextRegistrableDomain: null,
        reason: "missing-initiator"
      };
    }

    const contextReg = getRegistrableDomain(contextHost);
    if (!reqReg || !contextReg) {
      return {
        relation: "unattributed",
        requestHost: reqHost,
        requestRegistrableDomain: reqReg,
        contextHost,
        contextRegistrableDomain: contextReg,
        reason: "unresolvable-registrable-domain"
      };
    }

    const isFirstParty = reqReg === contextReg;
    return {
      relation: isFirstParty ? "first-party" : "third-party",
      requestHost: reqHost,
      requestRegistrableDomain: reqReg,
      contextHost,
      contextRegistrableDomain: contextReg,
      reason: isFirstParty ? "same-registrable-domain" : "cross-site-registrable-domain"
    };
  }

  return Object.freeze({
    MULTI_PART_PUBLIC_SUFFIXES,
    normalizeHostname,
    isIpAddress,
    getRegistrableDomain,
    sameSite,
    sameCookieDomain,
    classifyRequestRelation
  });
});
