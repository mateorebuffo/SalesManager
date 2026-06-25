import { useEffect, useMemo, useRef, useState } from "react";
import { themes } from "./design/tokens";
import "./design/styles.css";
import { AppShell as NewShell } from "./design/AppShell";
import SaleScreen from "./design/screens/SaleScreen";
import { Cart as CartIcon } from "./design/Icons";

// En producción setear VITE_API_URL en el archivo .env de Netlify/Railway
const API = import.meta.env.VITE_API_URL ?? `http://${window.location.hostname}:8000`;

/**
 * apiFetch — wrapper de fetch que:
 *  1. Agrega el header Authorization: Bearer <token> automáticamente
 *  2. Si el servidor devuelve 401 (token expirado/inválido), limpia el
 *     token guardado y llama a _onUnauthorized para volver al login
 *
 * Se usa exactamente igual que fetch():
 *   const res = await apiFetch(`${API}/clients`)
 *   const res = await apiFetch(`${API}/sales`, { method: "POST", ... })
 */
let _onUnauthorized = null;

const localToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
};

/** Decodifica el payload del JWT (sin verificar firma — solo para UI). */
function parseToken(token) {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    if (payload.exp && payload.exp * 1000 < Date.now()) return null;
    return {
      id: payload.uid,
      username: payload.sub,
      role: payload.role,
      permissions: payload.permissions ?? [],
    };
  } catch {
    return null;
  }
}

/** Devuelve true si currentUser puede ver la pantalla dada. */
function canSee(currentUser, screen) {
  if (!currentUser) return false;
  if (currentUser.role === "admin") return true;
  if (screen === "users") return false;
  return currentUser.permissions.includes(screen);
}

async function apiFetch(url, options = {}) {
  const token = localStorage.getItem("auth_token");
  const res = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (res.status === 401) {
    localStorage.removeItem("auth_token");
    _onUnauthorized?.();
  }
  return res;
}

/* =========================
   Toast (sin librerías)
========================= */
const TOAST_COLOR = { success: "#5C82FF", error: "#f87171", info: "#5C82FF" };
const TOAST_LABEL = { success: "OK", error: "Error", info: "Info" };

function ToastHost({ toasts, removeToast }) {
  return (
    <div style={{
      position: "fixed",
      left: 0,
      right: 0,
      bottom: "calc(env(safe-area-inset-bottom, 0px) + 92px)",
      zIndex: 9999,
      pointerEvents: "none",
      display: "flex",
      flexDirection: "column-reverse",
      gap: 10,
      alignItems: "center",
      padding: "0 12px",
    }}>
      {toasts.map((t) => {
        const color = TOAST_COLOR[t.type] || TOAST_COLOR.info;
        return (
          <div key={t.id} style={{
            width: "min(520px, calc(100vw - 24px))",
            borderRadius: 14,
            border: `1.5px solid ${color}`,
            background: "#0D1526",
            color: "#fff",
            padding: "12px 12px",
            boxShadow: `0 8px 32px rgba(0,0,0,.6), 0 0 18px ${color}44`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            pointerEvents: "auto",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
              <div style={{ width: 4, borderRadius: 4, alignSelf: "stretch", background: color, flexShrink: 0 }} />
              <div style={{ display: "grid", gap: 2 }}>
                <div style={{ fontWeight: 900, fontSize: 12, color, letterSpacing: 0.5 }}>
                  {TOAST_LABEL[t.type] || "Info"}
                </div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{t.message}</div>
              </div>
            </div>
            <button type="button" onClick={() => removeToast(t.id)} style={{
              height: 34, minWidth: 38, borderRadius: 9,
              border: `1px solid ${color}55`,
              background: `${color}18`,
              color, fontWeight: 900, fontSize: 15, cursor: "pointer", flexShrink: 0,
            }}>✕</button>
          </div>
        );
      })}
    </div>
  );
}

/** Dropdown buscable (solo muestra lista si hay query) */
function SearchDropdown({
  inputRef,
  label,
  placeholder,
  items,
  getKey,
  getLabel,
  query,
  setQuery,
  selected,
  setSelected,
  maxResults = 12,
  onAdd,
  onEdit,
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items.slice(0, maxResults);
    return items
      .filter((it) => getLabel(it).toLowerCase().includes(q))
      .slice(0, maxResults);
  }, [items, query, getLabel, maxResults]);

  useEffect(() => {
    const onDown = (e) => {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
    };
  }, []);

  return (
    <div
      ref={wrapRef}
      style={{
        marginBottom: 14,
        width: "100%",
        maxWidth: "100%",
        boxSizing: "border-box",
      }}
    >
      <label style={{ display: "block", marginBottom: 6, color: "#fff" }}>{label}</label>

      {selected ? (
        <div
          style={{
            border: "1px solid #1F2A4A",
            borderRadius: 12,
            padding: 12,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 10,
            background: "#121A33",
            color: "#fff",
          }}
        >
          <div style={{ fontWeight: 800, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{getLabel(selected)}</div>

          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            {onEdit && (
              <button
                type="button"
                style={{
                  height: 44,
                  padding: "0 14px",
                  borderRadius: 12,
                  border: "1px solid rgba(92,130,255,0.4)",
                  background: "rgba(92,130,255,0.1)",
                  color: "#5C82FF",
                  fontWeight: 800,
                  cursor: "pointer",
                }}
                onClick={onEdit}
              >
                Editar
              </button>
            )}
            <button
              type="button"
              style={{
                height: 44,
                minWidth: 110,
                borderRadius: 12,
                border: "1px solid #2B3960",
                background: "#0A1124",
                color: "#fff",
                fontWeight: 800,
              }}
              onClick={() => {
                setSelected(null);
                setQuery("");
                setOpen(true);
                setTimeout(() => inputRef?.current?.focus(), 0);
              }}
            >
              Cambiar
            </button>
          </div>
        </div>
      ) : (
        <div
          style={{
            position: "relative",
            width: "100%",
            maxWidth: "100%",
            boxSizing: "border-box",
          }}
        >
          <div style={{ display: "flex", gap: 8 }}>
            <input
              ref={inputRef}
              placeholder={placeholder}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setOpen(true);
              }}
              onFocus={() => setOpen(true)}
              style={{
                flex: 1,
                height: 48,
                fontSize: 16,
                borderRadius: 12,
                border: "1px solid #1F2A4A",
                background: "#121A33",
                color: "#fff",
                padding: "0 12px",
                outline: "none",
                boxSizing: "border-box",
                minWidth: 0,
              }}
            />
            {onAdd && (
              <button
                type="button"
                onClick={onAdd}
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 12,
                  border: "1px solid #1F2A4A",
                  background: "#121A33",
                  color: "#5C82FF",
                  fontSize: 24,
                  fontWeight: 300,
                  flexShrink: 0,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                +
              </button>
            )}
          </div>

          {open && (
            <div
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                top: 54,
                zIndex: 50,
                border: "1px solid #1F2A4A",
                borderRadius: 12,
                background: "#0A1124",
                overflow: "hidden",
                maxHeight: 280,
                overflowY: "auto",
                maxWidth: "100%",
                boxSizing: "border-box",
              }}
            >
              {filtered.length === 0 ? (
                <div style={{ padding: 12, color: "#6E7A98" }}>Sin resultados</div>
              ) : (
                filtered.map((it) => (
                  <button
                    key={getKey(it)}
                    type="button"
                    style={{
                      width: "100%",
                      textAlign: "left",
                      padding: "12px 12px",
                      border: "none",
                      borderBottom: "1px solid #222",
                      background: "transparent",
                      color: "#fff",
                      fontSize: 16,
                      boxSizing: "border-box",
                    }}
                    onClick={() => {
                      setSelected(it);
                      setQuery("");
                      setOpen(false);
                    }}
                  >
                    {getLabel(it)}
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const SCREEN_LABELS = {
  sale: "Nueva venta",
  client: "Cliente",
  debtors: "Deudores",
  products: "Productos",
  stock: "Stock",
  users: "Usuarios",
};

function formatArDate(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("es-AR", {
    year: "2-digit",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

const PAY_NOTE_PRESETS = [
  "USD FISICO",
  "USDT / CRIPTO",
  "TRANSFERENCIA PESOS",
  "PESOS FISICO",
];

function NotesCombo({ value, onChange, onKeyDown, placeholder, inputStyle }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  const filtered = PAY_NOTE_PRESETS.filter(
    (p) => !value.trim() || p.toLowerCase().includes(value.toLowerCase())
  );

  useEffect(() => {
    const handler = (e) => {
      if (!containerRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <input
        placeholder={placeholder}
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        style={inputStyle}
      />
      {open && filtered.length > 0 && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0,
          background: "#0A1124", border: "1px solid #1F2A4A", borderRadius: 10,
          zIndex: 100, boxShadow: "0 4px 20px rgba(0,0,0,0.5)", overflow: "hidden",
        }}>
          {filtered.map((p, i) => (
            <button
              key={p}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); onChange(p); setOpen(false); }}
              style={{
                width: "100%", textAlign: "left", padding: "11px 14px",
                background: "transparent", border: "none",
                borderBottom: i < filtered.length - 1 ? "1px solid #1F2A4A" : "none",
                color: "#fff", fontSize: 14, cursor: "pointer", fontFamily: "inherit",
              }}
            >
              {p}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Pantalla: Cliente (Saldo + acciones) */
const PAY_METHODS_EDIT = [
  { id: "credit",   label: "Cuenta corriente" },
  { id: "crypto",   label: "USDT / Cripto"    },
  { id: "cash",     label: "Efectivo"         },
  { id: "transfer", label: "Transferencia"    },
];

function EditSaleModal({ saleId, products, pushToast, onSaved, onClose }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [saleDate, setSaleDate] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState([]);
  const [clientId, setClientId] = useState(null);
  const [payMethod, setPayMethod] = useState("credit");
  const [payAmount, setPayAmount] = useState("");

  // Campos para agregar item
  const [productQuery, setProductQuery] = useState("");
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [quantity, setQuantity] = useState("");
  const [price, setPrice] = useState("");
  const [itemNotes, setItemNotes] = useState("");
  const productRef = useRef(null);

  useEffect(() => {
    apiFetch(`${API}/sales/${saleId}`)
      .then((r) => r.json())
      .then((data) => {
        const dt = new Date(data.sale_date);
        const pad = (n) => String(n).padStart(2, "0");
        setSaleDate(
          `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`
        );
        setNotes(data.notes || "");
        setClientId(data.client_id);
        setItems(
          data.items.map((it) => ({
            product_id: it.product_id,
            name: it.product_name,
            quantity: Number(it.quantity),
            unit_price: Number(it.unit_price),
            notes: it.notes || "",
          }))
        );
        // Detectar método actual: si pagado > 0 → efectivo (approx); si no → CC
        const paid = Number(data.paid ?? 0);
        setPayMethod(paid > 0 ? "cash" : "credit");
        setPayAmount(paid > 0 ? String(paid.toFixed(2)) : "");
        setLoading(false);
      })
      .catch(() => {
        pushToast("Error cargando venta", "error");
        onClose();
      });
  }, [saleId]);

  const addItem = () => {
    if (!selectedProduct || !quantity || !price) return;
    const q = Number(quantity);
    const p = Number(price);
    if (!Number.isFinite(q) || q <= 0) return;
    if (!Number.isFinite(p) || p < 0) return;
    setItems((prev) => [
      ...prev,
      { product_id: selectedProduct.id, name: selectedProduct.name, quantity: q, unit_price: p, notes: itemNotes.trim() },
    ]);
    setSelectedProduct(null);
    setProductQuery("");
    setQuantity("");
    setPrice("");
    setItemNotes("");
    setTimeout(() => productRef.current?.focus(), 0);
  };

  const handleDelete = async () => {
    if (!window.confirm(`¿Eliminar venta #${saleId}? Esta acción no se puede deshacer.`)) return;
    setDeleting(true);
    try {
      const res = await apiFetch(`${API}/sales/${saleId}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Error eliminando venta");
      }
      pushToast(`Venta #${saleId} eliminada`, "success");
      onSaved();
      onClose();
    } catch (e) {
      pushToast(e.message || "Error", "error");
    } finally {
      setDeleting(false);
    }
  };

  const submit = async (force = false) => {
    if (items.length === 0) { pushToast("Agregá al menos un producto.", "error"); return; }
    const newTotal = items.reduce((s, it) => s + Number(it.quantity) * Number(it.unit_price), 0);
    let amt = null;
    if (payMethod !== "credit") {
      amt = Number(payAmount);
      if (!Number.isFinite(amt) || amt <= 0) { pushToast("Ingresá un monto válido.", "error"); return; }
      if (amt > newTotal + 0.001) { pushToast(`El monto no puede superar el total ($${newTotal.toFixed(2)}).`, "error"); return; }
    }
    setSaving(true);
    try {
      // 1) Actualizar items de la venta
      const res = await apiFetch(`${API}/sales/${saleId}${force ? "?force=true" : ""}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sale_date: saleDate ? new Date(saleDate).toISOString() : undefined,
          notes: notes.trim() || null,
          items: items.map((it) => ({
            product_id: it.product_id,
            quantity: it.quantity,
            unit_price: it.unit_price,
            notes: it.notes || null,
          })),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        if (res.status === 409 && err.detail?.code === "STOCK_INSUFFICIENT") {
          if (window.confirm("Stock insuficiente para algunos productos. ¿Guardar igual?")) {
            setSaving(false);
            submit(true);
          } else {
            setSaving(false);
          }
          return;
        }
        throw new Error(err.detail || "Error guardando venta");
      }

      // 2) Resetear pagos vinculados a esta venta
      if (clientId) {
        const paymentsRes = await apiFetch(`${API}/clients/${clientId}/payments`);
        if (paymentsRes.ok) {
          const allPayments = await paymentsRes.json();
          const salePayments = allPayments.filter((p) => p.sale_id === saleId);
          await Promise.all(
            salePayments.map((p) =>
              apiFetch(`${API}/clients/${clientId}/payments/${p.payment_id}`, { method: "DELETE" })
            )
          );
        }

        // 3) Crear nuevo pago si no es cuenta corriente
        if (payMethod !== "credit" && amt !== null) {
          const isPartial = amt < newTotal - 0.001;
          const methodLabel = PAY_METHODS_EDIT.find((m) => m.id === payMethod)?.label ?? payMethod;
          await apiFetch(`${API}/sales/${saleId}/payments`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              amount: amt,
              payment_date: new Date().toISOString(),
              notes: `${isPartial ? "Pago parcial" : "Pago completo"} Venta #${saleId} ${methodLabel}`,
            }),
          });
        }
      }

      pushToast("Venta actualizada ✅", "success");
      onSaved();
      onClose();
    } catch (e) {
      pushToast(e.message || "Error", "error");
    } finally {
      setSaving(false);
    }
  };

  const inputStyle = {
    height: 44, fontSize: 15, borderRadius: 10,
    border: "1px solid #1F2A4A", background: "#121A33",
    color: "#fff", padding: "0 12px", outline: "none", boxSizing: "border-box", width: "100%",
  };

  const total = items.reduce((acc, it) => acc + it.quantity * it.unit_price, 0);

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 200,
        background: "rgba(0,0,0,0.7)", display: "flex",
        alignItems: "flex-start", justifyContent: "center",
        paddingTop: "calc(env(safe-area-inset-top, 0px) + 16px)",
        paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)",
        paddingLeft: 12, paddingRight: 12,
        overflowY: "auto",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          width: "100%", maxWidth: "min(calc(100vw - 24px), 480px)", background: "#121A33",
          borderRadius: 18, border: "1px solid #1F2A4A",
          boxShadow: "0 8px 40px rgba(0,0,0,0.6)", padding: 20,
          display: "grid", gap: 14, marginTop: 16,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontWeight: 900, fontSize: 17 }}>Editar venta #{saleId}</div>
          <button type="button" onClick={onClose}
            style={{ background: "transparent", border: "none", color: "#6E7A98", fontSize: 22, cursor: "pointer", lineHeight: 1 }}>
            ✕
          </button>
        </div>

        {loading ? (
          <div style={{ color: "#6E7A98" }}>Cargando...</div>
        ) : (
          <>
            {/* Fecha */}
            <div style={{ display: "grid", gap: 6 }}>
              <label style={{ fontSize: 13, color: "#6E7A98" }}>Fecha</label>
              <input type="datetime-local" value={saleDate} onChange={(e) => setSaleDate(e.target.value)} style={inputStyle} />
            </div>

            {/* Notas */}
            <div style={{ display: "grid", gap: 6 }}>
              <label style={{ fontSize: 13, color: "#6E7A98" }}>Notas (opcional)</label>
              <input placeholder="Notas de la venta" value={notes} onChange={(e) => setNotes(e.target.value)} style={inputStyle} />
            </div>

            {/* Forma de pago */}
            <div style={{ display: "grid", gap: 6 }}>
              <label style={{ fontSize: 13, color: "#6E7A98" }}>Forma de pago</label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {PAY_METHODS_EDIT.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      if (m.id !== "credit" && payMethod === "credit") {
                        setPayAmount(total.toFixed(2));
                      }
                      setPayMethod(m.id);
                    }}
                    style={{
                      height: 42, borderRadius: 10, border: "none", cursor: "pointer",
                      background: payMethod === m.id ? "#5C82FF" : "#0A1124",
                      color: payMethod === m.id ? "#fff" : "#6E7A98",
                      fontWeight: payMethod === m.id ? 700 : 500, fontSize: 14,
                      outline: payMethod === m.id ? "none" : "1px solid #1F2A4A",
                    }}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
              {payMethod !== "credit" && (
                <div style={{ display: "grid", gap: 6, marginTop: 4 }}>
                  <label style={{ fontSize: 13, color: "#6E7A98" }}>Monto pagado (total: ${total.toFixed(2)})</label>
                  <input
                    inputMode="decimal"
                    placeholder={`0.00`}
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    style={inputStyle}
                  />
                </div>
              )}
            </div>

            {/* Items actuales */}
            <div style={{ display: "grid", gap: 8 }}>
              <div style={{ fontSize: 13, color: "#6E7A98" }}>Productos</div>
              {items.map((it, idx) => (
                <div key={idx} style={{
                  background: "#0A1124", borderRadius: 10, padding: "10px 12px",
                  border: "1px solid #1F2A4A", display: "grid", gap: 6,
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontWeight: 800 }}>{it.name}</span>
                    <button type="button" onClick={() => setItems((prev) => prev.filter((_, i) => i !== idx))}
                      style={{ background: "transparent", border: "none", color: "#f87171", cursor: "pointer", fontSize: 16 }}>
                      ✕
                    </button>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 8 }}>
                    <div>
                      <label style={{ fontSize: 11, color: "#6E7A98" }}>Cantidad</label>
                      <input
                        inputMode="decimal"
                        value={it.quantity}
                        onChange={(e) => setItems((prev) => prev.map((x, i) => i === idx ? { ...x, quantity: e.target.value } : x))}
                        style={{ ...inputStyle, height: 38, fontSize: 14 }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, color: "#6E7A98" }}>Precio unit.</label>
                      <input
                        inputMode="decimal"
                        value={it.unit_price}
                        onChange={(e) => setItems((prev) => prev.map((x, i) => i === idx ? { ...x, unit_price: e.target.value } : x))}
                        style={{ ...inputStyle, height: 38, fontSize: 14 }}
                      />
                    </div>
                  </div>
                  <input
                    placeholder="Nota del item (opcional)"
                    value={it.notes}
                    onChange={(e) => setItems((prev) => prev.map((x, i) => i === idx ? { ...x, notes: e.target.value } : x))}
                    style={{ ...inputStyle, height: 36, fontSize: 13 }}
                  />
                </div>
              ))}
            </div>

            {/* Agregar item */}
            <div style={{
              background: "#0A1124", borderRadius: 12, padding: 12,
              border: "1px solid rgba(255,255,255,0.06)", display: "grid", gap: 8,
            }}>
              <div style={{ fontSize: 13, color: "#6E7A98" }}>Agregar producto</div>
              <SearchDropdown
                inputRef={productRef}
                label=""
                placeholder="Buscar producto..."
                items={products}
                getKey={(p) => p.id}
                getLabel={(p) => p.name}
                query={productQuery}
                setQuery={setProductQuery}
                selected={selectedProduct}
                setSelected={setSelectedProduct}
              />
              <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 8 }}>
                <input inputMode="decimal" placeholder="Cantidad" value={quantity}
                  onChange={(e) => setQuantity(e.target.value)} style={{ ...inputStyle, height: 42 }} />
                <input inputMode="decimal" placeholder="Precio unit." value={price}
                  onChange={(e) => setPrice(e.target.value)} style={{ ...inputStyle, height: 42 }} />
              </div>
              <input placeholder="Nota (opcional)" value={itemNotes}
                onChange={(e) => setItemNotes(e.target.value)} style={{ ...inputStyle, height: 38, fontSize: 13 }} />
              <button type="button" onClick={addItem}
                style={{
                  height: 42, borderRadius: 10, border: "1px solid #1F2A4A",
                  background: "#1a1a2e", color: "#5C82FF", fontWeight: 900, cursor: "pointer",
                }}>
                + Agregar
              </button>
            </div>

            {/* Total */}
            <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 900, padding: "4px 0" }}>
              <span>Total</span>
              <span>${total.toFixed(2)}</span>
            </div>

            {/* Guardar */}
            <button type="button" disabled={saving || deleting} onClick={() => submit(false)}
              style={{
                height: 50, borderRadius: 12, border: "none",
                background: saving ? "#3b3b8a" : "#5C82FF", color: "#fff",
                fontWeight: 900, fontSize: 16, cursor: (saving || deleting) ? "not-allowed" : "pointer",
                opacity: (saving || deleting) ? 0.7 : 1,
              }}>
              {saving ? "Guardando..." : "Guardar cambios"}
            </button>

            {/* Eliminar */}
            <button type="button" disabled={saving || deleting} onClick={handleDelete}
              style={{
                height: 44, borderRadius: 12, border: "1px solid rgba(248,113,113,0.4)",
                background: "transparent", color: deleting ? "#9ca3af" : "#f87171",
                fontWeight: 700, fontSize: 14, cursor: (saving || deleting) ? "not-allowed" : "pointer",
                opacity: (saving || deleting) ? 0.5 : 1,
              }}>
              {deleting ? "Eliminando..." : "Eliminar venta"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function ClientScreen({ clients, products, priceLists, pushToast, onClientCreated }) {
  const [clientSection, setClientSection] = useState("clients"); // "clients" | "debtors"

  const clientRef = useRef(null);
  const [clientQuery, setClientQuery] = useState("");
  const [selectedClient, setSelectedClient] = useState(null); // {id, name}

  const [loading, setLoading] = useState(false);
  const [statement, setStatement] = useState(null);
  const [error, setError] = useState("");

  const [editSaleId, setEditSaleId] = useState(null);

  const [deliveriesLoading, setDeliveriesLoading] = useState(false);
  const [deliveriesError, setDeliveriesError] = useState("");
  const [deliveriesData, setDeliveriesData] = useState(null);

  // Vista interna
  const [clientView, setClientView] = useState("deliveries"); // "new_payment" | "deliveries" | "payments"

  // Pagos (lista)
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [paymentsError, setPaymentsError] = useState("");
  const [paymentsData, setPaymentsData] = useState([]); // array de pagos

  // UI pago general
  const [payAmount, setPayAmount] = useState("");
  const [payNotes, setPayNotes] = useState("");
  const [payDate, setPayDate] = useState(() => localToday());
  const [paySubmitting, setPaySubmitting] = useState(false);

  // Edición inline de pagos
  const [editPaymentId, setEditPaymentId] = useState(null);
  const [editPayAmount, setEditPayAmount] = useState("");
  const [editPayNotes, setEditPayNotes] = useState("");
  const [editPaySubmitting, setEditPaySubmitting] = useState(false);

  // Entregas
  const [showAllDeliveries, setShowAllDeliveries] = useState(false);

  // Editar cliente
  const [showEditClient, setShowEditClient] = useState(false);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editPriceListId, setEditPriceListId] = useState("");
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [deactivateSubmitting, setDeactivateSubmitting] = useState(false);

  // Nuevo cliente (formulario inline)
  const [showNewClient, setShowNewClient] = useState(false);
  const [ncName, setNcName] = useState("");
  const [ncPhone, setNcPhone] = useState("");
  const [ncPriceListId, setNcPriceListId] = useState("");
  const [ncIsSupplier, setNcIsSupplier] = useState(false);
  const [ncSubmitting, setNcSubmitting] = useState(false);
  const ncNameRef = useRef(null);

  useEffect(() => {
    if (ncPriceListId) return;
    if (!priceLists || priceLists.length === 0) return;
    const general = priceLists.find((p) => p.name.toLowerCase() === "general");
    if (general) setNcPriceListId(String(general.id));
    else setNcPriceListId(String(priceLists[0].id));
  }, [priceLists, ncPriceListId]);

  useEffect(() => {
    if (showNewClient) setTimeout(() => ncNameRef.current?.focus(), 0);
  }, [showNewClient]);

  const submitNewClient = async () => {
    const n = ncName.trim();
    if (!n) { pushToast("Ingresá un nombre.", "error"); return; }
    const plId = ncPriceListId ? Number(ncPriceListId) : null;
    setNcSubmitting(true);
    try {
      const res = await apiFetch(`${API}/clients`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: n, phone: ncPhone.trim() || null, price_list_id: plId, is_supplier: ncIsSupplier }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Error creando cliente");
      }
      setNcName("");
      setNcPhone("");
      setNcIsSupplier(false);
      setShowNewClient(false);
      pushToast("Cliente creado ✅", "success");
      onClientCreated?.();
    } catch (e) {
      pushToast(e.message || "Error", "error");
    } finally {
      setNcSubmitting(false);
    }
  };

  useEffect(() => {
    setTimeout(() => clientRef.current?.focus(), 0);
  }, []);

  const fetchStatement = async (clientId) => {
    const res = await apiFetch(`${API}/clients/${clientId}/statement`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Error obteniendo estado del cliente");
    }
    return res.json();
  };

  const fetchDeliveries = async (clientId) => {
    const res = await apiFetch(`${API}/clients/${clientId}/deliveries`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Error obteniendo entregas del cliente");
    }
    return res.json();
  };

  // Tu endpoint devuelve LISTA
  const fetchPayments = async (clientId) => {
    const res = await apiFetch(`${API}/clients/${clientId}/payments`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Error obteniendo pagos del cliente");
    }
    return res.json(); // array
  };

  // Cuando elijo cliente: trae statement + deliveries
  useEffect(() => {
    const run = async () => {
      if (!selectedClient) {
        setStatement(null);
        setError("");

        setDeliveriesData(null);
        setDeliveriesError("");
        setDeliveriesLoading(false);

        setPaymentsData([]);
        setPaymentsError("");
        setPaymentsLoading(false);

        setClientView("deliveries");
        setShowEditClient(false);
        return;
      }

      setClientView("deliveries"); // default
      setLoading(true);
      setDeliveriesLoading(true);
      setError("");
      setDeliveriesError("");

      // pagos on-demand al entrar a "payments"
      setPaymentsData([]);
      setPaymentsError("");
      setPaymentsLoading(false);

      try {
        const [st, del] = await Promise.all([
          fetchStatement(selectedClient.id),
          fetchDeliveries(selectedClient.id),
        ]);
        setStatement(st);
        setDeliveriesData(del);
      } catch (e) {
        const msg = e.message || "Error";
        setError(msg);
        setStatement(null);
        setDeliveriesError(msg);
        setDeliveriesData(null);
      } finally {
        setLoading(false);
        setDeliveriesLoading(false);
      }
    };

    run();
  }, [selectedClient]);

  //Entregas
  useEffect(() => {
    if (selectedClient) setShowAllDeliveries(false);
  }, [selectedClient]);

  // Cargar pagos SOLO cuando el usuario entra a "payments"
  useEffect(() => {
    const run = async () => {
      if (!selectedClient) return;
      if (clientView !== "payments") return;

      // cache: si ya tengo data, no refetcheo
      if (paymentsData && paymentsData.length > 0) return;

      setPaymentsLoading(true);
      setPaymentsError("");

      try {
        const data = await fetchPayments(selectedClient.id);
        setPaymentsData(data || []);
      } catch (e) {
        setPaymentsError(e.message || "Error");
        setPaymentsData([]);
      } finally {
        setPaymentsLoading(false);
      }
    };

    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientView, selectedClient]);

  const submitGeneralPayment = async () => {
    if (!selectedClient) return;

    const amount = Number(payAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      pushToast("Ingresá un monto válido (> 0).", "error");
      return;
    }

    setPaySubmitting(true);
    setError("");

    try {
      const res = await apiFetch(`${API}/clients/${selectedClient.id}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          payment_date: payDate === localToday()
            ? new Date().toISOString()
            : new Date(payDate + 'T12:00:00').toISOString(),
          notes: payNotes?.trim() ? payNotes.trim() : null,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Error registrando pago");
      }

      setPayAmount("");
      setPayNotes("");
      setPayDate(localToday());

      // refresco saldo (statement)
      const st = await fetchStatement(selectedClient.id);
      setStatement(st);

      // refresco pagos si ya se habían cargado (o si estoy en tab pagos)
      try {
        if (clientView === "payments" || (paymentsData && paymentsData.length > 0)) {
          const p = await fetchPayments(selectedClient.id);
          setPaymentsData(p || []);
          setPaymentsError("");
        }
      } catch {
        // no bloquear flujo
      }

      pushToast("Pago registrado ✅", "success");
    } catch (e) {
      pushToast(e.message || "Error", "error");
      setError(e.message || "Error");
    } finally {
      setPaySubmitting(false);
    }
  };

  const openEditClient = () => {
    const full = clients.find(c => c.id === selectedClient?.id);
    setEditName(full?.name || selectedClient?.name || "");
    setEditPhone(full?.phone || "");
    setEditPriceListId(full?.price_list_id ? String(full.price_list_id) : "");
    setShowEditClient(true);
  };

  const submitEditClient = async () => {
    const n = editName.trim();
    if (!n) { pushToast("Ingresá un nombre.", "error"); return; }
    setEditSubmitting(true);
    try {
      const res = await apiFetch(`${API}/clients/${selectedClient.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: n,
          phone: editPhone.trim() || null,
          price_list_id: editPriceListId ? Number(editPriceListId) : null,
        }),
      });
      if (!res.ok) throw new Error(((await res.json().catch(() => ({}))).detail) || "Error");
      const updated = await res.json();
      setSelectedClient({ id: updated.id, name: updated.name });
      setShowEditClient(false);
      pushToast("Cliente actualizado ✅", "success");
      onClientCreated?.();
    } catch (e) { pushToast(e.message || "Error", "error"); }
    finally { setEditSubmitting(false); }
  };

  const deactivateClient = async () => {
    if (!selectedClient) return;
    setDeactivateSubmitting(true);
    try {
      const res = await apiFetch(`${API}/clients/${selectedClient.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: false }),
      });
      if (!res.ok) throw new Error(((await res.json().catch(() => ({}))).detail) || "Error");
      pushToast("Cliente desactivado", "info");
      setSelectedClient(null);
      setShowEditClient(false);
      setClientQuery("");
      onClientCreated?.();
    } catch (e) { pushToast(e.message || "Error", "error"); }
    finally { setDeactivateSubmitting(false); }
  };

  const deliveriesBySale = useMemo(() => {
    const rows = deliveriesData?.deliveries || [];
    const map = new Map();

    for (const r of rows) {
      const key = r.sale_id;
      if (!map.has(key)) {
        map.set(key, { sale_id: r.sale_id, sale_date: r.sale_date, rows: [], total: 0 });
      }
      const g = map.get(key);
      g.rows.push(r);
      g.total += Number(r.subtotal || 0);
    }

    return Array.from(map.values()).sort((a, b) => {
      const da = new Date(a.sale_date).getTime();
      const db = new Date(b.sale_date).getTime();
      if (db !== da) return db - da;
      return (b.sale_id || 0) - (a.sale_id || 0);
    });
  }, [deliveriesData]);

  // ===== Export texto (copiable para WhatsApp) =====
  const formatMoney = (n) => {
    const v = Number(n || 0);
    if (!Number.isFinite(v)) return "0.00";
    return v.toFixed(2);
  };

  const formatNowAR = () => {
    const now = new Date();
    return new Intl.DateTimeFormat("es-AR", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(now);
  };

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      pushToast("Copiado ✅", "success");
    } catch {
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        pushToast("Copiado ✅", "success");
      } catch {
        pushToast("No se pudo copiar", "error");
      }
    }
  };

  const buildDeliveriesText = () => {
    const clientName = selectedClient?.name || "";
    const saldo = formatMoney(statement?.total_balance || 0);

    const header =
      `📌 Cuenta corriente - ${clientName}\n` +
      `🕒 ${formatNowAR()}\n` +
      `💰 Saldo total: $${saldo}\n\n` +
      `📦 Entregas\n`;

    if (!deliveriesBySale.length) return header + "Sin entregas.\n";

    const blocks = deliveriesBySale.map((sale) => {
      const lines = sale.rows.map((r, idx) => {
        const qty = formatMoney(r.quantity);
        const pu = formatMoney(r.unit_price);
        const sub = formatMoney(r.subtotal);
        const note = r.notes ? ` (${r.notes})` : "";
        return `- ${idx + 1}) ${r.product_name}${note} x${qty} $${pu} Sub: $${sub}`;
      });

      return (
        `VENTA #${sale.sale_id} (${formatArDate(sale.sale_date)})\n` +
        lines.join("\n") +
        `\nTOTAL VENTA: $${formatMoney(sale.total)}\n`
      );
    });

    return header + blocks.join("\n");
  };

  const buildPaymentsText = () => {
    const clientName = selectedClient?.name || "";
    const saldo = formatMoney(statement?.total_balance || 0);

    const header =
      `📌 Pagos - ${clientName}\n` +
      `🕒 ${formatNowAR()}\n` +
      `💰 Saldo total: $${saldo}\n\n` +
      `💵 Pagos a cuenta\n`;

    if (!paymentsData?.length) return header + "Sin pagos.\n";

    const totalPaid = paymentsData.reduce((acc, p) => acc + Number(p.amount || 0), 0);

    const lines = paymentsData.map((p) => {
      const amt = formatMoney(p.amount);
      const note = p.notes ? ` "${p.notes}"` : "";
      return `- ${formatArDate(p.payment_date)}  $${amt}${note}`;
    });

    return header + lines.join("\n") + `\nTOTAL PAGOS: $${formatMoney(totalPaid)}\n`;
  };

  const exportBtnStyle = {
    width: "100%",
    height: 48,
    borderRadius: 12,
    border: "1px solid #1F2A4A",
    background: "#0A1124",
    color: "#fff",
    fontWeight: 900,
    marginTop: 10,
  };

  const refreshAfterEdit = async () => {
    if (!selectedClient) return;
    try {
      const [st, del] = await Promise.all([
        fetchStatement(selectedClient.id),
        fetchDeliveries(selectedClient.id),
      ]);
      setStatement(st);
      setDeliveriesData(del);
      // invalidar cache de pagos
      setPaymentsData([]);
    } catch {/* silencioso */}
  };

  const tabBtnStyle = (active) => ({
    flex: 1, height: 40, borderRadius: 10, cursor: "pointer",
    border: active ? "1px solid #5C82FF" : "1px solid #1F2A4A",
    background: active ? "#1A2453" : "#0A1124",
    color: active ? "#5C82FF" : "#6E7A98",
    fontWeight: 900, fontSize: 14, fontFamily: "inherit",
  });

  return (
    <div style={{ display: 'grid', gap: 12, padding: '16px 16px 0' }}>
      {/* Tabs Clientes / Deudores */}
      <div style={{ display: "flex", gap: 8 }}>
        <button style={tabBtnStyle(clientSection === "clients")} onClick={() => setClientSection("clients")}>Clientes</button>
        <button style={tabBtnStyle(clientSection === "debtors")} onClick={() => setClientSection("debtors")}>Deudores</button>
      </div>

      {clientSection === "debtors" ? (
        <DebtorsScreen pushToast={pushToast} />
      ) : (<>
      {editSaleId && (
        <EditSaleModal
          saleId={editSaleId}
          products={products}
          pushToast={pushToast}
          onSaved={refreshAfterEdit}
          onClose={() => setEditSaleId(null)}
        />
      )}
      <SearchDropdown
        inputRef={clientRef}
        label="Cliente"
        placeholder="Buscar cliente..."
        items={clients}
        getKey={(c) => c.id}
        getLabel={(c) => c.name}
        query={clientQuery}
        setQuery={setClientQuery}
        selected={selectedClient}
        setSelected={(c) => setSelectedClient(c ? { id: c.id, name: c.name } : null)}
        onAdd={() => setShowNewClient((v) => !v)}
        onEdit={selectedClient ? () => (showEditClient ? setShowEditClient(false) : openEditClient()) : undefined}
      />

      {showNewClient && (
        <div
          style={{
            border: "1px solid #1F2A4A",
            background: "#0A1124",
            borderRadius: 14,
            padding: 14,
            display: "grid",
            gap: 10,
            marginBottom: 4,
            boxShadow: "0 2px 12px rgba(0,0,0,0.25)",
          }}
        >
          <div style={{ fontWeight: 900 }}>Crear cliente</div>
          <input
            ref={ncNameRef}
            placeholder="Nombre"
            style={{
              width: "100%",
              height: 48,
              fontSize: 16,
              borderRadius: 12,
              border: "1px solid #1F2A4A",
              background: "#121A33",
              color: "#fff",
              padding: "0 12px",
              outline: "none",
              boxSizing: "border-box",
            }}
            value={ncName}
            onChange={(e) => setNcName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submitNewClient(); } }}
          />
          <input
            inputMode="tel"
            placeholder="Teléfono (opcional)"
            style={{
              width: "100%",
              height: 48,
              fontSize: 16,
              borderRadius: 12,
              border: "1px solid #1F2A4A",
              background: "#121A33",
              color: "#fff",
              padding: "0 12px",
              outline: "none",
              boxSizing: "border-box",
            }}
            value={ncPhone}
            onChange={(e) => setNcPhone(e.target.value)}
          />
          <div style={{ display: "grid", gap: 6 }}>
            <label style={{ color: "#fff", fontWeight: 800, fontSize: 13 }}>Lista de precios</label>
            <select
              value={ncPriceListId}
              onChange={(e) => setNcPriceListId(e.target.value)}
              style={{
                width: "100%",
                height: 48,
                borderRadius: 12,
                border: "1px solid #1F2A4A",
                background: "#121A33",
                color: "#fff",
                padding: "0 12px",
                outline: "none",
                boxSizing: "border-box",
                fontSize: 16,
              }}
            >
              {(priceLists || []).map((pl) => (
                <option key={pl.id} value={String(pl.id)}>{pl.name}</option>
              ))}
            </select>
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", padding: "4px 0" }}>
            <input
              type="checkbox"
              checked={ncIsSupplier}
              onChange={e => setNcIsSupplier(e.target.checked)}
              style={{ width: 18, height: 18, accentColor: "#5C82FF", cursor: "pointer" }}
            />
            <span style={{ color: "#A5B0CC", fontSize: 14, fontWeight: 600 }}>Es proveedor</span>
          </label>
          <button
            type="button"
            disabled={ncSubmitting}
            onClick={submitNewClient}
            style={{
              height: 52,
              borderRadius: 12,
              border: "1px solid #1F2A4A",
              background: ncSubmitting ? "#0A1124" : "#0A1124",
              color: "#fff",
              fontWeight: 900,
              fontSize: 16,
              opacity: ncSubmitting ? 0.7 : 1,
            }}
          >
            {ncSubmitting ? "Creando..." : "Crear cliente"}
          </button>
        </div>
      )}

      {/* Panel editar cliente */}
      {showEditClient && (
        <div style={{ border: "1px solid #1F2A4A", background: "#0A1124", borderRadius: 14, padding: 14, display: "grid", gap: 10, marginBottom: 4 }}>
          <div style={{ fontWeight: 900, fontSize: 13, color: "#6E7A98", letterSpacing: 1, textTransform: "uppercase" }}>Editar cliente</div>
          <input
            placeholder="Nombre"
            style={{ width: "100%", height: 48, fontSize: 16, borderRadius: 12, border: "1px solid #1F2A4A", background: "#121A33", color: "#fff", padding: "0 12px", outline: "none", boxSizing: "border-box" }}
            value={editName}
            onChange={e => setEditName(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); submitEditClient(); } }}
          />
          <input
            inputMode="tel"
            placeholder="Teléfono (opcional)"
            style={{ width: "100%", height: 48, fontSize: 16, borderRadius: 12, border: "1px solid #1F2A4A", background: "#121A33", color: "#fff", padding: "0 12px", outline: "none", boxSizing: "border-box" }}
            value={editPhone}
            onChange={e => setEditPhone(e.target.value)}
          />
          <div style={{ display: "grid", gap: 6 }}>
            <label style={{ color: "#fff", fontWeight: 800, fontSize: 13 }}>Lista de precios</label>
            <select
              value={editPriceListId}
              onChange={e => setEditPriceListId(e.target.value)}
              style={{ width: "100%", height: 48, borderRadius: 12, border: "1px solid #1F2A4A", background: "#121A33", color: "#fff", padding: "0 12px", outline: "none", boxSizing: "border-box", fontSize: 16 }}
            >
              {(priceLists || []).map(pl => (
                <option key={pl.id} value={String(pl.id)}>{pl.name}</option>
              ))}
            </select>
          </div>
          <button
            type="button"
            disabled={editSubmitting}
            onClick={submitEditClient}
            style={{ height: 48, borderRadius: 12, border: "none", background: editSubmitting ? "#3b3b8a" : "#5C82FF", color: "#fff", fontWeight: 900, fontSize: 15, opacity: editSubmitting ? 0.7 : 1, cursor: editSubmitting ? "not-allowed" : "pointer" }}
          >
            {editSubmitting ? "Guardando..." : "Guardar cambios"}
          </button>
          <button
            type="button"
            disabled={deactivateSubmitting}
            onClick={deactivateClient}
            style={{ height: 44, borderRadius: 12, border: "1px solid #f87171", background: "transparent", color: "#f87171", fontWeight: 900, fontSize: 14, opacity: deactivateSubmitting ? 0.7 : 1, cursor: deactivateSubmitting ? "not-allowed" : "pointer" }}
          >
            {deactivateSubmitting ? "Desactivando..." : "Desactivar cliente"}
          </button>
        </div>
      )}

      {!selectedClient ? (
        <div style={{ color: "#6E7A98" }}>Elegí un cliente para ver su cuenta corriente.</div>
      ) : loading ? (
        <div style={{ color: "#6E7A98" }}>Cargando...</div>
      ) : error ? (
        <div style={{ color: "#f87171" }}>{error}</div>
      ) : statement ? (
        <div style={{ display: "grid", gap: 12 }}>
          {/* Resumen */}
          <div
            style={{
              border: "1px solid #1F2A4A",
              background: "#0A1124",
              borderRadius: 14,
              padding: 14,
              boxShadow: "0 2px 12px rgba(0,0,0,0.25)",
            }}
          >
            <div style={{ color: "#6E7A98", fontSize: 12 }}>Saldo total</div>
            <div style={{ fontWeight: 900, fontSize: 22 }}>
              ${Number(statement.total_balance || 0).toFixed(2)}
            </div>
          </div>

          {/* Tabs historial */}
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 8 }}>
            <button
              type="button"
              style={{
                height: 40,
                borderRadius: 10,
                border: clientView === "deliveries" ? "1px solid #5C82FF" : "1px solid #1F2A4A",
                background: clientView === "deliveries" ? "#1A2453" : "#0A1124",
                color: clientView === "deliveries" ? "#5C82FF" : "#6E7A98",
                fontWeight: 900,
                fontSize: 14,
                cursor: "pointer",
              }}
              onClick={() => setClientView("deliveries")}
            >
              Entregas
            </button>
            <button
              type="button"
              style={{
                height: 40,
                borderRadius: 10,
                border: clientView === "payments" ? "1px solid #5C82FF" : "1px solid #1F2A4A",
                background: clientView === "payments" ? "#1A2453" : "#0A1124",
                color: clientView === "payments" ? "#5C82FF" : "#6E7A98",
                fontWeight: 900,
                fontSize: 14,
                cursor: "pointer",
              }}
              onClick={() => setClientView("payments")}
            >
              Pagos
            </button>
          </div>

          {/* Exportar — visible solo cuando hay datos en la tab activa */}
          {clientView === "deliveries" && deliveriesBySale.length > 0 && (
            <button
              type="button"
              onClick={() => copyToClipboard(buildDeliveriesText())}
              style={{
                width: "100%", height: 44, borderRadius: 10,
                border: "1px solid #1F2A4A",
                background: "#0A1124", color: "#fff", fontWeight: 900, fontSize: 14, cursor: "pointer",
              }}
            >
              Exportar entregas
            </button>
          )}
          {clientView === "payments" && (
            <div style={{ border: "1px solid #1F2A4A", background: "#0A1124", borderRadius: 14, padding: 14, display: "grid", gap: 10, boxShadow: "0 2px 12px rgba(0,0,0,0.25)" }}>
              <div style={{ fontWeight: 900, fontSize: 13, color: "#6E7A98", letterSpacing: 1, textTransform: "uppercase" }}>
                Registrar pago
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 10 }}>
                <input
                  inputMode="decimal"
                  placeholder="Monto"
                  style={{ height: 48, fontSize: 16, borderRadius: 12, border: "1px solid #1F2A4A", background: "#121A33", color: "#fff", padding: "0 12px", outline: "none", boxSizing: "border-box" }}
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") submitGeneralPayment(); }}
                />
                <NotesCombo
                  placeholder="Notas (opcional)"
                  inputStyle={{ width: "100%", height: 48, fontSize: 16, borderRadius: 12, border: "1px solid #1F2A4A", background: "#121A33", color: "#fff", padding: "0 12px", outline: "none", boxSizing: "border-box" }}
                  value={payNotes}
                  onChange={setPayNotes}
                  onKeyDown={(e) => { if (e.key === "Enter") submitGeneralPayment(); }}
                />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#6E7A98" }}>Fecha</span>
                <input
                  type="date"
                  lang="en-GB"
                  value={payDate}
                  max={localToday()}
                  onChange={(e) => setPayDate(e.target.value)}
                  style={{ height: 40, fontSize: 14, borderRadius: 10, border: "1px solid #1F2A4A", background: "#121A33", color: "#fff", padding: "0 10px", outline: "none", cursor: "pointer", fontFamily: "inherit" }}
                />
              </div>
              <button
                type="button"
                disabled={paySubmitting}
                style={{ height: 48, borderRadius: 12, border: "none", background: paySubmitting ? "#3b3b8a" : "#5C82FF", color: "#fff", fontWeight: 900, fontSize: 15, opacity: paySubmitting ? 0.7 : 1, cursor: paySubmitting ? "not-allowed" : "pointer" }}
                onClick={submitGeneralPayment}
              >
                {paySubmitting ? "Registrando..." : "Confirmar pago"}
              </button>
            </div>
          )}
          {clientView === "payments" && paymentsData.length > 0 && (
            <button
              type="button"
              onClick={() => copyToClipboard(buildPaymentsText())}
              style={{
                width: "100%", height: 44, borderRadius: 10,
                border: "1px solid #1F2A4A",
                background: "#0A1124", color: "#fff", fontWeight: 900, fontSize: 14, cursor: "pointer",
              }}
            >
              Exportar pagos
            </button>
          )}

          {/* ===== Entregas ===== */}
          {clientView === "deliveries" ? (
            <div
              style={{
                border: "1px solid #1F2A4A",
                background: "#0A1124",
                borderRadius: 12,
                padding: 12,
              }}
            >
              <div style={{ fontWeight: 900, marginBottom: 10 }}>Entregas</div>

              {deliveriesLoading ? (
                <div style={{ color: "#6E7A98" }}>Cargando entregas...</div>
              ) : deliveriesError ? (
                <div style={{ color: "#f87171" }}>{deliveriesError}</div>
              ) : deliveriesBySale.length ? (
                <>
                  {(() => {
                    const visible = showAllDeliveries ? deliveriesBySale : deliveriesBySale.slice(0, 5);

                    return (
                      <div style={{ display: "grid", gap: 12 }}>
                        {visible.map((sale) => (
                          <div
                            key={sale.sale_id}
                            style={{
                              border: "1px solid #1F2A4A",
                              borderRadius: 14,
                              background: "#121A33",
                              overflow: "hidden",
                              boxShadow: "0 2px 12px rgba(0,0,0,0.25)",
                            }}
                          >
                            {/* Header venta */}
                            <div
                              style={{
                                padding: 12,
                                borderBottom: "1px solid #2a2a2a",
                                display: "flex",
                                justifyContent: "space-between",
                                gap: 10,
                                alignItems: "center",
                              }}
                            >
                              <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, flexShrink: 1 }}>
                                <div style={{ fontWeight: 900, whiteSpace: "nowrap" }}>VENTA #{sale.sale_id}</div>
                                <button
                                  type="button"
                                  onClick={() => setEditSaleId(sale.sale_id)}
                                  style={{
                                    height: 26, padding: "0 10px", borderRadius: 8,
                                    border: "1px solid rgba(92,130,255,0.35)",
                                    background: "rgba(92,130,255,0.1)", color: "#5C82FF",
                                    fontSize: 12, fontWeight: 800, cursor: "pointer",
                                    flexShrink: 0,
                                  }}
                                >
                                  Editar
                                </button>
                              </div>
                              <div style={{ color: "#6E7A98", fontWeight: 800, textAlign: "right", flexShrink: 0, fontSize: 12 }}>
                                {formatArDate(sale.sale_date)}
                              </div>
                            </div>

                            {/* Filas (mobile-friendly) */}
                            <div style={{ padding: 12, display: "grid", gap: 10 }}>
                              {sale.rows.map((r, idx) => (
                                <div
                                  key={`${r.sale_id}-${r.product_id}-${idx}`}
                                  style={{
                                    border: "1px solid #1F2A4A",
                                    borderRadius: 12,
                                    padding: 10,
                                    background: "#0A1124",
                                    display: "grid",
                                    gap: 6,
                                  }}
                                >
                                  <div style={{ fontWeight: 900 }}>
                                    {idx + 1}) {r.product_name}
                                  </div>

                                  {r.notes ? (
                                    <div style={{ color: "#6E7A98", fontSize: 12 }}>Nota: {r.notes}</div>
                                  ) : null}

                                  <div style={{ display: "flex", justifyContent: "space-between", color: "#A5B0CC" }}>
                                    <span>Cant</span>
                                    <span style={{ fontWeight: 900 }}>{Number(r.quantity || 0).toFixed(2)}</span>
                                  </div>

                                  <div style={{ display: "flex", justifyContent: "space-between", color: "#A5B0CC" }}>
                                    <span>Precio unit</span>
                                    <span style={{ fontWeight: 900 }}>${Number(r.unit_price || 0).toFixed(2)}</span>
                                  </div>

                                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                                    <span style={{ fontWeight: 900 }}>Subtotal</span>
                                    <span style={{ fontWeight: 900 }}>${Number(r.subtotal || 0).toFixed(2)}</span>
                                  </div>
                                </div>
                              ))}
                            </div>

                            {/* Total + Pagado */}
                            {(() => {
                              const stmtSale = statement?.sales?.find(s => s.sale_id === sale.sale_id);
                              const paid = Number(stmtSale?.paid ?? 0);
                              return (
                                <div style={{ borderTop: "1px solid #1F2A4A" }}>
                                  <div
                                    style={{
                                      padding: "10px 12px 4px",
                                      display: "flex",
                                      justifyContent: "space-between",
                                      fontWeight: 900,
                                    }}
                                  >
                                    <div>TOTAL</div>
                                    <div>${Number(sale.total || 0).toFixed(2)}</div>
                                  </div>
                                  <div
                                    style={{
                                      padding: "4px 12px 10px",
                                      display: "flex",
                                      justifyContent: "space-between",
                                      color: paid >= Number(sale.total || 0) ? "#4ade80" : paid > 0 ? "#facc15" : "#6E7A98",
                                      fontSize: 13,
                                      fontWeight: 700,
                                    }}
                                  >
                                    <div>PAGADO</div>
                                    <div>${paid.toFixed(2)}</div>
                                  </div>
                                </div>
                              );
                            })()}
                          </div>
                        ))}
                      </div>
                    );
                  })()}

                  {/* Mostrar más / menos */}
                  {deliveriesBySale.length > 5 ? (
                    <button
                      type="button"
                      onClick={() => setShowAllDeliveries((v) => !v)}
                      style={{
                        width: "100%",
                        height: 48,
                        borderRadius: 12,
                        border: "1px solid #1F2A4A",
                        background: "#0A1124",
                        color: "#fff",
                        fontWeight: 900,
                        marginTop: 10,
                      }}
                    >
                      {showAllDeliveries
                        ? "Mostrar menos"
                        : `Mostrar más entregas (${deliveriesBySale.length - 5} más)`}
                    </button>
                  ) : null}

                </>
              ) : (
                <div style={{ color: "#6E7A98" }}>No hay entregas registradas.</div>
              )}
            </div>
          ) : null}

          {/* ===== Pagos ===== */}
          {clientView === "payments" ? (
            <div
              style={{
                border: "1px solid #1F2A4A",
                background: "#0A1124",
                borderRadius: 12,
                padding: 12,
              }}
            >
              <div style={{ fontWeight: 900, marginBottom: 10 }}>Pagos</div>

              {paymentsLoading ? (
                <div style={{ color: "#6E7A98" }}>Cargando pagos...</div>
              ) : paymentsError ? (
                <div style={{ color: "#f87171" }}>{paymentsError}</div>
              ) : paymentsData.length ? (
                <>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 10,
                      maxHeight: "55vh",
                      overflowY: "auto",
                    }}
                  >
                    {paymentsData.map((p) => (
                      <div
                        key={p.payment_id}
                        style={{
                          border: "1px solid #1F2A4A",
                          borderRadius: 14,
                          padding: 12,
                          background: "#121A33",
                          display: "grid",
                          gap: 8,
                          boxShadow: "0 2px 12px rgba(0,0,0,0.25)",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, flexShrink: 1 }}>
                            <div style={{ fontWeight: 900, whiteSpace: "nowrap" }}>Pago #{p.payment_id}</div>
                            <button
                              type="button"
                              onClick={() => {
                                if (editPaymentId === p.payment_id) {
                                  setEditPaymentId(null);
                                } else {
                                  setEditPaymentId(p.payment_id);
                                  setEditPayAmount(String(Number(p.amount)));
                                  setEditPayNotes(p.notes || "");
                                }
                              }}
                              style={{
                                height: 26, padding: "0 10px", borderRadius: 8,
                                border: "1px solid rgba(92,130,255,0.35)",
                                background: editPaymentId === p.payment_id ? "rgba(92,130,255,0.2)" : "rgba(92,130,255,0.1)",
                                color: "#5C82FF", fontSize: 12, fontWeight: 800, cursor: "pointer",
                                flexShrink: 0,
                              }}
                            >
                              {editPaymentId === p.payment_id ? "Cancelar" : "Editar"}
                            </button>
                          </div>
                          <div style={{ color: "#6E7A98", flexShrink: 0, fontSize: 12 }}>{formatArDate(p.payment_date)}</div>
                        </div>

                        {editPaymentId === p.payment_id ? (
                          <div style={{ display: "grid", gap: 8 }}>
                            <input
                              inputMode="decimal"
                              placeholder="Monto"
                              value={editPayAmount}
                              onChange={(e) => setEditPayAmount(e.target.value)}
                              style={{
                                height: 42, fontSize: 15, borderRadius: 10,
                                border: "1px solid #1F2A4A", background: "#0A1124",
                                color: "#fff", padding: "0 12px", outline: "none", boxSizing: "border-box",
                              }}
                            />
                            <NotesCombo
                              placeholder="Notas (opcional)"
                              inputStyle={{
                                width: "100%", height: 42, fontSize: 15, borderRadius: 10,
                                border: "1px solid #1F2A4A", background: "#0A1124",
                                color: "#fff", padding: "0 12px", outline: "none", boxSizing: "border-box",
                              }}
                              value={editPayNotes}
                              onChange={setEditPayNotes}
                            />
                            <button
                              type="button"
                              disabled={editPaySubmitting}
                              onClick={async () => {
                                const amount = Number(editPayAmount);
                                if (!Number.isFinite(amount) || amount <= 0) {
                                  pushToast("Monto inválido.", "error"); return;
                                }
                                setEditPaySubmitting(true);
                                try {
                                  const res = await apiFetch(
                                    `${API}/clients/${selectedClient.id}/payments/${p.payment_id}`,
                                    {
                                      method: "PUT",
                                      headers: { "Content-Type": "application/json" },
                                      body: JSON.stringify({ amount, notes: editPayNotes.trim() || null }),
                                    }
                                  );
                                  if (!res.ok) {
                                    const err = await res.json().catch(() => ({}));
                                    throw new Error(err.detail || "Error actualizando pago");
                                  }
                                  // refrescar lista y saldo
                                  const [st, pays] = await Promise.all([
                                    fetchStatement(selectedClient.id),
                                    fetchPayments(selectedClient.id),
                                  ]);
                                  setStatement(st);
                                  setPaymentsData(pays || []);
                                  setEditPaymentId(null);
                                  pushToast("Pago actualizado ✅", "success");
                                } catch (e) {
                                  pushToast(e.message || "Error", "error");
                                } finally {
                                  setEditPaySubmitting(false);
                                }
                              }}
                              style={{
                                height: 42, borderRadius: 10, border: "none",
                                background: editPaySubmitting ? "#3b3b8a" : "#5C82FF",
                                color: "#fff", fontWeight: 900, fontSize: 14,
                                cursor: editPaySubmitting ? "not-allowed" : "pointer",
                                opacity: editPaySubmitting ? 0.7 : 1,
                              }}
                            >
                              {editPaySubmitting ? "Guardando..." : "Guardar"}
                            </button>
                          </div>
                        ) : (
                          <>
                            <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 900 }}>
                              <span>Monto</span>
                              <span>${Number(p.amount || 0).toFixed(2)}</span>
                            </div>
                            {p.notes ? (
                              <div style={{ color: "#6E7A98", fontSize: 13, whiteSpace: 'pre-line' }}>Nota: {p.notes}</div>
                            ) : null}
                          </>
                        )}
                      </div>
                    ))}
                  </div>

                </>
              ) : (
                <div style={{ color: "#6E7A98" }}>No hay pagos registrados.</div>
              )}
            </div>
          ) : null}
        </div>
      ) : null}
      </>)}
    </div>
  );
}

/** Pantalla: Nueva venta (POS) */
function NewSaleScreen({ clients, products, pushToast }) {
  // Wrapper around the new design system SaleScreen.
  // Legacy pushToast is (message, type, ms); the new SaleScreen calls
  // pushToast(type, message). Adapt here so both signatures work.
  return (
    <SaleScreen
      theme={themes.dark}
      clients={clients}
      products={products}
      pushToast={(type, msg) => pushToast(msg ?? type, msg ? type : "info")}
      apiBase={API}
      apiFetch={apiFetch}
    />
  );
}

/** Pantalla: Productos */
function ProductsScreen({ products, priceLists, pushToast, onProductCreated, onPriceListCreated }) {
  const [productsTab, setProductsTab] = useState("products"); // "products" | "stock"

  // --- Crear ---
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState("");
  const [costPrice, setCostPrice] = useState("");
  const [priceInputs, setPriceInputs] = useState({});
  const [isService, setIsService] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // --- Editar ---
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");
  const [editType, setEditType] = useState("");
  const [editCostPrice, setEditCostPrice] = useState("");
  const [editActive, setEditActive] = useState(true);
  const [editIsService, setEditIsService] = useState(false);
  const [editPriceInputs, setEditPriceInputs] = useState({});
  const [editSubmitting, setEditSubmitting] = useState(false);

  // --- Buscador ---
  const [search, setSearch] = useState("");

  // --- Listas de precios ---
  const [newPlName, setNewPlName] = useState("");
  const [plSubmitting, setPlSubmitting] = useState(false);
  const [showPlForm, setShowPlForm] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) => p.name.toLowerCase().includes(q) || p.type.toLowerCase().includes(q)
    );
  }, [products, search]);

  const nameRef = useRef(null);

  useEffect(() => {
    if (showForm) setTimeout(() => nameRef.current?.focus(), 0);
  }, [showForm]);

  const inputStyle = {
    width: "100%",
    height: 48,
    fontSize: 16,
    borderRadius: 12,
    border: "1px solid #1F2A4A",
    background: "#121A33",
    color: "#fff",
    padding: "0 12px",
    outline: "none",
    boxSizing: "border-box",
  };

  const startEdit = (p) => {
    setEditingId(p.id);
    setEditName(p.name);
    setEditType(p.type);
    setEditCostPrice(p.cost_price != null ? String(p.cost_price) : "");
    setEditActive(p.active);
    setEditIsService(p.is_service ?? false);
    const inputs = {};
    (p.prices || []).forEach((pr) => { inputs[pr.price_list_id] = String(pr.price); });
    setEditPriceInputs(inputs);
  };

  const cancelEdit = () => setEditingId(null);

  const saveEdit = async (productId) => {
    const n = editName.trim();
    const t = editType.trim();
    if (!n) { pushToast("Ingresá un nombre.", "error"); return; }
    if (!t) { pushToast("Ingresá un tipo.", "error"); return; }

    setEditSubmitting(true);
    try {
      const res = await apiFetch(`${API}/products/${productId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: n,
          type: t,
          cost_price: editCostPrice.trim() ? Number(editCostPrice) : null,
          active: editActive,
          is_service: editIsService,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Error actualizando producto");
      }

      const priceEntries = Object.entries(editPriceInputs).filter(([, v]) => v.trim() !== "");
      await Promise.all(
        priceEntries.map(([plId, priceVal]) =>
          apiFetch(`${API}/products/${productId}/prices`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ price_list_id: Number(plId), price: Number(priceVal) }),
          })
        )
      );

      setEditingId(null);
      pushToast("Producto actualizado ✅", "success");
      onProductCreated?.();
    } catch (e) {
      pushToast(e.message || "Error", "error");
    } finally {
      setEditSubmitting(false);
    }
  };

  const submit = async () => {
    const n = name.trim();
    const t = type.trim();
    if (!n) { pushToast("Ingresá un nombre.", "error"); return; }
    if (!t) { pushToast("Ingresá un tipo.", "error"); return; }

    setSubmitting(true);
    try {
      const res = await apiFetch(`${API}/products`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: n,
          type: t,
          cost_price: costPrice.trim() ? Number(costPrice) : null,
          is_service: isService,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Error creando producto");
      }
      const product = await res.json();

      const priceEntries = Object.entries(priceInputs).filter(([, v]) => v.trim() !== "");
      await Promise.all(
        priceEntries.map(([plId, priceVal]) =>
          apiFetch(`${API}/products/${product.id}/prices`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ price_list_id: Number(plId), price: Number(priceVal) }),
          })
        )
      );

      setName("");
      setType("");
      setCostPrice("");
      setIsService(false);
      setPriceInputs({});
      setShowForm(false);
      pushToast("Producto creado ✅", "success");
      onProductCreated?.();
    } catch (e) {
      pushToast(e.message || "Error", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const createPriceList = async () => {
    const n = newPlName.trim();
    if (!n) { pushToast("Ingresá un nombre.", "error"); return; }
    setPlSubmitting(true);
    try {
      const res = await apiFetch(`${API}/price-lists`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: n, active: true }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Error creando lista");
      }
      setNewPlName("");
      setShowPlForm(false);
      pushToast(`Lista "${n}" creada ✅`, "success");
      onPriceListCreated?.();
    } catch (e) {
      pushToast(e.message || "Error", "error");
    } finally {
      setPlSubmitting(false);
    }
  };

  const priceListsSection = (inputs, setInputs) =>
    priceLists.length > 0 && (
      <div style={{ display: "grid", gap: 8 }}>
        <div style={{ fontWeight: 800, fontSize: 13, color: "#6E7A98" }}>Precios de venta por lista</div>
        {priceLists.map((pl) => (
          <div key={pl.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <label style={{ flex: "0 0 140px", color: "#A5B0CC", fontSize: 14, fontWeight: 700 }}>
              {pl.name}
            </label>
            <input
              inputMode="decimal"
              placeholder="$"
              style={{ ...inputStyle, flex: 1 }}
              value={inputs[pl.id] || ""}
              onChange={(e) => setInputs((prev) => ({ ...prev, [pl.id]: e.target.value }))}
            />
          </div>
        ))}
      </div>
    );

  const tabBtnStyle = (active) => ({
    flex: 1, height: 40, borderRadius: 10, cursor: "pointer",
    border: active ? "1px solid #5C82FF" : "1px solid #1F2A4A",
    background: active ? "#1A2453" : "#0A1124",
    color: active ? "#5C82FF" : "#6E7A98",
    fontWeight: 900, fontSize: 14, fontFamily: "inherit",
  });

  return (
    <div style={{ display: "grid", gap: 12, padding: '16px 16px 0' }}>
      {/* Tabs Productos / Stock */}
      <div style={{ display: "flex", gap: 8 }}>
        <button style={tabBtnStyle(productsTab === "products")} onClick={() => setProductsTab("products")}>Productos</button>
        <button style={tabBtnStyle(productsTab === "stock")} onClick={() => setProductsTab("stock")}>Stock</button>
      </div>

      {productsTab === "stock" ? (
        <StockScreen products={products} pushToast={pushToast} />
      ) : (<>
      {showForm && (
        <div
          style={{
            border: "1px solid #1F2A4A",
            background: "#0A1124",
            borderRadius: 14,
            padding: 14,
            display: "grid",
            gap: 10,
            boxShadow: "0 2px 12px rgba(0,0,0,0.25)",
          }}
        >
          <div style={{ fontWeight: 900 }}>Nuevo producto</div>
          <input
            ref={nameRef}
            placeholder="Nombre"
            style={inputStyle}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submit(); } }}
          />
          <input
            placeholder="Tipo (ej: Aceite, Gas, Bebida)"
            style={inputStyle}
            value={type}
            onChange={(e) => setType(e.target.value)}
          />
          <input
            inputMode="decimal"
            placeholder="Precio costo (opcional)"
            style={inputStyle}
            value={costPrice}
            onChange={(e) => setCostPrice(e.target.value)}
          />
          <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", userSelect: "none" }}>
            <input
              type="checkbox"
              checked={isService}
              onChange={(e) => setIsService(e.target.checked)}
              style={{ width: 18, height: 18, accentColor: "#5C82FF", cursor: "pointer" }}
            />
            <span style={{ color: "#A5B0CC", fontSize: 14 }}>Es un servicio (no controla stock)</span>
          </label>
          {priceListsSection(priceInputs, setPriceInputs)}
          <button
            type="button"
            disabled={submitting}
            onClick={submit}
            style={{
              height: 52,
              borderRadius: 12,
              border: "1px solid #1F2A4A",
              background: submitting ? "#0A1124" : "#0A1124",
              color: "#fff",
              fontWeight: 900,
              fontSize: 16,
              opacity: submitting ? 0.7 : 1,
            }}
          >
            {submitting ? "Guardando..." : "Guardar producto"}
          </button>
        </div>
      )}

      {/* Buscador + botón nuevo */}
      <div style={{ display: "flex", gap: 8 }}>
        <input
          placeholder="Buscar por nombre o tipo..."
          style={{
            flex: 1,
            height: 48,
            fontSize: 16,
            borderRadius: 12,
            border: "1px solid #1F2A4A",
            background: "#121A33",
            color: "#fff",
            padding: "0 12px",
            outline: "none",
            boxSizing: "border-box",
            minWidth: 0,
          }}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button
          type="button"
          onClick={() => { setShowForm((v) => !v); setEditingId(null); }}
          style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            border: "1px solid #1F2A4A",
            background: showForm ? "rgba(92,130,255,0.15)" : "#121A33",
            color: showForm ? "#f87171" : "#5C82FF",
            fontSize: showForm ? 20 : 24,
            fontWeight: 300,
            flexShrink: 0,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {showForm ? "✕" : "+"}
        </button>
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        {filtered.length === 0 ? (
          <div style={{ color: "#6E7A98" }}>
            {products.length === 0
              ? "No hay productos. Creá uno con el botón +."
              : "Sin resultados para esa búsqueda."}
          </div>
        ) : (
          filtered.map((p) => (
            <div
              key={p.id}
              style={{
                border: "1px solid #1F2A4A",
                background: "#0A1124",
                borderRadius: 14,
                padding: 14,
                display: "grid",
                gap: 8,
                boxShadow: "0 2px 12px rgba(0,0,0,0.25)",
              }}
            >
              {editingId === p.id ? (
                <>
                  <div style={{ fontWeight: 900, fontSize: 13, color: "#6E7A98" }}>Editando producto</div>
                  <input
                    placeholder="Nombre"
                    style={inputStyle}
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                  />
                  <input
                    placeholder="Tipo"
                    style={inputStyle}
                    value={editType}
                    onChange={(e) => setEditType(e.target.value)}
                  />
                  <input
                    inputMode="decimal"
                    placeholder="Precio costo (opcional)"
                    style={inputStyle}
                    value={editCostPrice}
                    onChange={(e) => setEditCostPrice(e.target.value)}
                  />
                  <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", userSelect: "none" }}>
                    <input
                      type="checkbox"
                      checked={editActive}
                      onChange={(e) => setEditActive(e.target.checked)}
                      style={{ width: 18, height: 18, accentColor: "#5C82FF", cursor: "pointer" }}
                    />
                    <span style={{ color: "#A5B0CC", fontSize: 14 }}>Activo</span>
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", userSelect: "none" }}>
                    <input
                      type="checkbox"
                      checked={editIsService}
                      onChange={(e) => setEditIsService(e.target.checked)}
                      style={{ width: 18, height: 18, accentColor: "#5C82FF", cursor: "pointer" }}
                    />
                    <span style={{ color: "#A5B0CC", fontSize: 14 }}>Es un servicio (no controla stock)</span>
                  </label>
                  {priceListsSection(editPriceInputs, setEditPriceInputs)}
                  <div style={{ display: "flex", gap: 10 }}>
                    <button
                      type="button"
                      disabled={editSubmitting}
                      onClick={() => saveEdit(p.id)}
                      style={{
                        flex: 1,
                        height: 48,
                        borderRadius: 12,
                        border: "1px solid #1F2A4A",
                        background: editSubmitting ? "#0A1124" : "#0A1124",
                        color: "#fff",
                        fontWeight: 900,
                        opacity: editSubmitting ? 0.7 : 1,
                      }}
                    >
                      {editSubmitting ? "Guardando..." : "Guardar"}
                    </button>
                    <button
                      type="button"
                      disabled={editSubmitting}
                      onClick={cancelEdit}
                      style={{
                        flex: 1,
                        height: 48,
                        borderRadius: 12,
                        border: "1px solid #1F2A4A",
                        background: "#0A1124",
                        color: "#6E7A98",
                        fontWeight: 900,
                      }}
                    >
                      Cancelar
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ fontWeight: 900 }}>{p.name}</div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <div style={{ color: "#6E7A98", fontSize: 13 }}>{p.type}</div>
                      <button
                        type="button"
                        onClick={() => { setShowForm(false); startEdit(p); }}
                        style={{
                          height: 34,
                          padding: "0 12px",
                          borderRadius: 10,
                          border: "1px solid #2B3960",
                          background: "#0A1124",
                          color: "#fff",
                          fontWeight: 800,
                          fontSize: 13,
                        }}
                      >
                        Editar
                      </button>
                    </div>
                  </div>

                  {p.cost_price != null && (
                    <div style={{ display: "flex", justifyContent: "space-between", color: "#A5B0CC", fontSize: 14 }}>
                      <span>Precio costo</span>
                      <span style={{ fontWeight: 800 }}>${Number(p.cost_price).toFixed(2)}</span>
                    </div>
                  )}

                  {p.prices && p.prices.length > 0 && (
                    <div style={{ display: "grid", gap: 4, borderTop: "1px solid #1F2A4A", paddingTop: 8 }}>
                      <div style={{ color: "#6E7A98", fontSize: 12 }}>Precios de venta</div>
                      {p.prices.map((pr) => (
                        <div
                          key={pr.price_list_id}
                          style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}
                        >
                          <span style={{ color: "#6E7A98" }}>{pr.price_list_name}</span>
                          <span style={{ fontWeight: 900 }}>${Number(pr.price).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          ))
        )}
      </div>

      {/* Listas de precios */}
      <div
        style={{
          border: "1px solid #1F2A4A",
          background: "#0A1124",
          borderRadius: 14,
          padding: 14,
          display: "grid",
          gap: 10,
          marginTop: 4,
          boxShadow: "0 2px 12px rgba(0,0,0,0.25)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontWeight: 900 }}>Listas de precios</div>
          <button
            type="button"
            onClick={() => setShowPlForm((v) => !v)}
            style={{
              height: 34,
              padding: "0 14px",
              borderRadius: 10,
              border: "1px solid #2B3960",
              background: showPlForm ? "#121A33" : "#0A1124",
              color: "#fff",
              fontWeight: 800,
              fontSize: 13,
            }}
          >
            {showPlForm ? "Cancelar" : "+ Nueva lista"}
          </button>
        </div>

        {priceLists.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {priceLists.map((pl) => (
              <div
                key={pl.id}
                style={{
                  padding: "6px 14px",
                  borderRadius: 20,
                  border: "1px solid #1F2A4A",
                  background: "#121A33",
                  color: "#fff",
                  fontSize: 13,
                  fontWeight: 700,
                }}
              >
                {pl.name}
              </div>
            ))}
          </div>
        )}

        {showPlForm && (
          <div style={{ display: "flex", gap: 10 }}>
            <input
              placeholder="Nombre de la lista"
              style={{
                flex: 1,
                height: 48,
                fontSize: 16,
                borderRadius: 12,
                border: "1px solid #1F2A4A",
                background: "#121A33",
                color: "#fff",
                padding: "0 12px",
                outline: "none",
                boxSizing: "border-box",
              }}
              value={newPlName}
              onChange={(e) => setNewPlName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); createPriceList(); } }}
            />
            <button
              type="button"
              disabled={plSubmitting}
              onClick={createPriceList}
              style={{
                height: 48,
                padding: "0 18px",
                borderRadius: 12,
                border: "1px solid #1F2A4A",
                background: plSubmitting ? "#0A1124" : "#0A1124",
                color: "#fff",
                fontWeight: 900,
                opacity: plSubmitting ? 0.7 : 1,
              }}
            >
              {plSubmitting ? "..." : "Crear"}
            </button>
          </div>
        )}
      </div>
      </>)}
    </div>
  );
}

/** Pantalla: Stock */
function StockScreen({ products, pushToast }) {
  const [tab, setTab] = useState("current");
  const [currentStock, setCurrentStock] = useState([]);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedEntry, setExpandedEntry] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [stockQuery, setStockQuery] = useState("");

  const [formDate, setFormDate] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formItems, setFormItems] = useState([]);
  const [formSelectedProduct, setFormSelectedProduct] = useState(null);
  const [formProductQuery, setFormProductQuery] = useState("");
  const [formQty, setFormQty] = useState("");
  const [formSubmitting, setFormSubmitting] = useState(false);

  const formProductRef = useRef(null);
  const formQtyRef = useRef(null);

  const loadCurrentStock = async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`${API}/stock/current`);
      if (!res.ok) throw new Error("Error cargando stock");
      setCurrentStock(await res.json());
    } catch {
      pushToast("Error al cargar stock", "error");
    } finally {
      setLoading(false);
    }
  };

  const loadEntries = async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`${API}/stock/entries`);
      if (!res.ok) throw new Error("Error cargando ingresos");
      setEntries(await res.json());
    } catch {
      pushToast("Error al cargar ingresos", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (tab === "current") loadCurrentStock();
    else loadEntries();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const openNewForm = () => {
    setEditingEntry(null);
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    setFormDate(now.toISOString().slice(0, 16));
    setFormNotes("");
    setFormItems([]);
    setFormSelectedProduct(null);
    setFormProductQuery("");
    setFormQty("");
    setShowForm(true);
  };

  const openEditForm = (entry) => {
    setEditingEntry(entry);
    const d = new Date(entry.entry_date);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    setFormDate(d.toISOString().slice(0, 16));
    setFormNotes(entry.notes || "");
    setFormItems(entry.items.map((it) => ({
      product_id: it.product_id,
      product_name: it.product_name,
      quantity: String(Number(it.quantity)),
    })));
    setFormSelectedProduct(null);
    setFormProductQuery("");
    setFormQty("");
    setShowForm(true);
  };

  const addFormItem = () => {
    if (!formSelectedProduct || !formQty) return;
    const q = Number(formQty);
    if (!Number.isFinite(q) || q <= 0) return;
    setFormItems((prev) => [...prev, {
      product_id: formSelectedProduct.id,
      product_name: formSelectedProduct.name,
      quantity: String(q),
    }]);
    setFormSelectedProduct(null);
    setFormProductQuery("");
    setFormQty("");
    setTimeout(() => formProductRef.current?.focus(), 0);
  };

  const removeFormItem = (idx) => {
    setFormItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const submitForm = async () => {
    if (formItems.length === 0) { pushToast("Agregá al menos un producto.", "error"); return; }
    setFormSubmitting(true);
    try {
      const body = {
        entry_date: new Date(formDate).toISOString(),
        notes: formNotes.trim() || null,
        items: formItems.map((it) => ({ product_id: it.product_id, quantity: Number(it.quantity) })),
      };
      const url = editingEntry ? `${API}/stock/entries/${editingEntry.id}` : `${API}/stock/entries`;
      const method = editingEntry ? "PUT" : "POST";
      const res = await apiFetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (res.ok) {
        pushToast(editingEntry ? "Ingreso actualizado ✅" : "Ingreso creado ✅", "success");
        setShowForm(false);
        setEditingEntry(null);
        loadEntries();
        if (tab === "current") loadCurrentStock();
      } else {
        const err = await res.json().catch(() => ({}));
        pushToast(err.detail || "Error al guardar", "error");
      }
    } finally {
      setFormSubmitting(false);
    }
  };

  const inputStyle = {
    width: "100%", height: 44, fontSize: 15, borderRadius: 10,
    border: "1px solid #1F2A4A", background: "#121A33", color: "#fff",
    padding: "0 12px", outline: "none", boxSizing: "border-box",
  };

  const fmtQty = (n) => {
    const num = Number(n);
    return num % 1 === 0 ? String(num) : num.toFixed(3).replace(/0+$/, "");
  };

  const fmtDate = (iso) => {
    const d = new Date(iso);
    return d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
  };

  return (
    <div style={{ display: "grid", gap: 12, padding: '16px 16px 0' }}>
      {/* Tabs */}
      <div style={{ display: "flex", gap: 8 }}>
        {[["current", "Stock actual"], ["entries", "Ingresos"]].map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            style={{
              flex: 1, height: 40, borderRadius: 10, border: "1px solid #1F2A4A",
              background: tab === key ? "#5C82FF" : "#121A33",
              color: tab === key ? "#fff" : "#6E7A98",
              fontWeight: 900, fontSize: 14, cursor: "pointer",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Botón Nuevo ingreso (tab ingresos) */}
      {tab === "entries" && !showForm && (
        <button
          type="button"
          onClick={openNewForm}
          style={{
            height: 44, borderRadius: 10, border: "1px solid #2B3960",
            background: "#121A33", color: "#fff", fontWeight: 800, fontSize: 15, cursor: "pointer",
          }}
        >
          + Nuevo ingreso
        </button>
      )}

      {/* Formulario crear/editar */}
      {showForm && (
        <div style={{ border: "1px solid #1F2A4A", borderRadius: 16, padding: 16, background: "#0A1124", display: "grid", gap: 12, boxShadow: "0 2px 16px rgba(0,0,0,0.3)" }}>
          <div style={{ fontWeight: 900, fontSize: 15 }}>
            {editingEntry ? "Editar ingreso" : "Nuevo ingreso de stock"}
          </div>

          <div>
            <label style={{ display: "block", marginBottom: 6, fontSize: 13, color: "#6E7A98" }}>Fecha</label>
            <input
              type="datetime-local"
              value={formDate}
              onChange={(e) => setFormDate(e.target.value)}
              style={inputStyle}
            />
          </div>

          <div>
            <label style={{ display: "block", marginBottom: 6, fontSize: 13, color: "#6E7A98" }}>Nota (opcional)</label>
            <input
              placeholder="Nota del ingreso..."
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
              style={inputStyle}
            />
          </div>

          {/* Agregar ítem al formulario */}
          <div style={{ border: "1px solid #1F2A4A", borderRadius: 10, padding: 12, display: "grid", gap: 8 }}>
            <div style={{ fontSize: 13, color: "#6E7A98", fontWeight: 700 }}>Agregar producto</div>
            <SearchDropdown
              inputRef={formProductRef}
              label=""
              placeholder="Buscar producto..."
              items={products}
              getKey={(p) => p.id}
              getLabel={(p) => p.name}
              query={formProductQuery}
              setQuery={setFormProductQuery}
              selected={formSelectedProduct}
              setSelected={(p) => {
                setFormSelectedProduct(p || null);
                if (p && !p.is_service) setTimeout(() => formQtyRef.current?.focus(), 0);
              }}
            />
            {formSelectedProduct?.is_service && (
              <div style={{
                background: "rgba(251,191,36,0.1)",
                border: "1px solid rgba(251,191,36,0.35)",
                borderRadius: 10,
                padding: "10px 14px",
                color: "#fbbf24",
                fontSize: 13,
                fontWeight: 700,
              }}>
                ⚠️ Este producto es un servicio, no debe sumarse stock.
              </div>
            )}
            <input
              ref={formQtyRef}
              inputMode="decimal"
              placeholder="Cantidad"
              value={formQty}
              onChange={(e) => setFormQty(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addFormItem(); } }}
              style={inputStyle}
            />
            <button
              type="button"
              onClick={addFormItem}
              style={{
                height: 40, borderRadius: 10, border: "1px solid #2B3960",
                background: "#121A33", color: "#fff", fontWeight: 800, cursor: "pointer",
              }}
            >
              + Agregar
            </button>
          </div>

          {/* Items del formulario */}
          {formItems.length > 0 && (
            <div style={{ display: "grid", gap: 6 }}>
              {formItems.map((it, idx) => (
                <div
                  key={idx}
                  style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    border: "1px solid #1F2A4A", borderRadius: 8, padding: "8px 12px", background: "#0A1124",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 14 }}>{it.product_name}</div>
                    <div style={{ color: "#6E7A98", fontSize: 13 }}>{fmtQty(it.quantity)} u.</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeFormItem(idx)}
                    style={{
                      height: 32, width: 36, borderRadius: 8, border: "1px solid #1F2A4A",
                      background: "#0A1124", color: "#f87171", fontWeight: 900, cursor: "pointer",
                    }}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={() => { setShowForm(false); setEditingEntry(null); }}
              style={{
                flex: 1, height: 44, borderRadius: 10, border: "1px solid #2B3960",
                background: "#0A1124", color: "#fff", fontWeight: 800, cursor: "pointer",
              }}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={submitForm}
              disabled={formSubmitting}
              style={{
                flex: 2, height: 44, borderRadius: 10, border: "none",
                background: "#5C82FF", color: "#fff", fontWeight: 900, cursor: "pointer",
              }}
            >
              {formSubmitting ? "Guardando..." : (editingEntry ? "Actualizar" : "Guardar ingreso")}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ color: "#6E7A98" }}>Cargando...</div>
      ) : tab === "current" ? (
        currentStock.length === 0 ? (
          <div style={{ color: "#6E7A98" }}>Sin datos de stock. Cargá un ingreso primero.</div>
        ) : (
          <>
            <input
              placeholder="Buscar producto..."
              value={stockQuery}
              onChange={(e) => setStockQuery(e.target.value)}
              style={{
                width: "100%", height: 44, fontSize: 15, borderRadius: 10,
                border: "1px solid #1F2A4A", background: "#121A33", color: "#fff",
                padding: "0 12px", outline: "none", boxSizing: "border-box",
              }}
            />
          {currentStock.filter(s =>
            !stockQuery.trim() || s.product_name.toLowerCase().includes(stockQuery.trim().toLowerCase())
          ).map((s) => (
            <div
              key={s.product_id}
              style={{
                border: "1px solid #1F2A4A", background: "#0A1124", borderRadius: 14, padding: 14, display: "grid", gap: 6, boxShadow: "0 2px 12px rgba(0,0,0,0.25)",
              }}
            >
              <div style={{ fontWeight: 900, fontSize: 15 }}>{s.product_name}</div>
              <div style={{ fontSize: 12, color: "#6E7A98" }}>{s.product_type}</div>
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 14, color: "#A5B0CC", marginTop: 4 }}>
                <span>Ingresado: <b style={{ color: "#fff" }}>{fmtQty(s.stock_in)}</b></span>
                <span>Vendido: <b style={{ color: "#fff" }}>{fmtQty(s.stock_out)}</b></span>
                <span>
                  Stock actual:{" "}
                  <b style={{ color: Number(s.current_stock) >= 0 ? "#34d399" : "#f87171" }}>
                    {fmtQty(s.current_stock)}
                  </b>
                </span>
              </div>
            </div>
          ))}
          </>
        )
      ) : (
        entries.length === 0 ? (
          <div style={{ color: "#6E7A98" }}>No hay ingresos de stock.</div>
        ) : (
          entries.map((e) => (
            <div
              key={e.id}
              style={{ border: "1px solid #1F2A4A", background: "#0A1124", borderRadius: 14, overflow: "hidden", boxShadow: "0 2px 12px rgba(0,0,0,0.25)" }}
            >
              <button
                type="button"
                onClick={() => setExpandedEntry(expandedEntry === e.id ? null : e.id)}
                style={{
                  width: "100%", padding: "12px 14px", background: "transparent", border: "none",
                  color: "#fff", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center",
                }}
              >
                <div style={{ textAlign: "left" }}>
                  <div style={{ fontWeight: 900, fontSize: 15 }}>{fmtDate(e.entry_date)}</div>
                  {e.notes && <div style={{ fontSize: 12, color: "#6E7A98", marginTop: 2 }}>{e.notes}</div>}
                  <div style={{ fontSize: 12, color: "#6E7A98", marginTop: 2 }}>{e.items.length} producto{e.items.length !== 1 ? "s" : ""}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button
                    type="button"
                    onClick={(ev) => { ev.stopPropagation(); openEditForm(e); setTab("entries"); }}
                    style={{
                      height: 32, padding: "0 12px", borderRadius: 8, border: "1px solid #1F2A4A",
                      background: "#121A33", color: "#fff", fontWeight: 800, fontSize: 12, cursor: "pointer",
                    }}
                  >
                    Editar
                  </button>
                  <span style={{ fontSize: 16 }}>{expandedEntry === e.id ? "▲" : "▼"}</span>
                </div>
              </button>

              {expandedEntry === e.id && (
                <div style={{ borderTop: "1px solid rgba(255,255,255,0.04)", padding: "10px 14px", display: "grid", gap: 6 }}>
                  {e.items.map((it) => (
                    <div key={it.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 14, color: "#A5B0CC" }}>
                      <span>{it.product_name}</span>
                      <span style={{ fontWeight: 800, color: "#34d399" }}>+{fmtQty(it.quantity)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        )
      )}
    </div>
  );
}

/** Pantalla: Deudores */
function DebtorsScreen({ pushToast }) {
  const [debtors, setDebtors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const run = async () => {
      try {
        const res = await apiFetch(`${API}/clients/debtors`);
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.detail || "Error cargando deudores");
        }
        const data = await res.json();
        setDebtors(data);
      } catch (e) {
        setError(e.message || "Error");
      } finally {
        setLoading(false);
      }
    };
    run();
  }, []);

  const [search, setSearch] = useState("");

  const fmt = (n) => Number(n || 0).toFixed(2);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return debtors;
    return debtors.filter((d) => d.client_name.toLowerCase().includes(q));
  }, [debtors, search]);

  return (
    <div style={{ display: "grid", gap: 12, padding: '16px 16px 0' }}>
      <input
        placeholder="Buscar por cliente..."
        style={{
          width: "100%",
          height: 48,
          fontSize: 16,
          borderRadius: 12,
          border: "1px solid #1F2A4A",
          background: "#121A33",
          color: "#fff",
          padding: "0 12px",
          outline: "none",
          boxSizing: "border-box",
        }}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {loading ? (
        <div style={{ color: "#6E7A98" }}>Cargando...</div>
      ) : error ? (
        <div style={{ color: "#f87171" }}>{error}</div>
      ) : filtered.length === 0 ? (
        <div style={{ color: "#6E7A98" }}>
          {debtors.length === 0 ? "No hay deudores. Todos los clientes están al día." : "Sin resultados."}
        </div>
      ) : (
        filtered.map((d) => (
          <div
            key={d.client_id}
            style={{
              border: "1px solid #1F2A4A",
              background: "#0A1124",
              borderRadius: 14,
              padding: 14,
              display: "grid",
              gap: 6,
              boxShadow: "0 2px 12px rgba(0,0,0,0.25)",
            }}
          >
            <div style={{ fontWeight: 900, fontSize: 16 }}>{d.client_name}</div>
            <div style={{ display: "flex", justifyContent: "space-between", color: "#A5B0CC", fontSize: 14 }}>
              <span>Entregado</span>
              <span style={{ fontWeight: 800 }}>${fmt(d.total_delivered)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", color: "#A5B0CC", fontSize: 14 }}>
              <span>Pagado</span>
              <span style={{ fontWeight: 800 }}>${fmt(d.total_paid)}</span>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontWeight: 900,
                borderTop: "1px solid #1F2A4A",
                paddingTop: 6,
                marginTop: 2,
              }}
            >
              <span>Deuda</span>
              <span style={{ color: "#f87171" }}>${fmt(d.balance)}</span>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

/** Pantalla: Proveedores */
function SuppliersScreen({ suppliers, allClients = [], pushToast, onSupplierCreated }) {
  const supplierRef = useRef(null);
  const [supplierQuery, setSupplierQuery] = useState("");
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [tab, setTab] = useState("purchases");

  const [purchases, setPurchases] = useState([]);
  const [supplierPayments, setSupplierPayments] = useState([]);
  const [statement, setStatement] = useState(null);
  const [loading, setLoading] = useState(false);
  const [statementLoading, setStatementLoading] = useState(false);

  const [purchaseDeliveriesData, setPurchaseDeliveriesData] = useState(null);
  const [saleDeliveriesData, setSaleDeliveriesData] = useState(null);
  const [showAllPurchases, setShowAllPurchases] = useState(false);
  const [showAllSales, setShowAllSales] = useState(false);

  const [showNewSupplier, setShowNewSupplier] = useState(false);
  const [nsMode, setNsMode] = useState("new"); // "new" | "existing"
  const [nsName, setNsName] = useState("");
  const [nsPhone, setNsPhone] = useState("");
  const [nsSubmitting, setNsSubmitting] = useState(false);
  const nsNameRef = useRef(null);
  const [nsExistingQuery, setNsExistingQuery] = useState("");
  const [nsExistingSelected, setNsExistingSelected] = useState(null);
  const [nsConvertSubmitting, setNsConvertSubmitting] = useState(false);

  const [payAmount, setPayAmount] = useState("");
  const [payNotes, setPayNotes] = useState("");
  const [payDate, setPayDate] = useState(() => localToday());
  const [paySubmitting, setPaySubmitting] = useState(false);

  // Editar proveedor
  const [showEditSupplier, setShowEditSupplier] = useState(false);
  const [editSName, setEditSName] = useState("");
  const [editSPhone, setEditSPhone] = useState("");
  const [editSSubmitting, setEditSSubmitting] = useState(false);
  const [deactivateSSubmitting, setDeactivateSSubmitting] = useState(false);

  useEffect(() => {
    if (showNewSupplier) setTimeout(() => nsNameRef.current?.focus(), 0);
  }, [showNewSupplier]);

  useEffect(() => {
    if (!selectedSupplier) {
      setPurchases([]); setSupplierPayments([]); setStatement(null); setTab("purchases");
      setPurchaseDeliveriesData(null); setSaleDeliveriesData(null);
      setShowAllPurchases(false); setShowAllSales(false);
      setShowEditSupplier(false);
      return;
    }
    setLoading(true);
    setTab("purchases");
    setStatement(null);
    setShowEditSupplier(false);
    setPurchaseDeliveriesData(null); setSaleDeliveriesData(null);
    setShowAllPurchases(false); setShowAllSales(false);
    Promise.all([
      apiFetch(`${API}/clients/${selectedSupplier.id}/purchases`).then(r => r.json()),
      apiFetch(`${API}/clients/${selectedSupplier.id}/supplier-payments`).then(r => r.json()),
      apiFetch(`${API}/clients/${selectedSupplier.id}/deliveries?sale_type=purchase`).then(r => r.json()),
      apiFetch(`${API}/clients/${selectedSupplier.id}/deliveries?sale_type=sale`).then(r => r.json()),
    ]).then(([p, sp, pd, sd]) => {
      setPurchases(Array.isArray(p) ? p : []);
      setSupplierPayments(Array.isArray(sp) ? sp : []);
      setPurchaseDeliveriesData(pd?.deliveries ? pd : null);
      setSaleDeliveriesData(sd?.deliveries ? sd : null);
    }).catch(() => pushToast("Error cargando datos del proveedor", "error"))
      .finally(() => setLoading(false));
  }, [selectedSupplier]);

  useEffect(() => {
    if (!selectedSupplier || tab !== "sales" || statement) return;
    setStatementLoading(true);
    apiFetch(`${API}/clients/${selectedSupplier.id}/statement`)
      .then(r => r.json())
      .then(data => setStatement(data))
      .catch(() => pushToast("Error cargando ventas", "error"))
      .finally(() => setStatementLoading(false));
  }, [tab, selectedSupplier, statement]);

  const submitNewSupplier = async () => {
    const n = nsName.trim();
    if (!n) { pushToast("Ingresá un nombre.", "error"); return; }
    setNsSubmitting(true);
    try {
      const res = await apiFetch(`${API}/clients`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: n, phone: nsPhone.trim() || null, is_supplier: true }),
      });
      if (!res.ok) throw new Error(((await res.json().catch(() => ({}))).detail) || "Error");
      setNsName(""); setNsPhone(""); setShowNewSupplier(false);
      pushToast("Proveedor creado ✅", "success");
      onSupplierCreated?.();
    } catch (e) { pushToast(e.message || "Error", "error"); }
    finally { setNsSubmitting(false); }
  };

  const convertToSupplier = async () => {
    if (!nsExistingSelected) return;
    setNsConvertSubmitting(true);
    try {
      const res = await apiFetch(`${API}/clients/${nsExistingSelected.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_supplier: true }),
      });
      if (!res.ok) throw new Error(((await res.json().catch(() => ({}))).detail) || "Error");
      setNsExistingQuery(""); setNsExistingSelected(null); setShowNewSupplier(false);
      pushToast(`${nsExistingSelected.name} marcado como proveedor ✅`, "success");
      onSupplierCreated?.();
    } catch (e) { pushToast(e.message || "Error", "error"); }
    finally { setNsConvertSubmitting(false); }
  };

  const submitPayment = async () => {
    const amount = Number(payAmount);
    if (!Number.isFinite(amount) || amount <= 0) { pushToast("Ingresá un monto válido.", "error"); return; }
    setPaySubmitting(true);
    try {
      const res = await apiFetch(`${API}/clients/${selectedSupplier.id}/supplier-payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          payment_date: payDate === localToday() ? new Date().toISOString() : new Date(payDate + "T12:00:00").toISOString(),
          notes: payNotes.trim() || null,
        }),
      });
      if (!res.ok) throw new Error(((await res.json().catch(() => ({}))).detail) || "Error");
      setPayAmount(""); setPayNotes(""); setPayDate(localToday());
      const sp = await apiFetch(`${API}/clients/${selectedSupplier.id}/supplier-payments`).then(r => r.json());
      setSupplierPayments(Array.isArray(sp) ? sp : []);
      pushToast("Pago registrado ✅", "success");
    } catch (e) { pushToast(e.message || "Error", "error"); }
    finally { setPaySubmitting(false); }
  };

  const openEditSupplier = () => {
    const full = suppliers.find(s => s.id === selectedSupplier?.id);
    setEditSName(full?.name || selectedSupplier?.name || "");
    setEditSPhone(full?.phone || "");
    setShowEditSupplier(true);
  };

  const submitEditSupplier = async () => {
    const n = editSName.trim();
    if (!n) { pushToast("Ingresá un nombre.", "error"); return; }
    setEditSSubmitting(true);
    try {
      const res = await apiFetch(`${API}/clients/${selectedSupplier.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: n, phone: editSPhone.trim() || null }),
      });
      if (!res.ok) throw new Error(((await res.json().catch(() => ({}))).detail) || "Error");
      const updated = await res.json();
      setSelectedSupplier({ id: updated.id, name: updated.name });
      setShowEditSupplier(false);
      pushToast("Proveedor actualizado ✅", "success");
      onSupplierCreated?.();
    } catch (e) { pushToast(e.message || "Error", "error"); }
    finally { setEditSSubmitting(false); }
  };

  const deactivateSupplier = async () => {
    if (!selectedSupplier) return;
    setDeactivateSSubmitting(true);
    try {
      const res = await apiFetch(`${API}/clients/${selectedSupplier.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: false }),
      });
      if (!res.ok) throw new Error(((await res.json().catch(() => ({}))).detail) || "Error");
      pushToast("Proveedor desactivado", "info");
      setSelectedSupplier(null);
      setShowEditSupplier(false);
      setSupplierQuery("");
      onSupplierCreated?.();
    } catch (e) { pushToast(e.message || "Error", "error"); }
    finally { setDeactivateSSubmitting(false); }
  };

  // ── Grouped deliveries (item breakdown per sale) ──────────────────────────
  const purchasesBySale = useMemo(() => {
    const rows = purchaseDeliveriesData?.deliveries || [];
    const map = new Map();
    for (const r of rows) {
      if (!map.has(r.sale_id)) map.set(r.sale_id, { sale_id: r.sale_id, sale_date: r.sale_date, rows: [], total: 0 });
      const g = map.get(r.sale_id);
      g.rows.push(r);
      g.total += Number(r.subtotal || 0);
    }
    return Array.from(map.values()).sort((a, b) => new Date(b.sale_date) - new Date(a.sale_date) || b.sale_id - a.sale_id);
  }, [purchaseDeliveriesData]);

  const salesBySale = useMemo(() => {
    const rows = saleDeliveriesData?.deliveries || [];
    const map = new Map();
    for (const r of rows) {
      if (!map.has(r.sale_id)) map.set(r.sale_id, { sale_id: r.sale_id, sale_date: r.sale_date, rows: [], total: 0 });
      const g = map.get(r.sale_id);
      g.rows.push(r);
      g.total += Number(r.subtotal || 0);
    }
    return Array.from(map.values()).sort((a, b) => new Date(b.sale_date) - new Date(a.sale_date) || b.sale_id - a.sale_id);
  }, [saleDeliveriesData]);

  // ── Helpers ────────────────────────────────────────────────────────────────
  const fmtMoney = (n) => { const v = Number(n || 0); return Number.isFinite(v) ? v.toFixed(2) : "0.00"; };
  const fmtNowAR = () => new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short" }).format(new Date());
  const copyToClipboard = async (text) => {
    try { await navigator.clipboard.writeText(text); pushToast("Copiado ✅", "success"); }
    catch { try { const ta = document.createElement("textarea"); ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); document.body.removeChild(ta); pushToast("Copiado ✅", "success"); } catch { pushToast("No se pudo copiar", "error"); } }
  };

  const buildPurchasesText = () => {
    const totalOwed = Math.max(0, purchases.reduce((s, p) => s + Number(p.total || 0), 0) - supplierPayments.reduce((s, p) => s + Number(p.amount || 0), 0));
    const header = `📌 Compras - ${selectedSupplier?.name || ""}\n🕒 ${fmtNowAR()}\n💰 Les debemos: $${fmtMoney(totalOwed)}\n\n📦 Compras\n`;
    if (!purchasesBySale.length) return header + "Sin compras.\n";
    const blocks = purchasesBySale.map(sale => {
      const lines = sale.rows.map((r, i) => `- ${i+1}) ${r.product_name}${r.notes ? ` (${r.notes})` : ""} x${fmtMoney(r.quantity)} $${fmtMoney(r.unit_price)} Sub: $${fmtMoney(r.subtotal)}`);
      const info = purchases.find(p => p.sale_id === sale.sale_id);
      return `COMPRA #${sale.sale_id} (${formatArDate(sale.sale_date)})\n${lines.join("\n")}\nTOTAL: $${fmtMoney(sale.total)}${info ? `\nPAGADO: $${fmtMoney(info.paid)}` : ""}\n`;
    });
    return header + blocks.join("\n");
  };

  const buildPaymentsText = () => {
    const header = `📌 Pagos a proveedor - ${selectedSupplier?.name || ""}\n🕒 ${fmtNowAR()}\n\n💵 Entregas de dinero\n`;
    if (!supplierPayments.length) return header + "Sin pagos.\n";
    const totalPaid = supplierPayments.reduce((s, p) => s + Number(p.amount || 0), 0);
    const lines = supplierPayments.map(p => `- ${formatArDate(p.payment_date)}  $${fmtMoney(p.amount)}${p.notes ? ` "${p.notes}"` : ""}`);
    return header + lines.join("\n") + `\nTOTAL: $${fmtMoney(totalPaid)}\n`;
  };

  // ── Shared sub-components ─────────────────────────────────────────────────
  const exportBtnStyle = { width: "100%", height: 44, borderRadius: 10, border: "1px solid #1F2A4A", background: "#0A1124", color: "#fff", fontWeight: 900, fontSize: 14, cursor: "pointer" };
  const showMoreBtnStyle = { width: "100%", height: 48, borderRadius: 12, border: "1px solid #1F2A4A", background: "#0A1124", color: "#fff", fontWeight: 900, marginTop: 10, cursor: "pointer" };

  const DeliveryCard = ({ sale, labelPrefix, paidInfo }) => {
    const paid = Number(paidInfo?.paid ?? 0);
    const total = Number(paidInfo?.total ?? sale.total);
    return (
      <div style={{ border: "1px solid #1F2A4A", borderRadius: 14, background: "#121A33", overflow: "hidden", boxShadow: "0 2px 12px rgba(0,0,0,0.25)" }}>
        <div style={{ padding: 12, borderBottom: "1px solid #2a2a2a", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontWeight: 900 }}>{labelPrefix} #{sale.sale_id}</div>
          <div style={{ color: "#6E7A98", fontSize: 12 }}>{formatArDate(sale.sale_date)}</div>
        </div>
        <div style={{ padding: 12, display: "grid", gap: 10 }}>
          {sale.rows.map((r, i) => (
            <div key={`${r.sale_id}-${r.product_id}-${i}`} style={{ border: "1px solid #1F2A4A", borderRadius: 12, padding: 10, background: "#0A1124", display: "grid", gap: 6 }}>
              <div style={{ fontWeight: 900 }}>{i+1}) {r.product_name}</div>
              {r.notes && <div style={{ color: "#6E7A98", fontSize: 12 }}>Nota: {r.notes}</div>}
              <div style={{ display: "flex", justifyContent: "space-between", color: "#A5B0CC" }}><span>Cant</span><span style={{ fontWeight: 900 }}>{Number(r.quantity).toFixed(2)}</span></div>
              <div style={{ display: "flex", justifyContent: "space-between", color: "#A5B0CC" }}><span>Precio unit</span><span style={{ fontWeight: 900 }}>${Number(r.unit_price).toFixed(2)}</span></div>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ fontWeight: 900 }}>Subtotal</span><span style={{ fontWeight: 900 }}>${Number(r.subtotal).toFixed(2)}</span></div>
            </div>
          ))}
        </div>
        <div style={{ borderTop: "1px solid #1F2A4A" }}>
          <div style={{ padding: "10px 12px 4px", display: "flex", justifyContent: "space-between", fontWeight: 900 }}><div>TOTAL</div><div>${total.toFixed(2)}</div></div>
          <div style={{ padding: "4px 12px 10px", display: "flex", justifyContent: "space-between", color: paid >= total ? "#4ade80" : paid > 0 ? "#facc15" : "#6E7A98", fontSize: 13, fontWeight: 700 }}><div>PAGADO</div><div>${paid.toFixed(2)}</div></div>
        </div>
      </div>
    );
  };

  const tabBtnStyle = (active) => ({
    flex: 1, height: 40, borderRadius: 10, cursor: "pointer",
    border: active ? "1px solid #5C82FF" : "1px solid #1F2A4A",
    background: active ? "#1A2453" : "#0A1124",
    color: active ? "#5C82FF" : "#6E7A98",
    fontWeight: 900, fontSize: 13, fontFamily: "inherit",
  });

  const inputStyle = {
    width: "100%", height: 48, fontSize: 16, borderRadius: 12,
    border: "1px solid #1F2A4A", background: "#121A33", color: "#fff",
    padding: "0 12px", outline: "none", boxSizing: "border-box",
  };

  const totalPurchaseAmount = purchases.reduce((s, p) => s + Number(p.total || 0), 0);
  const totalPaid = supplierPayments.reduce((s, p) => s + Number(p.amount || 0), 0);
  const totalOwed = Math.max(0, totalPurchaseAmount - totalPaid);

  return (
    <div style={{ display: "grid", gap: 12, padding: "16px 16px 0" }}>
      <SearchDropdown
        inputRef={supplierRef}
        label="Proveedor"
        placeholder="Buscar proveedor..."
        items={suppliers}
        getKey={c => c.id}
        getLabel={c => c.name}
        query={supplierQuery}
        setQuery={setSupplierQuery}
        selected={selectedSupplier}
        setSelected={c => { setSelectedSupplier(c ? { id: c.id, name: c.name } : null); setStatement(null); }}
        onAdd={() => setShowNewSupplier(v => !v)}
        onEdit={selectedSupplier ? () => (showEditSupplier ? setShowEditSupplier(false) : openEditSupplier()) : undefined}
      />

      {showNewSupplier && (
        <div style={{ border: "1px solid #1F2A4A", background: "#0A1124", borderRadius: 14, padding: 14, display: "grid", gap: 10, marginBottom: 4 }}>
          <div style={{ display: "flex", gap: 6 }}>
            <button type="button" onClick={() => setNsMode("new")} style={{ flex: 1, height: 36, borderRadius: 10, border: nsMode === "new" ? "1px solid #5C82FF" : "1px solid #1F2A4A", background: nsMode === "new" ? "#1A2453" : "transparent", color: nsMode === "new" ? "#5C82FF" : "#6E7A98", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Nuevo</button>
            <button type="button" onClick={() => setNsMode("existing")} style={{ flex: 1, height: 36, borderRadius: 10, border: nsMode === "existing" ? "1px solid #5C82FF" : "1px solid #1F2A4A", background: nsMode === "existing" ? "#1A2453" : "transparent", color: nsMode === "existing" ? "#5C82FF" : "#6E7A98", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Desde cliente existente</button>
          </div>
          {nsMode === "new" ? (
            <>
              <input ref={nsNameRef} placeholder="Nombre" style={inputStyle} value={nsName}
                onChange={e => setNsName(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); submitNewSupplier(); } }} />
              <input inputMode="tel" placeholder="Teléfono (opcional)" style={inputStyle}
                value={nsPhone} onChange={e => setNsPhone(e.target.value)} />
              <button type="button" disabled={nsSubmitting} onClick={submitNewSupplier}
                style={{ height: 52, borderRadius: 12, border: "1px solid #1F2A4A", background: "#0A1124", color: "#fff", fontWeight: 900, fontSize: 16, opacity: nsSubmitting ? 0.7 : 1, cursor: nsSubmitting ? "not-allowed" : "pointer" }}>
                {nsSubmitting ? "Creando..." : "Crear proveedor"}
              </button>
            </>
          ) : (
            <>
              <input placeholder="Buscar cliente..." style={inputStyle} value={nsExistingQuery}
                onChange={e => { setNsExistingQuery(e.target.value); setNsExistingSelected(null); }} />
              {nsExistingQuery.trim() && (
                <div style={{ border: "1px solid #1F2A4A", borderRadius: 10, overflow: "hidden", maxHeight: 200, overflowY: "auto" }}>
                  {allClients
                    .filter(c => !c.is_supplier && c.name.toLowerCase().includes(nsExistingQuery.toLowerCase()))
                    .map(c => (
                      <button key={c.id} type="button" onClick={() => { setNsExistingSelected(c); setNsExistingQuery(c.name); }}
                        style={{ width: "100%", padding: "10px 12px", background: nsExistingSelected?.id === c.id ? "#1A2453" : "#121A33", border: "none", borderBottom: "1px solid #1F2A4A", color: nsExistingSelected?.id === c.id ? "#5C82FF" : "#fff", textAlign: "left", cursor: "pointer", fontSize: 14 }}>
                        {c.name}{c.phone ? ` · ${c.phone}` : ""}
                      </button>
                    ))}
                </div>
              )}
              <button type="button" disabled={!nsExistingSelected || nsConvertSubmitting} onClick={convertToSupplier}
                style={{ height: 52, borderRadius: 12, border: "none", background: nsExistingSelected ? "#5C82FF" : "#1F2A4A", color: "#fff", fontWeight: 900, fontSize: 16, opacity: (!nsExistingSelected || nsConvertSubmitting) ? 0.6 : 1, cursor: (!nsExistingSelected || nsConvertSubmitting) ? "not-allowed" : "pointer" }}>
                {nsConvertSubmitting ? "Convirtiendo..." : nsExistingSelected ? `Marcar "${nsExistingSelected.name}" como proveedor` : "Seleccioná un cliente"}
              </button>
            </>
          )}
        </div>
      )}

      {/* Panel editar proveedor */}
      {showEditSupplier && (
        <div style={{ border: "1px solid #1F2A4A", background: "#0A1124", borderRadius: 14, padding: 14, display: "grid", gap: 10, marginBottom: 4 }}>
          <div style={{ fontWeight: 900, fontSize: 13, color: "#6E7A98", letterSpacing: 1, textTransform: "uppercase" }}>Editar proveedor</div>
          <input
            placeholder="Nombre"
            style={inputStyle}
            value={editSName}
            onChange={e => setEditSName(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); submitEditSupplier(); } }}
          />
          <input
            inputMode="tel"
            placeholder="Teléfono (opcional)"
            style={inputStyle}
            value={editSPhone}
            onChange={e => setEditSPhone(e.target.value)}
          />
          <button
            type="button"
            disabled={editSSubmitting}
            onClick={submitEditSupplier}
            style={{ height: 48, borderRadius: 12, border: "none", background: editSSubmitting ? "#3b3b8a" : "#5C82FF", color: "#fff", fontWeight: 900, fontSize: 15, opacity: editSSubmitting ? 0.7 : 1, cursor: editSSubmitting ? "not-allowed" : "pointer" }}
          >
            {editSSubmitting ? "Guardando..." : "Guardar cambios"}
          </button>
          <button
            type="button"
            disabled={deactivateSSubmitting}
            onClick={deactivateSupplier}
            style={{ height: 44, borderRadius: 12, border: "1px solid #f87171", background: "transparent", color: "#f87171", fontWeight: 900, fontSize: 14, opacity: deactivateSSubmitting ? 0.7 : 1, cursor: deactivateSSubmitting ? "not-allowed" : "pointer" }}
          >
            {deactivateSSubmitting ? "Desactivando..." : "Desactivar proveedor"}
          </button>
        </div>
      )}

      {!selectedSupplier ? (
        <div style={{ color: "#6E7A98" }}>Elegí un proveedor para ver sus datos.</div>
      ) : loading ? (
        <div style={{ color: "#6E7A98" }}>Cargando...</div>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div style={{ border: "1px solid #1F2A4A", background: "#0A1124", borderRadius: 14, padding: 12 }}>
              <div style={{ color: "#6E7A98", fontSize: 12 }}>Les debemos</div>
              <div style={{ fontWeight: 900, fontSize: 20, color: totalOwed > 0 ? "#f87171" : "#34d399" }}>
                ${totalOwed.toFixed(2)}
              </div>
            </div>
            <div style={{ border: "1px solid #1F2A4A", background: "#0A1124", borderRadius: 14, padding: 12 }}>
              <div style={{ color: "#6E7A98", fontSize: 12 }}>Pagado a ellos</div>
              <div style={{ fontWeight: 900, fontSize: 20 }}>${totalPaid.toFixed(2)}</div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button style={tabBtnStyle(tab === "purchases")} onClick={() => setTab("purchases")}>Compras</button>
            <button style={tabBtnStyle(tab === "sales")} onClick={() => setTab("sales")}>Ventas</button>
            <button style={tabBtnStyle(tab === "payments")} onClick={() => setTab("payments")}>Dinero</button>
          </div>

          {/* ===== Compras ===== */}
          {tab === "purchases" && (
            <>
              {purchasesBySale.length > 0 && (
                <button type="button" onClick={() => copyToClipboard(buildPurchasesText())} style={exportBtnStyle}>
                  Exportar compras
                </button>
              )}
              {purchasesBySale.length === 0 ? (
                <div style={{ color: "#6E7A98" }}>No hay compras registradas.</div>
              ) : (
                <div style={{ display: "grid", gap: 12 }}>
                  {(showAllPurchases ? purchasesBySale : purchasesBySale.slice(0, 5)).map(sale => (
                    <DeliveryCard key={sale.sale_id} sale={sale} labelPrefix="COMPRA"
                      paidInfo={purchases.find(p => p.sale_id === sale.sale_id)} />
                  ))}
                </div>
              )}
              {purchasesBySale.length > 5 && (
                <button type="button" onClick={() => setShowAllPurchases(v => !v)} style={showMoreBtnStyle}>
                  {showAllPurchases ? "Mostrar menos" : `Mostrar más compras (${purchasesBySale.length - 5} más)`}
                </button>
              )}
            </>
          )}

          {/* ===== Dinero ===== */}
          {tab === "payments" && (
            <div style={{ display: "grid", gap: 12 }}>
              <div style={{ border: "1px solid #1F2A4A", background: "#0A1124", borderRadius: 14, padding: 14, display: "grid", gap: 10 }}>
                <div style={{ fontWeight: 900, fontSize: 13, color: "#6E7A98", letterSpacing: 1, textTransform: "uppercase" }}>
                  Registrar entrega de dinero
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 10 }}>
                  <input inputMode="decimal" placeholder="Monto"
                    style={{ height: 48, fontSize: 16, borderRadius: 12, border: "1px solid #1F2A4A", background: "#121A33", color: "#fff", padding: "0 12px", outline: "none", boxSizing: "border-box" }}
                    value={payAmount} onChange={e => setPayAmount(e.target.value)} />
                  <NotesCombo placeholder="Notas (opcional)"
                    inputStyle={{ width: "100%", height: 48, fontSize: 16, borderRadius: 12, border: "1px solid #1F2A4A", background: "#121A33", color: "#fff", padding: "0 12px", outline: "none", boxSizing: "border-box" }}
                    value={payNotes} onChange={setPayNotes} />
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#6E7A98" }}>Fecha</span>
                  <input type="date" lang="en-GB" value={payDate} max={localToday()} onChange={e => setPayDate(e.target.value)}
                    style={{ height: 40, fontSize: 14, borderRadius: 10, border: "1px solid #1F2A4A", background: "#121A33", color: "#fff", padding: "0 10px", outline: "none", cursor: "pointer", fontFamily: "inherit" }} />
                </div>
                <button type="button" disabled={paySubmitting} onClick={submitPayment}
                  style={{ height: 48, borderRadius: 12, border: "none", background: paySubmitting ? "#3b3b8a" : "#5C82FF", color: "#fff", fontWeight: 900, fontSize: 15, opacity: paySubmitting ? 0.7 : 1, cursor: paySubmitting ? "not-allowed" : "pointer" }}>
                  {paySubmitting ? "Registrando..." : "Confirmar entrega"}
                </button>
              </div>
              {supplierPayments.length > 0 && (
                <button type="button" onClick={() => copyToClipboard(buildPaymentsText())} style={exportBtnStyle}>
                  Exportar pagos
                </button>
              )}
              {supplierPayments.length === 0 ? (
                <div style={{ color: "#6E7A98" }}>No hay entregas registradas.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: "55vh", overflowY: "auto" }}>
                  {supplierPayments.map(p => (
                    <div key={p.id} style={{ border: "1px solid #1F2A4A", background: "#121A33", borderRadius: 14, padding: 12, display: "grid", gap: 6, boxShadow: "0 2px 12px rgba(0,0,0,0.25)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ fontWeight: 900 }}>Pago #{p.id}</div>
                        <div style={{ color: "#6E7A98", fontSize: 12 }}>{formatArDate(p.payment_date)}</div>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 900 }}>
                        <span>Monto</span><span>${Number(p.amount || 0).toFixed(2)}</span>
                      </div>
                      {p.notes && <div style={{ color: "#6E7A98", fontSize: 13, whiteSpace: "pre-line" }}>{p.notes}</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ===== Ventas ===== */}
          {tab === "sales" && (
            <>
              {salesBySale.length > 0 && statement && (
                <div style={{ border: "1px solid #1F2A4A", background: "#0A1124", borderRadius: 14, padding: 12 }}>
                  <div style={{ color: "#6E7A98", fontSize: 12 }}>Saldo pendiente</div>
                  <div style={{ fontWeight: 900, fontSize: 22 }}>${Number(statement.total_balance || 0).toFixed(2)}</div>
                </div>
              )}
              {statementLoading ? (
                <div style={{ color: "#6E7A98" }}>Cargando ventas...</div>
              ) : salesBySale.length === 0 ? (
                <div style={{ color: "#6E7A98" }}>No hay ventas registradas a este proveedor.</div>
              ) : (
                <div style={{ display: "grid", gap: 12 }}>
                  {(showAllSales ? salesBySale : salesBySale.slice(0, 5)).map(sale => (
                    <DeliveryCard key={sale.sale_id} sale={sale} labelPrefix="VENTA"
                      paidInfo={statement?.sales?.find(s => s.sale_id === sale.sale_id)} />
                  ))}
                </div>
              )}
              {salesBySale.length > 5 && (
                <button type="button" onClick={() => setShowAllSales(v => !v)} style={showMoreBtnStyle}>
                  {showAllSales ? "Mostrar menos" : `Mostrar más ventas (${salesBySale.length - 5} más)`}
                </button>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

const SCREEN_OPTIONS = [
  { key: "sale",      label: "Nueva venta" },
  { key: "client",    label: "Clientes" },
  { key: "products",  label: "Productos" },
  { key: "suppliers", label: "Proveedores" },
];

/** Pantalla: Usuarios (solo admin) */
function UsersScreen({ pushToast, currentUser }) {
  const [activeTab, setActiveTab] = useState("users");
  const [roles, setRoles] = useState([]);

  const inputStyle = {
    height: 48, fontSize: 15, borderRadius: 12,
    border: "1px solid #1F2A4A", background: "#121A33",
    color: "#fff", padding: "0 12px", outline: "none", boxSizing: "border-box", width: "100%",
  };
  const selectStyle = { ...inputStyle, cursor: "pointer" };

  const fetchRoles = async () => {
    try {
      const res = await apiFetch(`${API}/roles`);
      if (res.ok) setRoles(await res.json());
    } catch { /* silencioso */ }
  };

  useEffect(() => { fetchRoles(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const tabBtn = (key, label) => (
    <button
      key={key} type="button"
      onClick={() => setActiveTab(key)}
      style={{
        flex: 1, height: 40, borderRadius: 10, cursor: "pointer",
        border: activeTab === key ? "1px solid #5C82FF" : "1px solid #1F2A4A",
        background: activeTab === key ? "#1A2453" : "#0A1124",
        color: activeTab === key ? "#5C82FF" : "#6E7A98",
        fontWeight: 900, fontSize: 14,
      }}
    >{label}</button>
  );

  // ── Tab: Usuarios ──────────────────────────────────────────────────────────
  function UsersTab() {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [newUsername, setNewUsername] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [newRole, setNewRole] = useState(roles[0]?.name ?? "operator");
    const [submitting, setSubmitting] = useState(false);
    const [changePwdId, setChangePwdId] = useState(null);
    const [changePwdValue, setChangePwdValue] = useState("");
    const [changePwdSubmitting, setChangePwdSubmitting] = useState(false);

    const fetchUsers = async () => {
      setLoading(true);
      try {
        const res = await apiFetch(`${API}/users`);
        if (!res.ok) throw new Error();
        setUsers(await res.json());
      } catch { pushToast("Error cargando usuarios", "error"); }
      finally { setLoading(false); }
    };

    useEffect(() => { fetchUsers(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const apiErr = async (res) => {
      const e = await res.json().catch(() => ({}));
      const d = e.detail;
      return typeof d === "string" ? d : Array.isArray(d) ? d.map((x) => x.msg).join(", ") : "Error";
    };

    const createUser = async () => {
      if (!newUsername.trim() || !newPassword) { pushToast("Completá usuario y contraseña", "error"); return; }
      setSubmitting(true);
      try {
        const res = await apiFetch(`${API}/users`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: newUsername.trim(), password: newPassword, role: newRole }),
        });
        if (!res.ok) throw new Error(await apiErr(res));
        pushToast("Usuario creado ✅", "success");
        setNewUsername(""); setNewPassword(""); setShowForm(false);
        fetchUsers();
      } catch (e) { pushToast(e.message || "Error", "error"); }
      finally { setSubmitting(false); }
    };

    const toggleActive = async (u) => {
      try {
        const res = await apiFetch(`${API}/users/${u.id}`, {
          method: "PUT", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ active: !u.active }),
        });
        if (!res.ok) throw new Error(await apiErr(res));
        fetchUsers();
      } catch (e) { pushToast(e.message || "Error actualizando usuario", "error"); }
    };

    const changeRole = async (u, role) => {
      try {
        const res = await apiFetch(`${API}/users/${u.id}`, {
          method: "PUT", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role }),
        });
        if (!res.ok) throw new Error(await apiErr(res));
        fetchUsers();
      } catch (e) { pushToast(e.message || "Error actualizando rol", "error"); }
    };

    const submitChangePwd = async () => {
      if (!changePwdValue || changePwdValue.length < 8) { pushToast("Mínimo 8 caracteres", "error"); return; }
      setChangePwdSubmitting(true);
      try {
        const res = await apiFetch(`${API}/users/${changePwdId}/password`, {
          method: "PUT", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ new_password: changePwdValue }),
        });
        if (!res.ok) throw new Error(await apiErr(res));
        pushToast("Contraseña actualizada ✅", "success");
        setChangePwdId(null); setChangePwdValue("");
      } catch (e) { pushToast(e.message || "Error", "error"); }
      finally { setChangePwdSubmitting(false); }
    };

    return (
      <div style={{ display: "grid", gap: 12 }}>
        <button type="button" onClick={() => setShowForm((v) => !v)}
          style={{ height: 44, borderRadius: 12, border: "1px solid #1F2A4A", background: showForm ? "#1a1a28" : "#0A1124", color: "#fff", fontWeight: 900, cursor: "pointer" }}>
          {showForm ? "Cancelar" : "+ Nuevo usuario"}
        </button>

        {showForm && (
          <div style={{ border: "1px solid #1F2A4A", background: "#0A1124", borderRadius: 14, padding: 14, display: "grid", gap: 10 }}>
            <div style={{ fontWeight: 900 }}>Nuevo usuario</div>
            <input style={inputStyle} placeholder="Nombre de usuario" value={newUsername} onChange={(e) => setNewUsername(e.target.value)} />
            <input style={inputStyle} type="password" placeholder="Contraseña (mín. 8 caracteres)" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            <select style={selectStyle} value={newRole} onChange={(e) => setNewRole(e.target.value)}>
              {roles.map((r) => <option key={r.id} value={r.name}>{r.name.charAt(0).toUpperCase() + r.name.slice(1)}</option>)}
            </select>
            <button type="button" disabled={submitting} onClick={createUser}
              style={{ height: 48, borderRadius: 12, border: "none", background: submitting ? "#3b3b8a" : "#5C82FF", color: "#fff", fontWeight: 900, cursor: "pointer" }}>
              {submitting ? "Creando..." : "Crear usuario"}
            </button>
          </div>
        )}

        {loading ? <div style={{ color: "#6E7A98" }}>Cargando...</div> : users.map((u) => (
          <div key={u.id} style={{ border: "1px solid #1F2A4A", borderRadius: 14, background: "#121A33", padding: 14, display: "grid", gap: 10 }}>
            <div>
              <div style={{ fontWeight: 900, fontSize: 15 }}>{u.username}</div>
              <div style={{ fontSize: 12, color: u.role === "admin" ? "#5C82FF" : "#6E7A98", fontWeight: 700, marginTop: 2 }}>
                {u.role.charAt(0).toUpperCase() + u.role.slice(1)}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {u.id !== currentUser.id && (
                <select value={u.role} onChange={(e) => changeRole(u, e.target.value)}
                  style={{ height: 34, borderRadius: 8, border: "1px solid #1F2A4A", background: "#0A1124", color: "#fff", padding: "0 8px", fontSize: 13, cursor: "pointer" }}>
                  {roles.map((r) => <option key={r.id} value={r.name}>{r.name.charAt(0).toUpperCase() + r.name.slice(1)}</option>)}
                </select>
              )}
              <button type="button" onClick={() => { setChangePwdId(u.id); setChangePwdValue(""); }}
                style={{ height: 34, padding: "0 12px", borderRadius: 8, border: "1px solid #1F2A4A", background: "#0A1124", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                Cambiar clave
              </button>
              {u.id !== currentUser.id && (
                <button type="button" onClick={() => toggleActive(u)}
                  style={{ height: 34, padding: "0 12px", borderRadius: 8, border: "none", background: u.active ? "rgba(248,113,113,0.15)" : "rgba(52,211,153,0.15)", color: u.active ? "#f87171" : "#34d399", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                  {u.active ? "Desactivar" : "Activar"}
                </button>
              )}
            </div>
            {!u.active && <div style={{ fontSize: 12, color: "#f87171", fontWeight: 700 }}>● Inactivo</div>}
            {changePwdId === u.id && (
              <div style={{ display: "grid", gap: 8, borderTop: "1px solid #1F2A4A", paddingTop: 10 }}>
                <div style={{ fontWeight: 800, fontSize: 13, color: "#6E7A98" }}>NUEVA CONTRASEÑA</div>
                <input style={inputStyle} type="password" placeholder="Mínimo 8 caracteres" value={changePwdValue} onChange={(e) => setChangePwdValue(e.target.value)} />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <button type="button" onClick={() => { setChangePwdId(null); setChangePwdValue(""); }}
                    style={{ height: 40, borderRadius: 10, border: "1px solid #1F2A4A", background: "#0A1124", color: "#fff", fontWeight: 700, cursor: "pointer" }}>
                    Cancelar
                  </button>
                  <button type="button" disabled={changePwdSubmitting} onClick={submitChangePwd}
                    style={{ height: 40, borderRadius: 10, border: "none", background: changePwdSubmitting ? "#3b3b8a" : "#5C82FF", color: "#fff", fontWeight: 900, cursor: "pointer" }}>
                    {changePwdSubmitting ? "Guardando..." : "Confirmar"}
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    );
  }

  // ── Tab: Roles ─────────────────────────────────────────────────────────────
  function RolesTab() {
    const [showForm, setShowForm] = useState(false);
    const [editingRole, setEditingRole] = useState(null);
    const [formName, setFormName] = useState("");
    const [formPerms, setFormPerms] = useState([]);
    const [submitting, setSubmitting] = useState(false);

    const openCreate = () => {
      setEditingRole(null);
      setFormName("");
      setFormPerms([]);
      setShowForm(true);
    };

    const openEdit = (r) => {
      setEditingRole(r);
      setFormName(r.name);
      setFormPerms([...r.permissions]);
      setShowForm(true);
    };

    const cancelForm = () => { setShowForm(false); setEditingRole(null); };

    const togglePerm = (key) => {
      setFormPerms((prev) => prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key]);
    };

    const apiErr = async (res) => {
      const e = await res.json().catch(() => ({}));
      const d = e.detail;
      return typeof d === "string" ? d : Array.isArray(d) ? d.map((x) => x.msg).join(", ") : "Error";
    };

    const saveRole = async () => {
      if (!formName.trim()) { pushToast("Ingresá un nombre para el rol", "error"); return; }
      setSubmitting(true);
      try {
        const body = { name: formName.trim(), permissions: formPerms };
        const res = editingRole
          ? await apiFetch(`${API}/roles/${editingRole.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
          : await apiFetch(`${API}/roles`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
        if (!res.ok) throw new Error(await apiErr(res));
        pushToast(editingRole ? "Rol actualizado ✅" : "Rol creado ✅", "success");
        cancelForm();
        fetchRoles();
      } catch (e) { pushToast(e.message || "Error", "error"); }
      finally { setSubmitting(false); }
    };

    const deleteRole = async (r) => {
      try {
        const res = await apiFetch(`${API}/roles/${r.id}`, { method: "DELETE" });
        if (!res.ok) throw new Error(await apiErr(res));
        pushToast("Rol eliminado", "success");
        fetchRoles();
      } catch (e) { pushToast(e.message || "Error", "error"); }
    };

    const isAdminRole = (r) => r.name === "admin";
    const permLabel = (key) => SCREEN_OPTIONS.find((s) => s.key === key)?.label ?? key;

    return (
      <div style={{ display: "grid", gap: 12 }}>
        {!showForm && (
          <button type="button" onClick={openCreate}
            style={{ height: 44, borderRadius: 12, border: "1px solid #1F2A4A", background: "#0A1124", color: "#fff", fontWeight: 900, cursor: "pointer" }}>
            + Nuevo rol
          </button>
        )}

        {showForm && (
          <div style={{ border: "1px solid #1F2A4A", background: "#0A1124", borderRadius: 14, padding: 14, display: "grid", gap: 12 }}>
            <div style={{ fontWeight: 900 }}>{editingRole ? "Editar rol" : "Nuevo rol"}</div>
            <input
              style={{ ...inputStyle, opacity: editingRole?.is_system ? 0.5 : 1 }}
              placeholder="Nombre del rol"
              value={formName}
              disabled={editingRole?.is_system}
              onChange={(e) => setFormName(e.target.value)}
            />
            <div style={{ display: "grid", gap: 8 }}>
              <div style={{ fontSize: 13, color: "#6E7A98", fontWeight: 700 }}>PANTALLAS HABILITADAS</div>
              {SCREEN_OPTIONS.map(({ key, label }) => {
                const locked = isAdminRole(editingRole);
                const checked = locked ? true : formPerms.includes(key);
                return (
                  <label key={key} style={{ display: "flex", alignItems: "center", gap: 10, cursor: locked ? "default" : "pointer", opacity: locked ? 0.6 : 1 }}>
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={locked}
                      onChange={() => !locked && togglePerm(key)}
                      style={{ width: 18, height: 18, accentColor: "#5C82FF", cursor: locked ? "default" : "pointer" }}
                    />
                    <span style={{ fontWeight: 700, fontSize: 14 }}>{label}</span>
                  </label>
                );
              })}
              {isAdminRole(editingRole) && (
                <div style={{ fontSize: 12, color: "#6E7A98" }}>El rol admin siempre tiene acceso a todo.</div>
              )}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <button type="button" onClick={cancelForm}
                style={{ height: 44, borderRadius: 12, border: "1px solid #1F2A4A", background: "#0A1124", color: "#fff", fontWeight: 700, cursor: "pointer" }}>
                Cancelar
              </button>
              <button type="button" disabled={submitting} onClick={saveRole}
                style={{ height: 44, borderRadius: 12, border: "none", background: submitting ? "#3b3b8a" : "#5C82FF", color: "#fff", fontWeight: 900, cursor: "pointer" }}>
                {submitting ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </div>
        )}

        {roles.map((r) => (
          <div key={r.id} style={{ border: "1px solid #1F2A4A", borderRadius: 14, background: "#121A33", padding: 14, display: "grid", gap: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontWeight: 900, fontSize: 15 }}>{r.name.charAt(0).toUpperCase() + r.name.slice(1)}</span>
                  {r.is_system && <span style={{ fontSize: 11, background: "#1A2453", color: "#5C82FF", borderRadius: 6, padding: "2px 7px", fontWeight: 700 }}>sistema</span>}
                </div>
                <div style={{ fontSize: 12, color: "#6E7A98", marginTop: 4 }}>
                  {isAdminRole(r) ? "Acceso completo" : r.permissions.length === 0 ? "Sin pantallas habilitadas" : r.permissions.map(permLabel).join(", ")}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" onClick={() => openEdit(r)}
                  style={{ height: 32, padding: "0 12px", borderRadius: 8, border: "1px solid #1F2A4A", background: "#0A1124", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                  Editar
                </button>
                {!r.is_system && (
                  <button type="button" onClick={() => deleteRole(r)}
                    style={{ height: 32, padding: "0 12px", borderRadius: 8, border: "none", background: "rgba(248,113,113,0.15)", color: "#f87171", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                    Eliminar
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 12, padding: '16px 16px 0' }}>
      <div style={{ display: "flex", gap: 8 }}>
        {tabBtn("users", "Usuarios")}
        {tabBtn("roles", "Roles")}
      </div>
      {activeTab === "users" ? <UsersTab /> : <RolesTab />}
    </div>
  );
}

/** Pantalla: Login */
function LoginScreen({ onLogin }) {
  const t = themes.dark;
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const userRef = useRef(null);

  useEffect(() => {
    setTimeout(() => userRef.current?.focus(), 0);
    document.documentElement.style.background = t.page;
    document.body.style.background = t.page;
    document.body.style.margin = "0";
  }, []);

  const submit = async (e) => {
    e?.preventDefault();
    if (!username.trim() || !password) return;
    setLoading(true);
    setError("");
    try {
      const form = new URLSearchParams();
      form.append("username", username.trim());
      form.append("password", password);
      const res = await fetch(`${API}/auth/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: form.toString(),
      });
      if (res.ok) {
        const data = await res.json();
        localStorage.setItem("auth_token", data.access_token);
        onLogin(data.access_token);
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.detail || "Credenciales incorrectas");
      }
    } catch {
      setError("No se pudo conectar al servidor");
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    width: "100%", height: 48, fontSize: 15, borderRadius: 12,
    border: `1px solid ${t.borderStrong}`, background: t.surfaceSunk, color: t.text,
    padding: "0 14px", outline: "none", boxSizing: "border-box", fontFamily: "inherit",
  };

  return (
    <div style={{
      minHeight: "100dvh", background: t.page, display: "flex",
      alignItems: "center", justifyContent: "center",
      fontFamily: '"Geist", -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
      padding: "16px",
    }}>
      <form onSubmit={submit} style={{
        width: "100%", maxWidth: 360, display: "grid", gap: 16,
        border: `1px solid ${t.border}`, borderRadius: 20, padding: "clamp(16px, 5.5vw, 28px)",
        background: t.surface,
        boxShadow: "0 8px 40px rgba(0,0,0,0.4)",
      }}>
        {/* Logo + título */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: `linear-gradient(135deg, ${t.brand}, ${t.brandDeep})`,
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#fff",
          }}><CartIcon size={20} /></div>
          <div style={{ fontWeight: 700, fontSize: 20, color: t.text, letterSpacing: -0.4 }}>
            SManager
          </div>
        </div>

        <div>
          <label style={{ display: "block", marginBottom: 6, fontSize: 13, fontWeight: 600, color: t.text2 }}>
            Usuario
          </label>
          <input
            ref={userRef}
            placeholder="usuario"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            style={inputStyle}
          />
        </div>

        <div>
          <label style={{ display: "block", marginBottom: 6, fontSize: 13, fontWeight: 600, color: t.text2 }}>
            Contraseña
          </label>
          <div style={{ position: "relative" }}>
            <input
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              style={{ ...inputStyle, paddingRight: 48 }}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              style={{
                position: "absolute", right: 0, top: 0, height: 48, width: 48,
                border: "none", background: "transparent", color: t.text3,
                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 16,
              }}
              tabIndex={-1}
            >
              {showPassword ? "🙈" : "👁"}
            </button>
          </div>
        </div>

        {error && (
          <div style={{ color: t.danger, fontSize: 14, fontWeight: 600 }}>{error}</div>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{
            height: 48, borderRadius: 12, border: "none",
            background: loading ? t.surface2 : t.brand,
            color: loading ? t.text3 : "#fff",
            fontWeight: 700, fontSize: 15, cursor: loading ? "default" : "pointer",
            marginTop: 4, fontFamily: "inherit",
            boxShadow: loading ? "none" : `0 8px 20px rgba(45,91,255,0.3)`,
          }}
        >
          {loading ? "Ingresando..." : "Ingresar"}
        </button>
      </form>
    </div>
  );
}

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem("auth_token"));
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem("auth_token");
    return saved ? parseToken(saved) : null;
  });

  useEffect(() => {
    _onUnauthorized = () => { setToken(null); setCurrentUser(null); };
    return () => { _onUnauthorized = null; };
  }, []);

  const handleLogin = (newToken) => {
    setToken(newToken);
    setCurrentUser(parseToken(newToken));
  };

  const handleLogout = () => {
    localStorage.removeItem("auth_token");
    setToken(null);
    setCurrentUser(null);
  };

  if (!token || !currentUser) return <LoginScreen onLogin={handleLogin} />;

  return <AppShell onLogout={handleLogout} currentUser={currentUser} />;
}

function AppShell({ onLogout, currentUser }) {
  // Pantalla inicial: arrancamos en "sale" (Nueva venta) por el rediseño.
  // Si el usuario no tiene permiso, caemos a la primera disponible.
  const NAV_KEYS = ["sale", "products", "client", "suppliers", "users"];
  const [screen, setScreen] = useState(() => {
    if (canSee(currentUser, "sale")) return "sale";
    return NAV_KEYS.find((s) => canSee(currentUser, s)) ?? "sale";
  });

  const [clients, setClients] = useState([]);
  const [products, setProducts] = useState([]);
  const [priceLists, setPriceLists] = useState([]);
  const [toasts, setToasts] = useState([]);

  const theme = themes.dark;

  const removeToast = (id) => setToasts((prev) => prev.filter((t) => t.id !== id));
  const pushToast = (message, type = "info", ms = 2200) => {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    setToasts((prev) => [...prev, { id, message, type }]);
    window.setTimeout(() => removeToast(id), ms);
  };

  const refreshClients    = async () => { const r = await apiFetch(`${API}/clients`);     setClients(await r.json()); };
  const refreshProducts   = async () => { const r = await apiFetch(`${API}/products`);    setProducts(await r.json()); };
  const refreshPriceLists = async () => { const r = await apiFetch(`${API}/price-lists`); setPriceLists(await r.json()); };

  // Bloquear scroll horizontal (igual que antes)
  useEffect(() => {
    const prevHtml = document.documentElement.style.overflowX;
    const prevBody = document.body.style.overflowX;
    document.documentElement.style.overflowX = "hidden";
    document.body.style.overflowX = "hidden";
    return () => {
      document.documentElement.style.overflowX = prevHtml;
      document.body.style.overflowX = prevBody;
    };
  }, []);

  // Reset scroll al cambiar de pantalla
  useEffect(() => {
    try { window.scrollTo(0, 0); document.documentElement.scrollLeft = 0; document.body.scrollLeft = 0; } catch {}
  }, [screen]);

  // Si el screen actual quedó sin permiso, saltar al primero disponible.
  useEffect(() => {
    if (!canSee(currentUser, screen)) {
      const first = NAV_KEYS.find((s) => canSee(currentUser, s));
      if (first) setScreen(first);
    }
  }, [screen, currentUser]);

  // Fondo de la página acorde al tema
  useEffect(() => {
    const prevBgHtml = document.documentElement.style.background;
    const prevBgBody = document.body.style.background;
    const prevMargin = document.body.style.margin;
    document.documentElement.style.background = theme.page;
    document.body.style.background = theme.page;
    document.body.style.margin = "0";
    return () => {
      document.documentElement.style.background = prevBgHtml;
      document.body.style.background = prevBgBody;
      document.body.style.margin = prevMargin;
    };
  }, [theme.page]);

  useEffect(() => {
    refreshClients();
    refreshProducts();
    refreshPriceLists();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <ToastHost toasts={toasts} removeToast={removeToast} />
      <NewShell
        theme={theme}
        screen={screen}
        setScreen={setScreen}
        currentUser={currentUser}
        onLogout={onLogout}
      >
        {screen === "sale" ? (
          <NewSaleScreen clients={clients} products={products} pushToast={pushToast} />
        ) : screen === "client" ? (
          <ClientScreen
            clients={clients.filter(c => !c.is_supplier)} products={products} priceLists={priceLists}
            pushToast={pushToast} onClientCreated={refreshClients}
          />
        ) : screen === "suppliers" ? (
          <SuppliersScreen
            suppliers={clients.filter(c => c.is_supplier)}
            allClients={clients}
            pushToast={pushToast} onSupplierCreated={refreshClients}
          />
        ) : screen === "users" ? (
          <UsersScreen pushToast={pushToast} currentUser={currentUser} />
        ) : (
          <ProductsScreen
            products={products} priceLists={priceLists}
            pushToast={pushToast}
            onProductCreated={refreshProducts}
            onPriceListCreated={refreshPriceLists}
          />
        )}
      </NewShell>
    </>
  );
}



