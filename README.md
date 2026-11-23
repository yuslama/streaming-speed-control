# HBO Max Playback Speed Controller

A zero-build Manifest V3 Chrome Extension for controlling video playback speed on HBO Max (`hbomax.com` and `max.com`), with **`1.25x`**, **`1.50x`**, **`1.75x`**, and **`2.0x`** available as first-class favorite presets.

## Features

- **Favorite Speed Presets**: One-click access to `1.25x`, `1.50x`, `1.75x`, and `2.0x` in both the extension popup and the on-player overlay.
- **Full Speed Range (`0.25x` – `4.0x`)**: Extended presets (`0.50x`, `0.75x`, `1.0x`, `2.50x`, `3.0x`), coarse (`±0.25x`) and fine (`±0.05x`) steppers, and a smooth range slider.
- **Fullscreen-Safe On-Player Overlay**: Unobtrusive Shadow DOM pill in the top-right corner that auto-hides after inactivity, reparents into fullscreen elements automatically, and keeps clicks from triggering play/pause.
- **SPA & Pitch-Preserving Video Controller**: Automatically detects dynamically mounted `<video>` elements (including Shadow DOM), preserves audio pitch, and guards against player rate resets across episode transitions.
- **Keyboard Shortcuts**:
  - `[` or `<`: Decrease speed
  - `]` or `>`: Increase speed
  - `\`: Toggle between `1.0x` and your last non-default speed
  - `Alt+1` – `Alt+5`: Jump directly to `1.0x`, `1.25x`, `1.50x`, `1.75x`, `2.0x`
- **Live Toolbar Badge**: Shows the active playback speed on the extension icon whenever it differs from `1.0x`.

## Load Unpacked in Chrome

1. Open `chrome://extensions` in Google Chrome (or Chromium-based browser).
2. Enable **Developer mode** (top-right toggle).
3. Click **Load unpacked** and select this repository folder (`/Users/yuslam/Documents/Personal/extension/hbo-max`).
4. Navigate to `https://www.hbomax.com/id/en` (or any `hbomax.com` / `max.com` stream) and start watching.

## Development & Tests

No bundler or external npm dependencies are required.

```bash
# Syntax-check all extension scripts
npm run check

# Run unit and manifest validation tests
npm test

# Regenerate PNG extension icons
npm run icons
```
