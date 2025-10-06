// CHANGELOG: Added centralised pub/sub for gameplay state events.

const subscribers = new Map();

function getBucket(event) {
  if (!subscribers.has(event)) {
    subscribers.set(event, new Set());
  }
  return subscribers.get(event);
}

export function on(event, handler) {
  if (typeof handler !== 'function') {
    return () => {};
  }
  const bucket = getBucket(event);
  bucket.add(handler);
  return () => {
    bucket.delete(handler);
  };
}

export function once(event, handler) {
  if (typeof handler !== 'function') {
    return () => {};
  }
  const off = on(event, (...args) => {
    off();
    handler(...args);
  });
  return off;
}

export function emit(event, payload) {
  const bucket = subscribers.get(event);
  if (!bucket || bucket.size === 0) {
    return;
  }
  bucket.forEach((handler) => {
    try {
      handler(payload);
    } catch (error) {
      if (console && typeof console.error === 'function') {
        console.error('[GameEvents] handler error for', event, error);
      }
    }
  });
}

export const GameEvents = Object.freeze({ on, once, emit });
