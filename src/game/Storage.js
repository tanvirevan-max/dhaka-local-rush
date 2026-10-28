// Thin localStorage wrapper. Every call is wrapped in try/catch because storage can throw
// (private windows, blocked site data) - the game must keep working without it.
import { DEFAULT_SETTINGS, STORAGE_KEYS } from '../config/gameConfig.js';

export function loadBest() {
  try {
    const v = Number(localStorage.getItem(STORAGE_KEYS.best));
    return Number.isFinite(v) && v > 0 ? v : 0;
  } catch (e) { return 0; }
}

export function saveBest(score) {
  try { localStorage.setItem(STORAGE_KEYS.best, String(Math.round(score))); } catch (e) { /* ignore */ }
}

export function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.settings);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_SETTINGS, ...(parsed && typeof parsed === 'object' ? parsed : {}) };
  } catch (e) { return { ...DEFAULT_SETTINGS }; }
}

export function saveSettings(settings) {
  try { localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(settings)); } catch (e) { /* ignore */ }
}
