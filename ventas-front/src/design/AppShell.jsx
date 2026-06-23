// src/design/AppShell.jsx
// Responsive shell: Sidebar (desktop) + BottomNav (mobile) sharing a common
// `screen` state. Wrap your screens with it and provide currentUser + onLogout.
// Drop-in replacement for the legacy NavBar in App.jsx.

import { useIsDesktop, Avatar } from './primitives';
import { FONT_UI } from './tokens';
import {
  Cart, Pkg, Users, Cash, Bell, Logout, Receipt, Edit,
} from './Icons';

// One source of truth for the navigation items. `key` lines up with the
// `screen` keys your App.jsx already uses.
export const NAV_ITEMS = [
  { key: 'sale',     label: 'Venta',    icon: Cart    },
  { key: 'products', label: 'Productos', icon: Pkg    },
  { key: 'client',   label: 'Clientes',  icon: Users  },
  { key: 'users',    label: 'Usuarios',  icon: Edit   },
];

const SCREEN_TITLES = {
  sale: 'Venta', products: 'Productos', client: 'Clientes', users: 'Usuarios',
};

// canSee — replicate of your App.jsx helper, but here so the shell can
// filter nav items by permission without you having to thread props.
export function canSee(currentUser, screen) {
  if (!currentUser) return false;
  if (currentUser.role === 'admin') return true;
  if (screen === 'users') return false;
  return currentUser.permissions?.includes(screen);
}

// ─────────────────────────────────────────────────────────────
// Sidebar (≥ 900px)
// ─────────────────────────────────────────────────────────────
function Sidebar({ theme, screen, setScreen, currentUser, onLogout }) {
  return (
    <aside style={{
      width: 240, background: theme.surface, borderRight: `1px solid ${theme.border}`,
      display: 'flex', flexDirection: 'column', padding: '20px 14px',
      flexShrink: 0,
    }}>
      {/* Logo block */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 8px 22px' }}>
        <div style={{
          width: 32, height: 32, borderRadius: 10,
          background: `linear-gradient(135deg, ${theme.brand}, ${theme.brandDeep})`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff',
        }}><Cart size={18} /></div>
        <div style={{ fontWeight: 700, fontSize: 18, letterSpacing: -0.4, color: theme.text }}>SManager</div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {NAV_ITEMS.filter(it => canSee(currentUser, it.key)).map(it => {
          const a = it.key === screen;
          const Ic = it.icon;
          return (
            <button key={it.key} onClick={() => setScreen(it.key)} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 12px', borderRadius: 10,
              color: a ? theme.brand : theme.text2,
              background: a ? theme.brandSoft : 'transparent',
              fontWeight: a ? 600 : 500, fontSize: 14, fontFamily: FONT_UI,
              border: 'none', cursor: 'pointer', textAlign: 'left',
            }}>
              <Ic size={20} /> {it.label}
            </button>
          );
        })}
      </div>

      <div style={{ flex: 1 }} />

      {currentUser && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: 10, borderRadius: 12,
          background: theme.surface2, border: `1px solid ${theme.border}`,
        }}>
          <Avatar name={currentUser.username || '?'} theme={theme} size={34} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 13, color: theme.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{currentUser.username}</div>
            <div style={{ fontSize: 11, color: theme.text3, textTransform: 'capitalize' }}>{currentUser.role}</div>
          </div>
          <button onClick={onLogout} title="Salir" style={{
            background: 'none', border: 'none', cursor: 'pointer', color: theme.text3,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 4,
          }}>
            <Logout size={18} />
          </button>
        </div>
      )}
    </aside>
  );
}

// ─────────────────────────────────────────────────────────────
// Desktop top bar
// ─────────────────────────────────────────────────────────────
function DesktopTopBar({ theme }) {
  return (
    <div style={{
      height: 60, borderBottom: `1px solid ${theme.border}`, background: theme.surface,
      padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
      gap: 16, flexShrink: 0,
    }}>
      <button style={{
        width: 40, height: 40, borderRadius: 12, background: theme.surfaceSunk,
        border: `1px solid ${theme.border}`, color: theme.text2, position: 'relative',
        display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
      }}>
        <Bell size={20} />
        <span style={{
          position: 'absolute', top: 8, right: 9, width: 8, height: 8, borderRadius: 4,
          background: theme.danger, border: `2px solid ${theme.surfaceSunk}`,
        }} />
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// BottomNav (< 900px)
// ─────────────────────────────────────────────────────────────
function BottomNav({ theme, screen, setScreen, currentUser }) {
  return (
    <div style={{
      position: 'fixed', left: 0, right: 0, bottom: 0,
      paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 14px)', paddingTop: 8,
      background: theme.surface, borderTop: `1px solid ${theme.border}`,
      display: 'flex', alignItems: 'flex-end', justifyContent: 'space-around',
      zIndex: 30,
    }}>
      {NAV_ITEMS.filter(it => canSee(currentUser, it.key)).map(it => {
        const a = it.key === screen;
        const Ic = it.icon;
        return (
          <button key={it.key} onClick={() => setScreen(it.key)} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
            color: a ? theme.brand : theme.text3,
            padding: '6px 4px', flex: 1, minWidth: 0, position: 'relative',
            overflow: 'hidden', fontFamily: FONT_UI,
          }}>
            {a && (
              <div style={{
                position: 'absolute', top: -8, left: '50%', transform: 'translateX(-50%)',
                width: 28, height: 3, borderRadius: 2, background: theme.brand,
              }} />
            )}
            <Ic size={24} />
            <span style={{ fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>{it.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// AppShell — responsive wrapper
// ─────────────────────────────────────────────────────────────
export function AppShell({ theme, screen, setScreen, currentUser, onLogout, children }) {
  const desktop = useIsDesktop();
  if (desktop) {
    return (
      <div style={{
        display: 'flex', height: '100vh', background: theme.page,
        fontFamily: FONT_UI, color: theme.text,
      }}>
        <Sidebar theme={theme} screen={screen} setScreen={setScreen}
                 currentUser={currentUser} onLogout={onLogout} />
        <main style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <DesktopTopBar theme={theme} />
          <div style={{ flex: 1, overflow: 'auto', padding: 28 }}>
            {children}
          </div>
        </main>
      </div>
    );
  }
  // Mobile
  return (
    <div style={{
      minHeight: '100vh', background: theme.page,
      fontFamily: FONT_UI, color: theme.text,
      paddingTop: 'env(safe-area-inset-top, 0px)',
      paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 84px)',
      overflowX: 'hidden',
    }}>
      {children}
      <BottomNav theme={theme} screen={screen} setScreen={setScreen} currentUser={currentUser} />
    </div>
  );
}
