// src/design/screens/SaleScreen.jsx
// Drop-in "Nueva venta" screen for the redesign. Replaces NewSaleScreen
// from the legacy App.jsx. Same data contract: clients[], products[],
// pushToast(), and an `apiFetch(`${API}/sales`, {method:'POST'…})` POST on submit.
//
// You wire two things from App.jsx:
//   - The lists you already load: clients, products
//   - pushToast(type, message) for feedback
//   - The actual POST: edit the `submit()` body below

import { useMemo, useState } from 'react';
import { FONT_UI, FONT_MONO, money, PAYMENT_METHODS } from '../tokens';
import {
  Avatar, Pill, Card, Row, SectionHeader, SearchField, PayMethodButton,
  BottomSheet, useIsDesktop, iconBtnStyle, QtyInput,
} from '../primitives';
import {
  ChevD, Plus, Receipt, X, Check, Bolt, Pkg, Cash, Transfer, Crypto, Clock,
} from '../Icons';

const ICONS_BY_PAY = { cash: Cash, transfer: Transfer, crypto: Crypto, credit: Clock };

const localToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
};

export default function SaleScreen({ theme, clients = [], products = [], pushToast, apiBase, apiFetch }) {
  const desktop = useIsDesktop();
  const [client, setClient] = useState(null);   // null = mostrador
  const [cart, setCart] = useState([]);          // [{ productId, q }]
  const [payMethod, setPayMethod] = useState('cash');
  const [parcial, setParcial] = useState(false);
  const [parcialAmount, setParcialAmount] = useState('');
  const [saleDate, setSaleDate] = useState(() => localToday());
  const [sheet, setSheet] = useState(null);      // 'client' | 'product' | null
  const [query, setQuery] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Resolve cart -> products with prices/names
  const lines = useMemo(() => cart
    .map(c => ({ ...c, p: products.find(p => p.id === c.productId) }))
    .filter(c => c.p), [cart, products]);

  // Resolve unit price using price lists (same logic as legacy NewSaleScreen)
  const priceFor = (p) => {
    const prices = p?.prices || [];
    if (client) {
      const match = prices.find(pr => pr.price_list_id === client.price_list_id);
      if (match) return Number(match.price);
    }
    const general = prices.find(pr => pr.price_list_name?.toLowerCase() === 'general');
    if (general) return Number(general.price);
    if (prices.length > 0) return Number(prices[0].price);
    return Number(p?.cost_price ?? 0);
  };

  const linePrice = (l) => {
    const n = Number(l.price);
    return Number.isFinite(n) && n >= 0 ? n : priceFor(l.p);
  };

  const total = lines.reduce((s, l) => s + linePrice(l) * l.q, 0);
  const count = lines.reduce((s, l) => s + l.q, 0);

  const addProduct = (p) => {
    setCart(prev => {
      const i = prev.find(x => x.productId === p.id);
      if (i) return prev.map(x => x.productId === p.id ? { ...x, q: x.q + 1 } : x);
      return [...prev, { productId: p.id, q: 1, price: String(priceFor(p)) }];
    });
  };
  const setQty = (productId, val) => {
    const n = Math.max(1, parseInt(val) || 1);
    setCart(c => c.map(x => x.productId === productId ? { ...x, q: n } : x));
  };
  const setPrice = (productId, val) =>
    setCart(c => c.map(x => x.productId === productId ? { ...x, price: val } : x));
  const removeLine = (productId) =>
    setCart(c => c.filter(x => x.productId !== productId));

  async function submit(force = false) {
    if (lines.length === 0) return;
    if (!client) { pushToast?.('error', 'Seleccioná un cliente'); return; }
    if (parcial && payMethod !== 'credit' && !(Number(parcialAmount) > 0)) {
      pushToast?.('error', 'Ingresá el monto del pago parcial'); return;
    }
    setSubmitting(true);
    try {
      const payload = {
        client_id: client.id,
        sale_date: saleDate === localToday()
          ? new Date().toISOString()
          : new Date(saleDate + 'T12:00:00').toISOString(),
        notes: null,
        items: lines.map(l => ({
          product_id: l.p.id,
          quantity: l.q,
          unit_price: linePrice(l),
          notes: null,
        })),
        initial_payment_amount: payMethod === 'credit'
          ? 0
          : parcial
            ? (Number(parcialAmount) || 0)
            : total,
        initial_payment_method: payMethod === 'credit'
          ? null
          : (PAYMENT_METHODS.find(m => m.id === payMethod)?.label ?? null),
      };
      const url = force ? `${apiBase}/sales?force=true` : `${apiBase}/sales`;
      const res = await apiFetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        if (res.status === 409 && err.detail?.code === 'STOCK_INSUFFICIENT') {
          setSubmitting(false);
          const items = err.detail.items || [];
          const resumen = items.map(i => `${i.product_name}: pedido ${i.requested}, disponible ${i.available}`).join('\n');
          if (window.confirm(`Stock insuficiente:\n${resumen}\n\n¿Confirmar igual?`)) {
            submit(true);
          }
          return;
        }
        const detail = err.detail;
        const msg = typeof detail === 'string' ? detail
          : Array.isArray(detail) ? detail.map(e => e.msg || JSON.stringify(e)).join(', ')
          : 'Error al registrar venta';
        throw new Error(msg);
      }
      pushToast?.('success', `Venta registrada · ${money(total)}`);
      setCart([]);
      setClient(null);
      setPayMethod('cash');
      setParcial(false);
      setParcialAmount('');
      setSaleDate(localToday());
    } catch (e) {
      pushToast?.('error', e.message || 'No se pudo registrar la venta');
    } finally {
      setSubmitting(false);
    }
  }

  // Filtered lists for sheets
  const clientResults = clients.filter(c =>
    !query || c.name?.toLowerCase().includes(query.toLowerCase()) ||
    c.phone?.includes(query)
  );
  const productResults = products.filter(p =>
    !query || p.name?.toLowerCase().includes(query.toLowerCase())
  );

  // Shared body: Cliente · Productos (with dropdown) · Cart · Total · Pago · Confirmar
  const body = (
    <>
      {/* Header */}
      <div style={{
        padding: desktop ? '0 0 18px' : '28px 20px 8px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
      }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: desktop ? 24 : 26, color: theme.text, letterSpacing: -0.5, marginBottom: 6 }}>
            Nueva venta
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: theme.text2 }}>Fecha</span>
            <input
              type="date"
              lang="en-GB"
              value={saleDate}
              max={localToday()}
              onChange={e => setSaleDate(e.target.value)}
              style={{
                background: theme.surfaceSunk, border: `1px solid ${theme.border}`,
                borderRadius: 8, color: theme.text, fontSize: 13, fontWeight: 500,
                padding: '5px 10px', outline: 'none', cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            />
          </div>
        </div>
        <button style={iconBtnStyle(theme)} title="Historial"><Receipt size={20}/></button>
      </div>

      {/* Cliente */}
      <SectionHeader theme={theme} title="Cliente" />
      <div style={{ padding: '0 16px' }}>
        <Card theme={theme}>
          <Row theme={theme} divider={false} paddingY={12}
            onClick={() => { setQuery(''); setSheet('client'); }}
            leading={<Avatar name={client?.name || 'Mostrador'} theme={theme} />}
            title={client?.name || 'Mostrador'}
            subtitle={client ? `Lista ${client.price_list?.name || 'general'}` : 'Venta sin cliente · lista minorista'}
            trailing={<ChevD size={20} style={{ color: theme.text3 }} />}
          />
        </Card>
      </div>

      {/* Productos */}
      <SectionHeader theme={theme} title="Productos" action={count > 0 ? `${count} item${count === 1 ? '' : 's'}` : null} />
      <div style={{ padding: '0 16px' }}>
        <button onClick={() => { setQuery(''); setSheet('product'); }} style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 12,
          padding: '14px 16px', borderRadius: 14,
          background: theme.surface, border: `1px solid ${theme.border}`,
          color: theme.text, fontFamily: FONT_UI, fontSize: 15, fontWeight: 500,
          cursor: 'pointer', textAlign: 'left',
        }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: theme.brandSoft, color: theme.brand, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Plus size={18}/>
          </div>
          <span style={{ flex: 1 }}>Agregar producto</span>
          <ChevD size={18} style={{ color: theme.text3 }} />
        </button>
      </div>

      {lines.length > 0 && (
        <div style={{ padding: '10px 16px 0' }}>
          <Card theme={theme}>
            {lines.map((l, i) => (
              <div key={l.productId} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '12px 14px',
                borderBottom: i < lines.length - 1 ? `1px solid ${theme.border}` : 'none',
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14.5, color: theme.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.p.name}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 2, marginTop: 3 }}>
                    <span style={{ fontSize: 12, color: theme.text3, fontFamily: FONT_MONO }}>$</span>
                    <input
                      inputMode="decimal"
                      value={l.price}
                      onChange={(e) => setPrice(l.productId, e.target.value)}
                      style={{
                        width: 72, background: 'transparent', border: 'none',
                        borderBottom: `1px solid ${theme.border}`, color: theme.text2,
                        fontSize: 12, fontFamily: FONT_MONO, outline: 'none', padding: '1px 2px',
                      }}
                    />
                    <span style={{ fontSize: 12, color: theme.text3, fontFamily: FONT_MONO }}>c/u</span>
                  </div>
                </div>
                <QtyInput theme={theme} value={l.q} onChange={(v) => setQty(l.productId, v)} />
                <div style={{ fontFamily: FONT_MONO, fontWeight: 600, fontSize: 14.5, color: theme.text, width: 76, textAlign: 'right' }}>
                  {money(linePrice(l) * l.q)}
                </div>
                <button onClick={() => removeLine(l.productId)} style={{
                  width: 28, height: 28, borderRadius: 14,
                  background: 'transparent', border: 'none',
                  color: theme.text3, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}><X size={16}/></button>
              </div>
            ))}
          </Card>
        </div>
      )}

      {/* Total */}
      <div style={{ padding: '16px 20px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span style={{ fontSize: 14, color: theme.text2, fontWeight: 600 }}>Total</span>
          <span style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 30, color: theme.text, letterSpacing: -0.5 }}>{money(total)}</span>
        </div>
      </div>

      {/* Método de pago */}
      <SectionHeader theme={theme} title="Método de pago" />
      <div style={{ padding: '0 16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {PAYMENT_METHODS.map((p) => (
          <PayMethodButton key={p.id} theme={theme}
            icon={ICONS_BY_PAY[p.id] || Cash}
            label={p.label}
            active={payMethod === p.id}
            onClick={() => {
              setPayMethod(p.id);
              if (p.id === 'credit') { setParcial(false); setParcialAmount(''); }
            }}
          />
        ))}
      </div>

      {/* Pago parcial */}
      <div style={{ padding: '10px 16px 0', display: 'grid', gap: 10 }}>
        <label style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 16px', borderRadius: 14,
          background: parcial ? theme.brandSoft : theme.surface,
          border: `1px solid ${parcial ? theme.brand : theme.border}`,
          cursor: 'pointer', userSelect: 'none', transition: 'all .15s',
        }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: parcial ? theme.brand : theme.text2 }}>
            Pago parcial
          </span>
          <div style={{
            width: 42, height: 24, borderRadius: 12,
            background: parcial ? theme.brand : theme.surfaceSunk,
            border: `1px solid ${parcial ? theme.brand : theme.borderStrong}`,
            position: 'relative', transition: 'background .15s',
            flexShrink: 0,
          }}>
            <div style={{
              position: 'absolute', top: 3, left: parcial ? 19 : 3,
              width: 16, height: 16, borderRadius: 8,
              background: '#fff', transition: 'left .15s',
            }} />
          </div>
          <input
            type="checkbox"
            checked={parcial}
            onChange={(e) => {
              const checked = e.target.checked;
              setParcial(checked);
              if (!checked) setParcialAmount('');
              if (checked && payMethod === 'credit') setPayMethod('cash');
            }}
            style={{ display: 'none' }}
          />
        </label>

        {parcial && payMethod !== 'credit' && (
          <input
            type="number"
            inputMode="decimal"
            placeholder="Monto a entregar..."
            value={parcialAmount}
            onChange={(e) => setParcialAmount(e.target.value)}
            style={{
              width: '100%', height: 48, fontSize: 16,
              borderRadius: 12, border: `1px solid ${theme.borderStrong}`,
              background: theme.surfaceSunk, color: theme.text,
              padding: '0 14px', outline: 'none', boxSizing: 'border-box',
              fontFamily: FONT_MONO,
            }}
          />
        )}
      </div>

      {/* Confirm */}
      <div style={{ padding: '16px 16px 24px' }}>
        <button onClick={submit} disabled={submitting || lines.length === 0} style={{
          width: '100%', padding: '16px', borderRadius: 16,
          background: theme.brand, color: '#fff', border: 'none',
          fontWeight: 700, fontSize: 16, fontFamily: FONT_UI,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          cursor: (submitting || lines.length === 0) ? 'default' : 'pointer',
          opacity: lines.length === 0 ? 0.45 : (submitting ? 0.7 : 1),
          boxShadow: lines.length > 0 ? `0 12px 24px ${theme.name === 'dark' ? 'rgba(45,91,255,0.4)' : 'rgba(45,91,255,0.25)'}` : 'none',
          transition: 'opacity .15s, box-shadow .15s',
        }}>
          <Check size={22}/>
          {submitting ? 'Procesando…' : lines.length === 0 ? 'Agregá productos' : `Confirmar venta · ${money(total)}`}
        </button>
      </div>
    </>
  );

  // Always render BottomSheets (they use open prop to show/hide).
  // Desktop wraps body in a centered container; sheets work on any screen size.
  return (
    <>
      {desktop ? <div style={{ maxWidth: 720, margin: '0 auto' }}>{body}</div> : body}
      {/* Client picker sheet */}
      <BottomSheet theme={theme} open={sheet === 'client'} onClose={() => setSheet(null)} title="Elegí el cliente">
        <div style={{ padding: '0 16px 12px' }}>
          <SearchField theme={theme} placeholder="Buscar cliente…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <div style={{ padding: '0 16px 8px' }}>
          <button onClick={() => { setClient(null); setSheet(null); }} style={{
            width: '100%', padding: '12px 14px', borderRadius: 12,
            background: theme.brandSoft, color: theme.brand,
            border: `1px dashed ${theme.brand}`,
            display: 'flex', alignItems: 'center', gap: 10,
            fontFamily: FONT_UI, cursor: 'pointer',
          }}>
            <div style={{ width: 32, height: 32, borderRadius: 16, background: theme.brand, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Bolt size={16}/>
            </div>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>Venta sin cliente</div>
              <div style={{ fontSize: 11, fontWeight: 500, opacity: 0.85 }}>Mostrador rápido</div>
            </div>
          </button>
        </div>
        <div style={{ padding: '0 16px 16px' }}>
          <Card theme={theme}>
            {clientResults.map((c, i, arr) => (
              <Row key={c.id} theme={theme} divider={i < arr.length - 1}
                onClick={() => { setClient(c); setSheet(null); }}
                leading={<Avatar name={c.name} theme={theme} size={36} />}
                title={c.name} subtitle={c.price_list?.name || 'Sin lista'}
              />
            ))}
          </Card>
        </div>
      </BottomSheet>

      {/* Product picker sheet */}
      <BottomSheet theme={theme} open={sheet === 'product'} onClose={() => setSheet(null)} title="Elegí un producto">
        <div style={{ padding: '0 16px 12px' }}>
          <SearchField theme={theme} placeholder="Buscar producto…" value={query} onChange={(e) => setQuery(e.target.value)} autoFocus />
        </div>
        <div style={{ padding: '0 16px 16px' }}>
          <Card theme={theme}>
            {productResults.map((p, i, arr) => (
              <Row key={p.id} theme={theme} divider={i < arr.length - 1}
                onClick={() => { addProduct(p); setSheet(null); }}
                leading={<div style={{ width: 40, height: 40, borderRadius: 10, background: theme.brandSoft, color: theme.brand, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Pkg size={20}/></div>}
                title={p.name}
                subtitle={p.type}
                trailing={<div style={{ fontFamily: FONT_MONO, fontWeight: 600, fontSize: 15, color: theme.text }}>{money(priceFor(p))}</div>}
              />
            ))}
          </Card>
        </div>
      </BottomSheet>
    </>
  );
}
