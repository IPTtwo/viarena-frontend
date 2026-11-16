import { useEffect, useState } from 'react';

const PREFIX = 'viarena_p2_';

export function readStored(key, fallback) {
  try {
    const value = localStorage.getItem(PREFIX + key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

export function makeId() {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function useStoredState(key, fallback) {
  const [value, setValue] = useState(() => readStored(key, fallback));

  useEffect(() => {
    if (value === null) localStorage.removeItem(PREFIX + key);
    else localStorage.setItem(PREFIX + key, JSON.stringify(value));
  }, [key, value]);

  return [value, setValue];
}

export function storageKey(key) {
  return PREFIX + key;
}
