/**
 * miTch Transparency Layer — MAIN-World Page Surface Observer (#17, #22)
 *
 * Security & Hygiene Properties:
 * 1. Zero DOM footprint: never writes `data-mitch-fp-*` or any other attribute to the DOM.
 * 2. Zero global CustomEvents: never dispatches or listens for `mitch:surface-observed` on `window`.
 * 3. Private MessageChannel handshake: transfers `port2` once at `document_start` to the
 *    ISOLATED-world `content.js` capture-phase listener (which stops propagation immediately),
 *    and sends deduplicated surface observations over closure-private `port1`.
 * 4. Proxy + WeakMap wrapper hygiene: preserves `Function.prototype.toString`, property descriptors,
 *    `name`, `length`, `prototype`, `instanceof`, and thrown exceptions.
 *
 * Honest Evasion Caveat:
 * Because this script executes in the page's MAIN JavaScript world, a determined site can still
 * evade observation (for example, by creating a fresh same-origin iframe realm and extracting
 * unwrapped prototype methods before invoking them).
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    const api = factory();
    if (typeof window !== "undefined") {
      api.installPageObserver(window);
    }
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const OBSERVER_EVASION_CAVEAT =
    "MAIN-world API wrappers observe calls in the top-level realm since document_start; a determined site can still evade detection (e.g., via fresh same-origin iframe realms).";

  function installPageObserver(win, options = {}) {
    if (!win || typeof win !== "object") {
      return { installed: false };
    }

    const observedSurfaces = new Set();
    const wrappedToOriginal = new WeakMap();
    let privatePort = null;

    try {
      const ChannelCtor = options.MessageChannel || win.MessageChannel || globalThis.MessageChannel;
      if (typeof ChannelCtor === "function" && typeof win.postMessage === "function") {
        const channel = new ChannelCtor();
        if (typeof channel.port1.unref === "function") channel.port1.unref();
        if (typeof channel.port2.unref === "function") channel.port2.unref();
        privatePort = channel.port1;
        win.postMessage({ __mitchInitChannel: true }, "*", [channel.port2]);
      }
    } catch {
      privatePort = null;
    }

    function notifySurface(surface) {
      if (observedSurfaces.has(surface)) {
        return; // Deduplicate per surface to prevent IPC storms
      }
      observedSurfaces.add(surface);
      try {
        if (typeof options.onNotify === "function") {
          options.onNotify(surface);
        }
        if (privatePort && typeof privatePort.postMessage === "function") {
          privatePort.postMessage({
            type: "MITCH_SURFACE_OBSERVED",
            surface
          });
        }
      } catch {
        // Never disrupt host page execution
      }
    }

    // Preserve Function.prototype.toString for all wrapped functions (including toString itself)
    try {
      const FnProto = (win.Function && win.Function.prototype) || Function.prototype;
      const origToStringDesc = Object.getOwnPropertyDescriptor(FnProto, "toString");
      const origToString = origToStringDesc && origToStringDesc.value;

      if (typeof origToString === "function" && origToStringDesc.configurable !== false) {
        const reflectApply = Reflect.apply;
        const toStringProxy = new Proxy(origToString, {
          apply(target, thisArg, argArray) {
            const unwrapped = wrappedToOriginal.has(thisArg)
              ? wrappedToOriginal.get(thisArg)
              : thisArg;
            return reflectApply(target, unwrapped, argArray);
          }
        });
        wrappedToOriginal.set(toStringProxy, origToString);
        Object.defineProperty(FnProto, "toString", {
          ...origToStringDesc,
          value: toStringProxy
        });
      }
    } catch {
      // Ignore if Function.prototype is frozen
    }

    function wrapMethod(holder, propName, onInvoke) {
      if (!holder || (typeof holder !== "object" && typeof holder !== "function")) return;
      const desc = Object.getOwnPropertyDescriptor(holder, propName);
      if (!desc || typeof desc.value !== "function" || desc.configurable === false) return;

      const origFn = desc.value;
      const reflectApply = Reflect.apply;
      const proxy = new Proxy(origFn, {
        apply(target, thisArg, argArray) {
          try {
            onInvoke(argArray, thisArg);
          } catch {
            // Never let observer callback throw into host code
          }
          return reflectApply(target, thisArg, argArray);
        }
      });

      wrappedToOriginal.set(proxy, origFn);
      Object.defineProperty(holder, propName, {
        ...desc,
        value: proxy
      });
    }

    function wrapConstructor(holder, propName, onConstruct) {
      if (!holder || (typeof holder !== "object" && typeof holder !== "function")) return;
      const desc = Object.getOwnPropertyDescriptor(holder, propName);
      if (!desc || typeof desc.value !== "function" || desc.configurable === false) return;

      const origCtor = desc.value;
      const reflectConstruct = Reflect.construct;
      const reflectApply = Reflect.apply;
      const proxy = new Proxy(origCtor, {
        construct(target, argArray, newTarget) {
          try {
            onConstruct(argArray);
          } catch {
            // Ignore observer error
          }
          const effectiveNewTarget =
            newTarget === proxy ? target : newTarget;
          return reflectConstruct(target, argArray, effectiveNewTarget);
        },
        apply(target, thisArg, argArray) {
          try {
            onConstruct(argArray);
          } catch {
            // Ignore observer error
          }
          return reflectApply(target, thisArg, argArray);
        }
      });

      wrappedToOriginal.set(proxy, origCtor);
      Object.defineProperty(holder, propName, {
        ...desc,
        value: proxy
      });
    }

    try {
      // 1. Canvas readout observation
      if (win.HTMLCanvasElement && win.HTMLCanvasElement.prototype) {
        wrapMethod(win.HTMLCanvasElement.prototype, "toDataURL", () => notifySurface("canvas"));
        wrapMethod(win.HTMLCanvasElement.prototype, "toBlob", () => notifySurface("canvas"));
      }
      if (win.CanvasRenderingContext2D && win.CanvasRenderingContext2D.prototype) {
        wrapMethod(win.CanvasRenderingContext2D.prototype, "getImageData", () =>
          notifySurface("canvas")
        );
      }

      // 2. WebGL parameter / pixel readout observation
      const hookWebGL = (Ctor) => {
        if (!Ctor || !Ctor.prototype) return;
        wrapMethod(Ctor.prototype, "getParameter", (args) => {
          const pname = args && args[0];
          // UNMASKED_VENDOR_WEBGL (37445), UNMASKED_RENDERER_WEBGL (37446)
          if (pname === 37445 || pname === 37446) {
            notifySurface("webgl");
          }
        });
        wrapMethod(Ctor.prototype, "readPixels", () => notifySurface("webgl"));
      };
      hookWebGL(win.WebGLRenderingContext);
      hookWebGL(win.WebGL2RenderingContext);

      // 3. AudioContext / OfflineAudioContext oscillator observation
      const hookAudio = (Ctor) => {
        if (!Ctor || !Ctor.prototype) return;
        wrapMethod(Ctor.prototype, "createOscillator", () => notifySurface("audio"));
      };
      hookAudio(win.AudioContext);
      hookAudio(win.OfflineAudioContext);

      // 4. WebRTC RTCPeerConnection observation
      if (typeof win.RTCPeerConnection === "function") {
        wrapConstructor(win, "RTCPeerConnection", () => notifySurface("webrtc"));
      }
    } catch {
      // Fail silently without disrupting host page
    }

    return {
      installed: true,
      evasionCaveat: OBSERVER_EVASION_CAVEAT
    };
  }

  return Object.freeze({
    OBSERVER_EVASION_CAVEAT,
    installPageObserver
  });
});
