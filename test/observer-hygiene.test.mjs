import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { installPageObserver, OBSERVER_EVASION_CAVEAT } = require("../page-observer.js");
const { initContentCollector, COLLECTION_MODES } = require("../content.js");

function createMockWindowAndDom() {
  const captureListeners = new Map();
  const bubbleListeners = new Map();
  const docAttributes = new Map();
  let queryFields = [];
  let mutationCallback = null;

  class MockMutationObserver {
    constructor(cb) {
      mutationCallback = cb;
    }
    observe() {}
    disconnect() {}
  }

  const doc = {
    readyState: "complete",
    documentElement: {
      setAttribute(k, v) {
        docAttributes.set(k, String(v));
      },
      getAttribute(k) {
        return docAttributes.has(k) ? docAttributes.get(k) : null;
      }
    },
    addEventListener() {},
    querySelector() {
      return null;
    },
    querySelectorAll() {
      return queryFields;
    }
  };

  function Canvas2D() {}
  Canvas2D.prototype.getImageData = function getImageData(x, y, w, h) {
    if (w < 0) throw new RangeError("Negative width");
    return { width: w, height: h, data: [1, 2, 3, 4] };
  };

  function HTMLCanvas() {}
  HTMLCanvas.prototype.toDataURL = function toDataURL(type = "image/png") {
    return `data:${type};base64,AAAA`;
  };
  HTMLCanvas.prototype.toBlob = function toBlob(cb) {
    if (typeof cb === "function") cb({ size: 4 });
  };

  function WebGLCtx() {}
  WebGLCtx.prototype.getParameter = function getParameter(pname) {
    if (pname === 37445) return "MockVendor";
    if (pname === 37446) return "MockRenderer";
    return "OtherParam";
  };
  WebGLCtx.prototype.readPixels = function readPixels() {
    return true;
  };

  function AudioCtx() {}
  AudioCtx.prototype.createOscillator = function createOscillator() {
    return { type: "sine" };
  };

  function PeerConn(config) {
    if (!(this instanceof PeerConn)) {
      throw new TypeError("Failed to construct 'RTCPeerConnection': Please use the 'new' operator");
    }
    this.config = config || {};
  }

  const win = {
    Function,
    HTMLCanvasElement: HTMLCanvas,
    CanvasRenderingContext2D: Canvas2D,
    WebGLRenderingContext: WebGLCtx,
    AudioContext: AudioCtx,
    RTCPeerConnection: PeerConn,
    MutationObserver: MockMutationObserver,
    location: { hostname: "shop.example.co.uk" },
    navigator: { language: "en-GB", userAgent: "Mozilla/5.0 Test" },
    screen: { width: 1920, height: 1080 },
    localStorage: { length: 1 },
    sessionStorage: { length: 0 },
    performance: {
      getEntriesByType() {
        return [
          { name: "https://cdn.example.co.uk/bundle.js" }, // Same registrable domain (.co.uk) -> first-party!
          { name: "https://analytics.other.co.uk/pixel.gif" } // Different .co.uk -> third-party!
        ];
      }
    },
    addEventListener(type, fn, useCapture) {
      const map = useCapture ? captureListeners : bubbleListeners;
      if (!map.has(type)) map.set(type, []);
      map.get(type).push(fn);
    },
    removeEventListener(type, fn, useCapture) {
      const map = useCapture ? captureListeners : bubbleListeners;
      if (!map.has(type)) return;
      map.set(
        type,
        map.get(type).filter((item) => item !== fn)
      );
    },
    dispatchEvent(evt) {
      const list = bubbleListeners.get(evt.type) || [];
      for (const fn of [...list]) fn(evt);
    },
    postMessage(data, targetOrigin, transfer) {
      let stopped = false;
      const evt = {
        type: "message",
        source: win,
        data,
        ports: transfer || [],
        stopImmediatePropagation() {
          stopped = true;
        }
      };
      const cap = captureListeners.get("message") || [];
      for (const fn of [...cap]) {
        fn(evt);
        if (stopped) return;
      }
      const bub = bubbleListeners.get("message") || [];
      for (const fn of [...bub]) {
        fn(evt);
        if (stopped) return;
      }
    }
  };

  return {
    win,
    doc,
    docAttributes,
    setFields(fields) {
      queryFields = fields.map((attrs) => ({
        getAttribute(name) {
          return Object.prototype.hasOwnProperty.call(attrs, name) ? attrs[name] : null;
        }
      }));
    },
    triggerMutations(mutations) {
      if (mutationCallback) mutationCallback(mutations);
    }
  };
}

test("#22 — private MessageChannel handshake stops propagation from page scripts, writes zero DOM attributes, and resists page forgery", async () => {
  const env = createMockWindowAndDom();
  let pageSawHandshake = false;
  env.win.addEventListener(
    "message",
    () => {
      pageSawHandshake = true;
    },
    false
  );

  // 1. Initialize ISOLATED content collector first (matches manifest.json order)
  const collector = initContentCollector(env.win, env.doc, null, {
    mutationThrottleMs: 20,
    pushDebounceMs: 10
  });

  // 2. Install MAIN-world page observer
  const obs = installPageObserver(env.win);
  assert.equal(obs.installed, true);
  assert.equal(obs.evasionCaveat, OBSERVER_EVASION_CAVEAT);
  assert.equal(pageSawHandshake, false, "Page bubble listener must never see private channel handshake");

  // 3. Hostile page attempts to forge old DOM attributes & CustomEvents
  env.doc.documentElement.setAttribute("data-mitch-fp-canvas", "1");
  env.doc.documentElement.setAttribute("data-mitch-fp-webgl", "1");
  env.win.dispatchEvent({
    type: "mitch:surface-observed",
    detail: { surface: "canvas" }
  });
  env.win.postMessage({ type: "MITCH_SURFACE_OBSERVED", surface: "audio" }, "*");

  const afterForgery = collector.collectAllSurfaces();
  assert.deepEqual(afterForgery.fingerprinting, {
    canvas: false,
    webgl: false,
    audio: false,
    webrtc: false,
    evalAttempt: false
  });

  // 4. Real calls to wrapped APIs report over the private MessagePort without writing DOM attributes
  env.docAttributes.clear();
  const canvas = new env.win.HTMLCanvasElement();
  assert.equal(canvas.toDataURL("image/jpeg"), "data:image/jpeg;base64,AAAA");

  const gl = new env.win.WebGLRenderingContext();
  assert.equal(gl.getParameter(9999), "OtherParam"); // Non-sensitive parameter does NOT trigger webgl flag
  assert.equal(gl.getParameter(37446), "MockRenderer"); // UNMASKED_RENDERER_WEBGL triggers webgl flag

  const peer = new env.win.RTCPeerConnection({ iceServers: [] });
  assert.equal(peer instanceof env.win.RTCPeerConnection, true);

  // Wait a tick for MessageChannel delivery
  await new Promise((r) => setTimeout(r, 30));

  assert.equal(env.docAttributes.size, 0, "Observer must never write attributes to documentElement");
  const afterRealCalls = collector.collectAllSurfaces();
  assert.equal(afterRealCalls.fingerprinting.canvas, true);
  assert.equal(afterRealCalls.fingerprinting.webgl, true);
  assert.equal(afterRealCalls.fingerprinting.audio, false);
  assert.equal(afterRealCalls.fingerprinting.webrtc, true);

  // Also verify PSL .co.uk resource classification in content collector
  assert.equal(afterRealCalls.requests.thirdPartyRequestCount, 1);
  assert.deepEqual(afterRealCalls.requests.thirdPartyDomains, ["analytics.other.co.uk"]);

  collector.disconnect();
});

test("#22 & #17 — wrapped MAIN-world APIs preserve Function.prototype.toString, name, length, descriptors, instanceof, and thrown exceptions", () => {
  const env = createMockWindowAndDom();
  const origToDataURLSource = Function.prototype.toString.call(
    env.win.HTMLCanvasElement.prototype.toDataURL
  );
  const origRTCPeerSource = Function.prototype.toString.call(env.win.RTCPeerConnection);
  const origToStringSource = Function.prototype.toString.call(Function.prototype.toString);
  const origDesc = Object.getOwnPropertyDescriptor(
    env.win.HTMLCanvasElement.prototype,
    "toDataURL"
  );

  installPageObserver(env.win);

  const wrappedToDataURL = env.win.HTMLCanvasElement.prototype.toDataURL;
  const wrappedRTC = env.win.RTCPeerConnection;
  const wrappedToString = env.win.Function.prototype.toString;
  const newDesc = Object.getOwnPropertyDescriptor(
    env.win.HTMLCanvasElement.prototype,
    "toDataURL"
  );

  assert.equal(wrappedToDataURL.name, "toDataURL");
  assert.equal(wrappedToDataURL.length, origDesc.value.length);
  assert.equal(newDesc.enumerable, origDesc.enumerable);
  assert.equal(newDesc.configurable, origDesc.configurable);
  assert.equal(newDesc.writable, origDesc.writable);

  assert.equal(wrappedToDataURL.toString(), origToDataURLSource);
  assert.equal(wrappedToString.call(wrappedToDataURL), origToDataURLSource);
  assert.equal(wrappedRTC.toString(), origRTCPeerSource);
  assert.equal(wrappedToString.toString(), origToStringSource);

  // Calling Function.prototype.toString on non-function must still throw TypeError
  assert.throws(() => wrappedToString.call({}), TypeError);

  // Calling getImageData with negative width must still throw original RangeError
  const ctx2d = new env.win.CanvasRenderingContext2D();
  assert.throws(() => ctx2d.getImageData(0, 0, -5, 10), RangeError);

  // Calling RTCPeerConnection without `new` must still throw original TypeError
  assert.throws(() => wrappedRTC(), TypeError);
});

test("#17 — throttled MutationObserver coalesces dynamic DOM form insertions and respects on-demand vs continuous collection mode", async () => {
  const env = createMockWindowAndDom();
  const pushedPayloads = [];
  const mockChrome = {
    runtime: {
      sendMessage(msg) {
        if (msg && msg.type === "MITCH_PAGE_SURFACES") {
          pushedPayloads.push(msg.payload);
        }
      }
    }
  };

  const collector = initContentCollector(env.win, env.doc, mockChrome, {
    mutationThrottleMs: 25,
    pushDebounceMs: 10
  });

  await new Promise((r) => setTimeout(r, 30));
  const initialCount = collector.getMutationRescanCount();
  assert.equal(initialCount, 0);

  // Dynamically insert a DOB field across 5 rapid DOM mutations
  env.setFields([{ name: "birthdate", type: "date", autocomplete: "bday" }]);
  for (let i = 0; i < 5; i += 1) {
    env.triggerMutations([{ type: "childList", addedNodes: [{}] }]);
  }

  await new Promise((r) => setTimeout(r, 60));
  assert.equal(
    collector.getMutationRescanCount(),
    1,
    "Rapid DOM mutations must be coalesced into a single throttled rescan"
  );

  const snapshot = collector.collectAllSurfaces();
  assert.equal(snapshot.visibilityLayer.highestLayer, "GRUNDVERSORGUNG (Medium)");
  assert.deepEqual(snapshot.visibilityLayer.proofSuggestion.suggestedMinimalClaims, ["age_over_18"]);

  // Switch to on-demand mode: background pushes must pause
  const pushCountBefore = pushedPayloads.length;
  collector.setCollectionMode(COLLECTION_MODES.ON_DEMAND);
  env.triggerMutations([{ type: "childList", addedNodes: [{}] }]);
  await new Promise((r) => setTimeout(r, 60));
  assert.equal(pushedPayloads.length, pushCountBefore, "On-demand mode must not push passive background messages");

  collector.disconnect();
});
