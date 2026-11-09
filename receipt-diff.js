(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.MitchReceiptDiff = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function getValidator() {
    if (typeof globalThis !== "undefined" && globalThis.MitchReceiptValidator) {
      return globalThis.MitchReceiptValidator;
    }
    if (typeof require === "function") {
      try {
        return require("./receipt-validator.js");
      } catch {
        return null;
      }
    }
    return null;
  }

  function matchAllowlist(kind, key, allowlist = {}) {
    if (!allowlist || typeof allowlist !== "object") return null;
    const rationale = allowlist.rationale || "Acknowledged in baseline allowlist";
    if (
      kind === "domain" &&
      Array.isArray(allowlist.allowedDomains) &&
      allowlist.allowedDomains.includes(key)
    ) {
      return { matched: true, rule: `allowedDomains:${key}`, rationale };
    }
    if (
      kind === "formField" &&
      Array.isArray(allowlist.allowedFormFields) &&
      (allowlist.allowedFormFields.includes(key) ||
        (key === "dob" && allowlist.allowedFormFields.includes("birthdate")))
    ) {
      return { matched: true, rule: `allowedFormFields:${key}`, rationale };
    }
    if (
      kind === "permission" &&
      Array.isArray(allowlist.allowedPermissions) &&
      allowlist.allowedPermissions.includes(key)
    ) {
      return { matched: true, rule: `allowedPermissions:${key}`, rationale };
    }
    if (
      kind === "fingerprinting" &&
      Array.isArray(allowlist.allowedFingerprinting) &&
      allowlist.allowedFingerprinting.includes(key)
    ) {
      return { matched: true, rule: `allowedFingerprinting:${key}`, rationale };
    }
    return null;
  }

  /**
   * Compute structured privacy-surface diff between two Surface Receipt v1 objects (#18).
   * - Strictly separates added, removed, changed, and unavailable evidence.
   * - Never treats an unavailable channel in candidate as removed or fixed!
   * - Allowlist annotations mark expected surfaces without hiding them or altering scores.
   */
  function diffSurfaceReceipts(baseline, candidate, options = {}) {
    const validator = getValidator();
    if (validator) {
      const bVal = validator.validateSurfaceReceipt(baseline);
      if (!bVal.valid) {
        throw new Error(`Invalid baseline receipt: ${bVal.errors.join("; ")}`);
      }
      const cVal = validator.validateSurfaceReceipt(candidate);
      if (!cVal.valid) {
        throw new Error(`Invalid candidate receipt: ${cVal.errors.join("; ")}`);
      }
    }

    const allowlist = options.allowlist || null;
    const added = [];
    const removed = [];
    const changed = [];
    const unavailable = [];

    const pushAdded = (item) => {
      const annotation = matchAllowlist(item.kind, item.key, allowlist);
      added.push({
        ...item,
        annotatedAllowlist: annotation
      });
    };

    // 1. Scan Status & Score / Exposure changes
    if (baseline.collector.scanStatus !== candidate.collector.scanStatus) {
      changed.push({
        kind: "scanStatus",
        key: "collector.scanStatus",
        before: baseline.collector.scanStatus,
        after: candidate.collector.scanStatus,
        summary: `Scan status changed from ${baseline.collector.scanStatus} to ${candidate.collector.scanStatus}`
      });
    }

    const bScore = baseline.surfaceScore.value ?? `${baseline.surfaceScore.observedMinimum}..${baseline.surfaceScore.unverifiedMaximum}`;
    const cScore = candidate.surfaceScore.value ?? `${candidate.surfaceScore.observedMinimum}..${candidate.surfaceScore.unverifiedMaximum}`;
    if (bScore !== cScore) {
      changed.push({
        kind: "surfaceScore",
        key: "surfaceScore",
        before: bScore,
        after: cScore,
        summary: `Surface Score changed from ${bScore} to ${cScore} (rule: ${candidate.surfaceScore.scoringRuleVersion})`
      });
    }

    // 2. Unavailable checks in either baseline or candidate
    const bUnavailMap = new Map((baseline.report.unavailable || []).map((u) => [u.id, u]));
    const cUnavailMap = new Map((candidate.report.unavailable || []).map((u) => [u.id, u]));
    for (const [id, u] of cUnavailMap.entries()) {
      unavailable.push({
        id,
        presentIn: bUnavailMap.has(id) ? "both" : "candidate",
        summary: u.summary,
        reason: u.reason || "unavailable"
      });
    }
    for (const [id, u] of bUnavailMap.entries()) {
      if (!cUnavailMap.has(id)) {
        unavailable.push({
          id,
          presentIn: "baseline",
          summary: u.summary,
          reason: u.reason || "unavailable"
        });
      }
    }

    // 3. Cookies diff (only compare counts if both are available!)
    if (baseline.cookies.available && candidate.cookies.available) {
      if (baseline.cookies.total !== candidate.cookies.total) {
        changed.push({
          kind: "cookies",
          key: "cookies.total",
          before: baseline.cookies.total,
          after: candidate.cookies.total,
          delta: candidate.cookies.total - baseline.cookies.total,
          summary: `Total cookies changed from ${baseline.cookies.total} to ${candidate.cookies.total}`
        });
      }
    }

    // 4. Third-party domains diff (only mark removed if candidate.network.available is true!)
    const bDomains = new Map(
      (baseline.network.available ? baseline.network.domains : []).map((d) => [d.domain, d])
    );
    const cDomains = new Map(
      (candidate.network.available ? candidate.network.domains : []).map((d) => [d.domain, d])
    );

    if (candidate.network.available) {
      for (const [dom, d] of cDomains.entries()) {
        if (!bDomains.has(dom)) {
          pushAdded({
            kind: "domain",
            key: dom,
            isTracker: Boolean(d.isTracker),
            requestCount: d.requestCount,
            classification: d.classification,
            summary: `Added third-party domain ${dom} (${d.requestCount} req, ${d.classification})`
          });
        } else if (baseline.network.available && bDomains.get(dom).requestCount !== d.requestCount) {
          changed.push({
            kind: "domainRequestCount",
            key: dom,
            before: bDomains.get(dom).requestCount,
            after: d.requestCount,
            delta: d.requestCount - bDomains.get(dom).requestCount,
            summary: `Request count for ${dom} changed from ${bDomains.get(dom).requestCount} to ${d.requestCount}`
          });
        }
      }
    }

    if (baseline.network.available && candidate.network.available) {
      for (const [dom, d] of bDomains.entries()) {
        if (!cDomains.has(dom)) {
          removed.push({
            kind: "domain",
            key: dom,
            isTracker: Boolean(d.isTracker),
            summary: `Removed third-party domain ${dom}`
          });
        }
      }
    }

    // 5. Fingerprinting calls diff (never mark removed if candidate fingerprinting check is unavailable!)
    const bFp = new Map((baseline.fingerprinting || []).map((f) => [f.key, f]));
    const cFp = new Map((candidate.fingerprinting || []).map((f) => [f.key, f]));
    for (const [key, cf] of cFp.entries()) {
      const bf = bFp.get(key);
      if (cf.evidenceState === "observed" && (!bf || bf.evidenceState !== "observed")) {
        pushAdded({
          kind: "fingerprinting",
          key,
          summary: `Newly observed fingerprinting surface: ${cf.label} (${key})`
        });
      } else if (
        bf &&
        bf.evidenceState === "observed" &&
        cf.evidenceState === "not-observed"
      ) {
        removed.push({
          kind: "fingerprinting",
          key,
          summary: `Fingerprinting surface no longer observed: ${cf.label} (${key})`
        });
      }
    }

    // 6. Visibility Layer form fields diff (only mark removed if candidate.visibility.available is true!)
    const bFields = new Map(
      (baseline.visibility.available ? baseline.visibility.findings : []).map((f) => [f.key, f])
    );
    const cFields = new Map(
      (candidate.visibility.available ? candidate.visibility.findings : []).map((f) => [f.key, f])
    );

    if (candidate.visibility.available) {
      for (const [key, cf] of cFields.entries()) {
        if (!bFields.has(key)) {
          pushAdded({
            kind: "formField",
            key,
            layer: cf.layer,
            summary: `Added form field metadata: ${cf.label} (${key}, ${cf.layer})`
          });
        }
      }
    }
    if (baseline.visibility.available && candidate.visibility.available) {
      for (const [key, bf] of bFields.entries()) {
        if (!cFields.has(key)) {
          removed.push({
            kind: "formField",
            key,
            layer: bf.layer,
            summary: `Removed form field metadata: ${bf.label} (${key})`
          });
        }
      }
    }

    // 7. Permissions diff
    const bPerms = new Map((baseline.permissions || []).map((p) => [p.key, p]));
    const cPerms = new Map((candidate.permissions || []).map((p) => [p.key, p]));
    for (const [key, cp] of cPerms.entries()) {
      const bp = bPerms.get(key);
      if (cp.state === "Granted" && (!bp || bp.state !== "Granted")) {
        pushAdded({
          kind: "permission",
          key,
          summary: `Newly granted browser permission: ${cp.label} (${key})`
        });
      } else if (
        bp &&
        bp.state === "Granted" &&
        cp.state !== "Granted" &&
        cp.state !== "Unavailable"
      ) {
        removed.push({
          kind: "permission",
          key,
          summary: `Permission no longer granted: ${cp.label} (${key} -> ${cp.state})`
        });
      }
    }

    const acknowledgedAddedCount = added.filter((a) => a.annotatedAllowlist !== null).length;
    const unacknowledgedAddedCount = added.length - acknowledgedAddedCount;

    return {
      schema: "askmi.transparency.surface-diff.v1",
      nonVerdictNotice:
        "Surface Diff summarizes changes in observed browser-visible surfaces between two snapshots. It is not a compliance, safety, or certification verdict.",
      baselineReceiptId: baseline.receiptId,
      candidateReceiptId: candidate.receiptId,
      baselineOrigin: baseline.page.origin,
      candidateOrigin: candidate.page.origin,
      baselineScanStatus: baseline.collector.scanStatus,
      candidateScanStatus: candidate.collector.scanStatus,
      counts: {
        added: added.length,
        acknowledgedAdded: acknowledgedAddedCount,
        unacknowledgedAdded: unacknowledgedAddedCount,
        removed: removed.length,
        changed: changed.length,
        unavailable: unavailable.length
      },
      hasUnacknowledgedAdditions: unacknowledgedAddedCount > 0,
      hasUnavailableEvidence: unavailable.length > 0,
      added,
      removed,
      changed,
      unavailable
    };
  }

  function formatReceiptDiffMarkdown(diff) {
    const lines = [
      "# miTch Transparency Layer — Privacy Surface Diff (v1)",
      "",
      `> ${diff.nonVerdictNotice}`,
      "",
      `- **Baseline:** \`${diff.baselineReceiptId}\` (\`${diff.baselineOrigin}\`, status: \`${diff.baselineScanStatus}\`)`,
      `- **Candidate:** \`${diff.candidateReceiptId}\` (\`${diff.candidateOrigin}\`, status: \`${diff.candidateScanStatus}\`)`,
      `- **Summary Counts:** +${diff.counts.added} added (${diff.counts.unacknowledgedAdded} unacknowledged, ${diff.counts.acknowledgedAdded} allowlist-annotated), -${diff.counts.removed} removed, Δ${diff.counts.changed} changed, ⊘${diff.counts.unavailable} unavailable`,
      "",
      "## 1. Added Surfaces (+)"
    ];

    if (diff.added.length === 0) {
      lines.push("- None observed.");
    } else {
      for (const item of diff.added) {
        const allowNote = item.annotatedAllowlist
          ? ` _[Allowlist: \`${item.annotatedAllowlist.rule}\` — ${item.annotatedAllowlist.rationale}]_`
          : "";
        lines.push(`- **${item.summary}**${allowNote}`);
      }
    }
    lines.push("");

    lines.push("## 2. Removed Surfaces (-)");
    if (diff.removed.length === 0) {
      lines.push("- None observed.");
    } else {
      for (const item of diff.removed) {
        lines.push(`- ${item.summary}`);
      }
    }
    lines.push("");

    lines.push("## 3. Changed Metrics & Status (Δ)");
    if (diff.changed.length === 0) {
      lines.push("- None.");
    } else {
      for (const item of diff.changed) {
        lines.push(`- ${item.summary}`);
      }
    }
    lines.push("");

    lines.push("## 4. Unavailable Checks (⊘ Never Counted as Removed or Clean)");
    if (diff.unavailable.length === 0) {
      lines.push("- None — all configured checks responded in both snapshots.");
    } else {
      for (const item of diff.unavailable) {
        lines.push(`- **${item.id}** (${item.presentIn}): ${item.summary} (` + `${item.reason}` + `)`);
      }
    }

    return lines.join("\n");
  }

  return Object.freeze({
    diffSurfaceReceipts,
    formatReceiptDiffMarkdown
  });
});
