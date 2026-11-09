#!/usr/bin/env node
/**
 * Deterministic, zero-dependency release builder & verifier for miTch Transparency Layer (#14).
 *
 * Binds:
 *   - manifest.json version & all referenced scripts/styles/icons
 *   - PRIVACY_POLICY.md & docs/index.html policy parity
 *   - build-meta.js (collectorVersion, sourceRevision, sourceTreeSha256)
 *   - release/mitch-transparency-layer-v<version>.zip (PKZIP STORE, fixed DOS timestamp, LF-normalized text)
 *   - release/release-manifest.json
 *
 * Usage:
 *   node scripts/build-release.mjs           # Generates build-meta.js, zip, and release-manifest.json
 *   node scripts/build-release.mjs --verify  # Fails with exit code 1 if any artifact is stale or mismatched
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const REPO_ROOT = path.resolve(__dirname, "..");

const GENERATED_META_FILE = "build-meta.js";
const STALE_ZIP_REL = "release/mitch-transparency-layer-v0.1.zip";
const TEXT_EXTENSIONS = new Set([".json", ".js", ".mjs", ".html", ".css", ".md", ".txt", ".svg"]);

// Precomputed IEEE 802.3 CRC-32 lookup table
const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let k = 0; k < 8; k += 1) {
      c = (c & 1) !== 0 ? (0xedb88320 ^ (c >>> 1)) >>> 0 : (c >>> 1) >>> 0;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

export function crc32(buffer) {
  let crc = 0xffffffff;
  for (let i = 0; i < buffer.length; i += 1) {
    crc = (CRC32_TABLE[(crc ^ buffer[i]) & 0xff] ^ (crc >>> 8)) >>> 0;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export function sha256HexBuffer(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function isTextPath(relPath) {
  return TEXT_EXTENSIONS.has(path.extname(relPath).toLowerCase());
}

function readNormalizedBytes(rootDir, relPath) {
  const absPath = path.join(rootDir, ...relPath.split("/"));
  if (!fs.existsSync(absPath)) {
    throw new Error(`Missing required release input file: ${relPath}`);
  }
  if (isTextPath(relPath)) {
    const rawText = fs.readFileSync(absPath, "utf8");
    const lfText = rawText.replace(/\r\n/g, "\n");
    return Buffer.from(lfText, "utf8");
  }
  return fs.readFileSync(absPath);
}

/**
 * Discover every runtime file referenced by manifest.json and popup.html, plus PRIVACY_POLICY.md.
 */
export function discoverCoreSourceFiles(rootDir = REPO_ROOT) {
  const files = new Set(["manifest.json", "PRIVACY_POLICY.md"]);
  const manifestRaw = readNormalizedBytes(rootDir, "manifest.json").toString("utf8");
  const manifest = JSON.parse(manifestRaw);

  if (manifest.background && manifest.background.service_worker) {
    files.add(manifest.background.service_worker);
  }
  if (Array.isArray(manifest.content_scripts)) {
    for (const cs of manifest.content_scripts) {
      for (const jsFile of cs.js || []) {
        files.add(jsFile);
      }
      for (const cssFile of cs.css || []) {
        files.add(cssFile);
      }
    }
  }
  if (manifest.icons && typeof manifest.icons === "object") {
    for (const iconPath of Object.values(manifest.icons)) {
      if (typeof iconPath === "string") files.add(iconPath);
    }
  }
  if (manifest.action && typeof manifest.action === "object") {
    if (manifest.action.default_icon && typeof manifest.action.default_icon === "object") {
      for (const iconPath of Object.values(manifest.action.default_icon)) {
        if (typeof iconPath === "string") files.add(iconPath);
      }
    }
    if (typeof manifest.action.default_popup === "string") {
      const popupFile = manifest.action.default_popup;
      files.add(popupFile);
      const popupHtml = readNormalizedBytes(rootDir, popupFile).toString("utf8");
      for (const match of popupHtml.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/gi)) {
        const ref = match[1].trim();
        if (ref && !/^https?:\/\//i.test(ref) && ref !== GENERATED_META_FILE) {
          files.add(ref);
        }
      }
      for (const match of popupHtml.matchAll(/<link\b[^>]*\bhref="([^"]+)"/gi)) {
        const ref = match[1].trim();
        if (ref && !/^https?:\/\//i.test(ref)) {
          files.add(ref);
        }
      }
    }
  }

  files.delete(GENERATED_META_FILE);
  return {
    manifest,
    coreFiles: Array.from(files).sort()
  };
}

/**
 * Verify that PRIVACY_POLICY.md and docs/index.html share identical section headings and core commitments.
 */
export function verifyPrivacyPolicyParity(rootDir = REPO_ROOT) {
  const mdText = readNormalizedBytes(rootDir, "PRIVACY_POLICY.md").toString("utf8");
  const htmlText = readNormalizedBytes(rootDir, "docs/index.html").toString("utf8");

  const headings = Array.from(mdText.matchAll(/^##\s+(.+)$/gm)).map((m) => m[1].trim());
  if (headings.length === 0) {
    throw new Error("PRIVACY_POLICY.md contains no section headings.");
  }
  for (const heading of headings) {
    if (!htmlText.includes(`<h2>${heading}</h2>`)) {
      throw new Error(`docs/index.html is missing privacy policy heading: <h2>${heading}</h2>`);
    }
  }

  const requiredPhrases = [
    "AskMI Proof Bridge",
    "form input attribute metadata",
    "does not sell, share, or transfer user data",
    "does not use remote code",
    "local clipboard"
  ];
  for (const phrase of requiredPhrases) {
    if (!mdText.includes(phrase)) {
      throw new Error(`PRIVACY_POLICY.md is missing required clause: "${phrase}"`);
    }
    if (!htmlText.includes(phrase)) {
      throw new Error(`docs/index.html is out of sync with PRIVACY_POLICY.md (missing "${phrase}")`);
    }
  }

  return {
    privacyPolicySha256: sha256HexBuffer(Buffer.from(mdText, "utf8")),
    docsHtmlSha256: sha256HexBuffer(Buffer.from(htmlText, "utf8")),
    headingsChecked: headings
  };
}

function renderBuildMetaJs({ collectorVersion, sourceRevision, sourceTreeSha256 }) {
  return [
    "// Auto-generated by scripts/build-release.mjs — do not edit manually.",
    "(function (root, factory) {",
    '  if (typeof module === "object" && module.exports) {',
    "    module.exports = factory();",
    "  } else {",
    "    root.MITCH_BUILD_META = factory();",
    "  }",
    '})(typeof globalThis !== "undefined" ? globalThis : this, function () {',
    '  "use strict";',
    "  return Object.freeze({",
    `    collectorVersion: ${JSON.stringify(collectorVersion)},`,
    `    sourceRevision: ${JSON.stringify(sourceRevision)},`,
    `    sourceTreeSha256: ${JSON.stringify(sourceTreeSha256)},`,
    '    ruleSetVersion: "visibility-rules-v1",',
    '    scoringRuleVersion: "surface-score-v1"',
    "  });",
    "});",
    ""
  ].join("\n");
}

/**
 * Build a deterministic PKZIP archive using STORE (method 0) and fixed DOS timestamp 1980-01-01 00:00:00.
 * Zero zlib heuristics -> 100% byte-for-byte identical across Node versions and operating systems.
 */
export function buildDeterministicZip(entries) {
  const sorted = [...entries].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  const localParts = [];
  const centralParts = [];
  let localOffset = 0;

  const dosTime = 0x0000; // 00:00:00
  const dosDate = 0x0021; // 1980-01-01
  const versionNeeded = 20;
  const versionMadeBy = 20;
  const flags = 0x0800; // UTF-8 filename flag
  const method = 0; // STORE (uncompressed)

  for (const entry of sorted) {
    const nameBytes = Buffer.from(entry.path, "utf8");
    const data = entry.data;
    const sum = crc32(data);
    const size = data.length;

    const localHeader = Buffer.alloc(30 + nameBytes.length);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(versionNeeded, 4);
    localHeader.writeUInt16LE(flags, 6);
    localHeader.writeUInt16LE(method, 8);
    localHeader.writeUInt16LE(dosTime, 10);
    localHeader.writeUInt16LE(dosDate, 12);
    localHeader.writeUInt32LE(sum, 14);
    localHeader.writeUInt32LE(size, 18);
    localHeader.writeUInt32LE(size, 22);
    localHeader.writeUInt16LE(nameBytes.length, 26);
    localHeader.writeUInt16LE(0, 28);
    nameBytes.copy(localHeader, 30);

    const centralHeader = Buffer.alloc(46 + nameBytes.length);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(versionMadeBy, 4);
    centralHeader.writeUInt16LE(versionNeeded, 6);
    centralHeader.writeUInt16LE(flags, 8);
    centralHeader.writeUInt16LE(method, 10);
    centralHeader.writeUInt16LE(dosTime, 12);
    centralHeader.writeUInt16LE(dosDate, 14);
    centralHeader.writeUInt32LE(sum, 16);
    centralHeader.writeUInt32LE(size, 20);
    centralHeader.writeUInt32LE(size, 24);
    centralHeader.writeUInt16LE(nameBytes.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(localOffset, 42);
    nameBytes.copy(centralHeader, 46);

    localParts.push(localHeader, data);
    centralParts.push(centralHeader);
    localOffset += localHeader.length + size;
  }

  const centralBuffer = Buffer.concat(centralParts);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(sorted.length, 8);
  eocd.writeUInt16LE(sorted.length, 10);
  eocd.writeUInt32LE(centralBuffer.length, 12);
  eocd.writeUInt32LE(localOffset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, centralBuffer, eocd]);
}

/**
 * Parse a PKZIP STORE archive back into entries and verify every CRC-32 checksum.
 */
export function parseZipEntries(zipBuffer) {
  if (zipBuffer.length < 22) {
    throw new Error("Invalid zip archive: buffer shorter than EOCD record.");
  }
  const eocdOffset = zipBuffer.length - 22;
  if (zipBuffer.readUInt32LE(eocdOffset) !== 0x06054b50) {
    throw new Error("Invalid zip archive: missing EOCD signature.");
  }
  const entryCount = zipBuffer.readUInt16LE(eocdOffset + 10);
  const centralSize = zipBuffer.readUInt32LE(eocdOffset + 12);
  const centralOffset = zipBuffer.readUInt32LE(eocdOffset + 16);

  if (centralOffset + centralSize !== eocdOffset) {
    throw new Error("Invalid zip archive: central directory bounds mismatch.");
  }

  const results = [];
  let ptr = centralOffset;
  for (let i = 0; i < entryCount; i += 1) {
    if (zipBuffer.readUInt32LE(ptr) !== 0x02014b50) {
      throw new Error(`Invalid central directory header signature at index ${i}.`);
    }
    const method = zipBuffer.readUInt16LE(ptr + 10);
    if (method !== 0) {
      throw new Error(`Unsupported compression method ${method} in deterministic archive.`);
    }
    const expectedCrc = zipBuffer.readUInt32LE(ptr + 16);
    const compSize = zipBuffer.readUInt32LE(ptr + 20);
    const uncompSize = zipBuffer.readUInt32LE(ptr + 24);
    const nameLen = zipBuffer.readUInt16LE(ptr + 28);
    const extraLen = zipBuffer.readUInt16LE(ptr + 30);
    const commentLen = zipBuffer.readUInt16LE(ptr + 32);
    const localHeaderOffset = zipBuffer.readUInt32LE(ptr + 42);
    const name = zipBuffer.subarray(ptr + 46, ptr + 46 + nameLen).toString("utf8");

    if (zipBuffer.readUInt32LE(localHeaderOffset) !== 0x04034b50) {
      throw new Error(`Invalid local header signature for ${name}.`);
    }
    const localNameLen = zipBuffer.readUInt16LE(localHeaderOffset + 26);
    const localExtraLen = zipBuffer.readUInt16LE(localHeaderOffset + 28);
    const dataStart = localHeaderOffset + 30 + localNameLen + localExtraLen;
    const data = zipBuffer.subarray(dataStart, dataStart + compSize);

    if (data.length !== uncompSize) {
      throw new Error(`Truncated entry data for ${name}.`);
    }
    const actualCrc = crc32(data);
    if (actualCrc !== expectedCrc) {
      throw new Error(`CRC-32 mismatch for ${name}: expected ${expectedCrc}, got ${actualCrc}.`);
    }

    results.push({
      path: name,
      bytes: data.length,
      sha256: sha256HexBuffer(data),
      data
    });
    ptr += 46 + nameLen + extraLen + commentLen;
  }

  return results;
}

export function computeReleaseArtifacts(rootDir = REPO_ROOT) {
  const { manifest, coreFiles } = discoverCoreSourceFiles(rootDir);
  const policyParity = verifyPrivacyPolicyParity(rootDir);
  const collectorVersion = manifest.version;

  const coreEntries = coreFiles.map((relPath) => {
    const data = readNormalizedBytes(rootDir, relPath);
    return {
      path: relPath,
      data,
      bytes: data.length,
      sha256: sha256HexBuffer(data)
    };
  });

  const treeManifestText = coreEntries.map((e) => `${e.path}:${e.sha256}\n`).join("");
  const sourceTreeSha256 = sha256HexBuffer(Buffer.from(treeManifestText, "utf8"));
  const sourceRevision = `v${collectorVersion}+tree.${sourceTreeSha256.slice(0, 12)}`;

  const buildMetaText = renderBuildMetaJs({
    collectorVersion,
    sourceRevision,
    sourceTreeSha256
  });
  const buildMetaBuffer = Buffer.from(buildMetaText, "utf8");
  const buildMetaEntry = {
    path: GENERATED_META_FILE,
    data: buildMetaBuffer,
    bytes: buildMetaBuffer.length,
    sha256: sha256HexBuffer(buildMetaBuffer)
  };

  const allEntries = [...coreEntries, buildMetaEntry].sort((a, b) =>
    a.path < b.path ? -1 : a.path > b.path ? 1 : 0
  );

  const zipBuffer = buildDeterministicZip(allEntries);
  const zipSha256 = sha256HexBuffer(zipBuffer);
  const zipRelPath = `release/mitch-transparency-layer-v${collectorVersion}.zip`;
  const manifestRelPath = "release/release-manifest.json";

  const releaseManifest = {
    schema: "askmi.transparency.release-manifest.v1",
    packageName: "mitch-transparency-layer",
    status: "experimental-local-only",
    manifestVersion: collectorVersion,
    sourceRevision,
    sourceTreeSha256,
    ruleSetVersion: "visibility-rules-v1",
    scoringRuleVersion: "surface-score-v1",
    privacyPolicy: {
      markdownPath: "PRIVACY_POLICY.md",
      markdownSha256: policyParity.privacyPolicySha256,
      docsHtmlPath: "docs/index.html",
      docsHtmlSha256: policyParity.docsHtmlSha256,
      parityVerified: true
    },
    archive: {
      path: zipRelPath,
      format: "pkzip-store-deterministic",
      bytes: zipBuffer.length,
      sha256: zipSha256
    },
    commands: {
      test: "node --test test/*.test.mjs",
      verifyRelease: "node scripts/build-release.mjs --verify"
    },
    packagedFiles: allEntries.map((e) => ({
      path: e.path,
      bytes: e.bytes,
      sha256: e.sha256
    }))
  };

  const releaseManifestText = `${JSON.stringify(releaseManifest, null, 2)}\n`;

  return {
    collectorVersion,
    sourceRevision,
    sourceTreeSha256,
    buildMetaText,
    zipRelPath,
    zipBuffer,
    zipSha256,
    manifestRelPath,
    releaseManifest,
    releaseManifestText
  };
}

export function writeReleaseArtifacts(rootDir = REPO_ROOT) {
  const computed = computeReleaseArtifacts(rootDir);
  const releaseDir = path.join(rootDir, "release");
  fs.mkdirSync(releaseDir, { recursive: true });

  const staleZipPath = path.join(rootDir, ...STALE_ZIP_REL.split("/"));
  if (fs.existsSync(staleZipPath)) {
    fs.unlinkSync(staleZipPath);
  }

  fs.writeFileSync(path.join(rootDir, GENERATED_META_FILE), computed.buildMetaText, "utf8");
  fs.writeFileSync(path.join(rootDir, ...computed.zipRelPath.split("/")), computed.zipBuffer);
  fs.writeFileSync(
    path.join(rootDir, ...computed.manifestRelPath.split("/")),
    computed.releaseManifestText,
    "utf8"
  );

  return computed;
}

export function verifyReleaseArtifacts(rootDir = REPO_ROOT) {
  const computed = computeReleaseArtifacts(rootDir);

  const staleZipPath = path.join(rootDir, ...STALE_ZIP_REL.split("/"));
  if (fs.existsSync(staleZipPath)) {
    throw new Error(`Stale historical package ${STALE_ZIP_REL} still exists on disk.`);
  }

  const diskMetaText = readNormalizedBytes(rootDir, GENERATED_META_FILE).toString("utf8");
  if (diskMetaText !== computed.buildMetaText) {
    throw new Error(
      `${GENERATED_META_FILE} is out of date with source tree. Run: node scripts/build-release.mjs`
    );
  }

  const zipAbsPath = path.join(rootDir, ...computed.zipRelPath.split("/"));
  if (!fs.existsSync(zipAbsPath)) {
    throw new Error(`Release zip missing at ${computed.zipRelPath}. Run: node scripts/build-release.mjs`);
  }
  const diskZipBuffer = fs.readFileSync(zipAbsPath);
  const diskZipSha256 = sha256HexBuffer(diskZipBuffer);
  if (diskZipSha256 !== computed.zipSha256) {
    throw new Error(
      `Release zip SHA-256 mismatch for ${computed.zipRelPath}: disk=${diskZipSha256}, expected=${computed.zipSha256}. Run: node scripts/build-release.mjs`
    );
  }

  // Also parse and CRC-verify every zip entry
  const parsedEntries = parseZipEntries(diskZipBuffer);
  if (parsedEntries.length !== computed.releaseManifest.packagedFiles.length) {
    throw new Error("Parsed zip entry count does not match release-manifest.json.");
  }

  const diskManifestText = readNormalizedBytes(rootDir, computed.manifestRelPath).toString("utf8");
  if (diskManifestText !== computed.releaseManifestText) {
    throw new Error(
      `${computed.manifestRelPath} does not match computed manifest. Run: node scripts/build-release.mjs`
    );
  }

  return computed;
}

const isCliEntry =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename);

if (isCliEntry) {
  const isVerify = process.argv.includes("--verify");
  try {
    if (isVerify) {
      const res = verifyReleaseArtifacts(REPO_ROOT);
      console.log(
        `[release:verify] OK — ${res.zipRelPath} (${res.sourceRevision}, zipSha256=${res.zipSha256})`
      );
    } else {
      const res = writeReleaseArtifacts(REPO_ROOT);
      console.log(
        `[release:build] Wrote ${res.zipRelPath} (${res.zipBuffer.length} bytes, ${res.sourceRevision}, zipSha256=${res.zipSha256})`
      );
    }
  } catch (err) {
    console.error(`[release] FAILED: ${err.message}`);
    process.exit(1);
  }
}
