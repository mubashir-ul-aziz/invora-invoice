/**
 * Web-only stand-in for `expo-secure-store`, which ships no web
 * implementation (every call throws). `metro.config.js` swaps it in for the
 * `web` platform only, so `npm run web` can boot the app in a browser for
 * development. Values live in `localStorage` — NOT secure; never rely on this
 * outside local browser debugging. Native builds keep using the real module.
 */
const PREFIX = 'secure-store:';

export async function getItemAsync(key: string): Promise<string | null> {
  return globalThis.localStorage?.getItem(PREFIX + key) ?? null;
}

export async function setItemAsync(key: string, value: string): Promise<void> {
  globalThis.localStorage?.setItem(PREFIX + key, value);
}

export async function deleteItemAsync(key: string): Promise<void> {
  globalThis.localStorage?.removeItem(PREFIX + key);
}

export function getItem(key: string): string | null {
  return globalThis.localStorage?.getItem(PREFIX + key) ?? null;
}

export function setItem(key: string, value: string): void {
  globalThis.localStorage?.setItem(PREFIX + key, value);
}

export async function isAvailableAsync(): Promise<boolean> {
  return typeof globalThis.localStorage !== 'undefined';
}

export function canUseBiometricAuthentication(): boolean {
  return false;
}

export const AFTER_FIRST_UNLOCK = 0;
export const AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY = 1;
export const ALWAYS = 2;
export const WHEN_PASSCODE_SET_THIS_DEVICE_ONLY = 3;
export const ALWAYS_THIS_DEVICE_ONLY = 4;
export const WHEN_UNLOCKED = 5;
export const WHEN_UNLOCKED_THIS_DEVICE_ONLY = 6;
