# Design

The category standard, played straight: a clean dark UI at the polish level of Linear / Raycast and native macOS controls. Built for a dim room while a show plays. No themed costume, no streaming service brand colors.

## Surfaces

- **Popup** (`src/popup/`): 320px wide. Header (name + one-sentence status), large live speed with Reset, 4-up segmented favorites, slider with ±0.05x step buttons, grouped settings list with three switches, keyboard hint footer.
- **On-player overlay** (`src/content/overlay-ui.js`, Shadow DOM): speed pill top-right that fades after 2.8s idle, a popover menu (5-up segmented presets, ±0.25x stepper, hint), and a centered speed toast on change.

## Color

Dark is the default; the popup follows `prefers-color-scheme: light`. The overlay is always dark (it sits on video).

| Token | Dark | Light | Use |
|---|---|---|---|
| `--bg` | `#161618` | `#f6f6f7` | Popup ground |
| `--surface` | `#1f1f22` | `#ffffff` | Settings group |
| `--control` | `#2a2a2e` | `#e9e9ec` | Segmented track, step buttons, kbd |
| `--control-hover` | `#333338` | `#e0e0e4` | Hover, slider track, switch off |
| `--text` | `#ededef` | `#1b1b1f` | Primary text |
| `--text-2` | `#a0a0a8` | `#5f5f68` | Status, inactive segments |
| `--text-3` | `#8a8a93` | `#6e6e77` | Help text, scale, footer |
| `--accent` | `#3b82f6` | `#2563eb` | Selected segment, slider fill, switch on, focus ring |
| `--ok` | `#30c463` | `#1f9d4c` | Status dot: playing at the set speed |
| `--wait` | `#e5a50a` | `#b57f00` | Status dot: supported tab open, no video |
| `--idle` | `#6b6b74` | `#a0a0a8` | Status dot: no supported tab |

Overlay panel: `rgba(24,24,27,0.86)` with `backdrop-filter: blur(20–24px) saturate(1.4)` for legibility over video, 0.5px white 10% ring.

Accent is used only for selection, fill and focus. Never for decoration.

## Type

System stack: `-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", system-ui, sans-serif`. All numbers use `font-variant-numeric: tabular-nums`.

- Live speed: 48px / 600 / -0.035em (overlay readout 20px, toast 20px)
- Body and labels: 13px / 400–600
- Status, buttons: 12px / 500
- Help, scale, footer: 11–11.5px

## Shape and depth

- Radii: groups 10px, segments 8px, buttons 7px, kbd 4px, pill and switches fully round, overlay menu 12px.
- Elevation is declared once: groups use a 1px hairline ring (`--line`), the selected segment a small raised shadow, overlay surfaces a soft drop shadow.

## Components

- **Segmented control**: track in `--control`, 2px padding and gap, selected segment filled with accent. `aria-pressed` on each segment.
- **Switch**: 32×20, 16px white knob, accent when on. Real checkbox with `role="switch"`.
- **Slider**: native range, 4px track filled to `--fill` (set from JS), 16px white thumb.
- **Status**: dot + one sentence that states the truth: "Playing on Netflix", "Start a video to apply", "Open a streaming site". When nothing is applied, the live speed turns `--text-2`.
- **Icons**: inline SVG, 1.5–1.6 stroke, round caps. No glyph icons.

## Motion

Ease-out `cubic-bezier(0.23, 1, 0.32, 1)`. Hover and color 150ms, switches 180ms, press scale 0.94–0.96 at 120ms. Overlay menu opens from its top-right origin (scale 0.97 + 4px, 160ms); toast scales in from 0.96. All durations go to 0 under `prefers-reduced-motion`.

## Icon

The original double-arrow fast-forward mark, refined: two white arrows with rounded corners meeting at the centre line, nudged right for optical balance, on a `#2563EB` rounded tile (radius 56 on a 256 canvas, 8-unit inset) framed like a film strip: `#1D4ED8` bands top and bottom with five `#3B7BF0` perforations each. At 16px the perforations are dropped and only the bands remain. No gradient. The geometry lives in `scripts/generate-icons.mjs`, which writes `icons/icon.svg` and the 16/32/48/128 PNGs (`npm run icons`). The toolbar badge uses the same `#2563EB`.
