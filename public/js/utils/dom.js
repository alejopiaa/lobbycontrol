/**
 * DOM - Helpers defensivos y seguros de manipulación del DOM
 */
export function getEl(idOrSelector) {
  if (typeof idOrSelector !== 'string') return idOrSelector;
  if (idOrSelector.startsWith('#') || idOrSelector.startsWith('.') || idOrSelector.includes(' ')) {
    return document.querySelector(idOrSelector);
  }
  return document.getElementById(idOrSelector);
}

export function getAllEl(selector) {
  return Array.from(document.querySelectorAll(selector));
}

export function onEvent(target, event, handler) {
  const el = typeof target === 'string' ? getEl(target) : target;
  if (el && typeof el.addEventListener === 'function') {
    el.addEventListener(event, handler);
    return () => el.removeEventListener(event, handler);
  }
  return () => {};
}
