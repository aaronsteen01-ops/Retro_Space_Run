/**
 * ui.js — canvas sizing, HUD updates, and overlay controls for Retro Space Run.
 */
export const canvas = document.getElementById('game');
export const ctx = canvas.getContext('2d');

const hudLives = document.getElementById('lives');
const hudScore = document.getElementById('score');
const hudTime = document.getElementById('time');
const hudPower = document.getElementById('pup');
const hudWeapon = document.getElementById('weapon');
const overlay = document.getElementById('overlay');

function fitCanvas() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = window.innerWidth;
  const h = window.innerHeight;
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

window.addEventListener('resize', fitCanvas);
fitCanvas();

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
