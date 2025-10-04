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

const THEME_STORAGE_KEY = 'retro-space-run.theme';

const themeListeners = new Set();

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

function emitThemeChange() {
  const palette = getThemePalette(activeThemeKey);
  applyThemeToDocument(palette);
  for (const cb of themeListeners) {
    cb(activeThemeKey, palette);
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

if (themeSelect) {
  themeSelect.addEventListener('change', (event) => {
    setThemeInternal(event.target.value);
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
  hudTime.textContent = value;
}

export function updatePower(label) {
  hudPower.textContent = label || '—';
}

export function updateWeapon(label) {
  hudWeapon.textContent = label;
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
