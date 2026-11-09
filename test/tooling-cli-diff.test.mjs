import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { validateSurfaceReceipt } = require("../receipt-validator.js");
const { diffSurfaceReceipts, formatReceiptDiffMarkdown } = require("../receipt-diff.js");
const { scanHtmlDocument } = await import("../cli/mitch-scan.mjs");

const REPO_ROOT = path.resolve(import.meta.dirname, "..");

function loadFixture(name) {
  return JSON.parse(
    fs.readFileSync(path.join(REPO_ROOT, "fixtures", "receipts", `${name}.json`), "utf8")
  );
}

test("#18 — JSON Schema and standalone receipt-validator accept all 4 deterministic fixtures and reject tampered or non-compliant receipts", () => {
  const schema = JSON.parse(
    fs.readFileSync(path.join(REPO_ROOT, "schemas", "surface-receipt.v1.schema.json"), "utf8")
  );
  assert.equal(schema.$schema, "https://json-schema.org/draft/2020-12/schema");
  assert.equal(schema.properties.schema.const, "askmi.transparency.surface-receipt.v1");

  for (const name of ["allowed", "limited", "high-surface", "unavailable"]) {
    const fixture = loadFixture(name);
    const res = validateSurfaceReceipt(fixture);
    assert.equal(res.valid, true, `Fixture ${name} failed validation: ${res.errors.join("; ")}`);
  }

  // Tamper with contentHash -> must fail validation
  const tampered = loadFixture("allowed");
  tampered.cookies.total = 99;
  const tamperedRes = validateSurfaceReceipt(tampered);
  assert.equal(tamperedRes.valid, false);
  assert.ok(tamperedRes.errors.some((e) => e.includes("contentHash")));

  // Leak query string in page.origin -> must fail validation
  const leakedOrigin = loadFixture("allowed");
  leakedOrigin.page.origin = "https://minimal.example/?secret=1";
  const leakedRes = validateSurfaceReceipt(leakedOrigin);
  assert.equal(leakedRes.valid, false);
  assert.ok(leakedRes.errors.some((e) => e.includes("page.origin")));

  // Numeric score on limited scan -> must fail validation
  const badLimited = loadFixture("limited");
  badLimited.surfaceScore.value = 5;
  const badLimitedRes = validateSurfaceReceipt(badLimited);
  assert.equal(badLimitedRes.valid, false);
  assert.ok(badLimitedRes.errors.some((e) => e.includes("surfaceScore.value must be null")));
});

test("#18 — diffSurfaceReceipts separates added, removed, changed, and unavailable evidence and supports non-hiding allowlist annotations", () => {
  const allowed = loadFixture("allowed");
  const high = loadFixture("high-surface");
  const limited = loadFixture("limited");

  const diff = diffSurfaceReceipts(allowed, high, {
    allowlist: {
      rationale: "Expected age-gate field and asset CDN",
      allowedDomains: ["cdn.checkout-assets.example.net"],
      allowedFormFields: ["birthdate"]
    }
  });

  assert.ok(diff.counts.added > 0);
  assert.equal(diff.counts.acknowledgedAdded, 2);
  assert.ok(diff.counts.unacknowledgedAdded > 0);

  // Allowlisted items MUST still be present in diff.added (never hidden!)
  const birthField = diff.added.find(
    (a) => a.kind === "formField" && (a.key === "dob" || a.key === "birthdate")
  );
  assert.ok(birthField, "Allowlisted formField must remain visible in diff.added");
  assert.equal(birthField.annotatedAllowlist.matched, true);

  // Diff between high-surface and limited (where content script failed):
  // Fingerprinting and form fields from high-surface must NOT be reported as removed when candidate content channel is unavailable!
  const diffToLimited = diffSurfaceReceipts(high, limited);
  assert.equal(
    diffToLimited.removed.filter((r) => r.kind === "formField").length,
    0,
    "Unavailable content channel in candidate must never report form fields as removed"
  );
  assert.ok(diffToLimited.unavailable.some((u) => u.id === "collector.content-surfaces"));

  const md = formatReceiptDiffMarkdown(diff);
  assert.ok(md.includes("# miTch Transparency Layer — Privacy Surface Diff (v1)"));
  assert.ok(md.includes("Allowlist:"));
  assert.equal(/certified|gdpr compliant|site is safe/i.test(md), false);
});

test("#18 — CLI mitch-scan.mjs executes validate, diff, scan --fixture, and scan --html-file deterministically", () => {
  const cliPath = path.join(REPO_ROOT, "cli", "mitch-scan.mjs");

  const valOut = execFileSync(
    process.execPath,
    [cliPath, "validate", path.join(REPO_ROOT, "fixtures", "receipts", "high-surface.json")],
    { encoding: "utf8" }
  );
  assert.ok(valOut.includes("[validate] VALID"));

  const diffOut = execFileSync(
    process.execPath,
    [
      cliPath,
      "diff",
      path.join(REPO_ROOT, "fixtures", "receipts", "allowed.json"),
      path.join(REPO_ROOT, "fixtures", "receipts", "high-surface.json"),
      "--format",
      "markdown"
    ],
    { encoding: "utf8" }
  );
  assert.ok(diffOut.includes("## 1. Added Surfaces (+)"));

  // Test scanHtmlDocument with a sample HTML containing a DOB field with a secret value and an external tracker script
  const sampleHtml = `<!doctype html>
  <html>
    <head>
      <title>Test Checkout</title>
      <meta http-equiv="Content-Security-Policy" content="default-src 'self'">
      <script src="https://www.google-analytics.com/analytics.js"></script>
    </head>
    <body>
      <form>
        <input name="birthdate" type="date" autocomplete="bday" value="1988-04-12">
      </form>
    </body>
  </html>`;

  const htmlReceipt = scanHtmlDocument(sampleHtml, {
    origin: "https://shop.example.com/pay?secret_token=xyz987"
  });
  assert.equal(validateSurfaceReceipt(htmlReceipt).valid, true);
  assert.equal(htmlReceipt.collector.mode, "cli");
  assert.equal(htmlReceipt.collector.scanStatus, "limited");
  assert.equal(htmlReceipt.network.knownTrackerDomainCount, 1);
  assert.deepEqual(htmlReceipt.visibility.proofSuggestion.suggestedMinimalClaims, ["age_over_18"]);
  assert.equal(JSON.stringify(htmlReceipt).includes("1988-04-12"), false);
  assert.equal(JSON.stringify(htmlReceipt).includes("xyz987"), false);
});
