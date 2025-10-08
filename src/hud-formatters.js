/**
 * hud-formatters.js — shared formatting helpers for HUD labels/icons.
 */

const WEAPON_DISPLAY_NAMES = Object.freeze({
  pulse: 'Pulse Cannon',
  twin: 'Twin Blaster',
  burst: 'Burst Laser',
  heavy: 'Heavy Plasma',
});

const WEAPON_LEVEL_CAPS = Object.freeze({
  pulse: 3,
  twin: 3,
  burst: 3,
  heavy: 3,
});

const WEAPON_GLYPHS = Object.freeze({
  pulse: '•',
  twin: '∥',
  burst: '≋',
  heavy: '◎',
});

const ROMAN_NUMERALS = ['I', 'II', 'III', 'IV', 'V'];

function sanitizeKey(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function clampLevelIndex(name, level = 0) {
  const safeLevel = Number.isFinite(level) ? Math.max(0, Math.floor(level)) : 0;
  const cap = WEAPON_LEVEL_CAPS[name];
  if (!Number.isFinite(cap) || cap <= 0) {
    return Math.min(safeLevel, ROMAN_NUMERALS.length - 1);
  }
  return Math.min(safeLevel, Math.max(0, cap - 1));
}

export function getWeaponDisplayName(key) {
  const normalized = sanitizeKey(key);
  if (!normalized) {
    return null;
  }
  return WEAPON_DISPLAY_NAMES[normalized] ?? null;
}

export function weaponGlyph(weapon) {
  const name = sanitizeKey(weapon?.name);
  if (!name) {
    return '·';
  }
  return WEAPON_GLYPHS[name] ?? '•';
}

export function labelWeapon(weapon) {
  const name = sanitizeKey(weapon?.name);
  if (!name) {
    return 'None';
  }
  const displayName = getWeaponDisplayName(name);
  if (!displayName) {
    return 'None';
  }
  const levelIndex = clampLevelIndex(name, weapon?.level ?? 0);
  const roman = ROMAN_NUMERALS[Math.min(levelIndex, ROMAN_NUMERALS.length - 1)] ?? ROMAN_NUMERALS[0];
  return `${displayName} – ${roman}`;
}

export function weaponToIconClass(weapon) {
  const name = sanitizeKey(weapon?.name);
  const suffix = name || 'none';
  return `hud-icon weapon-icon weapon-icon--${suffix}`;
}

export function labelPower(power) {
  const name = sanitizeKey(power?.name);
  if (!name) {
    return 'None';
  }
  return name.toUpperCase();
}

export { WEAPON_DISPLAY_NAMES };
