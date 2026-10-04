import { h } from './dom';

let tipEl: HTMLDivElement | null = null;

export function showTip(content: Node | string, x: number, y: number): void {
  hideTip();
  tipEl = h('div.tooltip', typeof content === 'string' ? h('span', content) : content);
  document.body.appendChild(tipEl);
  const r = tipEl.getBoundingClientRect();
  let left = x + 14;
  let top = y + 14;
  if (left + r.width > innerWidth - 8) left = x - r.width - 14;
  if (top + r.height > innerHeight - 8) top = y - r.height - 14;
  tipEl.style.left = `${Math.max(8, left)}px`;
  tipEl.style.top = `${Math.max(8, top)}px`;
}

export function hideTip(): void {
  tipEl?.remove();
  tipEl = null;
}

/** Attaches a hover tooltip (mouse only — touch devices use tap-to-select panels instead). */
export function tip(el: HTMLElement, content: () => Node | string): HTMLElement {
  el.addEventListener('pointerenter', (e) => {
    if (e.pointerType === 'mouse') showTip(content(), e.clientX, e.clientY);
  });
  el.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'mouse' && tipEl) {
      const r = tipEl.getBoundingClientRect();
      let left = e.clientX + 14;
      let top = e.clientY + 14;
      if (left + r.width > innerWidth - 8) left = e.clientX - r.width - 14;
      if (top + r.height > innerHeight - 8) top = e.clientY - r.height - 14;
      tipEl.style.left = `${Math.max(8, left)}px`;
      tipEl.style.top = `${Math.max(8, top)}px`;
    }
  });
  el.addEventListener('pointerleave', hideTip);
  el.addEventListener('pointerdown', hideTip);
  return el;
}
