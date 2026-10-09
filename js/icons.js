// Inline SVG icons (stroke style, 24px grid). icon(name, cls) returns markup.
const paths = {
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  cart: '<path d="M3 4h2l2.4 11.2a1 1 0 0 0 1 .8h9.2a1 1 0 0 0 1-.8L20 8H6.2"/><circle cx="9.5" cy="19.5" r="1.3"/><circle cx="17" cy="19.5" r="1.3"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>',
  chevronDown: '<path d="m6 9 6 6 6-6"/>',
  chevronRight: '<path d="m9 6 6 6-6 6"/>',
  chevronLeft: '<path d="m15 6-6 6 6 6"/>',
  arrowRight: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  gear: '<circle cx="12" cy="12" r="3.2"/><path d="M12 2.8v2.4M12 18.8v2.4M4.2 7.5l2.1 1.2M17.7 15.3l2.1 1.2M4.2 16.5l2.1-1.2M17.7 8.7l2.1-1.2"/><circle cx="12" cy="12" r="7"/>',
  box: '<path d="M12 3 3.5 7.5v9L12 21l8.5-4.5v-9L12 3Z"/><path d="M3.5 7.5 12 12l8.5-4.5M12 12v9"/>',
  gift: '<rect x="3.5" y="8" width="17" height="4" rx="1"/><path d="M5 12v8h14v-8M12 8v12M12 8c-1.5-3-5-4-5-1.5S10 8 12 8Zm0 0c1.5-3 5-4 5-1.5S14 8 12 8Z"/>',
  sliders: '<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/><path d="M4 12h6M14 12h6"/><circle cx="12" cy="12" r="2"/>',
  home: '<path d="M4 11 12 4l8 7v9h-5v-6H9v6H4v-9Z"/>',
  leaf: '<path d="M5 19c0-8 5-13 14-14 0 9-5 14-13 14"/><path d="M5 19c3-4 6-6 9-8"/>',
  sprout: '<path d="M12 21v-8"/><path d="M12 13c0-4-3-6-7-6 0 4 3 6 7 6Z"/><path d="M12 11c0-4 3-6 7-6 0 4-3 6-7 6Z"/>',
  heart: '<path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.6 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10Z"/>',
  people: '<circle cx="12" cy="8" r="2.6"/><circle cx="5.5" cy="9.5" r="2"/><circle cx="18.5" cy="9.5" r="2"/><path d="M7.5 18c.5-3 2.3-4.5 4.5-4.5s4 1.5 4.5 4.5M2.5 17.5c.3-2 1.4-3.2 3-3.2M21.5 17.5c-.3-2-1.4-3.2-3-3.2"/>',
  shield: '<path d="M12 3 5 6v5c0 5 3 8.5 7 10 4-1.5 7-5 7-10V6l-7-3Z"/><path d="m9 12 2 2 4-4"/>',
  globe: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.5 2.6 3.5 5.4 3.5 8.5s-1 5.9-3.5 8.5c-2.5-2.6-3.5-5.4-3.5-8.5s1-5.9 3.5-8.5Z"/>',
  truck: '<path d="M2.5 6.5h11v9h-11zM13.5 9.5h4l3 3v3h-7"/><circle cx="6.5" cy="17" r="1.8"/><circle cx="16.5" cy="17" r="1.8"/><path d="M1 9h4M1 12h3"/>',
  headset: '<path d="M4.5 14v-2a7.5 7.5 0 0 1 15 0v2"/><rect x="3.5" y="13" width="4" height="6" rx="1.5"/><rect x="16.5" y="13" width="4" height="6" rx="1.5"/><path d="M18.5 19c0 1.5-2 2.5-5 2.5"/>',
  cup: '<path d="M4 9h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V9Z"/><path d="M17 11h1.5a2.5 2.5 0 0 1 0 5H17M8 3.5c0 1.5 1.5 1.5 1.5 3M12 3.5c0 1.5 1.5 1.5 1.5 3"/>',
  sparkle: '<path d="M12 3.5 13.8 9 19.5 10.8 13.8 12.6 12 18.5 10.2 12.6 4.5 10.8 10.2 9 12 3.5Z"/><path d="M18.5 3.5v3M17 5h3"/>',
  shirt: '<path d="M8.5 4 4 6.5l1.8 4L8 9.8V20h8V9.8l2.2.7 1.8-4L15.5 4c-.6 1.6-1.9 2.5-3.5 2.5S9.1 5.6 8.5 4Z"/>',
  wallet: '<path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H18v3"/><rect x="4" y="8" width="16" height="11" rx="2.5"/><path d="M16 13.5h.01"/>',
  receipt: '<path d="M6 3.5h12v17l-3-1.8-3 1.8-3-1.8-3 1.8v-17Z"/><path d="M9 8h6M9 11.5h6M9 15h3.5"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M21 20H3"/>',
  tag: '<path d="M3.5 12.5V4.5a1 1 0 0 1 1-1h8l8 8-9 9-8-8Z"/><circle cx="8.5" cy="8.5" r="1.4"/>',
  layers: '<path d="m12 3.5 8.5 4.5L12 12.5 3.5 8 12 3.5Z"/><path d="m3.5 12 8.5 4.5 8.5-4.5M3.5 16l8.5 4.5 8.5-4.5"/>',
  logout: '<path d="M14 4.5h4.5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H14"/><path d="M10 16.5 5.5 12 10 7.5M5.5 12H15"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16v4Z"/><path d="m13.5 6.5 4 4"/>',
  archive: '<rect x="3.5" y="4" width="17" height="4.5" rx="1"/><path d="M5 8.5V19a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8.5M10 12.5h4"/>',
  up: '<path d="m6 15 6-6 6 6"/>',
  external: '<path d="M14 4.5h5.5V10M19.5 4.5 11 13M18 13.5V19a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5.5"/>',
  refresh: '<path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3L19.5 9"/><path d="M19.5 4.5V9H15"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  star: '<path d="m12 3.5 2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.8L12 3.5Z"/>',
  facebook: '<path d="M14 8h2.5V4.5H14A4 4 0 0 0 10 8.5V11H7.5v3.5H10V21h3.5v-6.5H16l.5-3.5h-3V8.8c0-.5.3-.8.5-.8Z"/>',
  youtube: '<rect x="2.5" y="5.5" width="19" height="13" rx="4"/><path d="m10 9 5 3-5 3V9Z"/>',
  instagram: '<rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.3" cy="6.7" r=".6"/>',
};

const filled = new Set(['star', 'facebook']);

export function icon(name, cls = 'w-5 h-5', strokeWidth = 1.8) {
  const fill = filled.has(name) ? 'currentColor' : 'none';
  const stroke = filled.has(name) ? 'none' : 'currentColor';
  return `<svg class="${cls}" viewBox="0 0 24 24" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || ''}</svg>`;
}
