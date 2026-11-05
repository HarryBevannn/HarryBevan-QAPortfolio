/**
 * sessionStorage wrapper. Storage can throw (privacy modes, blocked cookies,
 * sandboxed iframes), so every access is wrapped. Failing is harmless: the
 * visitor just sees the intro again.
 */
import { INTRO_STORAGE_KEY } from '../data/site';

export const introMemory = {
  isComplete(): boolean {
    try {
      return window.sessionStorage.getItem(INTRO_STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  },
  markComplete(): void {
    try {
      window.sessionStorage.setItem(INTRO_STORAGE_KEY, '1');
    } catch {
      /* ignore */
    }
  },
};
