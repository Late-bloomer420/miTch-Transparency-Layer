# Transparency Layer: scope and experimental RC roadmap

**Status:** Draft for review · **Baseline:** main `28b0d53fafe1564abb7e5ec39085e588fd76863b` · **Date:** 2026-11-20

## Goal and scope

A reproducible, clearly labelled experimental release candidate that explains browser-visible surfaces locally, with evidence of privacy, reliability and usability. Target a go/no-go on 16 December 2026, with year-end buffer; the date is not a readiness guarantee. A green test suite is necessary but not a certification or a substitute for browser and user evidence.

Three audiences: individuals wanting understandable choices, developers examining changes, and reviewers inspecting bounded technical evidence. Observed, declared, potential, inferred, unavailable and unknown information must remain distinguishable. Extension results are advisory: they never determine wallet authorization, issuer trust, fraud, compliance or disclosure. No automatic receipt centralization or typed value collection.

## Broader vision and ownership

| Area | Evidence and status | Boundary and next decision |
|---|---|---|
| Browser extension and receipt | [Ecosystem contract](ECOSYSTEM_ROLE_AND_BOUNDARIES.md), [programme #20](https://github.com/Late-bloomer420/miTch-Transparency-Layer/issues/20): repository reports G0–G4 implemented with deterministic evidence; still experimental. | Real-browser and independent usability evidence remain open. |
| Wallet pre-login visibility | [miTch #220](https://github.com/Late-bloomer420/miTch/issues/220), [design](https://github.com/Late-bloomer420/miTch/blob/master/docs/superpowers/specs/2026-10-27-pre-login-visibility-panel-design.md): proposed wallet panel. | On-device, dismissible, no decision input, no extension dependency or history import. |
| Transaction transparency | [miTch STATE](https://github.com/Late-bloomer420/miTch/blob/master/STATE.md) describes data-flow, claim disclosure and wallet audit views. | Wallet-owned transaction records are a distinct data flow; do not equate them with extension receipts. Verify current code and privacy boundaries before integration. |
| Personal privacy profile and import | [miTch vision ideas](https://github.com/Late-bloomer420/miTch/blob/master/docs/vision/IDEAS.md): cross-platform import and dashboard are exploratory, with unanswered product and maintenance questions. | Not an extension requirement or a claim of existing capability. Sensitive imports, storage, ownership, permissions and UX require separate design and privacy review. |
| Shadow profiles | [Hard limit and partial lever](https://github.com/Late-bloomer420/miTch/blob/master/docs/vision/SHADOW_PROFILES.md): inference and remote profiling can be invisible to the user. | Never claim complete knowledge of server-side profiles; access/export may reveal only what a provider supplies. |
| Collective signals / scoring | [Vision ideas](https://github.com/Late-bloomer420/miTch/blob/master/docs/vision/IDEAS.md) contain proposals, not accepted extension policy. | Public verifier scores, identifiers and centralized reporting conflict with the present non-authority/local-first boundary unless separately designed and approved. |
| Issuer and control | [Integration proposals](ECOSYSTEM_INTEGRATION_PROPOSALS.md): VeriCred issues; AskMI Control observes engineering posture. | Neither receives browsing receipts automatically; no extension-based credential or issuer verdict. |

See #31 for open questions, user research, and cross-repository ownership. Retain current boundaries until explicitly changed by a reviewed decision.

## Measurable gates and order

All gates are **open**, even where prior implementation exists. Record exact revision, environment, test results, limitations and linked PR before passing.

1. **Browser baseline — #28:** isolated profile; real extension, CSP, both modes, dynamic pages and unavailable channels; record observed vs expected.
2. **Privacy and permission truth — #29:** synthetic data, extension/page network channels, no-value and redaction checks; permission ADR and documented unresolved issues.
3. **Domain accuracy — #33:** compare maintained PSL alternatives using public/private suffix, wildcard/exception, IDN and special-host fixtures; ADR and offline/license/update plan.
4. **Evidence and standards — #34:** verify claims, GPC semantics, score boundaries, dataset licensing and provenance; misleading/legal conclusions fail the gate.
5. **Comprehension and access — #30:** DE/EN keyboard and screen reader evidence and at least three representative user task observations; unresolved critical barriers block.
6. **Release — #32:** frozen revision, complete required checks, clean-profile installation, reproducible archive and hash, version/notice/limitations and documented go/no-go.

Issues depend on #28 where actual browser evidence is needed. #31 runs as discovery alongside gates, not as an unbounded RC feature commitment. These are planning criteria, subject to review and feasibility.

## Traceability and workflow

Suggested statuses for a future GitHub Project: **Todo** = scoped but unstarted; **In progress** = active branch/PR or ongoing evidenced work; **Done** = merged and acceptance evidence reviewed. A closed issue or merged PR alone does not prove RC readiness. Use issue references in branch names and PR descriptions; use `Refs #n` until all gates are satisfied, and `Closes #n` only when they are. Link exact commits, checks and merge PRs. Proposed branches are labels, not proof a branch or commit exists.

Existing verified historical trace:
- [#23](https://github.com/Late-bloomer420/miTch-Transparency-Layer/pull/23), branch `feat/p0-surface-receipt-v1-and-sanitization`, merge [ed1cf51](https://github.com/Late-bloomer420/miTch-Transparency-Layer/commit/ed1cf5182cad43a35aa47cd182c4795602b36dd0): receipt model.
- [#24](https://github.com/Late-bloomer420/miTch-Transparency-Layer/pull/24), branch `feat/p0-scan-provenance-ci-and-release`, merge [c7946aa](https://github.com/Late-bloomer420/miTch-Transparency-Layer/commit/c7946aae61709f28fdefeaa0b310d621e6cbca0e): provenance and release checks.
- [#25](https://github.com/Late-bloomer420/miTch-Transparency-Layer/pull/25), branch `feat/v04-gates-g1-to-g4`, merge [d906832](https://github.com/Late-bloomer420/miTch-Transparency-Layer/commit/d9068323bf87ba5df3bb56e0b6cdfd3049bf3383): observation, UX and contracts.
- [#26](https://github.com/Late-bloomer420/miTch-Transparency-Layer/pull/26), branch `feat/v05-standards-and-privacy-layer-alignment`, merge [b3d5bc4](https://github.com/Late-bloomer420/miTch-Transparency-Layer/commit/b3d5bc468a9fe848f833ed95b0ad27a775d0455b): standards work.
- [#27](https://github.com/Late-bloomer420/miTch-Transparency-Layer/pull/27), branch `feat/v0.6-blind-convener-and-aqdr`, merge [28b0d53](https://github.com/Late-bloomer420/miTch-Transparency-Layer/commit/28b0d53fafe1564abb7e5ec39085e588fd76863b): offline rules and additional probes.

Historical branch names are those recorded by PRs; the branches may have been deleted. [Decision drafts](RC_DECISION_DRAFTS.md) and [work-item template](RC_WORK_ITEM_TEMPLATE.md) define the next reviewable artifacts.
