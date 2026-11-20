# RC decision drafts

**Status: Proposed, not accepted.** Each decision requires evidence, alternatives, consequences, owner/reviewer and a linked PR before adoption. Do not infer implementation approval from a proposal.

## ADR-01 — Domain boundary engine (#33)

**Context:** A hand-maintained subset misses public suffix entries and can conflate tenants. Options: A) retain and manually update subset; B) bundle a pinned maintained PSL implementation such as tldts; C) generate a complete offline PSL implementation. **Leading hypothesis:** B, conditional on private-suffix semantics, wildcard and exception fixtures, IP/localhost/IDN compatibility, bundled size, license notices, maintenance and privacy review. **Consequences:** dependency and update duty; changes can alter existing receipt counts. **Decision:** pending comparison and tests. **Rollback:** retain old adapter and fixture baselines until migration is validated.

## ADR-02 — Browser test harness (#28)

**Context:** Node tests cannot establish extension runtime behavior. Options: Playwright with isolated persistent bundled Chromium, another maintained extension harness, or manual-only checks. **Leading hypothesis:** evaluate Playwright, supplemented by documented manual accessibility work. **Decision:** pending successful loading, controlled network tests, reproducible CI feasibility and maintenance/license review. Never use a personal browser profile.

## ADR-03 — Permissions and local operation (#29)

**Context:** continuous early observation needs broad host access; a collection-mode toggle does not revoke permissions. Options: current broad permission with explicit explanation; optional per-site permissions with reload and reduced early coverage; separate modes/builds. **Decision:** pending browser behavior, security/privacy review and UX testing. State limitations and tradeoffs; CSP applies in its documented contexts, not to all website traffic.

## ADR-04 — Evidence, rules and data (#34)

**Context:** classifications, scores and third-party datasets are fallible. Options: curated rules, maintained third-party data with compatible rights, or no classification for unsupported domains. **Decision:** pending license review, false-positive checks, versioning/update plan, and independent evidence of what each signal means. Unknown stays unknown; GPC is a preference signal, not evidence of legal compliance.

## ADR-05 — Ecosystem and broader vision (#31)

**Context:** wallet visibility, data imports, transaction audit and collective signals address different problems and data. Options: independent products with documented vocabulary; explicit user-initiated, versioned advisory integration; broader shared service. **Decision:** pending owner review, threat model, user needs and separate privacy designs. Current boundary: no automatic receipt sharing, no wallet dependency, no credential or trust decisions based on observation. Exploration is not a commitment to adopt proposals.

## ADR-06 — Versioning and release (#32)

**Context:** manifest/package say 0.3.0 while programme labels describe later features. Options: new prerelease version tied to frozen revision or continue experimental local build without public prerelease. **Decision:** pending release gates, compatibility, clean install/upgrade evidence and maintainer review. Record exact source, artifact hash, notices and rollback plan.
