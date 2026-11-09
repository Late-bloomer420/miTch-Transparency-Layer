(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.MitchComparisonStore = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const VALID_SCENARIOS = Object.freeze(["login-state", "cookie-consent", "page-change", "manual"]);
  const VALID_STAGES = Object.freeze(["before", "after", "point-in-time"]);
  const MAX_TIMELINE_ENTRIES = 20;

  function sanitizeSnapshotFromReceipt(receipt, meta = {}) {
    if (!receipt || typeof receipt !== "object" || !receipt.page || !receipt.collector) {
      throw new Error("Valid Surface Receipt v1 object is required to create a comparison snapshot.");
    }

    const scenario = VALID_SCENARIOS.includes(meta.scenario) ? meta.scenario : "manual";
    const stage = VALID_STAGES.includes(meta.stage) ? meta.stage : "point-in-time";

    const domains =
      receipt.network && receipt.network.available && Array.isArray(receipt.network.domains)
        ? receipt.network.domains.map((d) => ({
            domain: String(d.domain || ""),
            isTracker: Boolean(d.isTracker),
            requestCount: Number(d.requestCount) || 0
          }))
        : [];

    const fpObserved = Array.isArray(receipt.fingerprinting)
      ? receipt.fingerprinting.filter((f) => f.observed === true).map((f) => f.key)
      : [];

    const formFields =
      receipt.visibility && receipt.visibility.available && Array.isArray(receipt.visibility.findings)
        ? receipt.visibility.findings.map((f) => f.key)
        : [];

    const grantedPermissions = Array.isArray(receipt.permissions)
      ? receipt.permissions.filter((p) => p.state === "Granted").map((p) => p.key)
      : [];

    return {
      snapshotId: receipt.receiptId || `snap_${Date.now()}`,
      capturedAt: receipt.capturedAt || new Date().toISOString(),
      scenario,
      stage,
      origin: receipt.page.origin || "unknown",
      domain: receipt.page.domain || "unknown",
      protocol: receipt.page.protocol || "UNKNOWN",
      urlIncluded: false,
      scanStatus: receipt.collector.scanStatus || "limited",
      surfaceScore: {
        value: receipt.surfaceScore ? receipt.surfaceScore.value : null,
        observedMinimum: receipt.surfaceScore ? receipt.surfaceScore.observedMinimum : null,
        unverifiedMaximum: receipt.surfaceScore ? receipt.surfaceScore.unverifiedMaximum : null,
        category: receipt.surfaceScore ? receipt.surfaceScore.category : "Unavailable",
        coveragePercent:
          receipt.surfaceScore &&
          receipt.surfaceScore.dimensions &&
          receipt.surfaceScore.dimensions.observationCoverage
            ? receipt.surfaceScore.dimensions.observationCoverage.percent
            : 0
      },
      cookies: {
        available: Boolean(receipt.cookies && receipt.cookies.available),
        total: receipt.cookies && receipt.cookies.available ? receipt.cookies.total : null,
        firstParty: receipt.cookies && receipt.cookies.available ? receipt.cookies.firstParty : null,
        thirdParty: receipt.cookies && receipt.cookies.available ? receipt.cookies.thirdParty : null
      },
      storage: {
        localStorage:
          receipt.storage && receipt.storage.localStorage && receipt.storage.localStorage.available
            ? receipt.storage.localStorage.keyCount
            : null,
        sessionStorage:
          receipt.storage && receipt.storage.sessionStorage && receipt.storage.sessionStorage.available
            ? receipt.storage.sessionStorage.keyCount
            : null
      },
      network: {
        available: Boolean(receipt.network && receipt.network.available),
        thirdPartyRequestCount:
          receipt.network && receipt.network.available ? receipt.network.thirdPartyRequestCount : null,
        uniqueThirdPartyDomainCount:
          receipt.network && receipt.network.available ? receipt.network.uniqueThirdPartyDomainCount : null,
        knownTrackerDomainCount:
          receipt.network && receipt.network.available ? receipt.network.knownTrackerDomainCount : null,
        domains
      },
      fingerprintingObserved: fpObserved,
      visibility: {
        available: Boolean(receipt.visibility && receipt.visibility.available),
        highestLayer: receipt.visibility ? receipt.visibility.highestLayer : "Unavailable",
        fieldKeys: formFields
      },
      grantedPermissions
    };
  }

  function toSnapshot(input, meta = {}) {
    if (input && input.schema === "askmi.transparency.surface-receipt.v1") {
      return sanitizeSnapshotFromReceipt(input, meta);
    }
    if (input && typeof input === "object" && input.snapshotId && input.cookies && input.network) {
      return input;
    }
    throw new Error("Input must be a Surface Receipt v1 or sanitized comparison snapshot.");
  }

  function numericDelta(beforeVal, afterVal) {
    if (beforeVal === null || beforeVal === undefined || afterVal === null || afterVal === undefined) {
      return {
        before: beforeVal ?? null,
        after: afterVal ?? null,
        delta: null,
        status: "unavailable"
      };
    }
    return {
      before: beforeVal,
      after: afterVal,
      delta: afterVal - beforeVal,
      status: afterVal > beforeVal ? "increased" : afterVal < beforeVal ? "decreased" : "unchanged"
    };
  }

  function compareSnapshots(beforeInput, afterInput, options = {}) {
    const locale = typeof options === "string" ? options : options.locale || "en";
    const isDe = String(locale).toLowerCase().startsWith("de");
    const before = toSnapshot(beforeInput, { stage: "before" });
    const after = toSnapshot(afterInput, { stage: "after" });
    const scenario = options.scenario || after.scenario || before.scenario || "manual";

    const cookiesDelta = numericDelta(before.cookies.total, after.cookies.total);
    const thirdPartyRequestsDelta = numericDelta(
      before.network.thirdPartyRequestCount,
      after.network.thirdPartyRequestCount
    );
    const uniqueDomainsDelta = numericDelta(
      before.network.uniqueThirdPartyDomainCount,
      after.network.uniqueThirdPartyDomainCount
    );
    const trackerDomainsDelta = numericDelta(
      before.network.knownTrackerDomainCount,
      after.network.knownTrackerDomainCount
    );
    const localStorageDelta = numericDelta(before.storage.localStorage, after.storage.localStorage);
    const sessionStorageDelta = numericDelta(before.storage.sessionStorage, after.storage.sessionStorage);

    const beforeDomainSet = new Set((before.network.domains || []).map((d) => d.domain));
    const afterDomainSet = new Set((after.network.domains || []).map((d) => d.domain));
    const addedDomains = Array.from(afterDomainSet).filter((d) => !beforeDomainSet.has(d)).sort();
    const removedDomains = Array.from(beforeDomainSet).filter((d) => !afterDomainSet.has(d)).sort();

    const beforeTrackerSet = new Set(
      (before.network.domains || []).filter((d) => d.isTracker).map((d) => d.domain)
    );
    const afterTrackerSet = new Set(
      (after.network.domains || []).filter((d) => d.isTracker).map((d) => d.domain)
    );
    const addedTrackers = Array.from(afterTrackerSet).filter((d) => !beforeTrackerSet.has(d)).sort();
    const removedTrackers = Array.from(beforeTrackerSet).filter((d) => !afterTrackerSet.has(d)).sort();

    const beforeFp = new Set(before.fingerprintingObserved || []);
    const afterFp = new Set(after.fingerprintingObserved || []);
    const addedFingerprinting = Array.from(afterFp).filter((k) => !beforeFp.has(k));

    const beforeFields = new Set((before.visibility && before.visibility.fieldKeys) || []);
    const afterFields = new Set((after.visibility && after.visibility.fieldKeys) || []);
    const addedFormFields = Array.from(afterFields).filter((k) => !beforeFields.has(k));

    const beforePerms = new Set(before.grantedPermissions || []);
    const afterPerms = new Set(after.grantedPermissions || []);
    const addedPermissions = Array.from(afterPerms).filter((k) => !beforePerms.has(k));

    const summaryLines = [];
    const hasPartial = before.scanStatus !== "complete" || after.scanStatus !== "complete";
    if (hasPartial) {
      summaryLines.push(
        isDe
          ? `Hinweis: Mindestens ein Schnappschuss hatte eingeschränkte Abdeckung (${before.scanStatus} → ${after.scanStatus}); nicht verfügbare Werte werden nicht als 0 gewertet.`
          : `Note: At least one snapshot had limited coverage (${before.scanStatus} → ${after.scanStatus}); unavailable checks are never counted as 0.`
      );
    }

    const fmtDelta = (d, labelEn, labelDe) => {
      const name = isDe ? labelDe : labelEn;
      if (d.status === "unavailable") {
        return isDe
          ? `${name}: Vergleich nicht verfügbar (${d.before ?? "n/v"} → ${d.after ?? "n/v"}).`
          : `${name}: comparison unavailable (${d.before ?? "n/a"} → ${d.after ?? "n/a"}).`;
      }
      const sign = d.delta > 0 ? `+${d.delta}` : String(d.delta);
      return `${name}: ${d.before} → ${d.after} (${sign}).`;
    };

    summaryLines.push(fmtDelta(cookiesDelta, "Cookies", "Cookies"));
    summaryLines.push(fmtDelta(thirdPartyRequestsDelta, "Third-party requests", "Drittanbieter-Anfragen"));
    summaryLines.push(fmtDelta(trackerDomainsDelta, "Tracker-rule domains", "Tracker-Regel-Domains"));

    if (addedDomains.length > 0) {
      summaryLines.push(
        isDe
          ? `Neue Drittanbieter-Domains (${addedDomains.length}): ${addedDomains.join(", ")}.`
          : `New third-party domains (${addedDomains.length}): ${addedDomains.join(", ")}.`
      );
    }
    if (addedFingerprinting.length > 0) {
      summaryLines.push(
        isDe
          ? `Neu beobachtete Fingerprinting-APIs: ${addedFingerprinting.join(", ")}.`
          : `Newly observed fingerprinting APIs: ${addedFingerprinting.join(", ")}.`
      );
    }
    if (addedFormFields.length > 0) {
      summaryLines.push(
        isDe
          ? `Neu beobachtete Formularfelder: ${addedFormFields.join(", ")}.`
          : `Newly observed form fields: ${addedFormFields.join(", ")}.`
      );
    }

    return {
      scenario,
      beforeOrigin: before.origin,
      afterOrigin: after.origin,
      beforeScanStatus: before.scanStatus,
      afterScanStatus: after.scanStatus,
      cookiesDelta,
      thirdPartyRequestsDelta,
      uniqueDomainsDelta: {
        ...uniqueDomainsDelta,
        addedDomains,
        removedDomains
      },
      trackerDomainsDelta: {
        ...trackerDomainsDelta,
        addedTrackers,
        removedTrackers
      },
      storageDelta: {
        localStorage: localStorageDelta,
        sessionStorage: sessionStorageDelta
      },
      addedFingerprinting,
      addedFormFields,
      addedPermissions,
      summaryLines
    };
  }

  function createTimelineStore(options = {}) {
    const storageKey = options.storageKey || "mitch_optin_session_timeline_v1";
    const optInKey = options.optInKey || "mitch_optin_timeline_enabled";
    const backing = options.storage || null;

    let memoryOptIn = false;
    let memoryItems = [];

    function readOptIn() {
      if (backing && typeof backing.getItem === "function") {
        try {
          return backing.getItem(optInKey) === "1";
        } catch {
          return memoryOptIn;
        }
      }
      return memoryOptIn;
    }

    function writeOptIn(enabled) {
      memoryOptIn = Boolean(enabled);
      if (backing && typeof backing.setItem === "function") {
        try {
          if (memoryOptIn) {
            backing.setItem(optInKey, "1");
          } else {
            backing.removeItem(optInKey);
          }
        } catch {
          // Ignore storage errors
        }
      }
      if (!memoryOptIn) {
        clearTimeline();
      }
      return memoryOptIn;
    }

    function readItems() {
      if (!readOptIn()) return [];
      if (backing && typeof backing.getItem === "function") {
        try {
          const raw = backing.getItem(storageKey);
          if (!raw) return [];
          const parsed = JSON.parse(raw);
          return Array.isArray(parsed) ? parsed : [];
        } catch {
          return [...memoryItems];
        }
      }
      return [...memoryItems];
    }

    function writeItems(items) {
      memoryItems = items.slice(-MAX_TIMELINE_ENTRIES);
      if (backing && typeof backing.setItem === "function") {
        try {
          backing.setItem(storageKey, JSON.stringify(memoryItems));
        } catch {
          // Ignore quota errors
        }
      }
    }

    function recordSnapshot(receiptOrSnap, meta = {}) {
      if (!readOptIn()) {
        return {
          stored: false,
          reason: "opt-in-disabled",
          count: 0
        };
      }
      const snap = toSnapshot(receiptOrSnap, meta);
      const current = readItems();
      current.push(snap);
      writeItems(current);
      return {
        stored: true,
        snapshot: snap,
        count: memoryItems.length
      };
    }

    function clearTimeline() {
      memoryItems = [];
      if (backing && typeof backing.removeItem === "function") {
        try {
          backing.removeItem(storageKey);
        } catch {
          // Ignore
        }
      }
      return { cleared: true, count: 0 };
    }

    function exportTimelineJson() {
      return JSON.stringify(
        {
          schema: "askmi.transparency.session-timeline.v1",
          optInEnabled: readOptIn(),
          exportedAt: new Date().toISOString(),
          urlIncluded: false,
          valuesInspected: false,
          snapshots: readItems()
        },
        null,
        2
      );
    }

    return {
      isOptInEnabled: readOptIn,
      setOptInEnabled: writeOptIn,
      getSnapshots: readItems,
      recordSnapshot,
      clearTimeline,
      exportTimelineJson
    };
  }

  return Object.freeze({
    VALID_SCENARIOS,
    VALID_STAGES,
    MAX_TIMELINE_ENTRIES,
    sanitizeSnapshotFromReceipt,
    compareSnapshots,
    createTimelineStore
  });
});
