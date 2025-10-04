/**
 * ui.js — canvas sizing, HUD updates, overlay controls, and theme selection
 * management for Retro Space Run.
 */
import {
  DEFAULT_THEME_KEY,
  THEMES,
  getThemeKeys,
  getThemeLabel,
  getThemePalette,
} from './themes.js';

export const canvas = document.getElementById('game');
export const ctx = canvas.getContext('2d');

let DPR = window.devicePixelRatio || 1;
let VIEW_W = window.innerWidth || canvas.clientWidth || canvas.width || 0;
let VIEW_H = window.innerHeight || canvas.clientHeight || canvas.height || 0;

const hudLives = document.getElementById('lives');
const hudScore = document.getElementById('score');
const hudTime = document.getElementById('time');
const hudPower = document.getElementById('pup');
const hudWeapon = document.getElementById('weapon');
const overlay = document.getElementById('overlay');
const themeSelect = document.getElementById('theme-select');
const assistToggle = document.getElementById('assist-toggle');

const THEME_STORAGE_KEY = 'retro-space-run.theme';
const ASSIST_STORAGE_KEY = 'retro-space-run.assist';

const themeListeners = new Set();
const assistListeners = new Set();

function readStoredTheme() {
  try {
    const stored = window.localStorage?.getItem(THEME_STORAGE_KEY);
    if (stored && THEMES[stored]) {
      return stored;
    }
  } catch (err) {
    /* ignore storage errors */
  }
  return DEFAULT_THEME_KEY;
}

let activeThemeKey = readStoredTheme();

function readStoredAssist() {
  try {
    const stored = window.localStorage?.getItem(ASSIST_STORAGE_KEY);
    if (stored === 'on') {
      return true;
    }
    if (stored === 'off') {
      return false;
    }
  } catch (err) {
    /* ignore storage errors */
  }
  return false;
}

let assistMode = readStoredAssist();

function populateThemeControl() {
  if (!themeSelect) {
    return;
  }
  const keys = getThemeKeys();
  themeSelect.innerHTML = '';
  for (const key of keys) {
    const option = document.createElement('option');
    option.value = key;
    option.textContent = getThemeLabel(key);
    themeSelect.appendChild(option);
  }
}

function syncThemeControl() {
  if (themeSelect) {
    themeSelect.value = activeThemeKey;
  }
}

function applyThemeToDocument(palette) {
  const root = document.documentElement;
  root.style.setProperty('--mag', palette.hud.accent);
  root.style.setProperty('--cyn', palette.hud.secondary);
  root.style.setProperty('--hud', palette.hud.text);
  root.style.setProperty('--bg', palette.background.base);
  if (document.body) {
    document.body.style.background = palette.background.gradient;
  }
  const hud = document.getElementById('hud');
  if (hud) {
    hud.style.textShadow = `0 0 6px ${palette.hud.secondary}88, 0 0 12px ${palette.hud.accent}44`;
  }
}

function syncAssistToggle() {
  if (!assistToggle) {
    return;
  }
  assistToggle.textContent = `Assist: ${assistMode ? 'On' : 'Off'}`;
  assistToggle.setAttribute('aria-pressed', assistMode ? 'true' : 'false');
  assistToggle.classList.toggle('is-on', assistMode);
}

function emitThemeChange() {
  const palette = getThemePalette(activeThemeKey);
  applyThemeToDocument(palette);
  for (const cb of themeListeners) {
    cb(activeThemeKey, palette);
  }
}

function emitAssistChange() {
  for (const cb of assistListeners) {
    cb(assistMode);
  }
}

function setThemeInternal(key, persist = true) {
  if (!THEMES[key]) {
    return;
  }
  activeThemeKey = key;
  syncThemeControl();
  if (persist) {
    try {
      window.localStorage?.setItem(THEME_STORAGE_KEY, key);
    } catch (err) {
      /* ignore storage errors */
    }
  }
  emitThemeChange();
}

populateThemeControl();
syncThemeControl();
emitThemeChange();
syncAssistToggle();

if (themeSelect) {
  themeSelect.addEventListener('change', (event) => {
    setThemeInternal(event.target.value);
  });
}

if (assistToggle) {
  assistToggle.addEventListener('click', () => {
    toggleAssistMode();
  });
}

function fitCanvas() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.max(window.innerWidth || canvas.clientWidth || 0, 1);
  const h = Math.max(window.innerHeight || canvas.clientHeight || 0, 1);
  DPR = dpr;
  VIEW_W = w;
  VIEW_H = h;
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

window.addEventListener('resize', fitCanvas);
fitCanvas();

export function getViewSize() {
  return { w: VIEW_W, h: VIEW_H, dpr: DPR };
}

export function getAssistMode() {
  return assistMode;
}

function setAssistModeInternal(enabled, { persist = true } = {}) {
  const value = Boolean(enabled);
  if (assistMode === value) {
    return;
  }
  assistMode = value;
  syncAssistToggle();
  if (persist) {
    try {
      window.localStorage?.setItem(ASSIST_STORAGE_KEY, assistMode ? 'on' : 'off');
    } catch (err) {
      /* ignore storage errors */
    }
  }
  emitAssistChange();
}

export function setAssistMode(enabled) {
  setAssistModeInternal(enabled);
}

export function toggleAssistMode() {
  setAssistModeInternal(!assistMode);
}

export function onAssistChange(handler, { immediate = true } = {}) {
  if (typeof handler !== 'function') {
    return () => {};
  }
  assistListeners.add(handler);
  if (immediate) {
    handler(assistMode);
  }
  return () => {
    assistListeners.delete(handler);
  };
}

let startHandler = null;

function bindStartButton() {
  if (!startHandler) {
    return;
  }
  const btn = document.getElementById('btn');
  if (btn) {
    btn.onclick = startHandler;
  }
}

export function setStartHandler(handler) {
  startHandler = handler;
  bindStartButton();
}

export function showOverlay(html) {
  overlay.innerHTML = html;
  overlay.style.display = 'block';
  bindStartButton();
}

export function hideOverlay() {
  overlay.style.display = 'none';
}

export function showPauseOverlay() {
  overlay.style.display = 'block';
  overlay.innerHTML = '<h1>PAUSED</h1><p>Press P to resume</p>';
  bindStartButton();
}

export function updateLives(value) {
  hudLives.textContent = value;
}

export function updateScore(value) {
  hudScore.textContent = value;
}

export function updateTime(value) {
  const seconds = value ?? 0;
  hudTime.textContent = `${seconds}s`;
}

export function updatePower(label) {
  hudPower.textContent = label || 'None';
}

export function updateWeapon(label) {
  hudWeapon.textContent = label || 'None';
}

export function currentOverlay() {
  return overlay;
}

export function getActiveThemeKey() {
  return activeThemeKey;
}

export function getActiveThemePalette() {
  return getThemePalette(activeThemeKey);
}

export function setTheme(key) {
  setThemeInternal(key);
}

export function onThemeChange(handler, { immediate = true } = {}) {
  if (typeof handler !== 'function') {
    return () => {};
  }
  themeListeners.add(handler);
  if (immediate) {
    handler(activeThemeKey, getThemePalette(activeThemeKey));
  }
  return () => {
    themeListeners.delete(handler);
  };
}
