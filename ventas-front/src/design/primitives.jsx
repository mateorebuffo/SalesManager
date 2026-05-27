// src/design/primitives.jsx
// Re-usable UI primitives. All accept a `theme` (from tokens.js) — pass it
// once from your top-level shell so you can switch light/dark instantly.

import { useState, useEffect } from 'react';
import { FONT_UI, FONT_MONO, money } from './tokens';
import { Search, Plus, ChevR, ChevD, Cart, Pkg, Users, Cash, X } from './Icons';

// ─────────────────────────────────────────────────────────────
// Avatar — 2-initials, deterministic hue per name
// ─────────────────────────────────────────────────────────────
export function Avatar({ name = '', theme, size = 40 }) {
  const initials = name.split(' ').filter(Boolean).slice(0, 2).map(s => s[0] || '').join('').toUpperCase();
  const hue = [...name].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  const bg = `oklch(${theme.name === 'dark' ? '32%' : '94%'} 0.06 ${hue})`;
  const fg = `oklch(${theme.name === 'dark' ? '85%' : '38%'} 0.12 ${hue})`;
  return (
    <div style={{
      width: size, height: size, borderRadius: size,
      background: bg, color: fg, display: 'flex',
      alignItems: 'center', justifyContent: 'center',
      fontWeight: 600, fontSize: size * 0.36, letterSpacing: 0.2,
      flexShrink: 0,
    }}>{initials || '?'}</div>
  );
}

// ─────────────────────────────────────────────────────────────
// Pill — status badge
// ─────────────────────────────────────────────────────────────
export function Pill({ theme, color = 'text2', children, soft = true }) {
  const map = {
    success: [theme.successSoft, theme.success],
    warning: [theme.warningSoft, theme.warning],
    danger:  [theme.dangerSoft,  theme.danger],
    brand:   [theme.brandSoft,   theme.brand],
    text2:   [theme.chip,        theme.text2],
  };
  const [bg, fg] = map[color] || map.text2;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '3px 8px', borderRadius: 999,
      background: soft ? bg : fg, color: soft ? fg : '#fff',
      fontSize: 11, fontWeight: 600, fontFamily: FONT_UI,
      lineHeight: 1.2, whiteSpace: 'nowrap',
    }}>{children}</span>
  );
}

// ─────────────────────────────────────────────────────────────
// Card — surface block with border + radius
// ─────────────────────────────────────────────────────────────
export function Card({ theme, children, style, onClick }) {
  return (
    <div onClick={onClick} style={{
      background: theme.surface,
      borderRadius: 16,
      border: `1px solid ${theme.border}`,
      ...style,
    }}>{children}</div>
  );
}

// ─────────────────────────────────────────────────────────────
// Row — list-item row: leading | title+subtitle | trailing
// ─────────────────────────────────────────────────────────────
export function Row({ theme, leading, title, subtitle, trailing, onClick, divider = true, paddingY = 14 }) {
  return (
    <div onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: `${paddingY}px 16px`,
      borderBottom: divider ? `1px solid ${theme.border}` : 'none',
      cursor: onClick ? 'pointer' : 'default',
    }}>
      {leading}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 15, color: theme.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</div>
        {subtitle && <div style={{ fontSize: 13, color: theme.text2, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{subtitle}</div>}
      </div>
      {trailing}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// SectionHeader — small uppercase label above a card group
// ─────────────────────────────────────────────────────────────
export function SectionHeader({ theme, title, action, onAction }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
      padding: '20px 20px 10px',
    }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: theme.text2, textTransform: 'uppercase', letterSpacing: 0.6 }}>{title}</div>
      {action && (
        <button onClick={onAction} style={{
          background: 'none', border: 'none', cursor: onAction ? 'pointer' : 'default',
          fontSize: 13, fontWeight: 600, color: theme.brand, fontFamily: FONT_UI, padding: 0,
        }}>{action}</button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// TopBar — large title with optional subtitle + trailing action
// ─────────────────────────────────────────────────────────────
export function TopBar({ theme, title, subtitle, leading, trailing, large = false }) {
  return (
    <div style={{ paddingTop: 28, padding: '28px 20px 8px', background: theme.page }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 36 }}>
        {leading}
        {!large && (
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 17, color: theme.text }}>{title}</div>
            {subtitle && <div style={{ fontSize: 12, color: theme.text2, marginTop: 2 }}>{subtitle}</div>}
          </div>
        )}
        {large && <div style={{ flex: 1 }} />}
        {trailing}
      </div>
      {large && (
        <div style={{ marginTop: 10 }}>
          {subtitle && <div style={{ fontSize: 13, color: theme.text2, fontWeight: 500 }}>{subtitle}</div>}
          <div style={{ fontWeight: 700, fontSize: 30, color: theme.text, letterSpacing: -0.6, marginTop: 2 }}>{title}</div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// SearchField — rounded input with leading icon
// ─────────────────────────────────────────────────────────────
export function SearchField({ theme, placeholder, value, onChange, autoFocus }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      background: theme.surface, border: `1px solid ${theme.border}`,
      borderRadius: 12, padding: '10px 14px',
    }}>
      <Search size={20} style={{ color: theme.text3 }} />
      <input
        autoFocus={autoFocus}
        value={value ?? ''}
        onChange={onChange || (() => {})}
        placeholder={placeholder}
        style={{
          background: 'transparent', border: 'none', outline: 'none',
          color: theme.text, fontSize: 15, fontFamily: FONT_UI, flex: 1, minWidth: 0,
        }}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Chip — segmented filter
// ─────────────────────────────────────────────────────────────
export function Chip({ theme, active, children, onClick }) {
  return (
    <button onClick={onClick} style={{
      padding: '8px 14px', borderRadius: 999,
      border: `1px solid ${active ? theme.brand : theme.border}`,
      background: active ? theme.brand : theme.surface,
      color: active ? '#fff' : theme.text,
      fontWeight: 600, fontSize: 13, fontFamily: FONT_UI,
      whiteSpace: 'nowrap', cursor: 'pointer', flexShrink: 0,
    }}>{children}</button>
  );
}

// ─────────────────────────────────────────────────────────────
// Stat — small label/value tile (used inside grids)
// ─────────────────────────────────────────────────────────────
export function Stat({ theme, label, value, mono }) {
  return (
    <div style={{
      background: theme.surface, borderRadius: 12,
      border: `1px solid ${theme.border}`, padding: '10px 12px',
    }}>
      <div style={{ fontSize: 10.5, color: theme.text3, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 }}>{label}</div>
      <div style={{
        fontFamily: mono ? FONT_MONO : FONT_UI,
        fontWeight: 600, fontSize: 16, color: theme.text, marginTop: 3,
      }}>{value}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// IconButton helper — square 40×40 surface button
// ─────────────────────────────────────────────────────────────
export function iconBtnStyle(theme) {
  return {
    width: 40, height: 40, borderRadius: 12, background: theme.surface,
    border: `1px solid ${theme.border}`, color: theme.text,
    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
  };
}

// ─────────────────────────────────────────────────────────────
// QtyInput — text input used for cart quantities (editable by keyboard)
// ─────────────────────────────────────────────────────────────
export function QtyInput({ theme, value, onChange, width = 56 }) {
  return (
    <input
      type="text" inputMode="numeric"
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
      onFocus={(e) => e.target.select()}
      className="caja-qty-input"
      aria-label="Cantidad"
      style={{
        width, height: 36, textAlign: 'center',
        background: theme.surface, border: `1px solid ${theme.borderStrong}`,
        borderRadius: 10, color: theme.text, fontFamily: FONT_MONO,
        fontWeight: 600, fontSize: 14, outline: 'none',
        transition: 'border-color .12s, box-shadow .12s',
      }}
    />
  );
}

// ─────────────────────────────────────────────────────────────
// PayMethodButton — tappable card for payment method picker
// ─────────────────────────────────────────────────────────────
export function PayMethodButton({ theme, icon: Ic, label, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      padding: '14px 12px', borderRadius: 14,
      background: active ? theme.brandSoft : theme.surface,
      border: `1.5px solid ${active ? theme.brand : theme.border}`,
      color: active ? theme.brand : theme.text,
      display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8,
      fontFamily: FONT_UI, cursor: 'pointer', textAlign: 'left',
    }}>
      <Ic size={22} />
      <span style={{ fontWeight: 600, fontSize: 13.5 }}>{label}</span>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────
// useIsDesktop — viewport hook; flips at 900px by default
// ─────────────────────────────────────────────────────────────
export function useIsDesktop(breakpoint = 900) {
  const [v, setV] = useState(
    typeof window !== 'undefined' ? window.innerWidth >= breakpoint : false
  );
  useEffect(() => {
    const onR = () => setV(window.innerWidth >= breakpoint);
    window.addEventListener('resize', onR);
    return () => window.removeEventListener('resize', onR);
  }, [breakpoint]);
  return v;
}

// ─────────────────────────────────────────────────────────────
// BottomSheet — mobile modal that slides up from bottom
// ─────────────────────────────────────────────────────────────
export function BottomSheet({ theme, open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: theme.overlay, display: 'flex', alignItems: 'flex-end',
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: '100%', background: theme.surface,
        borderTopLeftRadius: 22, borderTopRightRadius: 22,
        maxHeight: '85vh', display: 'flex', flexDirection: 'column',
        paddingBottom: 'env(safe-area-inset-bottom, 24px)',
        boxShadow: '0 -10px 30px rgba(0,0,0,0.25)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 6px' }}>
          <div style={{ width: 40, height: 4, borderRadius: 2, background: theme.borderStrong }} />
        </div>
        {title && (
          <div style={{ padding: '4px 20px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontWeight: 700, fontSize: 19, color: theme.text, letterSpacing: -0.3 }}>{title}</div>
            <button onClick={onClose} style={iconBtnStyle(theme)}><X size={20}/></button>
          </div>
        )}
        <div style={{ flex: 1, overflow: 'auto' }}>{children}</div>
      </div>
    </div>
  );
}
