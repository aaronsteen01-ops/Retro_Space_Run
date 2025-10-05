const KEYBOARD_BINDINGS = {
  up: ['w', 'arrowup'],
  down: ['s', 'arrowdown'],
  left: ['a', 'arrowleft'],
  right: ['d', 'arrowright'],
  fire: ['space'],
  altFire: ['enter'],
  pause: ['p'],
  mute: ['m'],
  fullscreen: ['f'],
  assist: ['h'],
  autoFire: ['t'],
  restart: ['r'],
  precision: ['shift'],
  options: ['escape'],
};

const ACTIONS = Object.freeze({
  PAUSE: 'pause',
  MUTE: 'mute',
  FULLSCREEN: 'fullscreen',
  ASSIST: 'assist',
  AUTO_FIRE: 'auto-fire',
  RESTART: 'restart',
  OPTIONS: 'options',
});

const keyboardState = new Set();
const keyToActions = new Map();
const actionListeners = new Map();
let lastGamepadConnected = false;

const DEADZONE = 0.22;

function normalizeKey(key) {
  if (!key) {
    return '';
  }
  if (key === ' ') {
    return 'space';
  }
  const lower = key.toLowerCase();
  if (lower === 'spacebar') {
    return 'space';
  }
  return lower;
}

function registerActionKey(keys, action) {
  for (const key of keys) {
    const normalized = normalizeKey(key);
    if (!keyToActions.has(normalized)) {
      keyToActions.set(normalized, new Set());
    }
    keyToActions.get(normalized).add(action);
  }
}

registerActionKey(KEYBOARD_BINDINGS.pause, ACTIONS.PAUSE);
registerActionKey(KEYBOARD_BINDINGS.mute, ACTIONS.MUTE);
registerActionKey(KEYBOARD_BINDINGS.fullscreen, ACTIONS.FULLSCREEN);
registerActionKey(KEYBOARD_BINDINGS.assist, ACTIONS.ASSIST);
registerActionKey(KEYBOARD_BINDINGS.autoFire, ACTIONS.AUTO_FIRE);
registerActionKey(KEYBOARD_BINDINGS.restart, ACTIONS.RESTART);
registerActionKey(KEYBOARD_BINDINGS.options, ACTIONS.OPTIONS);

function emitAction(action) {
  const listeners = actionListeners.get(action);
  if (!listeners) {
    return;
  }
  for (const listener of listeners) {
    try {
      listener();
    } catch (err) {
      // Swallow listener errors to avoid breaking input loop.
      console.error(err); // eslint-disable-line no-console
    }
  }
}

function handleKeyDown(event) {
  const key = normalizeKey(event.key);
  if (!key) {
    return;
  }
  if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'space'].includes(key)) {
    event.preventDefault();
  }
  const isRepeat = event.repeat;
  keyboardState.add(key);
  if (!isRepeat) {
    const mapped = keyToActions.get(key);
    if (mapped) {
      for (const action of mapped) {
        emitAction(action);
      }
    }
  }
}

function handleKeyUp(event) {
  const key = normalizeKey(event.key);
  if (!key) {
    return;
  }
  keyboardState.delete(key);
}

if (typeof window !== 'undefined') {
  window.addEventListener('keydown', handleKeyDown, { passive: false });
  window.addEventListener('keyup', handleKeyUp);
  window.addEventListener('gamepadconnected', () => {
    lastGamepadConnected = true;
  });
  window.addEventListener('gamepaddisconnected', () => {
    lastGamepadConnected = false;
  });
}

function applyDeadzone(value) {
  if (Math.abs(value) < DEADZONE) {
    return 0;
  }
  const sign = Math.sign(value);
  const magnitude = (Math.abs(value) - DEADZONE) / (1 - DEADZONE);
  return Math.max(0, Math.min(1, magnitude)) * sign;
}

function pollGamepad() {
  const pads = typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : [];
  if (!pads) {
    lastGamepadConnected = false;
    return { connected: false, moveX: 0, moveY: 0, fire: false, altFire: false };
  }
  for (const pad of pads) {
    if (!pad || !pad.connected) {
      continue;
    }
    const axes = Array.isArray(pad.axes) ? pad.axes : [];
    const buttons = Array.isArray(pad.buttons) ? pad.buttons : [];
    const leftX = applyDeadzone(axes[0] ?? 0);
    const leftY = applyDeadzone(axes[1] ?? 0);
    let moveX = leftX;
    let moveY = leftY;
    if (buttons[14]?.pressed) {
      moveX -= 1;
    }
    if (buttons[15]?.pressed) {
      moveX += 1;
    }
    if (buttons[12]?.pressed) {
      moveY -= 1;
    }
    if (buttons[13]?.pressed) {
      moveY += 1;
    }
    moveX = Math.max(-1, Math.min(1, moveX));
    moveY = Math.max(-1, Math.min(1, moveY));
    const fire = Boolean(buttons[0]?.pressed);
    lastGamepadConnected = true;
    return {
      connected: true,
      moveX,
      moveY,
      fire,
      altFire: Boolean(buttons[1]?.pressed),
    };
  }
  lastGamepadConnected = false;
  return { connected: false, moveX: 0, moveY: 0, fire: false, altFire: false };
}

function keyActive(binding) {
  return binding.some((key) => keyboardState.has(key));
}

function combineAxis(keyboardValue, gamepadValue) {
  if (Math.abs(gamepadValue) > Math.abs(keyboardValue)) {
    return gamepadValue;
  }
  return keyboardValue;
}

export function getState() {
  const keyboardMoveX = (keyActive(KEYBOARD_BINDINGS.left) ? -1 : 0) + (keyActive(KEYBOARD_BINDINGS.right) ? 1 : 0);
  const keyboardMoveY = (keyActive(KEYBOARD_BINDINGS.up) ? -1 : 0) + (keyActive(KEYBOARD_BINDINGS.down) ? 1 : 0);
  const keyboardFire = keyActive(KEYBOARD_BINDINGS.fire);
  const keyboardAltFire = keyActive(KEYBOARD_BINDINGS.altFire);

  const gamepad = pollGamepad();

  return {
    moveX: combineAxis(keyboardMoveX, gamepad.moveX),
    moveY: combineAxis(keyboardMoveY, gamepad.moveY),
    fire: keyboardFire || gamepad.fire,
    altFire: keyboardAltFire || gamepad.altFire,
    precision: keyActive(KEYBOARD_BINDINGS.precision),
    gamepad: { connected: gamepad.connected || lastGamepadConnected },
  };
}

export function onAction(action, listener) {
  if (!actionListeners.has(action)) {
    actionListeners.set(action, new Set());
  }
  actionListeners.get(action).add(listener);
  return () => offAction(action, listener);
}

export function offAction(action, listener) {
  const listeners = actionListeners.get(action);
  if (!listeners) {
    return;
  }
  listeners.delete(listener);
  if (listeners.size === 0) {
    actionListeners.delete(action);
  }
}

export function clearInput() {
  keyboardState.clear();
}

export { ACTIONS };
