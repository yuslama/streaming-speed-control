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
  const EXTENDED_PRESETS = [0.5, 0.75, 2.5, 3.0];
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
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Inter, Helvetica, Arial, sans-serif;
      color: #F8FAFC;
    }

    *, *::before, *::after {
      box-sizing: border-box;
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
      transition: opacity 220ms ease, transform 220ms ease;
    }

    .dock.is-idle {
      opacity: 0;
      pointer-events: none;
    }

    .pill {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      height: 34px;
      padding: 0 12px;
      border-radius: 999px;
      border: 1px solid rgba(255, 255, 255, 0.16);
      background: rgba(14, 14, 22, 0.82);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      color: #F8FAFC;
      font-size: 13px;
      font-weight: 600;
      letter-spacing: 0.01em;
      cursor: pointer;
      user-select: none;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.42);
      transition: background 150ms ease, border-color 150ms ease, transform 120ms ease, box-shadow 150ms ease;
    }

    .pill:hover {
      background: rgba(24, 24, 38, 0.92);
      border-color: rgba(167, 139, 250, 0.5);
    }

    .pill:active {
      transform: scale(0.97);
    }

    .pill.is-boosted {
      border-color: rgba(139, 92, 246, 0.72);
      background: linear-gradient(135deg, rgba(19, 17, 38, 0.9), rgba(109, 40, 217, 0.78));
      box-shadow: 0 8px 26px rgba(109, 40, 217, 0.36);
    }

    .pill-icon {
      display: inline-flex;
      align-items: center;
      color: #C4B5FD;
      font-size: 11px;
      font-weight: 700;
    }

    .pill.is-boosted .pill-icon {
      color: #EDE9FE;
    }

    .pill-label {
      font-variant-numeric: tabular-nums;
    }

    .menu {
      width: 268px;
      padding: 12px;
      border-radius: 14px;
      border: 1px solid rgba(255, 255, 255, 0.14);
      background: rgba(14, 14, 22, 0.92);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      box-shadow: 0 18px 42px rgba(0, 0, 0, 0.58);
      display: none;
      flex-direction: column;
      gap: 10px;
    }

    .dock.is-open .menu {
      display: flex;
    }

    .menu-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: rgba(226, 232, 240, 0.65);
    }

    .quick-grid {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 5px;
    }

    .speed-btn {
      appearance: none;
      border: 1px solid rgba(255, 255, 255, 0.12);
      background: rgba(255, 255, 255, 0.06);
      color: #E2E8F0;
      border-radius: 8px;
      height: 30px;
      padding: 0 4px;
      font-size: 11.5px;
      font-weight: 600;
      font-variant-numeric: tabular-nums;
      cursor: pointer;
      transition: background 120ms ease, border-color 120ms ease, color 120ms ease;
    }

    .speed-btn:hover {
      background: rgba(139, 92, 246, 0.22);
      border-color: rgba(167, 139, 250, 0.5);
      color: #FFFFFF;
    }

    .speed-btn.is-active {
      background: #7C3AED;
      border-color: #A78BFA;
      color: #FFFFFF;
      box-shadow: 0 0 0 1px rgba(167, 139, 250, 0.35);
    }

    .stepper-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 4px;
      border-radius: 10px;
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(255, 255, 255, 0.08);
    }

    .step-btn {
      appearance: none;
      width: 34px;
      height: 28px;
      border-radius: 7px;
      border: 1px solid rgba(255, 255, 255, 0.12);
      background: rgba(255, 255, 255, 0.07);
      color: #F8FAFC;
      font-size: 16px;
      font-weight: 600;
      line-height: 1;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }

    .step-btn:hover {
      background: rgba(139, 92, 246, 0.28);
      border-color: rgba(167, 139, 250, 0.55);
    }

    .stepper-readout {
      font-size: 14px;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
      color: #F8FAFC;
    }

    .extended-row {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 5px;
    }

    .speed-btn.is-secondary {
      height: 26px;
      font-size: 11px;
      color: rgba(226, 232, 240, 0.85);
    }

    .hint {
      font-size: 10px;
      color: rgba(203, 213, 225, 0.56);
      text-align: center;
    }

    .toast {
      position: fixed;
      top: 24px;
      left: 50%;
      transform: translateX(-50%) translateY(-6px);
      padding: 8px 16px;
      border-radius: 999px;
      background: rgba(14, 14, 22, 0.88);
      border: 1px solid rgba(139, 92, 246, 0.65);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      color: #FFFFFF;
      font-size: 15px;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
      letter-spacing: 0.02em;
      box-shadow: 0 10px 28px rgba(0, 0, 0, 0.5);
      opacity: 0;
      pointer-events: none;
      transition: opacity 150ms ease, transform 150ms ease;
    }

    .toast.is-visible {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
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
      if (!this.hasVideo || !this.visible) {
        return;
      }
      this._ensureMounted();
      const formatted = formatSpeed(speed !== undefined ? speed : this.speed);
      this._toast.textContent = formatted;
      this._toast.classList.add('is-visible');
      this._wake();

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
      this._pill.title = 'HBO Max Playback Speed';

      const pillIcon = this.doc.createElement('span');
      pillIcon.className = 'pill-icon';
      pillIcon.textContent = '>>';

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
      titleSpan.textContent = 'Playback Speed';
      const resetLink = this.doc.createElement('button');
      resetLink.type = 'button';
      resetLink.className = 'speed-btn is-secondary';
      resetLink.style.height = '22px';
      resetLink.style.padding = '0 8px';
      resetLink.textContent = 'Reset';
      resetLink.addEventListener('click', () => {
        this.onSelectSpeed(1.0);
      });
      header.appendChild(titleSpan);
      header.appendChild(resetLink);

      const quickGrid = this.doc.createElement('div');
      quickGrid.className = 'quick-grid';
      QUICK_PRESETS.forEach((rate) => {
        const btn = this._createPresetButton(rate, false);
        quickGrid.appendChild(btn);
      });

      const stepperRow = this.doc.createElement('div');
      stepperRow.className = 'stepper-row';

      const minusBtn = this.doc.createElement('button');
      minusBtn.type = 'button';
      minusBtn.className = 'step-btn';
      minusBtn.textContent = '−';
      minusBtn.title = 'Slower (-0.25x, Shift for -0.05x)';
      minusBtn.addEventListener('click', (e) => {
        this.onStepSpeed(-1, Boolean(e.shiftKey));
      });

      this._readout = this.doc.createElement('span');
      this._readout.className = 'stepper-readout';
      this._readout.textContent = formatSpeed(this.speed);

      const plusBtn = this.doc.createElement('button');
      plusBtn.type = 'button';
      plusBtn.className = 'step-btn';
      plusBtn.textContent = '+';
      plusBtn.title = 'Faster (+0.25x, Shift for +0.05x)';
      plusBtn.addEventListener('click', (e) => {
        this.onStepSpeed(1, Boolean(e.shiftKey));
      });

      stepperRow.appendChild(minusBtn);
      stepperRow.appendChild(this._readout);
      stepperRow.appendChild(plusBtn);

      const extendedRow = this.doc.createElement('div');
      extendedRow.className = 'extended-row';
      EXTENDED_PRESETS.forEach((rate) => {
        const btn = this._createPresetButton(rate, true);
        extendedRow.appendChild(btn);
      });

      const hint = this.doc.createElement('div');
      hint.className = 'hint';
      hint.textContent = 'Shift + / − for 0.05x • Keys [ ] \\ • Alt+1–5';

      menu.appendChild(header);
      menu.appendChild(quickGrid);
      menu.appendChild(stepperRow);
      menu.appendChild(extendedRow);
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

    _createPresetButton(rate, isSecondary) {
      const btn = this.doc.createElement('button');
      btn.type = 'button';
      btn.className = isSecondary ? 'speed-btn is-secondary' : 'speed-btn';
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
      const shouldShow = this.hasVideo && this.visible;
      this._root.classList.toggle('is-hidden', !shouldShow);
      this._dock.classList.toggle('is-open', this.isOpen);

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
