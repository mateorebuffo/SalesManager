// src/design/tokens.js
// Design tokens for the Caja redesign. Pure JS (no JSX) so it can be imported
// from any component without a babel/.jsx loader concern.

export const themes = {
  light: {
    name: 'light',
    page: '#F4F6FB',
    surface: '#FFFFFF',
    surface2: '#FAFBFE',
    surfaceSunk: '#EEF1F7',
    border: '#E5EAF2',
    borderStrong: '#D5DCE8',
    text: '#0E1626',
    text2: '#4D5A73',
    text3: '#8893A8',
    brand: '#2D5BFF',
    brandDeep: '#1E40D9',
    brandSoft: '#E8EEFF',
    brandOn: '#FFFFFF',
    success: '#0E9F6E',
    successSoft: '#DCFCE9',
    warning: '#D97706',
    warningSoft: '#FEF1D7',
    danger: '#E5484D',
    dangerSoft: '#FEE4E5',
    chip: '#EEF1F7',
    overlay: 'rgba(14,22,38,0.45)',
  },
  dark: {
    name: 'dark',
    page: '#0A1124',
    surface: '#121A33',
    surface2: '#0F1730',
    surfaceSunk: '#0A1124',
    border: '#1F2A4A',
    borderStrong: '#2B3960',
    text: '#F2F5FB',
    text2: '#A5B0CC',
    text3: '#6E7A98',
    brand: '#5C82FF',
    brandDeep: '#2D5BFF',
    brandSoft: '#1A2453',
    brandOn: '#FFFFFF',
    success: '#3DD68C',
    successSoft: '#0E2A20',
    warning: '#F4A93B',
    warningSoft: '#3A2710',
    danger: '#F46A6F',
    dangerSoft: '#3A1517',
    chip: '#1A2342',
    overlay: 'rgba(0,0,0,0.6)',
  },
};

export const FONT_UI = '"Geist", -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif';
export const FONT_MONO = '"Geist Mono", ui-monospace, SFMono-Regular, Menlo, monospace';

// Formatting helpers — USD. Adapt locale/currency if your store ever changes.
export const money = (n) =>
  '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const moneyCompact = (n) => {
  const v = Number(n || 0);
  if (Math.abs(v) >= 1000) return '$' + (v / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  return '$' + v.toFixed(0);
};

export const qty = (n) =>
  Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 3 });

// Helper: tint a hex color into a soft variant (used for runtime accent swaps).
export const hexToSoft = (hex) => {
  if (!hex || hex[0] !== '#') return hex;
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const mix = (c) => Math.round(c * 0.12 + 255 * 0.88);
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
};

// Payment methods used across the app.
export const PAYMENT_METHODS = [
  { id: 'cash',     label: 'Efectivo'        },
  { id: 'transfer', label: 'Transferencia'   },
  { id: 'crypto',   label: 'Cripto'          },
  { id: 'credit',   label: 'Cuenta corriente'},
];
