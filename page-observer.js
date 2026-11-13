/**
 * miTch Transparency Layer — MAIN-World Page Surface Observer (#17, #22, Standards Alignment)
 *
 * Security & Hygiene Properties:
 * 1. Zero DOM footprint: never writes `data-mitch-fp-*` or any other attribute to the DOM.
 * 2. Zero global CustomEvents: never dispatches or listens for `mitch:surface-observed` on `window`.
 * 3. Private MessageChannel handshake: transfers `port2` once at `document_start` to the
 *    ISOLATED-world `content.js` capture-phase listener (which stops propagation immediately),
 *    and sends deduplicated surface observations over closure-private `port1`.
 * 4. Proxy + WeakMap wrapper hygiene: preserves `Function.prototype.toString`, property descriptors,
 *    `name`, `length`, `prototype`, `instanceof`, and thrown exceptions.
 * 5. Same-origin iframe realm propagation: wraps `HTMLIFrameElement.prototype.contentWindow` getter
 *    so freshly created same-origin child realms inherit read-only hooks before unwrapped prototypes are extracted.
 * 6. W3C Digital Credentials API observation: detects `navigator.credentials.get({ digital })` calls.
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
    "MAIN-world API wrappers observe calls in the top-level realm and hooked same-origin iframe realms since document_start; a determined site can still evade detection via sandboxing or non-standard realm creation.";

  const hookedRealms = new WeakSet();

  function installPageObserver(win, options = {}) {
    if (!win || typeof win !== "object") {
      return { installed: false };
    }
    if (hookedRealms.has(win)) {
      return { installed: true, evasionCaveat: OBSERVER_EVASION_CAVEAT };
    }
    hookedRealms.add(win);

    const observedSurfaces = options._sharedObservedSet || new Set();
    const wrappedToOriginal = options._sharedWeakMap || new WeakMap();
    let privatePort = options._sharedPort || null;

    if (!privatePort && !options._isChildRealm) {
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

    function hookRealmPrototypes(targetWin) {
      if (!targetWin || typeof targetWin !== "object") return;

      // Preserve Function.prototype.toString for all wrapped functions (including toString itself)
      try {
        const FnProto = (targetWin.Function && targetWin.Function.prototype) || Function.prototype;
        const origToStringDesc = Object.getOwnPropertyDescriptor(FnProto, "toString");
        const origToString = origToStringDesc && origToStringDesc.value;

        if (
          typeof origToString === "function" &&
          origToStringDesc.configurable !== false &&
          !wrappedToOriginal.has(origToString)
        ) {
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
            value: toStringProxy,
            writable: origToStringDesc.writable,
            enumerable: origToStringDesc.enumerable,
            configurable: origToStringDesc.configurable
          });
        }
      } catch {
        // Ignore if Function.prototype.toString is non-configurable
      }

      function wrapMethod(proto, methodName, surfaceName, predicate) {
        try {
          if (!proto || typeof proto !== "object") return;
          const desc = Object.getOwnPropertyDescriptor(proto, methodName);
          if (!desc || typeof desc.value !== "function" || desc.configurable === false) return;
          const original = desc.value;
          if (wrappedToOriginal.has(original)) return;

          const reflectApply = Reflect.apply;
          const proxy = new Proxy(original, {
            apply(target, thisArg, argArray) {
              try {
                if (!predicate || predicate(argArray, thisArg)) {
                  notifySurface(surfaceName);
                }
              } catch {
                // Ignore observer predicate errors
              }
              return reflectApply(target, thisArg, argArray);
            }
          });

          wrappedToOriginal.set(proxy, original);
          Object.defineProperty(proto, methodName, {
            value: proxy,
            writable: desc.writable,
            enumerable: desc.enumerable,
            configurable: desc.configurable
          });
        } catch {
          // Ignore non-configurable properties
        }
      }

      function wrapConstructor(holder, ctorName, surfaceName) {
        try {
          if (!holder || typeof holder !== "object") return;
          const desc = Object.getOwnPropertyDescriptor(holder, ctorName);
          if (!desc || typeof desc.value !== "function" || desc.configurable === false) return;
          const OriginalCtor = desc.value;
          if (wrappedToOriginal.has(OriginalCtor)) return;

          const reflectConstruct = Reflect.construct;
          const reflectApply = Reflect.apply;
          const proxyCtor = new Proxy(OriginalCtor, {
            construct(target, argArray, newTarget) {
              try {
                notifySurface(surfaceName);
              } catch {
                // Ignore
              }
              return reflectConstruct(target, argArray, newTarget);
            },
            apply(target, thisArg, argArray) {
              return reflectApply(target, thisArg, argArray);
            }
          });

          wrappedToOriginal.set(proxyCtor, OriginalCtor);
          Object.defineProperty(holder, ctorName, {
            value: proxyCtor,
            writable: desc.writable,
            enumerable: desc.enumerable,
            configurable: desc.configurable
          });
        } catch {
          // Ignore
        }
      }

      // 1. Canvas fingerprinting hooks
      if (targetWin.HTMLCanvasElement && targetWin.HTMLCanvasElement.prototype) {
        wrapMethod(targetWin.HTMLCanvasElement.prototype, "toDataURL", "canvas");
        wrapMethod(targetWin.HTMLCanvasElement.prototype, "toBlob", "canvas");
      }
      if (targetWin.CanvasRenderingContext2D && targetWin.CanvasRenderingContext2D.prototype) {
        wrapMethod(targetWin.CanvasRenderingContext2D.prototype, "getImageData", "canvas");
      }
      if (targetWin.OffscreenCanvas && targetWin.OffscreenCanvas.prototype) {
        wrapMethod(targetWin.OffscreenCanvas.prototype, "convertToBlob", "canvas");
      }

      // 2. WebGL unmasked renderer / pixel readout hooks
      const webglParamPredicate = (args) => {
        const pname = args && args[0];
        return pname === 37445 || pname === 37446 || pname === 7936 || pname === 7937;
      };
      if (targetWin.WebGLRenderingContext && targetWin.WebGLRenderingContext.prototype) {
        wrapMethod(targetWin.WebGLRenderingContext.prototype, "getParameter", "webgl", webglParamPredicate);
        wrapMethod(targetWin.WebGLRenderingContext.prototype, "readPixels", "webgl");
      }
      if (targetWin.WebGL2RenderingContext && targetWin.WebGL2RenderingContext.prototype) {
        wrapMethod(targetWin.WebGL2RenderingContext.prototype, "getParameter", "webgl", webglParamPredicate);
        wrapMethod(targetWin.WebGL2RenderingContext.prototype, "readPixels", "webgl");
      }

      // 3. AudioContext fingerprinting hooks
      if (targetWin.AudioContext && targetWin.AudioContext.prototype) {
        wrapMethod(targetWin.AudioContext.prototype, "createOscillator", "audio");
        wrapMethod(targetWin.AudioContext.prototype, "createDynamicsCompressor", "audio");
      }
      if (targetWin.OfflineAudioContext && targetWin.OfflineAudioContext.prototype) {
        wrapMethod(targetWin.OfflineAudioContext.prototype, "startRendering", "audio");
      }
      if (targetWin.BaseAudioContext && targetWin.BaseAudioContext.prototype) {
        wrapMethod(targetWin.BaseAudioContext.prototype, "createOscillator", "audio");
        wrapMethod(targetWin.BaseAudioContext.prototype, "createDynamicsCompressor", "audio");
      }

      // 4. WebRTC hooks
      wrapConstructor(targetWin, "RTCPeerConnection", "webrtc");
      wrapConstructor(targetWin, "webkitRTCPeerConnection", "webrtc");

      // 5. W3C Digital Credentials API hook (navigator.credentials.get({ digital }))
      const credsProto =
        (targetWin.CredentialsContainer && targetWin.CredentialsContainer.prototype) ||
        (targetWin.navigator &&
          targetWin.navigator.credentials &&
          Object.getPrototypeOf(targetWin.navigator.credentials));
      if (credsProto) {
        wrapMethod(credsProto, "get", "digitalCredentials", (args) => {
          const req = args && args[0];
          return Boolean(req && typeof req === "object" && (req.digital || req.identity));
        });
      }

      // 6. Same-origin HTMLIFrameElement.prototype.contentWindow getter hook
      if (targetWin.HTMLIFrameElement && targetWin.HTMLIFrameElement.prototype) {
        try {
          const iframeProto = targetWin.HTMLIFrameElement.prototype;
          const cwDesc = Object.getOwnPropertyDescriptor(iframeProto, "contentWindow");
          if (cwDesc && typeof cwDesc.get === "function" && cwDesc.configurable !== false && !wrappedToOriginal.has(cwDesc.get)) {
            const origGetter = cwDesc.get;
            const reflectApply = Reflect.apply;
            const getterProxy = new Proxy(origGetter, {
              apply(target, thisArg, argArray) {
                const childWin = reflectApply(target, thisArg, argArray);
                try {
                  if (childWin && typeof childWin === "object" && !hookedRealms.has(childWin)) {
                    hookedRealms.add(childWin);
                    hookRealmPrototypes(childWin);
                  }
                } catch {
                  // Cross-origin frame access denied — ignore safely
                }
                return childWin;
              }
            });
            wrappedToOriginal.set(getterProxy, origGetter);
            Object.defineProperty(iframeProto, "contentWindow", {
              get: getterProxy,
              set: cwDesc.set,
              enumerable: cwDesc.enumerable,
              configurable: cwDesc.configurable
            });
          }
        } catch {
          // Ignore if non-configurable
        }
      }
    }

    hookRealmPrototypes(win);

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
