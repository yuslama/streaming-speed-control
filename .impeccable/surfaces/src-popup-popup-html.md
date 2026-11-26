---
version: 1
slug: "src-popup-popup-html"
primary_target: "src/popup/popup.html"
related_targets: ["src/content/overlay-ui.js"]
---

# Popup and on-player overlay

Scope: extension popup (src/popup/) and on-player overlay (src/content/overlay-ui.js). Mode: Operate.

Audience and job: streaming viewers (HBO Max, Netflix, Hulu, Prime Video, Disney+, Paramount+, Peacock, Apple TV), often in a dim room, changing speed in a few seconds and returning to the show. Public Web Store release, so first-time users must understand it unaided.

Constraints: zero-build HTML/CSS/JS, popup ~320px wide, overlay in Shadow DOM over the player and fullscreen. Secondary preset row (0.5/0.75/1/2.5/3) dropped; 1.0x via Reset.

## Direction contract

THESIS: The category standard, played straight at Linear / Raycast and macOS-control polish. It refuses the old purple-gradient glow and any themed costume.
OWN-WORLD: Neutral cool-gray dark panel (light variant follows system), one blue accent for selection and fill only, green status dot when applied. System font, tabular numerals, macOS-style segmented control and switches, 1px hairline groups, 10-12px radii.
STORY: The user sees the current speed and whether it reached the video, clicks a favorite or nudges the slider, and closes the popup.
FIRST VIEWPORT: Header row with product name left and a one-sentence status right; large live speed readout with Reset beside it; 4-up segmented favorites; slider flanked by minus/plus (0.05x); grouped settings list with three switches; keyboard hint footer.
FORM: canon (the category standard), chosen by the user from the direction round; seed:50366e736ff2b15f
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
