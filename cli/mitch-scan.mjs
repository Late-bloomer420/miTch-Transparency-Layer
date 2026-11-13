#!/usr/bin/env node
/**
 * miTch Transparency Layer — Local Auditor & Developer CLI (#18)
 *
 * Commands:
 *   node cli/mitch-scan.mjs validate <receipt.json>
 *   node cli/mitch-scan.mjs diff <baseline.json> <candidate.json> [--allowlist <file.json>] [--format json|markdown] [--fail-on-regression]
 *   node cli/mitch-scan.mjs scan --fixture <allowed|limited|high-surface|unavailable> [--format json|markdown] [--out <file>]
 *   node cli/mitch-scan.mjs scan --html-file <page.html> [--origin <https://example.test>] [--format json|markdown] [--out <file>]
 *   node cli/mitch-scan.mjs scan --url <https://...> [--browser-bin <path>] [--out <file>]
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..");
const require = createRequire(import.meta.url);

const {
  buildSurfaceReceiptModel,
  serializeReceiptJson,
  serializeReceiptMarkdown
} = require("../surface-receipt.js");
const { evaluateFieldsForVisibilityAndProof } = require("../proof-bridge.js");
const { sameSite } = require("../domain-boundary.js");
const { validateSurfaceReceipt } = require("../receipt-validator.js");
const { diffSurfaceReceipts, formatReceiptDiffMarkdown } = require("../receipt-diff.js");
const buildMeta = require("../build-meta.js");

function parseArgs(argv) {
  const positional = [];
  const flags = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith("--")) {
        flags[key] = next;
        i += 1;
      } else {
        flags[key] = true;
      }
    } else {
      positional.push(arg);
    }
  }
  return { positional, flags };
}

function extractAttr(tagHtml, attrName) {
  const re = new RegExp(`\\b${attrName}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i");
  const m = tagHtml.match(re);
  if (!m) return null;
  return (m[1] ?? m[2] ?? m[3] ?? "").trim();
}

/**
 * Inspect static/DOM HTML metadata without reading any input .value or executing remote scripts (#18).
 */
export function scanHtmlDocument(htmlText, options = {}) {
  const originUrl = options.origin || "https://local-audit.example/";
  let parsedOrigin;
  try {
    parsedOrigin = new URL(originUrl);
  } catch {
    parsedOrigin = new URL("https://local-audit.example/");
  }

  const titleMatch = htmlText.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? titleMatch[1].replace(/\s+/g, " ").trim() : "HTML Audit Target";

  // Extract <input>, <select>, <textarea> attribute metadata ONLY (never value!)
  const fieldDescriptors = [];
  for (const match of htmlText.matchAll(/<(input|select|textarea)\b[^>]*>/gi)) {
    const tag = match[0];
    fieldDescriptors.push({
      name: extractAttr(tag, "name"),
      id: extractAttr(tag, "id"),
      autocomplete: extractAttr(tag, "autocomplete"),
      placeholder: extractAttr(tag, "placeholder"),
      ariaLabel: extractAttr(tag, "aria-label"),
      type: extractAttr(tag, "type")
    });
  }

  // Extract <meta http-equiv="Content-Security-Policy">
  let hasMetaCsp = false;
  let metaBlocksEval = false;
  for (const match of htmlText.matchAll(/<meta\b[^>]*>/gi)) {
    const tag = match[0];
    const httpEquiv = extractAttr(tag, "http-equiv");
    if (httpEquiv && /^content-security-policy$/i.test(httpEquiv)) {
      const content = extractAttr(tag, "content") || "";
      if (content) {
        hasMetaCsp = true;
        metaBlocksEval = !/'unsafe-eval'/i.test(content);
      }
    }
  }

  // Extract external resource references (<script src>, <img src>, <iframe src>, <link href>)
  const domainCounts = {};
  let thirdPartyRequestCount = 0;
  for (const match of htmlText.matchAll(/<(?:script|img|iframe|link)\b[^>]*>/gi)) {
    const tag = match[0];
    const ref = extractAttr(tag, "src") || extractAttr(tag, "href");
    if (!ref) continue;
    try {
      const resolved = new URL(ref, parsedOrigin.href);
      if (/^https?:$/i.test(resolved.protocol)) {
        const host = resolved.hostname.toLowerCase();
        if (host && !sameSite(host, parsedOrigin.hostname)) {
          thirdPartyRequestCount += 1;
          domainCounts[host] = (domainCounts[host] || 0) + 1;
        }
      }
    } catch {
      // Ignore malformed URLs
    }
  }

  const visibilityLayer = evaluateFieldsForVisibilityAndProof(fieldDescriptors);

  // Note: static HTML scan marks cookies, runtime permissions, and live MAIN-world calls as unavailable (limited scan)
  return buildSurfaceReceiptModel({
    capturedAt: options.capturedAt,
    receiptId: options.receiptId,
    collectorVersion: buildMeta.collectorVersion,
    collectorRevision: buildMeta.sourceRevision,
    mode: "cli",
    collectionMode: "on-demand",
    url: parsedOrigin.href,
    title,
    useOfflineTosdr: Boolean(options.useOfflineTosdr),
    cookies: { available: false, reason: "cli-static-html-no-cookie-jar" },
    content: {
      available: true,
      storage: { localStorage: "Unavailable", sessionStorage: "Unavailable" },
      fingerprinting: {
        canvas: false,
        webgl: false,
        audio: false,
        webrtc: false,
        evalAttempt: false
      },
      csp: {
        hasMetaCsp,
        metaBlocksEval,
        evalBlockedCount: 0,
        totalViolationCount: 0,
        violatedDirectives: []
      },
      visibilityLayer,
      screen: "CLI Headless Context",
      language: "en-US",
      timezone: "UTC",
      userAgent: "mitch-scan-cli/0.3.0"
    },
    network: {
      available: true,
      thirdPartyRequestCount,
      domainCounts
    },
    permissions: { available: false },
    limitations: [
      "CLI HTML inspection evaluates DOM field attributes, CSP meta tags, and static external resource URLs without executing remote scripts or reading cookies."
    ]
  });
}

function runHeadlessDomDump(targetUrl, browserBin) {
  const candidates = [
    browserBin,
    process.env.MITCH_BROWSER_BIN,
    "chromium",
    "chromium-browser",
    "google-chrome",
    "msedge"
  ].filter(Boolean);

  let foundBin = null;
  for (const bin of candidates) {
    try {
      execFileSync(bin, ["--version"], { stdio: "ignore", timeout: 4000 });
      foundBin = bin;
      break;
    } catch {
      // Try next candidate
    }
  }

  if (!foundBin) {
    throw new Error(
      "No headless Chromium/Edge binary found for live --url scan. Use --fixture or --html-file, or pass --browser-bin <path>."
    );
  }

  const tmpProfile = fs.mkdtempSync(path.join(os.tmpdir(), "mitch-clean-profile-"));
  try {
    const dumpedHtml = execFileSync(
      foundBin,
      [
        "--headless",
        "--disable-gpu",
        "--no-first-run",
        "--no-default-browser-check",
        "--incognito",
        `--user-data-dir=${tmpProfile}`,
        "--dump-dom",
        targetUrl
      ],
      { encoding: "utf8", timeout: 20000, maxBuffer: 10 * 1024 * 1024 }
    );
    return scanHtmlDocument(dumpedHtml, { origin: targetUrl });
  } finally {
    try {
      fs.rmSync(tmpProfile, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  }
}

function writeOrPrint(outputText, outPath) {
  if (outPath) {
    const abs = path.resolve(outPath);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, outputText, "utf8");
    console.log(`[mitch-scan] Wrote ${abs}`);
  } else {
    process.stdout.write(outputText.endsWith("\n") ? outputText : `${outputText}\n`);
  }
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename);
if (isCli) {
  const { positional, flags } = parseArgs(process.argv.slice(2));
  const cmd = positional[0];

  try {
    if (cmd === "validate") {
      const target = positional[1];
      if (!target) throw new Error("Usage: mitch-scan.mjs validate <receipt.json>");
      const raw = JSON.parse(fs.readFileSync(path.resolve(target), "utf8"));
      const res = validateSurfaceReceipt(raw);
      if (!res.valid) {
        console.error(`[validate] INVALID (${target}):\n  - ${res.errors.join("\n  - ")}`);
        process.exit(1);
      }
      console.log(`[validate] VALID — ${target} (${raw.receiptId}, status=${raw.collector.scanStatus})`);
      process.exit(0);
    }

    if (cmd === "diff") {
      const baseFile = positional[1];
      const candFile = positional[2];
      if (!baseFile || !candFile) {
        throw new Error("Usage: mitch-scan.mjs diff <baseline.json> <candidate.json> [--allowlist <file.json>] [--format json|markdown] [--fail-on-regression]");
      }
      const baseline = JSON.parse(fs.readFileSync(path.resolve(baseFile), "utf8"));
      const candidate = JSON.parse(fs.readFileSync(path.resolve(candFile), "utf8"));
      const allowlist = flags.allowlist
        ? JSON.parse(fs.readFileSync(path.resolve(flags.allowlist), "utf8"))
        : null;

      const diff = diffSurfaceReceipts(baseline, candidate, { allowlist });
      const fmt = flags.format === "markdown" ? "markdown" : "json";
      const outText =
        fmt === "markdown" ? formatReceiptDiffMarkdown(diff) : JSON.stringify(diff, null, 2);
      writeOrPrint(outText, flags.out);

      if (flags["fail-on-regression"] && diff.hasUnacknowledgedAdditions) {
        console.error(
          `[diff] Unacknowledged privacy-surface additions detected: ${diff.counts.unacknowledgedAdded}`
        );
        process.exit(2);
      }
      process.exit(0);
    }

    if (cmd === "analyze-html") {
      const htmlPath = positional[1] || flags["html-file"];
      if (!htmlPath) {
        throw new Error("Usage: mitch-scan.mjs analyze-html <file.html> [--origin <https://...>] [--with-tosdr] [--format json|markdown] [--out <file>]");
      }
      const htmlText = fs.readFileSync(path.resolve(htmlPath), "utf8");
      const receipt = scanHtmlDocument(htmlText, {
        origin: flags.origin,
        useOfflineTosdr: Boolean(flags["with-tosdr"])
      });
      const check = validateSurfaceReceipt(receipt);
      if (!check.valid) {
        throw new Error(`Generated receipt failed validation: ${check.errors.join("; ")}`);
      }
      const fmt = flags.format === "markdown" ? "markdown" : "json";
      const outText =
        fmt === "markdown" ? serializeReceiptMarkdown(receipt) : serializeReceiptJson(receipt);
      writeOrPrint(outText, flags.out);
      process.exit(0);
    }

    if (cmd === "inspect") {
      const target = positional[1];
      if (!target) throw new Error("Usage: mitch-scan.mjs inspect <receipt.json>");
      const raw = JSON.parse(fs.readFileSync(path.resolve(target), "utf8"));
      const check = validateSurfaceReceipt(raw);
      if (!check.valid) {
        throw new Error(`Invalid receipt (${target}): ${check.errors.join("; ")}`);
      }
      writeOrPrint(serializeReceiptMarkdown(raw), flags.out);
      process.exit(0);
    }

    if (cmd === "scan") {
      let receipt;
      if (flags.fixture) {
        const fixturePath = path.join(REPO_ROOT, "fixtures", "receipts", `${flags.fixture}.json`);
        if (!fs.existsSync(fixturePath)) {
          throw new Error(`Unknown fixture "${flags.fixture}". Available: allowed, limited, high-surface, unavailable.`);
        }
        receipt = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
      } else if (flags["html-file"]) {
        const htmlText = fs.readFileSync(path.resolve(flags["html-file"]), "utf8");
        receipt = scanHtmlDocument(htmlText, {
          origin: flags.origin,
          useOfflineTosdr: Boolean(flags["with-tosdr"])
        });
      } else if (flags.url) {
        receipt = runHeadlessDomDump(flags.url, flags["browser-bin"]);
      } else {
        throw new Error("Usage: mitch-scan.mjs scan (--fixture <name> | --html-file <path> | --url <https://...>)");
      }

      const check = validateSurfaceReceipt(receipt);
      if (!check.valid) {
        throw new Error(`Generated receipt failed validation: ${check.errors.join("; ")}`);
      }

      const fmt = flags.format === "markdown" ? "markdown" : "json";
      const outText =
        fmt === "markdown" ? serializeReceiptMarkdown(receipt) : serializeReceiptJson(receipt);
      writeOrPrint(outText, flags.out);
      process.exit(0);
    }

    throw new Error("Unknown command. Supported commands: validate, inspect, diff, scan, analyze-html");
  } catch (err) {
    console.error(`[mitch-scan] ERROR: ${err.message}`);
    process.exit(1);
  }
}
