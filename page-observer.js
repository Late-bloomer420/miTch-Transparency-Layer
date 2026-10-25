(function () {
  try {
    const mark = (surface) => {
      try {
        if (document.documentElement) {
          document.documentElement.setAttribute(`data-mitch-fp-${surface}`, "1");
        }
        window.dispatchEvent(new CustomEvent("mitch:surface-observed", { detail: { surface } }));
      } catch {
        // Ignore DOM errors
      }
    };

    // 1. Canvas readout observation
    if (typeof HTMLCanvasElement !== "undefined" && HTMLCanvasElement.prototype) {
      const origToDataURL = HTMLCanvasElement.prototype.toDataURL;
      if (typeof origToDataURL === "function") {
        HTMLCanvasElement.prototype.toDataURL = function (...args) {
          mark("canvas");
          return origToDataURL.apply(this, args);
        };
      }
      const origToBlob = HTMLCanvasElement.prototype.toBlob;
      if (typeof origToBlob === "function") {
        HTMLCanvasElement.prototype.toBlob = function (...args) {
          mark("canvas");
          return origToBlob.apply(this, args);
        };
      }
    }

    if (typeof CanvasRenderingContext2D !== "undefined" && CanvasRenderingContext2D.prototype) {
      const origGetImageData = CanvasRenderingContext2D.prototype.getImageData;
      if (typeof origGetImageData === "function") {
        CanvasRenderingContext2D.prototype.getImageData = function (...args) {
          mark("canvas");
          return origGetImageData.apply(this, args);
        };
      }
    }

    // 2. WebGL parameter / pixel readout observation
    const hookWebGL = (Proto) => {
      if (!Proto || !Proto.prototype) return;
      const origGetParameter = Proto.prototype.getParameter;
      if (typeof origGetParameter === "function") {
        Proto.prototype.getParameter = function (pname, ...rest) {
          // UNMASKED_VENDOR_WEBGL (0x9245 = 37445), UNMASKED_RENDERER_WEBGL (0x9246 = 37446)
          if (pname === 37445 || pname === 37446) {
            mark("webgl");
          }
          return origGetParameter.call(this, pname, ...rest);
        };
      }
      const origReadPixels = Proto.prototype.readPixels;
      if (typeof origReadPixels === "function") {
        Proto.prototype.readPixels = function (...args) {
          mark("webgl");
          return origReadPixels.apply(this, args);
        };
      }
    };
    if (typeof WebGLRenderingContext !== "undefined") hookWebGL(WebGLRenderingContext);
    if (typeof WebGL2RenderingContext !== "undefined") hookWebGL(WebGL2RenderingContext);

    // 3. AudioContext / OfflineAudioContext oscillator/compressor fingerprinting observation
    const hookAudioProto = (AudioCtor) => {
      if (!AudioCtor || !AudioCtor.prototype) return;
      const origCreateOscillator = AudioCtor.prototype.createOscillator;
      if (typeof origCreateOscillator === "function") {
        AudioCtor.prototype.createOscillator = function (...args) {
          mark("audio");
          return origCreateOscillator.apply(this, args);
        };
      }
    };
    if (typeof window.AudioContext === "function") hookAudioProto(window.AudioContext);
    if (typeof window.OfflineAudioContext === "function") hookAudioProto(window.OfflineAudioContext);

    // 4. WebRTC ICE candidate / peer connection observation
    if (typeof window.RTCPeerConnection === "function") {
      const OrigRTC = window.RTCPeerConnection;
      const WrappedRTC = function (...args) {
        mark("webrtc");
        return new OrigRTC(...args);
      };
      WrappedRTC.prototype = OrigRTC.prototype;
      Object.setPrototypeOf(WrappedRTC, OrigRTC);
      window.RTCPeerConnection = WrappedRTC;
    }
  } catch {
    // Fail silently without disrupting host page
  }
})();
