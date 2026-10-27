// src/design/screens/PaymentScreen.jsx
// "Cobro" rápido desde la pantalla de inicio: elegir cliente/proveedor → monto
// → método → confirmar. Misma lógica que los formularios de Clientes → Pagos
// (POST /clients/{id}/payments) y Proveedores → Dinero
// (POST /clients/{id}/supplier-payments). Los pesos se pueden convertir a USD
// con el dólar blue en ambos casos.

import { useEffect, useRef, useState } from 'react';
import { FONT_UI, FONT_MONO, money, PAY_NOTE_PRESETS, PESOS_NOTES } from '../tokens';
import { Avatar, Pill, Card, Row, SectionHeader, SearchField, PayMethodButton, BottomSheet, useIsDesktop } from '../primitives';
import { ChevD, Check, Cash, Transfer, Crypto } from '../Icons';

const ICONS_BY_NOTE = {
  'USD FISICO': Cash, 'USDT / CRIPTO': Crypto, 'TRANSFERENCIA PESOS': Transfer, 'PESOS FISICO': Cash,
};
const LAST_METHOD_KEY = 'cobro.lastMethod';

const localToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
};

function readLastMethod() {
  try {
    const v = localStorage.getItem(LAST_METHOD_KEY);
    return PAY_NOTE_PRESETS.includes(v) ? v : PAY_NOTE_PRESETS[0];
  } catch { return PAY_NOTE_PRESETS[0]; }
}

export default function PaymentScreen({ theme, clients = [], pushToast, apiBase, apiFetch }) {
  const desktop = useIsDesktop();
  const [client, setClient] = useState(null);
  const [balance, setBalance] = useState(null);   // cliente: lo que debe · proveedor: lo que le debemos
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState(readLastMethod);
  const [extraNotes, setExtraNotes] = useState('');
  const [convertUSD, setConvertUSD] = useState(true);
  const [payDate, setPayDate] = useState(() => localToday());
  const [sheetOpen, setSheetOpen] = useState(true); // abre el buscador apenas se entra a "Cobro"
  const [query, setQuery] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const amountRef = useRef(null);

  const isSupplier = !!client?.is_supplier;
  const isPesos = PESOS_NOTES.includes(method);

  async function fetchBalance(c) {
    if (c.is_supplier) {
      const [p, sp] = await Promise.all([
        apiFetch(`${apiBase}/clients/${c.id}/purchases`).then(r => r.json()),
        apiFetch(`${apiBase}/clients/${c.id}/supplier-payments`).then(r => r.json()),
      ]);
      const bought = (Array.isArray(p) ? p : []).reduce((s, x) => s + Number(x.total || 0), 0);
      const paid = (Array.isArray(sp) ? sp : []).reduce((s, x) => s + Number(x.amount || 0), 0);
      return Math.max(0, bought - paid);
    }
    const st = await apiFetch(`${apiBase}/clients/${c.id}/statement`).then(r => r.json());
    return Number(st?.total_balance || 0);
  }

  useEffect(() => {
    if (!client) { setBalance(null); return; }
    let stale = false;
    setBalance(null);
    fetchBalance(client)
      .then(b => { if (!stale) setBalance(b); })
      .catch(() => { if (!stale) pushToast?.('error', 'No se pudo obtener el saldo'); });
    setTimeout(() => amountRef.current?.focus(), 0);
    return () => { stale = true; };
  }, [client]); // eslint-disable-line react-hooks/exhaustive-deps

  const pickMethod = (m) => {
    setMethod(m);
    if (PESOS_NOTES.includes(m)) setConvertUSD(true);
    try { localStorage.setItem(LAST_METHOD_KEY, m); } catch { /* sin storage: no pasa nada */ }
  };

  async function submit() {
    if (!client || submitting) return;
    const raw = Number(amount);
    if (!Number.isFinite(raw) || raw <= 0) { pushToast?.('error', 'Ingresá un monto válido (> 0).'); return; }
    setSubmitting(true);
    try {
      let finalAmount = raw;
      let notes = method;
      if (isPesos && convertUSD) {
        const d = await apiFetch(`${apiBase}/dolar-blue`).then(r => r.json());
        const venta = parseFloat(d?.venta);
        if (!Number.isFinite(venta) || venta <= 0) throw new Error('No se pudo obtener el dólar blue');
        finalAmount = raw / venta;
        notes = `${method} = $${raw.toLocaleString('es-AR')}`;
      }
      if (extraNotes.trim()) notes += `\n${extraNotes.trim()}`;
      const res = await apiFetch(
        `${apiBase}/clients/${client.id}/${isSupplier ? 'supplier-payments' : 'payments'}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount: finalAmount,
            payment_date: payDate === localToday()
              ? new Date().toISOString()
              : new Date(payDate + 'T12:00:00').toISOString(),
            notes,
          }),
        },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(typeof err.detail === 'string' ? err.detail : 'Error registrando pago');
      }
      const rest = balance == null ? null : balance - finalAmount;
      pushToast?.('success', `${isSupplier ? 'Pago' : 'Cobro'} registrado · ${money(finalAmount)}`
        + (rest == null ? '' : ` · ${isSupplier ? 'Le debemos' : 'Saldo'} ${money(rest)}`));
      setClient(null);
      setAmount('');
      setPayDate(localToday());
      setExtraNotes('');
      setQuery('');
      setSheetOpen(true);
    } catch (e) {
      pushToast?.('error', e.message || 'No se pudo registrar el pago');
    } finally {
      setSubmitting(false);
    }
  }

  const results = clients.filter(c =>
    !query || c.name?.toLowerCase().includes(query.toLowerCase()) || c.phone?.includes(query)
  );

  const balanceLabel = balance == null ? 'Cargando saldo…'
    : isSupplier ? `Le debemos ${money(balance)}`
    : balance > 0 ? `Debe ${money(balance)}`
    : balance < 0 ? `A favor ${money(-balance)}`
    : 'Sin deuda';

  const canSubmit = client && Number(amount) > 0 && !submitting;

  const body = (
    <>
      {/* Header */}
      <div style={{ padding: desktop ? '0 0 18px' : '16px 20px 8px' }}>
        <div style={{ fontWeight: 700, fontSize: desktop ? 24 : 26, color: theme.text, letterSpacing: -0.5, marginBottom: 6 }}>
          {isSupplier ? 'Nuevo pago' : 'Nuevo cobro'}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: theme.text2 }}>Fecha</span>
          <input
            type="date" lang="en-GB" value={payDate} max={localToday()}
            onChange={e => setPayDate(e.target.value)}
            style={{
              background: theme.surfaceSunk, border: `1px solid ${theme.border}`,
              borderRadius: 8, color: theme.text, fontSize: 13, fontWeight: 500,
              padding: '5px 10px', outline: 'none', cursor: 'pointer', fontFamily: 'inherit',
            }}
          />
        </div>
      </div>

      {/* Cliente */}
      <SectionHeader theme={theme} title={isSupplier ? 'Proveedor' : 'Cliente'} />
      <div style={{ padding: '0 16px' }}>
        <Card theme={theme}>
          <Row theme={theme} divider={false} paddingY={12}
            onClick={() => { setQuery(''); setSheetOpen(true); }}
            leading={<Avatar name={client?.name || '?'} theme={theme} />}
            title={client?.name || 'Elegí cliente o proveedor'}
            subtitle={client ? balanceLabel : 'Tocá para buscar'}
            trailing={<ChevD size={20} style={{ color: theme.text3 }} />}
          />
        </Card>
      </div>

      {/* Monto */}
      <SectionHeader theme={theme} title="Monto" />
      <div style={{ padding: '0 16px' }}>
        <input
          ref={amountRef}
          inputMode="decimal"
          placeholder="$ 0"
          value={amount}
          disabled={!client}
          onChange={e => setAmount(e.target.value.replace(',', '.').replace(/[^\d.]/g, ''))}
          onKeyDown={e => { if (e.key === 'Enter') submit(); }}
          style={{
            width: '100%', height: 56, fontSize: 24, fontWeight: 600,
            borderRadius: 14, border: `1px solid ${theme.borderStrong}`,
            background: theme.surfaceSunk, color: theme.text,
            padding: '0 16px', outline: 'none', boxSizing: 'border-box', fontFamily: FONT_MONO,
            opacity: client ? 1 : 0.5,
          }}
        />
        {balance > 0 && (
          <button onClick={() => { setAmount(String(Number(balance.toFixed(2)))); amountRef.current?.focus(); }} style={{
            marginTop: 10, padding: '8px 14px', borderRadius: 999,
            border: `1px solid ${theme.brand}`, background: theme.brandSoft, color: theme.brand,
            fontWeight: 600, fontSize: 13, fontFamily: FONT_UI, cursor: 'pointer',
          }}>Saldar {money(balance)}</button>
        )}
      </div>

      {/* Método */}
      <SectionHeader theme={theme} title="Método" />
      <div style={{ padding: '0 16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {PAY_NOTE_PRESETS.map(m => (
          <PayMethodButton key={m} theme={theme} icon={ICONS_BY_NOTE[m] || Cash}
            label={m} active={method === m} onClick={() => pickMethod(m)} />
        ))}
      </div>
      {isPesos && (
        <label style={{
          margin: '10px 16px 0', display: 'flex', alignItems: 'center', gap: 10,
          fontSize: 14, fontWeight: 600, color: theme.text2, cursor: 'pointer',
        }}>
          <input type="checkbox" checked={convertUSD} onChange={e => setConvertUSD(e.target.checked)}
            style={{ width: 18, height: 18 }} />
          Convertir a USD (dólar blue)
        </label>
      )}

      {/* Notas */}
      <SectionHeader theme={theme} title="Notas" />
      <div style={{ padding: '0 16px' }}>
        <textarea
          rows={2}
          maxLength={440} // notas del pago: 500 en el backend, menos el método
          placeholder="Opcional: descripción del pago…"
          value={extraNotes}
          onChange={e => setExtraNotes(e.target.value)}
          style={{
            width: '100%', fontSize: 15, borderRadius: 12,
            border: `1px solid ${theme.border}`, background: theme.surfaceSunk, color: theme.text,
            padding: '10px 14px', outline: 'none', boxSizing: 'border-box',
            fontFamily: FONT_UI, resize: 'vertical',
          }}
        />
      </div>

      {/* Confirmar */}
      <div style={{ padding: '16px 16px 24px' }}>
        <button onClick={submit} disabled={!canSubmit} style={{
          width: '100%', padding: '16px', borderRadius: 16,
          background: theme.brand, color: '#fff', border: 'none',
          fontWeight: 700, fontSize: 16, fontFamily: FONT_UI,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          cursor: canSubmit ? 'pointer' : 'default',
          opacity: canSubmit ? 1 : 0.45,
        }}>
          <Check size={22}/>
          {submitting ? 'Procesando…'
            : !client ? 'Elegí cliente o proveedor'
            : `${isSupplier ? 'Confirmar pago' : 'Confirmar cobro'}${Number(amount) > 0 ? ` · $${Number(amount).toLocaleString('es-AR')}` : ''}`}
        </button>
      </div>
    </>
  );

  return (
    <>
      {desktop
        ? <div style={{ maxWidth: 720, margin: '0 auto' }}>{body}</div>
        : <div style={{ overflowX: 'hidden', width: '100%' }}>{body}</div>
      }
      <BottomSheet theme={theme} open={sheetOpen} onClose={() => setSheetOpen(false)} title="¿A quién?">
        <div style={{ padding: '0 16px 12px' }}>
          <SearchField theme={theme} placeholder="Buscar cliente o proveedor…" value={query} onChange={e => setQuery(e.target.value)} autoFocus />
        </div>
        <div style={{ padding: '0 16px 16px' }}>
          <Card theme={theme}>
            {results.map((c, i, arr) => (
              <Row key={c.id} theme={theme} divider={i < arr.length - 1}
                onClick={() => { setClient(c); setAmount(''); setSheetOpen(false); }}
                leading={<Avatar name={c.name} theme={theme} size={36} />}
                title={c.name} subtitle={c.phone || null}
                trailing={c.is_supplier ? <Pill theme={theme} color="warning">Proveedor</Pill> : null}
              />
            ))}
          </Card>
        </div>
      </BottomSheet>
    </>
  );
}
