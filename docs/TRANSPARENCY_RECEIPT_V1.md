# Transparency Surface Receipt v1

**Status:** Draft contract for implementation and review  
**Schema identifier:** `askmi.transparency.surface-receipt.v1`  
**Tracker:** [Issue #15](https://github.com/Late-bloomer420/miTch-Transparency-Layer/issues/15) and [Issue #18](https://github.com/Late-bloomer420/miTch-Transparency-Layer/issues/18)

## Purpose

A Surface Receipt is a user-triggered, local snapshot of what the collector observed, what the browser/page could expose, and what remains unknown.

It is designed for:

- users saving or comparing a page's visible surface;
- developers detecting surface regressions;
- privacy/security reviewers examining bounded technical evidence; and
- AskMI ecosystem compatibility checks.

It is not proof of legal compliance, malicious behavior, server-side processing or site safety.

## Evidence states

Every report item belongs to exactly one state:

| State | Meaning |
|---|---|
| `observed` | The collector recorded a defined event or browser-visible state during the stated observation window |
| `potential` | The information/capability is normally exposed or available, but specific use was not observed |
| `unknown` | The collector cannot establish the fact from its current boundary |
| `unavailable` | The collector attempted the check but the page/browser/permission/runtime prevented a reliable result |

An unavailable item must not be converted to `false`, `notDetected` or a clean result.

## Proposed normalized structure

```json
{
  "schema": "askmi.transparency.surface-receipt.v1",
  "receiptId": "locally-generated-random-id",
  "capturedAt": "2026-10-27T14:00:00.000Z",
  "collector": {
    "name": "miTch Transparency Layer",
    "version": "0.3.0",
    "revision": "exact-source-revision-if-packaged",
    "ruleSetVersion": "visibility-rules-v1",
    "mode": "extension",
    "scanStatus": "complete",
    "observationWindowMs": 5000,
    "limitations": []
  },
  "page": {
    "origin": "https://example.test",
    "domain": "example.test",
    "protocol": "HTTPS",
    "title": "Example",
    "urlIncluded": false
  },
  "surfaceScore": {
    "value": 42,
    "category": "Moderate Surface",
    "semantics": "informational-surface-summary",
    "components": {
      "cookies": 4,
      "thirdPartyRequests": 15,
      "knownTrackerDomains": 8,
      "fingerprintingCalls": 10,
      "grantedPermissions": 0,
      "promptPermissions": 2
    }
  },
  "network": {
    "thirdPartyRequestCount": 5,
    "uniqueThirdPartyDomainCount": 2,
    "knownTrackerDomainCount": 1,
    "domains": [
      {
        "domain": "analytics.example",
        "classification": "Analytics Tracker",
        "classificationSource": "local-rule",
        "requestCount": 4
      },
      {
        "domain": "cdn.example",
        "classification": "External Resource / CDN",
        "classificationSource": "local-rule",
        "requestCount": 1
      }
    ]
  },
  "report": {
    "observed": [
      {
        "id": "fingerprinting.canvas.readout",
        "summary": "Canvas readout call observed",
        "source": "main-world-observer",
        "confidence": "high"
      }
    ],
    "potential": [
      {
        "id": "browser.user-agent",
        "summary": "Browser version may be visible through the user agent",
        "source": "browser-context",
        "confidence": "high"
      }
    ],
    "unknown": [
      {
        "id": "server.retention",
        "summary": "Server-side retention cannot be determined by this collector",
        "source": "boundary-statement",
        "confidence": "not-applicable"
      }
    ],
    "unavailable": []
  },
  "visibility": {
    "highestLayer": "GRUNDVERSORGUNG",
    "fieldMetadataOnly": true,
    "findings": [
      {
        "id": "form.birthdate",
        "evidenceState": "observed",
        "summary": "A DOB-like input field was observed",
        "layer": "GRUNDVERSORGUNG",
        "purposeKnown": false,
        "possibleMinimisation": {
          "claimContractVersion": "1.0.0",
          "suggestedClaims": ["age_over_18"],
          "advisoryOnly": true
        }
      }
    ]
  },
  "permissions": [],
  "fingerprinting": [],
  "csp": {},
  "integrity": {
    "normalizationVersion": "1",
    "contentHashAlgorithm": "sha-256",
    "contentHash": "optional-hash-over-canonical-receipt-without-this-field",
    "signature": null
  }
}
```

The example is a contract proposal, not evidence that these fields are already implemented.

## Required fields

A v1 implementation must include:

- schema identifier;
- capture time;
- collector and rule-set versions;
- collection mode;
- explicit scan status;
- page origin or a documented redaction;
- observation coverage/limitations;
- separated request, unique-domain and tracker-domain counts;
- all evidence-state collections;
- informational score semantics;
- field-metadata-only indicator; and
- an integrity/normalization version.

## Scan status

Allowed initial values:

| Value | Meaning |
|---|---|
| `complete` | All checks required by the declared collector profile completed |
| `limited` | Some checks completed; limitations list is non-empty |
| `unsupported` | The page/browser context is outside supported collection |
| `preview` | Standalone/mock/preview data, not an extension observation |
| `error` | Collection failed without reliable partial evidence |

`complete` does not mean server-side completeness or legal compliance.

## Privacy and minimisation rules

Receipts must not contain:

- entered form values;
- passwords, tokens, credentials or presentation payloads;
- cookie values;
- localStorage/sessionStorage contents;
- full browsing history;
- a stable device identifier;
- raw IP address;
- automatically attached identity;
- wallet credentials or proof results; or
- remote server assumptions represented as observed facts.

The page URL should default to origin/domain only. Query and fragment components can contain personal or secret values and require explicit redaction.

## Score rules

- Call it `Surface Score`.
- Include the component contributions and scoring-rule version.
- Treat unavailable inputs as unavailable, not zero.
- Do not use it for credential, trust, fraud, access, compliance or legal decisions.
- A low score never asserts safety.
- Rule changes require versioning and make cross-version comparisons explicit.

## Serialization rules

JSON and Markdown must be generated from the same normalized report model used by the UI.

Both formats must preserve:

- scan status and limitations;
- observed, potential, unknown and unavailable sections;
- request and domain counts;
- collector/rule versions;
- score semantics/components; and
- proof-suggestion advisory status.

## Integrity

A content hash can detect accidental changes after export. It does not establish who performed the scan or whether the observed page was authentic.

Stable signing identities are deferred because they can create correlation. If signing is added later, its privacy/linkability analysis and user-controlled key lifecycle must be documented first.

## Compatibility

- Readers must reject unsupported major versions explicitly.
- Additive optional fields can remain compatible within v1.
- Meaning changes require a new field or schema version.
- v0.2 exports are legacy inputs; they must not be silently relabelled as v1.
- The Proof Suggestion contract remains separate and is referenced by version.

## Implementation gates

1. Extract a pure normalized report-model builder.
2. Generate UI, JSON and Markdown from that model.
3. Add JSON Schema and deterministic fixtures.
4. Add round-trip and unavailable-scan tests.
5. Bind release artifacts to exact source/test evidence.
