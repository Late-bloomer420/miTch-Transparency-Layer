import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  normalizeHostname,
  isIpAddress,
  getRegistrableDomain,
  sameSite,
  sameCookieDomain,
  classifyRequestRelation
} = require("../domain-boundary.js");

test("#17 — PSL/eTLD+1 getRegistrableDomain and sameSite handle multi-part public suffixes accurately", () => {
  // UK multi-label suffixes: different registrable domains under .co.uk MUST NOT be same-site!
  assert.equal(getRegistrableDomain("shop.a.co.uk"), "a.co.uk");
  assert.equal(getRegistrableDomain("tracker.b.co.uk"), "b.co.uk");
  assert.equal(sameSite("shop.a.co.uk", "tracker.b.co.uk"), false);
  assert.equal(sameSite("shop.a.co.uk", "cdn.a.co.uk"), true);

  // Other multi-label public suffixes (.gov.uk, .com.au, .co.jp, .com.br, .co.nz)
  assert.equal(getRegistrableDomain("portal.service.gov.uk"), "service.gov.uk");
  assert.equal(sameSite("portal.service.gov.uk", "other.gov.uk"), false);
  assert.equal(getRegistrableDomain("news.Sydney.COM.AU."), "sydney.com.au");
  assert.equal(sameSite("a.sydney.com.au", "b.melbourne.com.au"), false);
  assert.equal(getRegistrableDomain("api.rakuten.co.jp"), "rakuten.co.jp");
  assert.equal(getRegistrableDomain("banco.itau.com.br"), "itau.com.br");
  assert.equal(getRegistrableDomain("media.rnz.co.nz"), "rnz.co.nz");

  // Shared hosting suffixes (github.io, vercel.app, pages.dev, cloudfront.net) isolate tenants!
  assert.equal(getRegistrableDomain("alice.github.io"), "alice.github.io");
  assert.equal(getRegistrableDomain("bob.github.io"), "bob.github.io");
  assert.equal(sameSite("alice.github.io", "bob.github.io"), false);
  assert.equal(sameSite("sub.alice.github.io", "alice.github.io"), true);
  assert.equal(sameSite("app1.vercel.app", "app2.vercel.app"), false);

  // Bare public suffixes return null and never match as sameSite
  assert.equal(getRegistrableDomain("co.uk"), null);
  assert.equal(getRegistrableDomain("github.io"), null);
  assert.equal(sameSite("co.uk", "co.uk"), false);
});

test("#17 — localhost, IPv4, IPv6, ports, and trailing dots are normalized cleanly", () => {
  assert.equal(getRegistrableDomain("http://localhost:5174/wallet"), "localhost");
  assert.equal(getRegistrableDomain("dev.localhost"), "localhost");
  assert.equal(sameSite("http://localhost:3000", "http://sub.localhost:8080"), true);

  assert.equal(isIpAddress("127.0.0.1"), true);
  assert.equal(isIpAddress("192.168.1.50"), true);
  assert.equal(isIpAddress("https://[2001:db8::1]:8443/test"), true);
  assert.equal(isIpAddress("example.com"), false);

  assert.equal(getRegistrableDomain("http://127.0.0.1:8080/api"), "127.0.0.1");
  assert.equal(sameSite("http://127.0.0.1:8080", "http://127.0.0.1:3000"), true);
  assert.equal(sameSite("127.0.0.1", "192.168.1.1"), false);

  assert.equal(normalizeHostname("https://[::1]:5174/path"), "::1");
  assert.equal(getRegistrableDomain("https://[::1]:5174/path"), "::1");
  assert.equal(sameCookieDomain(".example.co.uk", "checkout.example.co.uk"), true);
  assert.equal(sameCookieDomain(".other.co.uk", "checkout.example.co.uk"), false);
});

test("#17 — classifyRequestRelation separates first-party, third-party, missing/opaque initiators, and non-network URLs", () => {
  const firstPartyUk = classifyRequestRelation({
    requestUrl: "https://static.merchant.co.uk/app.js",
    initiator: "https://www.merchant.co.uk"
  });
  assert.equal(firstPartyUk.relation, "first-party");
  assert.equal(firstPartyUk.requestRegistrableDomain, "merchant.co.uk");

  const thirdPartyUk = classifyRequestRelation({
    requestUrl: "https://analytics.tracker.co.uk/collect",
    initiator: "https://www.merchant.co.uk"
  });
  assert.equal(thirdPartyUk.relation, "third-party");
  assert.equal(thirdPartyUk.requestRegistrableDomain, "tracker.co.uk");
  assert.equal(thirdPartyUk.contextRegistrableDomain, "merchant.co.uk");

  // Missing initiator (e.g., service worker / browser prefetch without documentUrl) -> unattributed
  const missingInit = classifyRequestRelation({
    requestUrl: "https://api.service.example/v1/ping",
    initiator: undefined
  });
  assert.equal(missingInit.relation, "unattributed");
  assert.equal(missingInit.reason, "missing-initiator");

  // Opaque ("null") initiator (e.g., sandboxed iframe) -> unattributed
  const opaqueInit = classifyRequestRelation({
    requestUrl: "https://cdn.example.net/font.woff2",
    initiator: "null",
    documentUrl: "https://host.example.com"
  });
  assert.equal(opaqueInit.relation, "unattributed");
  assert.equal(opaqueInit.reason, "opaque-initiator");

  // Non-HTTP(S) data: or chrome-extension: URL -> invalid
  const dataUrl = classifyRequestRelation({
    requestUrl: "data:image/png;base64,iVBORw0KGgo=",
    initiator: "https://www.merchant.co.uk"
  });
  assert.equal(dataUrl.relation, "invalid");
});
