// Unified keyboard + touch input. Gameplay code reads `input.throttle / brake / steer / boost / horn`.
// steer: -1 = full left, +1 = full right (smoothed).
import { CONTROLS } from '../config/gameConfig.js';
import { clamp } from './utils.js';

const ACTIONS = ['accel', 'brake', 'left', 'right', 'boost', 'horn'];

export class InputManager {
  constructor() {
    this.keyDown = Object.fromEntries(ACTIONS.map((a) => [a, false]));
    this.touchCount = Object.fromEntries(ACTIONS.map((a) => [a, 0]));
    this.steer = 0;
    this.throttle = 0;
    this.brake = 0;
    this.boost = false;
    this.horn = false;
    this.hornPressed = false;     // edge: true for one frame when the horn goes down
    this.listeners = { pause: [], restart: [] };
    this.enabled = false;         // gameplay capture on/off (menus are handled by the DOM)
    this._hornPrev = false;
    this.codeToAction = new Map();
    this.rebuildKeyMap();

    this._onKeyDown = (e) => this.handleKey(e, true);
    this._onKeyUp = (e) => this.handleKey(e, false);
    this._onBlur = () => this.releaseAll();
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('blur', this._onBlur);
    // block page scrolling / zooming gestures while playing
    this._onTouchMove = (e) => { if (this.enabled && e.cancelable) e.preventDefault(); };
    document.addEventListener('touchmove', this._onTouchMove, { passive: false });
    this._onContext = (e) => { if (this.enabled) e.preventDefault(); };
    window.addEventListener('contextmenu', this._onContext);
  }

  rebuildKeyMap() {
    this.codeToAction.clear();
    for (const [action, codes] of Object.entries(CONTROLS.keys)) for (const c of codes) this.codeToAction.set(c, action);
  }

  on(event, fn) { this.listeners[event].push(fn); }
  emit(event) { for (const fn of this.listeners[event]) fn(); }

  setEnabled(on) {
    this.enabled = on;
    if (!on) this.releaseAll();
  }

  handleKey(e, down) {
    const action = this.codeToAction.get(e.code);
    if (!action) return;
    if (action === 'pause') { if (down && !e.repeat) this.emit('pause'); if (this.enabled) e.preventDefault(); return; }
    if (action === 'restart') { if (down && !e.repeat) this.emit('restart'); return; }
    if (!this.enabled && down) return;
    if (this.enabled) e.preventDefault();
    this.keyDown[action] = down;
  }

  /** Bind an on-screen button element to an action. Safe to call many times (e.g. after rebuilding the HUD). */
  bindButton(el, action) {
    let activePointers = new Set();
    const press = (e) => {
      e.preventDefault();
      if (activePointers.has(e.pointerId)) return;
      activePointers.add(e.pointerId);
      this.touchCount[action]++;
      el.classList.add('down');
      try { el.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    };
    const release = (e) => {
      if (!activePointers.has(e.pointerId)) return;
      activePointers.delete(e.pointerId);
      this.touchCount[action] = Math.max(0, this.touchCount[action] - 1);
      if (activePointers.size === 0) el.classList.remove('down');
    };
    el.addEventListener('pointerdown', press);
    el.addEventListener('pointerup', release);
    el.addEventListener('pointercancel', release);
    el.addEventListener('lostpointercapture', release);
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    el.style.touchAction = 'none';
  }

  isActive(action) { return this.keyDown[action] || this.touchCount[action] > 0; }

  releaseAll() {
    for (const a of ACTIONS) { this.keyDown[a] = false; this.touchCount[a] = 0; }
    this.steer = 0; this.throttle = 0; this.brake = 0; this.boost = false; this.horn = false;
    document.querySelectorAll('.tbtn.down').forEach((el) => el.classList.remove('down'));
  }

  update(dt) {
    const l = this.isActive('left'), r = this.isActive('right');
    const target = (r ? 1 : 0) - (l ? 1 : 0);
    const rate = target === 0 || Math.sign(target) !== Math.sign(this.steer) ? CONTROLS.steerFallRate : CONTROLS.steerRiseRate;
    const step = rate * dt;
    if (this.steer < target) this.steer = Math.min(target, this.steer + step);
    else if (this.steer > target) this.steer = Math.max(target, this.steer - step);
    this.steer = clamp(this.steer, -1, 1);
    this.throttle = this.isActive('accel') ? 1 : 0;
    this.brake = this.isActive('brake') ? 1 : 0;
    this.boost = this.isActive('boost');
    this.horn = this.isActive('horn');
    this.hornPressed = this.horn && !this._hornPrev;
    this._hornPrev = this.horn;
  }

  dispose() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('blur', this._onBlur);
    document.removeEventListener('touchmove', this._onTouchMove);
    window.removeEventListener('contextmenu', this._onContext);
  }
}
