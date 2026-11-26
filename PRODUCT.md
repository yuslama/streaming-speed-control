# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

People watching HBO Max in a Chromium desktop browser who want to watch faster (or slower) than the player allows. They open the popup or glance at the on-player overlay mid-episode, usually in a dim room, change the speed, and go back to watching. Most visits last a few seconds.

## Product Purpose

A Manifest V3 browser extension that sets playback speed on HBO Max (`hbomax.com`, `max.com`) from 0.25x to 4.0x. Success: the user changes speed in one click and the speed sticks across episodes and player resets.

## Positioning

Built only for HBO Max: favorite speeds (1.25x, 1.50x, 1.75x, 2.0x) are first-class, an overlay that works in fullscreen, a speed that holds through HBO Max's own resets and episode changes, and pitch-preserving audio.

## Operating Context

- Popup opened from the browser toolbar while a video plays or is paused.
- On-player overlay inside the HBO Max player, including fullscreen; must not trigger play/pause.
- Keyboard shortcuts: `[` / `]` step, `\` toggle 1.0x and last speed, `Alt+1`–`Alt+5` jump to 1.0x–2.0x.
- Toolbar badge shows the speed when it is not 1.0x.
- Works in Chrome and de-Googled Chromium forks (e.g. Ardia), where `storage.sync` may be missing.

## Capabilities and Constraints

- Zero-build: plain HTML/CSS/JS, no bundler or npm runtime dependencies. Popup is a fixed-width extension popup (about 320px).
- Overlay renders in Shadow DOM over third-party page content.
- Controls in regular use: favorite speeds, slider with ±0.05x fine steps, settings toggles (remember speed, overlay on/off, keyboard shortcuts). The secondary presets row (0.5x, 0.75x, 1x, 2.5x, 3x) is not used and may be dropped; 1.0x stays reachable via reset.
- Popup status states: active on a playing video, ready on an HBO Max tab, and not connected to any HBO Max tab.

## Brand Commitments

Product name in use: "HBO Max Speed" / "HBO Max Playback Speed Controller". It is an unofficial extension: no HBO Max logo, wordmark, or brand colors may be used or imitated.

Visual standard (chosen 2026-11-26): the category standard, played straight. Clean dark UI at the polish level of Linear / Raycast and native macOS controls (segmented controls, switches, system font). No themed costume.

## Evidence on Hand

No user counts, ratings, reviews, or press. Do not invent them.

## Product Principles

1. One click to the speed you want; everything else is secondary.
2. Stay out of the way of the show: quiet in the dark, never covering what matters.
3. Always tell the truth about the state: what speed is set and whether it reached the video.
4. First-time Web Store users must understand it without reading instructions.

## Accessibility & Inclusion

Keyboard-operable popup with visible focus; readable contrast in a dark room; respect reduced motion.
