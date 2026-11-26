<div align="center">

<img src="icons/icon128.png" width="96" height="96" alt="HBO Max Playback Speed icon" />

# HBO Max Playback Speed

**Watch HBO Max at 1.25x, 1.5x, 1.75x, 2x, or any speed from 0.25x to 4x.**<br />
A free, open-source browser extension that adds the speed control the HBO Max player doesn't have.

[![License: MIT](https://img.shields.io/badge/license-MIT-2563EB.svg)](LICENSE)
![Manifest V3](https://img.shields.io/badge/manifest-v3-2563EB.svg)
![Chrome, Edge, Brave, Arc](https://img.shields.io/badge/works%20in-Chrome%20%C2%B7%20Edge%20%C2%B7%20Brave%20%C2%B7%20Arc-2563EB.svg)
![No tracking](https://img.shields.io/badge/tracking-none-2563EB.svg)

[Install](#install) · [How to use](#how-to-use) · [Keyboard shortcuts](#keyboard-shortcuts) · [FAQ](#faq) · [Contributing](#contributing)

<img src="docs/images/hero.png" alt="HBO Max Playback Speed popup set to 1.50x, playing" width="840" />

</div>

## Why

Netflix, YouTube and most video players let you change playback speed. HBO Max doesn't. If you like rewatching shows faster, getting through slow episodes, or slowing down a scene to catch a line, you're stuck at 1x.

This extension fixes that. Click a speed and it sticks, even through HBO Max's own resets and into the next episode.

## Features

- **One-click favorites:** `1.25x`, `1.50x`, `1.75x` and `2.0x`, right in the popup.
- **Any speed from 0.25x to 4x:** a slider plus `−` / `+` buttons that move in 0.05x steps.
- **Speed button on the player:** a small button in the top-right corner of the video, including in fullscreen. It hides when you stop moving the mouse.
- **Keyboard shortcuts** for changing speed without leaving the video.
- **Remembers your speed** across episodes and page reloads (optional).
- **Natural-sounding audio:** voices keep their normal pitch at higher speeds.
- **Holds the speed:** if the HBO Max player resets the speed (for example when the next episode starts), the extension sets it back.
- **Speed on the toolbar icon:** a small badge shows the current speed whenever it isn't 1.0x.
- **Light and dark popup** that follows your system setting.
- **Private:** no accounts, no analytics, no network requests. Settings stay in your browser.

## Screenshots

<table>
  <tr>
    <td align="center" width="50%">
      <img src="docs/images/popup-dark.png" alt="Popup in dark mode at 1.50x" width="320" /><br />
      <sub>Popup, dark mode</sub>
    </td>
    <td align="center" width="50%">
      <img src="docs/images/popup-light.png" alt="Popup in light mode at 1.75x" width="320" /><br />
      <sub>Popup, light mode</sub>
    </td>
  </tr>
  <tr>
    <td align="center" colspan="2">
      <img src="docs/images/overlay-menu.png" alt="Speed menu open on top of a video player" width="760" /><br />
      <sub>Speed menu on the player</sub>
    </td>
  </tr>
</table>

## Install

The extension isn't on the Chrome Web Store yet, so you install it from this repository. It takes about a minute.

1. **Download the code:** click **Code → Download ZIP** at the top of this page ([direct link](https://github.com/yuslama/hbo-max-playback-speed/archive/refs/heads/main.zip)), then unzip it.
   Or clone it:
   ```bash
   git clone https://github.com/yuslama/hbo-max-playback-speed.git
   ```
2. **Open the extensions page:** go to `chrome://extensions` (Edge: `edge://extensions`, Brave: `brave://extensions`).
3. **Turn on Developer mode** with the switch in the top-right corner.
4. **Click "Load unpacked"** and select the unzipped folder (the one that contains `manifest.json`).
5. **Pin it:** click the puzzle-piece icon in the toolbar and pin **HBO Max Playback Speed** so it's always one click away.

Open [hbomax.com](https://www.hbomax.com) or [max.com](https://www.max.com), start a show, and pick a speed.

**Updating:** download the new version (or `git pull`), then click the reload icon on the extension's card in `chrome://extensions`.

### Supported browsers

Desktop Google Chrome and Chromium-based browsers with Manifest V3 support, including de-Googled builds such as Ardia. Microsoft Edge, Brave, Arc, Opera and Vivaldi should work the same way. Firefox and Safari aren't supported yet.

## How to use

**From the popup.** Click the toolbar icon while a show is playing. Pick a favorite speed, drag the slider, or use `−` / `+` for fine steps. **Reset to 1.0x** puts it back to normal.

The status line at the top tells you whether the speed reached the video:

| Status | Meaning |
|---|---|
| 🟢 Playing at 1.50x | The video is playing at that speed. |
| 🟡 Start a video to apply | An HBO Max tab is open, but no video is playing yet. The speed applies as soon as one starts. |
| ⚪ Open HBO Max to apply | No HBO Max tab was found. Your choice is saved for next time. |

**On the player.** Move your mouse over the video and click the speed button in the top-right corner to open the speed menu. Shift-click `−` / `+` for 0.05x steps. Turn the button off in the popup with **Speed button on player** if you prefer a clean screen.

<img src="docs/images/overlay-toast.png" alt="Speed changed to 1.75x, shown briefly at the top of the player" width="560" />

<sub>When you change speed with the keyboard, the new speed flashes at the top of the player.</sub>

## Keyboard shortcuts

Shortcuts work anywhere on an HBO Max page, except while you're typing in a text field. Turn them off in the popup with **Keyboard shortcuts**.

| Keys | Action |
|---|---|
| <kbd>]</kbd> or <kbd>&gt;</kbd> | Faster by 0.25x |
| <kbd>[</kbd> or <kbd>&lt;</kbd> | Slower by 0.25x |
| <kbd>&#92;</kbd> | Switch between 1.0x and your last speed |
| <kbd>Alt</kbd> + <kbd>1</kbd> | 1.0x |
| <kbd>Alt</kbd> + <kbd>2</kbd> | 1.25x |
| <kbd>Alt</kbd> + <kbd>3</kbd> | 1.5x |
| <kbd>Alt</kbd> + <kbd>4</kbd> | 1.75x |
| <kbd>Alt</kbd> + <kbd>5</kbd> | 2.0x |

On a Mac, <kbd>Alt</kbd> is the <kbd>Option</kbd> key.

## FAQ

<details>
<summary><b>Is this allowed? Will it get my account banned?</b></summary>

The extension only changes the playback rate of the video element in your own browser, the same thing the browser's built-in video controls do on other sites. It doesn't download, record or modify any content, and it doesn't touch your account. That said, it isn't affiliated with or endorsed by HBO Max, so use it at your own discretion.
</details>

<details>
<summary><b>The popup says "Open HBO Max to apply" but HBO Max is open.</b></summary>

Reload the HBO Max tab once after installing or updating the extension, then open the popup again. Hover over the status line to see which tabs the extension found.
</details>

<details>
<summary><b>The speed went back to 1x.</b></summary>

Make sure **Remember speed** is on in the popup. If HBO Max still resets it, press <kbd>]</kbd> once or click your speed again, and please [open an issue](https://github.com/yuslama/hbo-max-playback-speed/issues) with the show and what you did, so it can be fixed.
</details>

<details>
<summary><b>Does it work in fullscreen?</b></summary>

Yes. The speed button moves into the fullscreen player, and the keyboard shortcuts keep working.
</details>

<details>
<summary><b>Does it collect any data?</b></summary>

No. There are no analytics and no network requests. Your settings (speed and the three switches) are saved with the browser's own extension storage.
</details>

<details>
<summary><b>Which permissions does it ask for, and why?</b></summary>

- **Access to hbomax.com and max.com:** to find the video and set its speed. It doesn't run on any other site.
- **storage:** to remember your speed and settings.
- **tabs, activeTab, scripting:** so the popup can find your HBO Max tab and connect to it when you open the popup.
</details>

## Privacy

This extension runs only on `hbomax.com` and `max.com`. It doesn't collect, send or sell any data, and it makes no network requests of its own.

## Contributing

Bug reports, ideas and pull requests are welcome. Please [open an issue](https://github.com/yuslama/hbo-max-playback-speed/issues) first for anything bigger than a small fix.

The extension is plain HTML, CSS and JavaScript with no build step and no runtime dependencies. You need Node.js 18 or newer for the dev scripts.

```bash
npm test             # unit tests and manifest checks
npm run check        # syntax-check every script
npm run icons        # regenerate the icons from scripts/generate-icons.mjs
npm run screenshots  # regenerate the README images (needs Google Chrome)
```

### Project layout

```
manifest.json                Extension manifest (Manifest V3)
src/popup/                   Toolbar popup
src/content/                 Runs on HBO Max: finds the video, sets the speed, draws the player button
src/background/              Service worker: toolbar badge and tab tracking
src/shared/speed-utils.js    Speed limits, presets and formatting shared by all parts
scripts/                     Icon generator and screenshot tooling
tests/                       Node test runner tests
```

To try your changes, load the folder with **Load unpacked** as described in [Install](#install), and click the reload icon on the extension's card after each change.

## License

[MIT](LICENSE)
