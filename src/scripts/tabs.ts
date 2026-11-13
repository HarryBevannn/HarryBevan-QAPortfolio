/**
 * Tabs: turns a group of panels into an accessible tab set (the WAI-ARIA tabs
 * pattern, automatic activation). Progressive: the markup is a hidden
 * role="tablist" plus plain panels, all readable without JavaScript; this adds
 * `.is-tabbed` to the root, shows one panel at a time and wires the keys
 * (Left/Right, Home/End, with a roving tabindex).
 *
 * Markup: [data-tabs] > [role="tab"][aria-controls=<panel id>] and
 * [data-tab-panel][id].
 */
export function initTabs(root: HTMLElement): void {
  const tabs = [...root.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
  const panels = tabs.map((tab) =>
    root.querySelector<HTMLElement>(`#${tab.getAttribute('aria-controls')}`),
  );
  if (tabs.length === 0 || panels.some((p) => !p)) return;

  const select = (index: number, focus = false) => {
    tabs.forEach((tab, i) => {
      const on = i === index;
      tab.setAttribute('aria-selected', String(on));
      tab.tabIndex = on ? 0 : -1;
      panels[i]!.hidden = !on;
    });
    if (focus) tabs[index]!.focus();
  };

  panels.forEach((panel, i) => {
    panel!.setAttribute('role', 'tabpanel');
    panel!.setAttribute('aria-labelledby', tabs[i]!.id);
    panel!.tabIndex = 0;
  });

  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => select(i));
    tab.addEventListener('keydown', (event) => {
      const last = tabs.length - 1;
      const to: Record<string, number> = {
        ArrowRight: i === last ? 0 : i + 1,
        ArrowLeft: i === 0 ? last : i - 1,
        Home: 0,
        End: last,
      };
      const next = to[event.key];
      if (next === undefined) return;
      event.preventDefault();
      select(next, true);
    });
  });

  root.classList.add('is-tabbed');
  select(
    Math.max(
      0,
      tabs.findIndex((t) => t.getAttribute('aria-selected') === 'true'),
    ),
  );
}
