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
import {
  DIFFICULTY,
  getDifficultyMode as getStoredDifficultyMode,
  setDifficultyMode as persistDifficultyMode,
  onDifficultyModeChange as subscribeDifficultyMode,
} from './difficulty.js';

const HUD_STYLE_ID = 'hud-compact-style';

const ICONS = Object.freeze({
  heart:
    '<svg viewBox="0 0 24 24" class="hud-svg" focusable="false" aria-hidden="true"><path d="M12 20.4c-3.6-2.5-6.1-4.5-7.6-6.2C2.4 12.1 2 10 2.9 8.3 4 6.3 6.7 5.4 8.8 6.3c1 .4 1.8 1 2.4 1.8.6-.8 1.4-1.4 2.4-1.8 2.1-.9 4.8 0 5.9 2 1 1.7.5 3.8-1.5 5.9-1.5 1.6-4 3.6-7.6 6.2z" fill="currentColor"/></svg>',
  shield:
    '<svg viewBox="0 0 24 24" class="hud-svg" focusable="false" aria-hidden="true"><path d="M12 3.5 5 6v5.7c0 4.1 2.9 7.9 7 9 4.1-1.1 7-4.9 7-9V6l-7-2.5Z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M12 11v6.3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" opacity="0.6"/></svg>',
  weapon:
    '<svg viewBox="0 0 24 24" class="hud-svg" focusable="false" aria-hidden="true"><path d="M12 4v3.2M12 16.8V20" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><circle cx="12" cy="12" r="5.5" stroke="currentColor" stroke-width="1.5" fill="none"/><path d="M12 9.2v5.6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" opacity="0.6"/></svg>',
  power:
    '<svg viewBox="0 0 24 24" class="hud-svg" focusable="false" aria-hidden="true"><path d="M11 3 5.5 13.2h5l-1.5 7.8 6.9-11.4h-5L17 3H11Z" fill="currentColor"/></svg>',
});

const WEAPON_ICON_MAP = new Map([
  ['•', '<svg viewBox="0 0 24 24" class="hud-svg" focusable="false" aria-hidden="true"><circle cx="12" cy="12" r="3.5" fill="currentColor"/></svg>'],
  ['||', '<svg viewBox="0 0 24 24" class="hud-svg" focusable="false" aria-hidden="true"><path d="M9.5 6.5v11" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M14.5 6.5v11" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>'],
  ['≋', '<svg viewBox="0 0 24 24" class="hud-svg" focusable="false" aria-hidden="true"><path d="M6 9h12M6 12h12M6 15h12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>'],
  ['◎', '<svg viewBox="0 0 24 24" class="hud-svg" focusable="false" aria-hidden="true"><circle cx="12" cy="12" r="6" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="12" r="2.8" fill="currentColor" opacity="0.75"/></svg>'],
]);

export const canvas = document.getElementById('game');
export const ctx = canvas.getContext('2d');

const hudRoot = document.getElementById('hud');
const overlay = document.getElementById('overlay');
let difficultySelect = document.getElementById('difficulty-select');

const hudLives = document.getElementById('lives');
const hudScore = document.getElementById('score');
const hudTime = document.getElementById('time');
const hudPower = document.getElementById('pup');
const hudWeapon = document.getElementById('weapon');
let hudLevel = document.getElementById('level-chip');
let hudLevelLabel = document.getElementById('level-chip-label');
let hudLevelIcons = document.getElementById('level-chip-icons');
let themeSelect = document.getElementById('theme-select');
let themeSelectBound = false;
const assistToggle = document.getElementById('assist-toggle');
const hudLivesChip = document.getElementById('hud-lives-chip');
const hudShieldMeter = document.getElementById('shield-meter');
const hudShieldFill = document.getElementById('shield-fill');
const hudShieldChip = document.getElementById('hud-shield-chip');
const hudPowerChip = document.getElementById('power-chip');
const hudWeaponChip = document.getElementById('weapon-chip');
const hudWeaponIcon = document.getElementById('weapon-icon');
let autoFirePill = document.getElementById('auto-fire-pill');
let autoFireToggleBound = false;
let gamepadPill = document.getElementById('gamepad-pill');

const THEME_STORAGE_KEY = 'retro-space-run.theme';
const ASSIST_STORAGE_KEY = 'retro-space-run.assist';
const AUTO_FIRE_STORAGE_KEY = 'retro-space-run.auto-fire';

const themeListeners = new Set();
const assistListeners = new Set();
const autoFireListeners = new Set();
const DIFFICULTY_KEYS = new Set(Object.keys(DIFFICULTY));
const mutatorPulseTimers = new WeakMap();

injectHudStyles();
setupHudLayout(hudRoot);
refreshLevelChipRefs();
bindThemeControl();
bindDifficultySelect();
bindAutoFireToggle();
subscribeDifficultyMode((mode) => {
  syncDifficultySelect(mode);
});

let DPR = window.devicePixelRatio || 1;
let VIEW_W = window.innerWidth || canvas.clientWidth || canvas.width || 0;
let VIEW_H = window.innerHeight || canvas.clientHeight || canvas.height || 0;

function syncDifficultySelect(mode = getStoredDifficultyMode()) {
  if (!difficultySelect) {
    return;
  }
  const target = typeof mode === 'string' && DIFFICULTY_KEYS.has(mode)
    ? mode
    : getStoredDifficultyMode();
  if (difficultySelect.value !== target) {
    difficultySelect.value = target;
  }
}

function handleDifficultySelectChange(event) {
  const value = event?.target?.value;
  if (typeof value !== 'string') {
    return;
  }
  persistDifficultyMode(value);
}

function bindDifficultySelect() {
  const element = document.getElementById('difficulty-select');
  if (difficultySelect && difficultySelect !== element) {
    difficultySelect.removeEventListener('change', handleDifficultySelectChange);
  }
  difficultySelect = element;
  if (!difficultySelect) {
    return;
  }
  syncDifficultySelect();
  difficultySelect.addEventListener('change', handleDifficultySelectChange);
}

function handleThemeSelectChange(event) {
  const value = event?.target?.value;
  if (typeof value !== 'string') {
    return;
  }
  setThemeInternal(value);
}

function bindThemeControl() {
  const element = document.getElementById('theme-select');
  if (themeSelect && themeSelect !== element && themeSelectBound) {
    themeSelect.removeEventListener('change', handleThemeSelectChange);
    themeSelectBound = false;
  }
  themeSelect = element;
  if (!themeSelect) {
    return null;
  }
  if (!themeSelectBound) {
    themeSelect.addEventListener('change', handleThemeSelectChange);
    themeSelectBound = true;
  }
  return themeSelect;
}

function bindAutoFireToggle() {
  const element = document.getElementById('auto-fire-pill');
  if (autoFirePill && autoFirePill !== element && autoFireToggleBound) {
    autoFirePill.removeEventListener('click', handleAutoFireToggleClick);
    autoFireToggleBound = false;
  }
  autoFirePill = element;
  if (!autoFirePill || autoFireToggleBound) {
    return autoFirePill;
  }
  autoFirePill.addEventListener('click', handleAutoFireToggleClick);
  autoFireToggleBound = true;
  return autoFirePill;
}

function handleAutoFireToggleClick(event) {
  if (event?.preventDefault) {
    event.preventDefault();
  }
  toggleAutoFire();
}

function refreshLevelChipRefs() {
  hudLevel = document.getElementById('level-chip');
  hudLevelLabel = document.getElementById('level-chip-label');
  hudLevelIcons = document.getElementById('level-chip-icons');
}

function ensureLevelIconRoot() {
  if (!hudLevelIcons || !hudLevelIcons.isConnected) {
    refreshLevelChipRefs();
  }
  return hudLevelIcons;
}

function injectHudStyles() {
  if (typeof document === 'undefined' || document.getElementById(HUD_STYLE_ID)) {
    return;
  }
  const style = document.createElement('style');
  style.id = HUD_STYLE_ID;
  style.textContent = `
    #hud {
      position: fixed;
      bottom: calc(env(safe-area-inset-bottom, 0px) + 16px);
      top: auto;
      left: 50%;
      transform: translate(-50%, 0);
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.55rem;
      max-width: min(92vw, 880px);
      font-weight: 600;
      letter-spacing: 0.03em;
      padding: 0;
      background: transparent;
      z-index: 30;
    }
    #hud .hud-main,
    #hud .hud-secondary {
      border-radius: 14px;
      background: #0a0d1acc;
      border: 1px solid #ffffff1f;
      box-shadow: 0 0 14px #00e5ff1f;
      backdrop-filter: blur(4px);
    }
    #hud .hud-main {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.65rem;
      padding: 0.45rem 0.75rem;
    }
    #hud .hud-secondary {
      display: flex;
      align-items: center;
      justify-content: center;
      flex-wrap: wrap;
      gap: 0.45rem;
      padding: 0.3rem 0.6rem;
    }
    #hud .hud-secondary-group {
      display: flex;
      align-items: center;
      gap: 0.45rem;
      flex-wrap: wrap;
    }
    #hud .hud-section {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      min-width: 0;
    }
    #hud .hud-section--center {
      justify-content: center;
      text-align: center;
    }
    #hud .hud-section--center .hud-chip {
      flex-direction: column;
      align-items: center;
      gap: 0.1rem;
      font-size: 0.85rem;
      min-width: 5.2rem;
    }
    #hud .hud-chip {
      display: inline-flex;
      align-items: center;
      gap: 0.45rem;
      min-height: 2rem;
      padding: 0;
      color: var(--hud);
      font-size: 0.92rem;
      white-space: nowrap;
    }
    #hud .hud-chip .hud-title {
      display: block;
      font-size: 0.64rem;
      text-transform: uppercase;
      letter-spacing: 0.14em;
      opacity: 0.78;
    }
    #hud .hud-chip .hud-value {
      display: block;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
      letter-spacing: 0.04em;
    }
    #hud .hud-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 1.35rem;
      height: 1.35rem;
      color: var(--cyn);
    }
    #hud .hud-chip--lives .hud-icon,
    #hud .hud-chip--power .hud-icon {
      color: var(--mag);
    }
    #hud .hud-chip--shield .hud-icon {
      color: var(--cyn);
    }
    #hud .hud-chip--shield .hud-title {
      margin-bottom: 0.05rem;
    }
    #hud .hud-chip--shield .hud-text {
      display: flex;
      flex-direction: column;
      gap: 0.18rem;
    }
    #hud .hud-shield-meter {
      position: relative;
      width: 6rem;
      height: 0.35rem;
      border-radius: 999px;
      background: #ffffff16;
      overflow: hidden;
    }
    #hud .hud-shield-fill {
      position: absolute;
      inset: 0;
      width: 0%;
      background: linear-gradient(90deg, var(--cyn), var(--mag));
      transition: width 0.2s ease-out;
    }
    #hud .hud-svg {
      width: 1.1rem;
      height: 1.1rem;
    }
    #hud .pill {
      background: #ffffff08;
    }
    #hud .pill--level {
      display: inline-flex;
      align-items: center;
      gap: 0.45rem;
      padding: 0.2rem 0.75rem;
      font-size: 0.82rem;
      letter-spacing: 0.08em;
      font-weight: 700;
      text-transform: none;
      white-space: nowrap;
      max-width: 22rem;
      overflow: hidden;
    }
    #hud .pill--level .level-chip__label {
      display: block;
      max-width: 16rem;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    #hud .level-chip__icons {
      display: inline-flex;
      align-items: center;
      gap: 0.3rem;
    }
    #hud .level-chip__icons[hidden] {
      display: none;
    }
    #hud .level-chip__icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 1.2rem;
      height: 1.2rem;
      border-radius: 999px;
      font-size: 0.82rem;
      line-height: 1;
      color: var(--cyn);
      text-shadow: 0 0 8px var(--mag);
      box-shadow: 0 0 8px #00e5ff33 inset, 0 0 10px #ff3df722;
      background: #ffffff12;
    }
    #hud .level-chip__icon--wind-right {
      animation: levelChipWindRight 1.8s ease-in-out infinite;
    }
    #hud .level-chip__icon--wind-left {
      animation: levelChipWindLeft 1.8s ease-in-out infinite;
    }
    #hud .level-chip__icon--squall {
      animation: levelChipSquall 2.6s linear infinite;
    }
    #hud .level-chip__icon--squall.level-chip__icon--squall-burst {
      animation: levelChipSquall 2.6s linear infinite, levelChipSquallBurst 0.65s ease-out;
    }
    @keyframes levelChipWindRight {
      0% {
        transform: translateX(0);
      }
      50% {
        transform: translateX(4px);
      }
      100% {
        transform: translateX(0);
      }
    }
    @keyframes levelChipWindLeft {
      0% {
        transform: translateX(0);
      }
      50% {
        transform: translateX(-4px);
      }
      100% {
        transform: translateX(0);
      }
    }
    @keyframes levelChipSquall {
      0% {
        transform: rotate(0deg);
      }
      100% {
        transform: rotate(360deg);
      }
    }
    @keyframes levelChipSquallBurst {
      0% {
        transform: scale(1) rotate(0deg);
      }
      35% {
        transform: scale(1.35) rotate(80deg);
      }
      100% {
        transform: scale(1) rotate(360deg);
      }
    }
    #hud button.pill {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      padding: 0.25rem 0.75rem;
    }
    #hud .pill.pill--auto {
      font-size: 0.72rem;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      padding: 0.2rem 0.65rem;
      opacity: 0.82;
    }
    #hud .pill.pill--auto .pill__icon {
      font-size: 0.9rem;
      line-height: 1;
      opacity: 0.8;
    }
    #hud .pill.pill--auto.is-on {
      box-shadow: 0 0 8px #00e5ff44 inset, 0 0 8px #ff3df744;
      background: #ffffff12;
      opacity: 1;
    }
    #hud .pill.pill--gamepad {
      font-size: 0.7rem;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      padding: 0.2rem 0.6rem;
      opacity: 0.72;
    }
    #hud .pill.pill--gamepad.is-active {
      opacity: 1;
      background: #ffffff12;
      box-shadow: 0 0 8px #00e5ff33 inset, 0 0 12px #00e5ff1f;
    }
    #hud .pill.pill--theme {
      display: inline-flex;
      align-items: center;
      gap: 0.45rem;
    }
    #hud .pill.pill--theme .hud-title {
      opacity: 0.78;
    }
    @media (max-width: 720px) {
      #hud {
        transform: translate(-50%, 0) scale(0.95);
      }
      #hud .hud-section {
        gap: 0.45rem;
      }
      #hud .hud-shield-meter {
        width: 4.6rem;
      }
    }
    @media (max-width: 520px) {
      #hud {
        transform: translate(-50%, 0) scale(0.9);
      }
    }
  `;
  document.head.appendChild(style);
}

function setupHudLayout(root) {
  if (!root || root.dataset.layout === 'compact') {
    return;
  }
  root.dataset.layout = 'compact';
  root.innerHTML = `
    <div class="hud-main">
      <div class="hud-section hud-section--left">
        <div class="hud-chip hud-chip--lives" id="hud-lives-chip" aria-live="polite" title="Lives remaining: 3">
          <span class="hud-icon" aria-hidden="true">${ICONS.heart}</span>
          <div class="hud-text">
            <span class="hud-title">Lives</span>
            <span class="hud-value" id="lives">3</span>
          </div>
        </div>
        <div class="hud-chip hud-chip--shield" id="hud-shield-chip" title="Shield strength: 0%">
          <span class="hud-icon" aria-hidden="true">${ICONS.shield}</span>
          <div class="hud-text">
            <span class="hud-title">Shield</span>
            <div class="hud-shield-meter" id="shield-meter" role="progressbar" aria-label="Shield strength" aria-valuemin="0" aria-valuemax="1" aria-valuenow="0">
              <span class="hud-shield-fill" id="shield-fill"></span>
            </div>
          </div>
        </div>
      </div>
      <div class="hud-section hud-section--center" role="group" aria-label="Mission progress">
        <div class="hud-chip hud-chip--stat" id="score-chip" title="Score">
          <span class="hud-title">Score</span>
          <span class="hud-value" id="score">0</span>
        </div>
        <div class="hud-chip hud-chip--stat" id="time-chip" title="Time elapsed">
          <span class="hud-title">Time</span>
          <span class="hud-value" id="time">0s</span>
        </div>
      </div>
      <div class="hud-section hud-section--right">
        <div class="hud-chip hud-chip--weapon" id="weapon-chip" title="Weapon: None">
          <span class="hud-icon" id="weapon-icon" aria-hidden="true">${ICONS.weapon}</span>
          <div class="hud-text">
            <span class="hud-title">Weapon</span>
            <span class="hud-value" id="weapon">None</span>
          </div>
        </div>
        <div class="hud-chip hud-chip--power" id="power-chip" title="Power-up: None">
          <span class="hud-icon" aria-hidden="true">${ICONS.power}</span>
          <div class="hud-text">
            <span class="hud-title">Power-up</span>
            <span class="hud-value" id="pup">None</span>
          </div>
        </div>
      </div>
    </div>
    <div class="hud-secondary">
      <span id="level-chip" class="pill pill--level" aria-live="polite">
        <span id="level-chip-label" class="level-chip__label">—</span>
        <span id="level-chip-icons" class="level-chip__icons" aria-hidden="true" hidden></span>
      </span>
      <div class="hud-secondary-group">
        <button id="assist-toggle" class="pill" type="button" aria-pressed="false">Assist: Off</button>
        <button
          id="auto-fire-pill"
          class="pill pill--auto"
          type="button"
          aria-pressed="false"
        >
          <span class="pill__icon" aria-hidden="true">⌁</span>
          <span class="pill__text">Auto: Off</span>
        </button>
        <span
          id="gamepad-pill"
          class="pill pill--gamepad"
          role="status"
          aria-live="polite"
          aria-hidden="true"
          hidden
        >Gamepad: Connected</span>
        <span class="pill pill--theme">
          <span class="hud-title">Theme</span>
          <select id="theme-select" class="hud-theme" aria-label="Theme selection"></select>
        </span>
      </div>
    </div>
  `;
}

function resolveWeaponIcon(icon) {
  if (typeof icon === 'string' && icon.includes('<svg')) {
    return icon;
  }
  if (typeof icon === 'string' && WEAPON_ICON_MAP.has(icon)) {
    return WEAPON_ICON_MAP.get(icon);
  }
  return ICONS.weapon;
}

function normalizeWeaponLabel(label) {
  const raw = typeof label === 'string' && label.trim().length ? label.trim() : 'None';
  const separators = [' · ', ' – ', ' - ', ' — '];
  for (const sep of separators) {
    const parts = raw.split(sep);
    if (parts.length === 2) {
      const name = parts[0].trim();
      const level = parts[1].trim();
      const display = name && level ? `${name} · ${level}` : raw;
      return {
        display,
        name: name || null,
        level: level || null,
      };
    }
  }
  return { display: raw, name: raw !== 'None' ? raw : null, level: null };
}

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
let autoFire = readStoredAutoFire();

function readStoredAutoFire() {
  try {
    const stored = window.localStorage?.getItem(AUTO_FIRE_STORAGE_KEY);
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

function populateThemeControl() {
  const control = themeSelect?.isConnected ? themeSelect : bindThemeControl();
  if (!control) {
    return;
  }
  const entries = getThemeKeys()
    .map((key) => ({ key, label: getThemeLabel(key) }))
    .sort((a, b) => a.label.localeCompare(b.label));
  control.innerHTML = '';
  for (const { key, label } of entries) {
    const option = document.createElement('option');
    option.value = key;
    option.textContent = label;
    option.setAttribute('aria-label', label);
    control.appendChild(option);
  }
}

function syncThemeControl() {
  const control = themeSelect?.isConnected ? themeSelect : bindThemeControl();
  if (!control) {
    return;
  }
  if (control.value !== activeThemeKey) {
    control.value = activeThemeKey;
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

function syncAutoFirePill() {
  const toggle = bindAutoFireToggle();
  if (!toggle) {
    return;
  }
  const stateLabel = autoFire ? 'On' : 'Off';
  toggle.innerHTML = `<span class="pill__icon" aria-hidden="true">⌁</span><span class="pill__text">Auto: ${stateLabel}</span>`;
  toggle.setAttribute('aria-label', `Auto-fire ${stateLabel.toLowerCase()} (press T)`);
  toggle.setAttribute('aria-pressed', autoFire ? 'true' : 'false');
  toggle.classList.toggle('is-on', autoFire);
  toggle.title = autoFire ? 'Auto-fire enabled (T to toggle)' : 'Auto-fire disabled (T to toggle)';
}

export function setGamepadIndicator(connected) {
  if (!gamepadPill) {
    gamepadPill = document.getElementById('gamepad-pill');
    if (!gamepadPill) {
      return;
    }
  }
  const isConnected = Boolean(connected);
  gamepadPill.hidden = !isConnected;
  gamepadPill.setAttribute('aria-hidden', isConnected ? 'false' : 'true');
  gamepadPill.classList.toggle('is-active', isConnected);
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

function emitAutoFireChange() {
  for (const cb of autoFireListeners) {
    cb(autoFire);
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
syncAutoFirePill();

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

function setAutoFireInternal(enabled, { persist = true } = {}) {
  const value = Boolean(enabled);
  if (autoFire === value) {
    return;
  }
  autoFire = value;
  syncAutoFirePill();
  if (persist) {
    try {
      window.localStorage?.setItem(AUTO_FIRE_STORAGE_KEY, autoFire ? 'on' : 'off');
    } catch (err) {
      /* ignore storage errors */
    }
  }
  emitAutoFireChange();
}

export function getAutoFire() {
  return autoFire;
}

export function setAutoFire(enabled) {
  setAutoFireInternal(enabled);
}

export function toggleAutoFire() {
  setAutoFireInternal(!autoFire);
}

export function onAutoFireChange(handler, { immediate = true } = {}) {
  if (typeof handler !== 'function') {
    return () => {};
  }
  autoFireListeners.add(handler);
  if (immediate) {
    handler(autoFire);
  }
  return () => {
    autoFireListeners.delete(handler);
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
  bindDifficultySelect();
  const focusTarget = overlay.querySelector('[autofocus], .btn, button, [role="button"]');
  if (focusTarget?.focus) {
    focusTarget.focus();
  }
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
  if (!hudLives) {
    return;
  }
  const safeValue = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
  hudLives.textContent = `${safeValue}`;
  if (hudLivesChip) {
    const label = `Lives remaining: ${safeValue}`;
    hudLivesChip.setAttribute('title', label);
    hudLivesChip.setAttribute('aria-label', label);
  }
}

export function updateScore(value) {
  hudScore.textContent = value;
}

export function updateTime(value) {
  const seconds = value ?? 0;
  hudTime.textContent = `${seconds}s`;
}

export function updateShield(value = 0, maxValue = 1) {
  if (!hudShieldMeter || !hudShieldFill) {
    return;
  }
  const safeMax = Number.isFinite(maxValue) && maxValue > 0 ? maxValue : 1;
  const safeValue = Number.isFinite(value) ? Math.max(0, Math.min(value, safeMax)) : 0;
  const ratio = safeMax === 0 ? 0 : safeValue / safeMax;
  const percent = Math.round(ratio * 100);
  hudShieldFill.style.width = `${Math.max(0, Math.min(100, percent))}%`;
  hudShieldMeter.setAttribute('aria-valuenow', ratio.toFixed(2));
  hudShieldMeter.setAttribute('aria-valuetext', `${percent}%`);
  if (hudShieldChip) {
    const label = `Shield strength: ${percent}%`;
    hudShieldChip.setAttribute('title', label);
    hudShieldChip.setAttribute('aria-label', label);
  }
}

export function updatePower(label) {
  if (!hudPower) {
    return;
  }
  const cleanLabel = typeof label === 'string' && label.trim().length ? label.trim() : 'None';
  hudPower.textContent = cleanLabel;
  if (hudPowerChip) {
    const desc = `Power-up: ${cleanLabel}`;
    hudPowerChip.setAttribute('title', desc);
    hudPowerChip.setAttribute('aria-label', desc);
  }
}

export function updateLevelChip({ levelIndex, name, mutators } = {}) {
  if (!hudLevel) {
    return;
  }
  const parts = [];
  if (Number.isFinite(levelIndex)) {
    const safeIndex = Math.max(1, Math.floor(levelIndex));
    parts.push(`L${safeIndex}`);
  }
  const cleanName = typeof name === 'string' ? name.trim() : '';
  if (cleanName) {
    parts.push(cleanName);
  }
  const baseLabel = parts.length ? parts.join(' · ') : '—';
  if (hudLevelLabel) {
    hudLevelLabel.textContent = baseLabel;
  } else if (!hudLevelIcons) {
    hudLevel.textContent = baseLabel;
  }
  const descriptors = Array.isArray(mutators)
    ? mutators
        .map((entry) => ({
          icon: typeof entry?.icon === 'string' ? entry.icon.trim() : '',
          label: typeof entry?.label === 'string' ? entry.label : '',
          kind: entry?.kind,
          direction: entry?.direction,
        }))
        .filter((entry) => entry.icon.length > 0)
    : [];
  if (hudLevelIcons) {
    hudLevelIcons.textContent = '';
    if (descriptors.length) {
      for (const descriptor of descriptors) {
        const icon = document.createElement('span');
        icon.classList.add('level-chip__icon');
        if (descriptor.kind) {
          icon.classList.add(`level-chip__icon--${descriptor.kind}`);
        }
        if (descriptor.kind) {
          icon.dataset.kind = descriptor.kind;
        }
        if (descriptor.kind === 'wind' && descriptor.direction) {
          icon.dataset.direction = descriptor.direction;
          icon.classList.add(`level-chip__icon--wind-${descriptor.direction}`);
        }
        icon.textContent = descriptor.icon;
        icon.setAttribute('aria-hidden', 'true');
        if (descriptor.label) {
          icon.title = descriptor.label;
        }
        hudLevelIcons.appendChild(icon);
      }
      hudLevelIcons.removeAttribute('hidden');
    } else {
      hudLevelIcons.setAttribute('hidden', 'hidden');
    }
  }
  const mutatorLabels = descriptors
    .map((entry) => entry.label)
    .filter((value) => typeof value === 'string' && value.trim().length > 0);
  const accessibleLabel = mutatorLabels.length
    ? `${baseLabel} · ${mutatorLabels.join(' · ')}`
    : baseLabel;
  hudLevel.title = accessibleLabel;
  hudLevel.setAttribute('aria-label', `Level status: ${accessibleLabel}`);
  if (!hudLevelLabel && !hudLevelIcons) {
    hudLevel.textContent = accessibleLabel;
  }
}

export function pulseMutatorIcon(kind) {
  const cleanKind = typeof kind === 'string' ? kind.trim() : '';
  if (!cleanKind) {
    return;
  }
  const root = ensureLevelIconRoot();
  if (!root) {
    return;
  }
  const target = root.querySelector(`.level-chip__icon--${cleanKind}`);
  if (!target) {
    return;
  }
  const pulseClass = `level-chip__icon--${cleanKind}-burst`;
  const existing = mutatorPulseTimers.get(target);
  if (existing) {
    window.clearTimeout(existing);
  }
  target.classList.add(pulseClass);
  const timeout = window.setTimeout(() => {
    target.classList.remove(pulseClass);
    mutatorPulseTimers.delete(target);
  }, 720);
  mutatorPulseTimers.set(target, timeout);
}

export function updateWeapon(
  label,
  { icon } = {},
) {
  const resolved = normalizeWeaponLabel(label);
  if (hudWeapon) {
    hudWeapon.textContent = resolved.display;
  }
  if (hudWeaponIcon) {
    hudWeaponIcon.innerHTML = resolveWeaponIcon(icon);
  }
  if (hudWeaponChip) {
    const descriptor = `Weapon: ${resolved.display}`;
    hudWeaponChip.setAttribute('title', descriptor);
    hudWeaponChip.setAttribute('aria-label', descriptor);
  }
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

export function setTheme(key, { persist = true } = {}) {
  setThemeInternal(key, persist);
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
