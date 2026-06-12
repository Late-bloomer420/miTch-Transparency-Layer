# miTch Transparency Layer

miTch Transparency Layer is a Manifest V3 Chrome extension that shows users what websites can technically access, observe, infer, or request from their browser.

Core principle:

> We show what is technically observable and technically possible. We do not claim what happens on remote servers.

## Features

- Current website detection: domain, protocol, and page title
- Cookie analysis: total, first-party, and third-party cookies when detectable
- Storage analysis: localStorage and sessionStorage usage
- Fingerprinting surface detection: Canvas, WebGL, AudioContext, and WebRTC
- Permission surface: geolocation, notifications, camera, microphone, and clipboard
- Transparency Surface Score from 0 to 100
- Three-layer report: observed facts, potential access, and unknowns

## Install Locally

1. Open `chrome://extensions`.
2. Enable Developer Mode.
3. Select Load unpacked.
4. Choose this repository folder.

## Release Package

The Chrome Web Store upload package is available at:

```text
release/mitch-transparency-layer-v0.1.zip
```

## Privacy Policy

The privacy policy is available in [PRIVACY_POLICY.md](PRIVACY_POLICY.md) and on GitHub Pages.
