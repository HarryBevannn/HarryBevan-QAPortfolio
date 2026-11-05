/** Polite aria-live announcements for state changes (guard lifted, engine on...). */
let region: HTMLElement | null = null;

export function announce(message: string): void {
  region ??= document.querySelector<HTMLElement>('[data-announcer]');
  if (!region) return;
  // Clear first so repeating the same message is still announced.
  region.textContent = '';
  window.setTimeout(() => {
    if (region) region.textContent = message;
  }, 60);
}
