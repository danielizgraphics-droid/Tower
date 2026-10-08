/**
 * Hand-made 24×24 stroke icon set (consistent line style, inherits currentColor).
 * Keys are referenced by data (augments, talents) so content stays emoji-free.
 */
const PATHS: Record<string, string> = {
  coin: '<circle cx="12" cy="12" r="8"/><path d="M12 7.5v9M9.5 9.5c0-1 1.1-1.7 2.5-1.7s2.5.7 2.5 1.7-1 1.5-2.5 1.8-2.5.8-2.5 1.9 1.1 1.8 2.5 1.8 2.5-.7 2.5-1.7"/>',
  coins:
    '<ellipse cx="9" cy="7" rx="6" ry="3"/><path d="M3 7v4c0 1.7 2.7 3 6 3s6-1.3 6-3V7"/><path d="M9 14v3c0 1.7 2.7 3 6 3s6-1.3 6-3v-4c0-1.6-2.4-2.9-5.5-3"/>',
  heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
  castle: '<path d="M4 21V9h3v2h2V9h2v2h2V9h2v2h2V9h3v12z"/><path d="M10 21v-4a2 2 0 0 1 4 0v4"/><path d="M4 9V5l2-1 2 1v4M16 9V5l2-1 2 1v4"/>',
  drop: '<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/><path d="M9.5 14.5a2.5 2.5 0 0 0 2.5 2.5"/>',
  star: '<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9 6.8 19.6l1-5.8L3.5 9.7l5.9-.9z"/>',
  sword: '<path d="M14.5 3.5H20v5.5L9 20l-5-5z"/><path d="M5 13l6 6M3.5 20.5l2-2"/>',
  swords: '<path d="M4 4l9 9M4 4h4M4 4v4M20 4l-9 9M20 4h-4M20 4v4"/><path d="M8 16l-4 4M16 16l4 4M6 14l4 4M18 14l-4 4"/>',
  shield: '<path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z"/>',
  bow: '<path d="M6 3c7 2 11 8 11 15"/><path d="M6 3l11 15"/><path d="M3 21l8-8M3 21h3M3 21v-3"/>',
  arrow: '<path d="M4 20L18 6M13 6h5v5"/><path d="M4 20l3-1-2-2z"/>',
  pierce: '<path d="M3 12h16M15 8l4 4-4 4"/><circle cx="8" cy="12" r="2.5"/><circle cx="14" cy="12" r="2.5"/>',
  flame:
    '<path d="M12 21c-3.9 0-6.5-2.6-6.5-6.2 0-3.4 2.8-5.2 3.7-8.8 2 1.3 3 3.2 3 5 1-.8 1.7-2 1.8-3.5 2.6 2 4.5 4.6 4.5 7.3 0 3.6-2.6 6.2-6.5 6.2z"/>',
  snow: '<path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9"/><path d="M9.5 4.5L12 6.5l2.5-2M9.5 19.5l2.5-2 2.5 2"/>',
  bolt: '<path d="M13 3L5 13.5h6L10 21l8-10.5h-6z"/>',
  flask: '<path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.7 3h10.6A2 2 0 0 0 19 18l-5-9V3"/><path d="M7.5 15h9"/>',
  skull:
    '<path d="M12 3a7.5 7.5 0 0 0-4.5 13.5V20h9v-3.5A7.5 7.5 0 0 0 12 3z"/><circle cx="9" cy="11.5" r="1.5"/><circle cx="15" cy="11.5" r="1.5"/><path d="M10.5 20v-2M13.5 20v-2"/>',
  orb: '<circle cx="12" cy="11" r="6"/><path d="M8 20h8M9.5 17l-1.5 3M14.5 17l1.5 3"/><path d="M10 9a2.5 2.5 0 0 1 2-1"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
  target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r=".8"/>',
  burst:
    '<path d="M12 2.5v4M12 17.5v4M2.5 12h4M17.5 12h4M5.3 5.3l2.8 2.8M15.9 15.9l2.8 2.8M5.3 18.7l2.8-2.8M15.9 8.1l2.8-2.8"/><circle cx="12" cy="12" r="2.5"/>',
  hammer: '<path d="M14 6l4 4M10.5 9.5L4 16l4 4 6.5-6.5"/><path d="M13 4l7 7-2.5 2.5-7-7z"/>',
  chart: '<path d="M4 4v16h16"/><path d="M7.5 14.5l3.5-4 3 2.5 5-6.5"/><path d="M15.5 6.5H19V10"/>',
  bag: '<path d="M8.5 7.5L7 4h10l-1.5 3.5"/><path d="M8.5 7.5h7c3 2.5 5 6 5 8.5 0 3-2.5 5-8.5 5s-8.5-2-8.5-5c0-2.5 2-6 5-8.5z"/><path d="M12 11v6M10 13c0-.8.9-1.3 2-1.3s2 .5 2 1.3-.9 1.1-2 1.2-2 .6-2 1.4.9 1.3 2 1.3 2-.5 2-1.3"/>',
  gem: '<path d="M6.5 4h11l3.5 5-9 11-9-11z"/><path d="M3 9h18M9.5 4L8 9l4 11 4-11-1.5-5"/>',
  crown: '<path d="M3.5 8l4 4 4.5-6 4.5 6 4-4-1.5 10h-14z"/><path d="M5 21h14"/>',
  hourglass: '<path d="M6 3h12M6 21h12M7 3c0 5 10 5 10 9s-10 4-10 9M17 3c0 5-10 5-10 9s10 4 10 9"/>',
  refresh: '<path d="M20 11a8 8 0 0 0-14.5-4.5L4 8M4 4v4h4"/><path d="M4 13a8 8 0 0 0 14.5 4.5L20 16M20 20v-4h-4"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>',
  pause: '<rect x="6.5" y="5" width="3.5" height="14" rx="1"/><rect x="14" y="5" width="3.5" height="14" rx="1"/>',
  play: '<path d="M7 4.5v15l12-7.5z"/>',
  fast: '<path d="M3.5 5.5v13l8-6.5zM12 5.5v13l8.5-6.5z"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  check: '<path d="M4.5 12.5l5 5 10-11"/>',
  lock: '<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/>',
  book: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5"/>',
  map: '<path d="M3 6.5l6-2.5 6 2.5 6-2.5v13.5l-6 2.5-6-2.5-6 2.5z"/><path d="M9 4v13.5M15 6.5V20"/>',
  tower: '<path d="M7 21V9H5V4h2.5v2h2V4h5v2h2V4H19v5h-2v12z"/><path d="M10.5 21v-4a1.5 1.5 0 0 1 3 0v4M11 11h2"/>',
  sparkle:
    '<path d="M12 3c.6 4.6 2.4 6.4 7 7-4.6.6-6.4 2.4-7 7-.6-4.6-2.4-6.4-7-7 4.6-.6 6.4-2.4 7-7z"/><path d="M19 15.5c.3 1.8 1 2.5 2.5 2.8-1.5.3-2.2 1-2.5 2.7-.3-1.7-1-2.4-2.5-2.7 1.5-.3 2.2-1 2.5-2.8z"/>',
  wave: '<path d="M5 21V4M5 4.5c3-2 6 2 9 0s4-1 5 0v8c-1-1-2-2-5 0s-6-2-9 0"/>',
  up: '<path d="M12 20V5M5.5 11.5L12 5l6.5 6.5"/>',
  trash: '<path d="M4 7h16M9.5 7V4.5h5V7M6.5 7l1 13.5h9l1-13.5"/>',
  cloud: '<path d="M7 18.5h10.5a4 4 0 0 0 .4-8 6 6 0 0 0-11.6-1.4A4.7 4.7 0 0 0 7 18.5z"/>',
  infinity: '<path d="M12 12c-2-2.7-3.9-4-5.7-4a4 4 0 0 0 0 8c1.8 0 3.7-1.3 5.7-4zm0 0c2 2.7 3.9 4 5.7 4a4 4 0 0 0 0-8c-1.8 0-3.7 1.3-5.7 4z"/>',
  mountain: '<path d="M3 20l6.5-11 3.5 5.5 2.5-3.5L21 20z"/><path d="M8 13l1.5 1.5L11 13"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
  home: '<path d="M3.5 11.5L12 4l8.5 7.5"/><path d="M6 10v10h12V10"/><path d="M10 20v-5h4v5"/>',
  sound: '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a8 8 0 0 1 0 11"/>',
  music: '<path d="M9 18V5.5l11-2V16"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/>',
  brick: '<rect x="3" y="5" width="18" height="14" rx="1"/><path d="M3 9.7h18M3 14.3h18M9 5v4.7M15 9.7v4.6M9 14.3V19"/>',
  scroll:
    '<path d="M7 4h11a2 2 0 0 1 2 2v1h-4"/><path d="M16 7v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-1h10"/><path d="M7 4a2 2 0 0 0-2 2v11M9 9h4M9 12.5h4"/>',
  clover:
    '<circle cx="9" cy="9" r="3.5"/><circle cx="15" cy="9" r="3.5"/><circle cx="9" cy="15" r="3.5"/><circle cx="15" cy="15" r="3.5"/><path d="M15 15l5 6"/>',
  medal:
    '<path d="M8 3l4 6 4-6M5 3h3M16 3h3"/><circle cx="12" cy="15" r="5.5"/><path d="M12 12.3l.9 1.8 2 .3-1.4 1.4.3 2-1.8-.9-1.8.9.3-2-1.4-1.4 2-.3z"/>',
  drum: '<ellipse cx="12" cy="8" rx="8" ry="3"/><path d="M4 8v8c0 1.7 3.6 3 8 3s8-1.3 8-3V8M8 10.7l-1 8M16 10.7l1 8M12 11v8"/>',
  scale: '<path d="M12 4v16M7 20h10M5 7h14"/><path d="M5 7l-2.5 6a2.5 2.5 0 0 0 5 0zM19 7l-2.5 6a2.5 2.5 0 0 0 5 0z"/>',
  recycle:
    '<path d="M7 19H4.5l3-5M12 4.5l2.5 4.3M17 19h2.5l-3-5"/><path d="M9.5 5.5L12 4.5l-1 2.5M7.5 14L6 11.5l2.6-.2M17 19l-2 1.5V18M7 19h10M8.5 11.5L12 4.5M16.5 14l-2-3.5"/>',
  bank: '<path d="M3 9.5L12 4l9 5.5zM4.5 20h15M6 9.5V18M10 9.5V18M14 9.5V18M18 9.5V18M3.5 20h17"/>',
  wall: '<path d="M3 20V8h18v12z"/><path d="M3 12h18M3 16h18M8 8v4M14 8v4M11 12v4M17 12v4M8 16v4M14 16v4"/><path d="M3 8V5h3v3M10.5 8V5h3v3M18 8V5h3v3"/>',
  telescope: '<path d="M3.5 13.5l13-6.5 2 4-13 6.5z"/><path d="M16.5 7l2.5-1.2 2 4-2.5 1.2M10 14.5l-2 6.5M10 14.5l3 6.5"/>',
  skip: '<path d="M5 5l9 7-9 7zM17 5v14"/>',
  undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>',
  crosshair: '<circle cx="12" cy="12" r="8"/><path d="M12 2v5M12 17v5M2 12h5M17 12h5"/>',
  paw: '<circle cx="7.5" cy="9" r="1.8"/><circle cx="12" cy="6.5" r="1.8"/><circle cx="16.5" cy="9" r="1.8"/><path d="M8.5 17.5c0-3 1.5-5 3.5-5s3.5 2 3.5 5c0 1.5-1.5 2-3.5 2s-3.5-.5-3.5-2z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
};

export function icon(name: string, size = 20, cls = ''): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', `icon ${cls}`.trim());
  svg.innerHTML = PATHS[name] ?? PATHS.sparkle;
  return svg;
}

export const ICON_NAMES = Object.keys(PATHS);
