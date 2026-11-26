(function (root, factory) {
  root.HboMaxOverlayUI = factory(root.HboMaxSpeedUtils);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (utils) {
  'use strict';

  const {
    QUICK_PRESETS,
    formatSpeed,
    clampSpeed,
  } = utils;

  const HOST_ID = 'hbomax-speed-controller-host';
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const INACTIVITY_MS = 2800;
  const TOAST_MS = 1100;

  const STYLES = `
    :host {
      all: initial;
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 2147483647;
      font: 13px/1.4 -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", system-ui, sans-serif;
      color: #ededef;
      -webkit-font-smoothing: antialiased;
      --panel: rgba(24, 24, 27, 0.86);
      --control: rgba(255, 255, 255, 0.08);
      --control-hover: rgba(255, 255, 255, 0.14);
      --ring: rgba(255, 255, 255, 0.1);
      --text-2: #a8a8b0;
      --text-3: #8e8e96;
      --accent: #3b82f6;
      --accent-ring: rgba(59, 130, 246, 0.6);
      --ease-out: cubic-bezier(0.23, 1, 0.32, 1);
    }

    *, *::before, *::after {
      box-sizing: border-box;
    }

    button {
      font: inherit;
      color: inherit;
    }

    button:focus-visible {
      outline: 2px solid var(--accent-ring);
      outline-offset: 2px;
    }

    .root {
      position: relative;
      width: 100%;
      height: 100%;
      pointer-events: none;
    }

    .root.is-hidden {
      display: none;
    }

    .dock {
      position: fixed;
      top: 20px;
      right: 24px;
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 8px;
      pointer-events: auto;
      opacity: 1;
      transition: opacity 240ms var(--ease-out);
    }

    .dock.is-idle {
      opacity: 0;
      pointer-events: none;
    }

    .dock.is-hidden {
      display: none;
    }

    .pill {
      appearance: none;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      height: 32px;
      padding: 0 12px 0 10px;
      border: 0;
      border-radius: 999px;
      background: var(--panel);
      backdrop-filter: blur(20px) saturate(1.4);
      -webkit-backdrop-filter: blur(20px) saturate(1.4);
      box-shadow: 0 0 0 0.5px var(--ring), 0 4px 16px rgba(0, 0, 0, 0.35);
      color: #ffffff;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      user-select: none;
      transition: background-color 150ms var(--ease-out), transform 120ms var(--ease-out);
    }

    .pill:hover {
      background: rgba(36, 36, 40, 0.92);
    }

    .pill:active {
      transform: scale(0.96);
    }

    .pill-icon {
      display: inline-flex;
      color: var(--text-2);
      transition: color 150ms var(--ease-out);
    }

    .pill.is-boosted .pill-icon {
      color: var(--accent);
    }

    .pill-label {
      font-variant-numeric: tabular-nums;
    }

    .menu {
      width: 252px;
      padding: 12px;
      border-radius: 12px;
      background: var(--panel);
      backdrop-filter: blur(24px) saturate(1.4);
      -webkit-backdrop-filter: blur(24px) saturate(1.4);
      box-shadow: 0 0 0 0.5px var(--ring), 0 16px 40px rgba(0, 0, 0, 0.5);
      display: flex;
      flex-direction: column;
      gap: 12px;
      transform-origin: top right;
      opacity: 0;
      visibility: hidden;
      transform: translateY(-4px) scale(0.97);
      pointer-events: none;
      transition: opacity 160ms var(--ease-out), transform 160ms var(--ease-out), visibility 0s linear 160ms;
    }

    .dock.is-open .menu {
      opacity: 1;
      visibility: visible;
      transform: none;
      pointer-events: auto;
      transition: opacity 160ms var(--ease-out), transform 160ms var(--ease-out), visibility 0s;
    }

    .menu-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 12px;
      font-weight: 600;
      color: var(--text-2);
    }

    .link-btn {
      appearance: none;
      height: 24px;
      padding: 0 8px;
      border: 0;
      border-radius: 6px;
      background: transparent;
      color: var(--text-2);
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      transition: background-color 150ms var(--ease-out), color 150ms var(--ease-out);
    }

    .link-btn:hover {
      background: var(--control);
      color: #ffffff;
    }

    .quick-grid {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 2px;
      padding: 2px;
      border-radius: 9px;
      background: var(--control);
    }

    .speed-btn {
      appearance: none;
      height: 30px;
      padding: 0;
      border: 0;
      border-radius: 7px;
      background: transparent;
      color: var(--text-2);
      font-size: 12px;
      font-weight: 600;
      font-variant-numeric: tabular-nums;
      cursor: pointer;
      transition: background-color 150ms var(--ease-out), color 150ms var(--ease-out), transform 120ms var(--ease-out);
    }

    .speed-btn:hover {
      background: var(--control-hover);
      color: #ffffff;
    }

    .speed-btn:active {
      transform: scale(0.95);
    }

    .speed-btn.is-active {
      background: var(--accent);
      color: #ffffff;
    }

    .stepper-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }

    .step-btn {
      appearance: none;
      display: inline-grid;
      place-items: center;
      width: 32px;
      height: 28px;
      border: 0;
      border-radius: 7px;
      background: var(--control);
      cursor: pointer;
      transition: background-color 150ms var(--ease-out), transform 120ms var(--ease-out);
    }

    .step-btn:hover {
      background: var(--control-hover);
    }

    .step-btn:active {
      transform: scale(0.94);
    }

    .stepper-readout {
      font-size: 20px;
      font-weight: 600;
      letter-spacing: -0.02em;
      font-variant-numeric: tabular-nums;
      color: #ffffff;
    }

    .hint {
      font-size: 11px;
      color: var(--text-3);
      text-align: center;
    }

    .toast {
      position: fixed;
      top: 24px;
      left: 50%;
      padding: 8px 16px;
      border-radius: 12px;
      background: var(--panel);
      backdrop-filter: blur(20px) saturate(1.4);
      -webkit-backdrop-filter: blur(20px) saturate(1.4);
      box-shadow: 0 0 0 0.5px var(--ring), 0 8px 24px rgba(0, 0, 0, 0.4);
      color: #ffffff;
      font-size: 20px;
      font-weight: 600;
      letter-spacing: -0.02em;
      font-variant-numeric: tabular-nums;
      opacity: 0;
      transform: translateX(-50%) scale(0.96);
      pointer-events: none;
      transition: opacity 180ms var(--ease-out), transform 180ms var(--ease-out);
    }

    .toast.is-visible {
      opacity: 1;
      transform: translateX(-50%) scale(1);
    }

    @media (prefers-reduced-motion: reduce) {
      .dock, .pill, .menu, .dock.is-open .menu, .speed-btn, .step-btn, .toast {
        transition-duration: 0ms;
      }
    }
  `;

  class SpeedOverlayUI {
    constructor(options = {}) {
      this.doc = options.document || document;
      this.win = options.window || window;
      this.onSelectSpeed = typeof options.onSelectSpeed === 'function' ? options.onSelectSpeed : () => {};
      this.onStepSpeed = typeof options.onStepSpeed === 'function' ? options.onStepSpeed : () => {};

      this.speed = 1.0;
      this.hasVideo = false;
      this.visible = true;
      this.isOpen = false;
      this.isHovered = false;

      this._inactivityTimer = null;
      this._toastTimer = null;
      this._host = null;
      this._shadow = null;
      this._root = null;
      this._dock = null;
      this._pill = null;
      this._pillLabel = null;
      this._readout = null;
      this._toast = null;
      this._presetButtons = new Map();

      this._onPointerActivity = this._wake.bind(this);
      this._onFullscreenChange = this._ensureMounted.bind(this);
      this._onOutsideClick = this._handleOutsideClick.bind(this);

      this._build();
      this._attachGlobalListeners();
      this._ensureMounted();
      this._render();
    }

    setState({ speed, hasVideo, visible }) {
      if (speed !== undefined) {
        this.speed = clampSpeed(speed);
      }
      if (hasVideo !== undefined) {
        this.hasVideo = Boolean(hasVideo);
      }
      if (visible !== undefined) {
        this.visible = Boolean(visible);
      }
      if (!this.hasVideo || !this.visible) {
        this.isOpen = false;
      }
      this._ensureMounted();
      this._render();
      if (this.hasVideo && this.visible) {
        this._wake();
      }
    }

    showToast(speed) {
      if (!this.hasVideo) {
        return;
      }
      this._ensureMounted();
      const formatted = formatSpeed(speed !== undefined ? speed : this.speed);
      this._toast.textContent = formatted;
      this._toast.classList.add('is-visible');
      if (this.visible) {
        this._wake();
      }

      if (this._toastTimer) {
        this.win.clearTimeout(this._toastTimer);
      }
      this._toastTimer = this.win.setTimeout(() => {
        this._toastTimer = null;
        if (this._toast) {
          this._toast.classList.remove('is-visible');
        }
      }, TOAST_MS);
    }

    destroy() {
      if (this._inactivityTimer) {
        this.win.clearTimeout(this._inactivityTimer);
        this._inactivityTimer = null;
      }
      if (this._toastTimer) {
        this.win.clearTimeout(this._toastTimer);
        this._toastTimer = null;
      }
      this.doc.removeEventListener('mousemove', this._onPointerActivity, true);
      this.doc.removeEventListener('fullscreenchange', this._onFullscreenChange, true);
      this.doc.removeEventListener('webkitfullscreenchange', this._onFullscreenChange, true);
      this.doc.removeEventListener('click', this._onOutsideClick, true);

      if (this._host && this._host.parentNode) {
        this._host.parentNode.removeChild(this._host);
      }
    }

    _build() {
      const existing = this.doc.getElementById(HOST_ID);
      if (existing && existing.parentNode) {
        existing.parentNode.removeChild(existing);
      }

      this._host = this.doc.createElement('div');
      this._host.id = HOST_ID;
      this._shadow = this._host.attachShadow({ mode: 'open' });

      const style = this.doc.createElement('style');
      style.textContent = STYLES;

      this._root = this.doc.createElement('div');
      this._root.className = 'root is-hidden';

      this._dock = this.doc.createElement('div');
      this._dock.className = 'dock';

      const stopBubble = (e) => {
        e.stopPropagation();
      };
      ['click', 'mousedown', 'pointerdown', 'dblclick'].forEach((evtName) => {
        this._dock.addEventListener(evtName, stopBubble);
      });

      this._dock.addEventListener('mouseenter', () => {
        this.isHovered = true;
        this._wake();
      });
      this._dock.addEventListener('mouseleave', () => {
        this.isHovered = false;
        this._scheduleIdle();
      });

      this._pill = this.doc.createElement('button');
      this._pill.type = 'button';
      this._pill.className = 'pill';
      this._pill.title = 'Playback speed';
      this._pill.setAttribute('aria-haspopup', 'true');
      this._pill.setAttribute('aria-expanded', 'false');

      const pillIcon = this.doc.createElement('span');
      pillIcon.className = 'pill-icon';
      pillIcon.appendChild(this._icon('M2.5 12.5a6 6 0 1 1 11 0M8 9.5l2.5-3', 15));

      this._pillLabel = this.doc.createElement('span');
      this._pillLabel.className = 'pill-label';
      this._pillLabel.textContent = formatSpeed(this.speed);

      this._pill.appendChild(pillIcon);
      this._pill.appendChild(this._pillLabel);
      this._pill.addEventListener('click', (e) => {
        e.stopPropagation();
        this.isOpen = !this.isOpen;
        this._render();
        this._wake();
      });

      const menu = this.doc.createElement('div');
      menu.className = 'menu';

      const header = this.doc.createElement('div');
      header.className = 'menu-header';
      const titleSpan = this.doc.createElement('span');
      titleSpan.textContent = 'Playback speed';
      const resetLink = this.doc.createElement('button');
      resetLink.type = 'button';
      resetLink.className = 'link-btn';
      resetLink.textContent = 'Reset';
      resetLink.addEventListener('click', () => {
        this.onSelectSpeed(1.0);
      });
      header.appendChild(titleSpan);
      header.appendChild(resetLink);

      const quickGrid = this.doc.createElement('div');
      quickGrid.className = 'quick-grid';
      QUICK_PRESETS.forEach((rate) => {
        const btn = this._createPresetButton(rate);
        quickGrid.appendChild(btn);
      });

      const stepperRow = this.doc.createElement('div');
      stepperRow.className = 'stepper-row';

      const minusBtn = this.doc.createElement('button');
      minusBtn.type = 'button';
      minusBtn.className = 'step-btn';
      minusBtn.appendChild(this._icon('M3.5 8h9', 14));
      minusBtn.title = 'Slower by 0.25x (Shift: 0.05x)';
      minusBtn.setAttribute('aria-label', 'Slower');
      minusBtn.addEventListener('click', (e) => {
        this.onStepSpeed(-1, Boolean(e.shiftKey));
      });

      this._readout = this.doc.createElement('span');
      this._readout.className = 'stepper-readout';
      this._readout.textContent = formatSpeed(this.speed);

      const plusBtn = this.doc.createElement('button');
      plusBtn.type = 'button';
      plusBtn.className = 'step-btn';
      plusBtn.appendChild(this._icon('M3.5 8h9M8 3.5v9', 14));
      plusBtn.title = 'Faster by 0.25x (Shift: 0.05x)';
      plusBtn.setAttribute('aria-label', 'Faster');
      plusBtn.addEventListener('click', (e) => {
        this.onStepSpeed(1, Boolean(e.shiftKey));
      });

      stepperRow.appendChild(minusBtn);
      stepperRow.appendChild(this._readout);
      stepperRow.appendChild(plusBtn);

      const hint = this.doc.createElement('div');
      hint.className = 'hint';
      hint.textContent = 'Shift-click for 0.05x · [ ] step · \\ toggle 1.0x';

      menu.appendChild(header);
      menu.appendChild(quickGrid);
      menu.appendChild(stepperRow);
      menu.appendChild(hint);

      this._dock.appendChild(this._pill);
      this._dock.appendChild(menu);

      this._toast = this.doc.createElement('div');
      this._toast.className = 'toast';

      this._root.appendChild(this._dock);
      this._root.appendChild(this._toast);

      this._shadow.appendChild(style);
      this._shadow.appendChild(this._root);
    }

    _icon(d, size) {
      const svg = this.doc.createElementNS(SVG_NS, 'svg');
      svg.setAttribute('viewBox', '0 0 16 16');
      svg.setAttribute('width', String(size));
      svg.setAttribute('height', String(size));
      svg.setAttribute('aria-hidden', 'true');
      const path = this.doc.createElementNS(SVG_NS, 'path');
      path.setAttribute('d', d);
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', 'currentColor');
      path.setAttribute('stroke-width', '1.6');
      path.setAttribute('stroke-linecap', 'round');
      svg.appendChild(path);
      return svg;
    }

    _createPresetButton(rate) {
      const btn = this.doc.createElement('button');
      btn.type = 'button';
      btn.className = 'speed-btn';
      btn.textContent = formatSpeed(rate);
      btn.addEventListener('click', () => {
        this.onSelectSpeed(rate);
      });
      this._presetButtons.set(rate, btn);
      return btn;
    }

    _attachGlobalListeners() {
      this.doc.addEventListener('mousemove', this._onPointerActivity, true);
      this.doc.addEventListener('fullscreenchange', this._onFullscreenChange, true);
      this.doc.addEventListener('webkitfullscreenchange', this._onFullscreenChange, true);
      this.doc.addEventListener('click', this._onOutsideClick, true);
    }

    _handleOutsideClick(e) {
      if (!this.isOpen) {
        return;
      }
      const path = typeof e.composedPath === 'function' ? e.composedPath() : [];
      if (path.includes(this._host) || path.includes(this._dock)) {
        return;
      }
      this.isOpen = false;
      this._render();
      this._scheduleIdle();
    }

    _ensureMounted() {
      if (!this._host) {
        return;
      }
      const mountTarget =
        this.doc.fullscreenElement ||
        this.doc.webkitFullscreenElement ||
        this.doc.body ||
        this.doc.documentElement;

      if (mountTarget && this._host.parentNode !== mountTarget) {
        mountTarget.appendChild(this._host);
      }
    }

    _wake() {
      if (!this._dock) {
        return;
      }
      this._dock.classList.remove('is-idle');
      this._scheduleIdle();
    }

    _scheduleIdle() {
      if (this._inactivityTimer) {
        this.win.clearTimeout(this._inactivityTimer);
        this._inactivityTimer = null;
      }
      if (!this.hasVideo || !this.visible || this.isOpen || this.isHovered) {
        return;
      }
      this._inactivityTimer = this.win.setTimeout(() => {
        this._inactivityTimer = null;
        if (this._dock && !this.isOpen && !this.isHovered) {
          this._dock.classList.add('is-idle');
        }
      }, INACTIVITY_MS);
    }

    _render() {
      this._root.classList.toggle('is-hidden', !this.hasVideo);
      this._dock.classList.toggle('is-hidden', !this.visible);
      this._dock.classList.toggle('is-open', this.isOpen);
      this._pill.setAttribute('aria-expanded', String(this.isOpen));

      const formatted = formatSpeed(this.speed);
      this._pillLabel.textContent = formatted;
      this._readout.textContent = formatted;
      this._pill.classList.toggle('is-boosted', Math.abs(this.speed - 1.0) > 0.001);

      this._presetButtons.forEach((btn, rate) => {
        btn.classList.toggle('is-active', Math.abs(this.speed - rate) <= 0.001);
      });
    }
  }

  return {
    SpeedOverlayUI,
  };
});
