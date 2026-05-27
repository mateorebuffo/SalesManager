import { useEffect, useMemo, useRef, useState } from "react";

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
function ToastHost({ toasts, removeToast }) {
  return (
    <div
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        top: "calc(env(safe-area-inset-top, 0px) + 12px)",
        zIndex: 9999,
        pointerEvents: "none",
        display: "flex",
        flexDirection: "column",
        gap: 10,
        alignItems: "center",
        padding: "0 12px",
      }}
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          style={{
            width: "min(520px, 100%)",
            borderRadius: 14,
            border: "1px solid rgba(255,255,255,0.07)",
            background: "#09091a",
            color: "#fff",
            padding: "12px 12px",
            boxShadow: "0 8px 30px rgba(0,0,0,.5)",
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            pointerEvents: "auto",
          }}
        >
          <div style={{ display: "grid", gap: 4 }}>
            <div style={{ fontWeight: 900, fontSize: 13, color: "#8888a8" }}>
              {t.type === "success" ? "OK" : t.type === "error" ? "Error" : "Info"}
            </div>
            <div style={{ fontWeight: 800 }}>{t.message}</div>
          </div>

          <button
            type="button"
            onClick={() => removeToast(t.id)}
            style={{
              height: 36,
              minWidth: 40,
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.08)",
              background: "#0f0f19",
              color: "#fff",
              fontWeight: 900,
            }}
          >
            ✕
          </button>
        </div>
      ))}
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
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 12,
            padding: 12,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 10,
            background: "#13131e",
            color: "#fff",
          }}
        >
          <div style={{ fontWeight: 800 }}>{getLabel(selected)}</div>

          <button
            type="button"
            style={{
              height: 44,
              minWidth: 110,
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.11)",
              background: "#0f0f19",
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
                border: "1px solid rgba(255,255,255,0.08)",
                background: "#13131e",
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
                  border: "1px solid rgba(255,255,255,0.08)",
                  background: "#13131e",
                  color: "#818cf8",
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
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 12,
                background: "#0f0f19",
                overflow: "hidden",
                maxHeight: 280,
                overflowY: "auto",
                maxWidth: "100%",
                boxSizing: "border-box",
              }}
            >
              {filtered.length === 0 ? (
                <div style={{ padding: 12, color: "#8888a8" }}>Sin resultados</div>
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

function NavBar({ screen, setScreen, onLogout, currentUser }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

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

  const navigate = (s) => {
    setScreen(s);
    setOpen(false);
  };

  return (
    <div ref={wrapRef} style={{ position: "relative", marginBottom: 14 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          height: 52,
          borderRadius: 14,
          border: "1px solid rgba(255,255,255,0.08)",
          background: "#13131e",
          padding: "0 16px",
          boxShadow: "0 2px 16px rgba(0,0,0,0.3)",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
          <div style={{ fontWeight: 900, fontSize: 16 }}>{SCREEN_LABELS[screen]}</div>
          {currentUser && (
            <div style={{ fontSize: 11, color: "#6366f1", fontWeight: 700 }}>
              {currentUser.username} · {currentUser.role.charAt(0).toUpperCase() + currentUser.role.slice(1)}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          style={{
            height: 38,
            width: 44,
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.11)",
            background: open ? "rgba(99,102,241,0.15)" : "#0f0f19",
            color: "#fff",
            fontWeight: 900,
            fontSize: 18,
            cursor: "pointer",
          }}
        >
          {open ? "✕" : "☰"}
        </button>
      </div>

      {open && (
        <div
          style={{
            position: "absolute",
            top: 58,
            left: 0,
            right: 0,
            zIndex: 100,
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 14,
            background: "#13131e",
            overflow: "hidden",
            boxShadow: "0 8px 32px rgba(0,0,0,0.6), 0 0 0 1px rgba(99,102,241,0.06)",
          }}
        >
          {Object.entries(SCREEN_LABELS).filter(([key]) => canSee(currentUser, key)).map(([key, label], idx, arr) => (
            <button
              key={key}
              type="button"
              onClick={() => navigate(key)}
              style={{
                width: "100%",
                textAlign: "left",
                padding: "16px 16px",
                border: "none",
                borderBottom: idx < arr.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none",
                background: screen === key ? "#1a1a28" : "transparent",
                color: "#fff",
                fontSize: 16,
                fontWeight: screen === key ? 900 : 700,
                display: "flex",
                alignItems: "center",
                gap: 12,
                cursor: "pointer",
              }}
            >
              <span style={{ fontSize: 8, opacity: screen === key ? 1 : 0 }}>●</span>
              {label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => { setOpen(false); onLogout(); }}
            style={{
              width: "100%",
              textAlign: "left",
              padding: "16px 16px",
              border: "none",
              borderTop: "1px solid rgba(255,255,255,0.07)",
              background: "transparent",
              color: "#f87171",
              fontSize: 16,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              gap: 12,
              cursor: "pointer",
            }}
          >
            <span style={{ fontSize: 8, opacity: 0 }}>●</span>
            Cerrar sesión
          </button>
        </div>
      )}
    </div>
  );
}

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

/** Pantalla: Cliente (Saldo + acciones) */
function EditSaleModal({ saleId, products, pushToast, onSaved, onClose }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saleDate, setSaleDate] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState([]);

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
        // sale_date como "YYYY-MM-DDTHH:mm" para datetime-local input
        const dt = new Date(data.sale_date);
        const pad = (n) => String(n).padStart(2, "0");
        setSaleDate(
          `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`
        );
        setNotes(data.notes || "");
        setItems(
          data.items.map((it) => ({
            product_id: it.product_id,
            name: it.product_name,
            quantity: Number(it.quantity),
            unit_price: Number(it.unit_price),
            notes: it.notes || "",
          }))
        );
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

  const submit = async (force = false) => {
    if (items.length === 0) { pushToast("Agregá al menos un producto.", "error"); return; }
    setSaving(true);
    try {
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
          // Para simplificar: guardar con force directamente tras confirmar
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
    border: "1px solid rgba(255,255,255,0.08)", background: "#13131e",
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
          width: "100%", maxWidth: 480, background: "#13131e",
          borderRadius: 18, border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 8px 40px rgba(0,0,0,0.6)", padding: 20,
          display: "grid", gap: 14, marginTop: 16,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontWeight: 900, fontSize: 17 }}>Editar venta #{saleId}</div>
          <button type="button" onClick={onClose}
            style={{ background: "transparent", border: "none", color: "#8888a8", fontSize: 22, cursor: "pointer", lineHeight: 1 }}>
            ✕
          </button>
        </div>

        {loading ? (
          <div style={{ color: "#7777a0" }}>Cargando...</div>
        ) : (
          <>
            {/* Fecha */}
            <div style={{ display: "grid", gap: 6 }}>
              <label style={{ fontSize: 13, color: "#8888a8" }}>Fecha</label>
              <input type="datetime-local" value={saleDate} onChange={(e) => setSaleDate(e.target.value)} style={inputStyle} />
            </div>

            {/* Notas */}
            <div style={{ display: "grid", gap: 6 }}>
              <label style={{ fontSize: 13, color: "#8888a8" }}>Notas (opcional)</label>
              <input placeholder="Notas de la venta" value={notes} onChange={(e) => setNotes(e.target.value)} style={inputStyle} />
            </div>

            {/* Items actuales */}
            <div style={{ display: "grid", gap: 8 }}>
              <div style={{ fontSize: 13, color: "#8888a8" }}>Productos</div>
              {items.map((it, idx) => (
                <div key={idx} style={{
                  background: "#0f0f19", borderRadius: 10, padding: "10px 12px",
                  border: "1px solid rgba(255,255,255,0.07)", display: "grid", gap: 6,
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
                      <label style={{ fontSize: 11, color: "#8888a8" }}>Cantidad</label>
                      <input
                        inputMode="decimal"
                        value={it.quantity}
                        onChange={(e) => setItems((prev) => prev.map((x, i) => i === idx ? { ...x, quantity: e.target.value } : x))}
                        style={{ ...inputStyle, height: 38, fontSize: 14 }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, color: "#8888a8" }}>Precio unit.</label>
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
              background: "#0f0f19", borderRadius: 12, padding: 12,
              border: "1px solid rgba(255,255,255,0.06)", display: "grid", gap: 8,
            }}>
              <div style={{ fontSize: 13, color: "#8888a8" }}>Agregar producto</div>
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
                  height: 42, borderRadius: 10, border: "1px solid rgba(255,255,255,0.08)",
                  background: "#1a1a2e", color: "#818cf8", fontWeight: 900, cursor: "pointer",
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
            <button type="button" disabled={saving} onClick={() => submit(false)}
              style={{
                height: 50, borderRadius: 12, border: "none",
                background: saving ? "#3b3b8a" : "#6366f1", color: "#fff",
                fontWeight: 900, fontSize: 16, cursor: saving ? "not-allowed" : "pointer",
                opacity: saving ? 0.7 : 1,
              }}>
              {saving ? "Guardando..." : "Guardar cambios"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function ClientScreen({ clients, products, priceLists, pushToast, onClientCreated }) {
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
  const [paySubmitting, setPaySubmitting] = useState(false);

  // Edición inline de pagos
  const [editPaymentId, setEditPaymentId] = useState(null);
  const [editPayAmount, setEditPayAmount] = useState("");
  const [editPayNotes, setEditPayNotes] = useState("");
  const [editPaySubmitting, setEditPaySubmitting] = useState(false);

  // Entregas
  const [showAllDeliveries, setShowAllDeliveries] = useState(false);

  // Nuevo cliente (formulario inline)
  const [showNewClient, setShowNewClient] = useState(false);
  const [ncName, setNcName] = useState("");
  const [ncPhone, setNcPhone] = useState("");
  const [ncPriceListId, setNcPriceListId] = useState("");
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
        body: JSON.stringify({ name: n, phone: ncPhone.trim() || null, price_list_id: plId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Error creando cliente");
      }
      setNcName("");
      setNcPhone("");
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
        // seguridad: solo generales en UI
        const onlyGeneral = (data || []).filter((p) => p.sale_id == null);
        setPaymentsData(onlyGeneral);
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
          payment_date: null, // ahora
          notes: payNotes?.trim() ? payNotes.trim() : null,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Error registrando pago");
      }

      setPayAmount("");
      setPayNotes("");

      // refresco saldo (statement)
      const st = await fetchStatement(selectedClient.id);
      setStatement(st);

      // refresco pagos si ya se habían cargado (o si estoy en tab pagos)
      try {
        if (clientView === "payments" || (paymentsData && paymentsData.length > 0)) {
          const p = await fetchPayments(selectedClient.id);
          const onlyGeneral = (p || []).filter((x) => x.sale_id == null);
          setPaymentsData(onlyGeneral);
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
    border: "1px solid rgba(255,255,255,0.08)",
    background: "#0f0f19",
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

  return (
    <>
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
      />

      {showNewClient && (
        <div
          style={{
            border: "1px solid rgba(255,255,255,0.05)",
            background: "#0f0f19",
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
              border: "1px solid rgba(255,255,255,0.08)",
              background: "#13131e",
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
              border: "1px solid rgba(255,255,255,0.08)",
              background: "#13131e",
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
                border: "1px solid rgba(255,255,255,0.08)",
                background: "#13131e",
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
          <button
            type="button"
            disabled={ncSubmitting}
            onClick={submitNewClient}
            style={{
              height: 52,
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.08)",
              background: ncSubmitting ? "#09091a" : "#0f0f19",
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

      {!selectedClient ? (
        <div style={{ color: "#7777a0" }}>Elegí un cliente para ver su cuenta corriente.</div>
      ) : loading ? (
        <div style={{ color: "#7777a0" }}>Cargando...</div>
      ) : error ? (
        <div style={{ color: "#f87171" }}>{error}</div>
      ) : statement ? (
        <div style={{ display: "grid", gap: 12 }}>
          {/* Resumen */}
          <div
            style={{
              border: "1px solid rgba(255,255,255,0.05)",
              background: "#0f0f19",
              borderRadius: 14,
              padding: 14,
              boxShadow: "0 2px 12px rgba(0,0,0,0.25)",
            }}
          >
            <div style={{ color: "#8888a8", fontSize: 12 }}>Saldo total</div>
            <div style={{ fontWeight: 900, fontSize: 22 }}>
              ${Number(statement.total_balance || 0).toFixed(2)}
            </div>
          </div>

          {/* Registrar pago (siempre visible) */}
          <div
            style={{
              border: "1px solid rgba(255,255,255,0.05)",
              background: "#0f0f19",
              borderRadius: 14,
              padding: 14,
              display: "grid",
              gap: 10,
              boxShadow: "0 2px 12px rgba(0,0,0,0.25)",
            }}
          >
            <div style={{ fontWeight: 900, fontSize: 13, color: "#8888a8", letterSpacing: 1, textTransform: "uppercase" }}>
              Registrar pago
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 10 }}>
              <input
                inputMode="decimal"
                placeholder="Monto"
                style={{
                  height: 48,
                  fontSize: 16,
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.08)",
                  background: "#13131e",
                  color: "#fff",
                  padding: "0 12px",
                  outline: "none",
                  boxSizing: "border-box",
                }}
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") submitGeneralPayment(); }}
              />
              <input
                placeholder="Notas (opcional)"
                style={{
                  height: 48,
                  fontSize: 16,
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.08)",
                  background: "#13131e",
                  color: "#fff",
                  padding: "0 12px",
                  outline: "none",
                  boxSizing: "border-box",
                }}
                value={payNotes}
                onChange={(e) => setPayNotes(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") submitGeneralPayment(); }}
              />
            </div>
            <button
              type="button"
              disabled={paySubmitting}
              style={{
                height: 48,
                borderRadius: 12,
                border: "none",
                background: paySubmitting ? "#3b3b8a" : "#6366f1",
                color: "#fff",
                fontWeight: 900,
                fontSize: 15,
                opacity: paySubmitting ? 0.7 : 1,
                cursor: paySubmitting ? "not-allowed" : "pointer",
              }}
              onClick={submitGeneralPayment}
            >
              {paySubmitting ? "Registrando..." : "Confirmar pago"}
            </button>
          </div>

          {/* Tabs historial */}
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 8 }}>
            <button
              type="button"
              style={{
                height: 40,
                borderRadius: 10,
                border: clientView === "deliveries" ? "1px solid #6366f1" : "1px solid rgba(255,255,255,0.08)",
                background: clientView === "deliveries" ? "rgba(99,102,241,0.15)" : "#0f0f19",
                color: clientView === "deliveries" ? "#818cf8" : "#8888a8",
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
                border: clientView === "payments" ? "1px solid #6366f1" : "1px solid rgba(255,255,255,0.08)",
                background: clientView === "payments" ? "rgba(99,102,241,0.15)" : "#0f0f19",
                color: clientView === "payments" ? "#818cf8" : "#8888a8",
                fontWeight: 900,
                fontSize: 14,
                cursor: "pointer",
              }}
              onClick={() => setClientView("payments")}
            >
              Pagos
            </button>
          </div>

          {/* ===== Entregas ===== */}
          {clientView === "deliveries" ? (
            <div
              style={{
                border: "1px solid rgba(255,255,255,0.05)",
                background: "#0f0f19",
                borderRadius: 12,
                padding: 12,
              }}
            >
              <div style={{ fontWeight: 900, marginBottom: 10 }}>Entregas</div>

              {deliveriesLoading ? (
                <div style={{ color: "#7777a0" }}>Cargando entregas...</div>
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
                              border: "1px solid rgba(255,255,255,0.08)",
                              borderRadius: 14,
                              background: "#13131e",
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
                                    border: "1px solid rgba(99,102,241,0.4)",
                                    background: "rgba(99,102,241,0.1)", color: "#818cf8",
                                    fontSize: 12, fontWeight: 800, cursor: "pointer",
                                    flexShrink: 0,
                                  }}
                                >
                                  Editar
                                </button>
                              </div>
                              <div style={{ color: "#8888a8", fontWeight: 800, textAlign: "right", flexShrink: 0, fontSize: 12 }}>
                                {formatArDate(sale.sale_date)}
                              </div>
                            </div>

                            {/* Filas (mobile-friendly) */}
                            <div style={{ padding: 12, display: "grid", gap: 10 }}>
                              {sale.rows.map((r, idx) => (
                                <div
                                  key={`${r.sale_id}-${r.product_id}-${idx}`}
                                  style={{
                                    border: "1px solid rgba(255,255,255,0.07)",
                                    borderRadius: 12,
                                    padding: 10,
                                    background: "#0f0f19",
                                    display: "grid",
                                    gap: 6,
                                  }}
                                >
                                  <div style={{ fontWeight: 900 }}>
                                    {idx + 1}) {r.product_name}
                                  </div>

                                  {r.notes ? (
                                    <div style={{ color: "#7777a0", fontSize: 12 }}>Nota: {r.notes}</div>
                                  ) : null}

                                  <div style={{ display: "flex", justifyContent: "space-between", color: "#aaaac0" }}>
                                    <span>Cant</span>
                                    <span style={{ fontWeight: 900 }}>{Number(r.quantity || 0).toFixed(2)}</span>
                                  </div>

                                  <div style={{ display: "flex", justifyContent: "space-between", color: "#aaaac0" }}>
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

                            {/* Total */}
                            <div
                              style={{
                                padding: 12,
                                borderTop: "1px solid rgba(255,255,255,0.07)",
                                display: "flex",
                                justifyContent: "space-between",
                                fontWeight: 900,
                              }}
                            >
                              <div>TOTAL</div>
                              <div>${Number(sale.total || 0).toFixed(2)}</div>
                            </div>
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
                        border: "1px solid rgba(255,255,255,0.08)",
                        background: "#0f0f19",
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

                  {/* Exportar (debajo) */}
                  <button
                    type="button"
                    onClick={() => copyToClipboard(buildDeliveriesText())}
                    style={{
                      width: "100%",
                      height: 48,
                      borderRadius: 12,
                      border: "1px solid rgba(255,255,255,0.08)",
                      background: "#0f0f19",
                      color: "#fff",
                      fontWeight: 900,
                      marginTop: 10,
                    }}
                  >
                    Exportar entregas
                  </button>
                </>
              ) : (
                <div style={{ color: "#7777a0" }}>No hay entregas registradas.</div>
              )}
            </div>
          ) : null}

          {/* ===== Pagos ===== */}
          {clientView === "payments" ? (
            <div
              style={{
                border: "1px solid rgba(255,255,255,0.05)",
                background: "#0f0f19",
                borderRadius: 12,
                padding: 12,
              }}
            >
              <div style={{ fontWeight: 900, marginBottom: 10 }}>Pagos</div>

              {paymentsLoading ? (
                <div style={{ color: "#7777a0" }}>Cargando pagos...</div>
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
                          border: "1px solid rgba(255,255,255,0.08)",
                          borderRadius: 14,
                          padding: 12,
                          background: "#13131e",
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
                                border: "1px solid rgba(99,102,241,0.4)",
                                background: editPaymentId === p.payment_id ? "rgba(99,102,241,0.25)" : "rgba(99,102,241,0.1)",
                                color: "#818cf8", fontSize: 12, fontWeight: 800, cursor: "pointer",
                                flexShrink: 0,
                              }}
                            >
                              {editPaymentId === p.payment_id ? "Cancelar" : "Editar"}
                            </button>
                          </div>
                          <div style={{ color: "#8888a8", flexShrink: 0, fontSize: 12 }}>{formatArDate(p.payment_date)}</div>
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
                                border: "1px solid rgba(255,255,255,0.08)", background: "#0f0f19",
                                color: "#fff", padding: "0 12px", outline: "none", boxSizing: "border-box",
                              }}
                            />
                            <input
                              placeholder="Notas (opcional)"
                              value={editPayNotes}
                              onChange={(e) => setEditPayNotes(e.target.value)}
                              style={{
                                height: 42, fontSize: 15, borderRadius: 10,
                                border: "1px solid rgba(255,255,255,0.08)", background: "#0f0f19",
                                color: "#fff", padding: "0 12px", outline: "none", boxSizing: "border-box",
                              }}
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
                                  setPaymentsData((pays || []).filter((x) => x.sale_id == null));
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
                                background: editPaySubmitting ? "#3b3b8a" : "#6366f1",
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
                              <div style={{ color: "#8888a8", fontSize: 13 }}>Nota: {p.notes}</div>
                            ) : null}
                          </>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Botón export debajo de la lista */}
                  <button
                    type="button"
                    onClick={() => copyToClipboard(buildPaymentsText())}
                    style={exportBtnStyle}
                  >
                    Exportar pagos
                  </button>
                </>
              ) : (
                <div style={{ color: "#7777a0" }}>No hay pagos registrados.</div>
              )}
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

/** Pantalla: Nueva venta (POS) */
function NewSaleScreen({ clients, products, pushToast }) {
  const [clientQuery, setClientQuery] = useState("");
  const [selectedClient, setSelectedClient] = useState(null);

  const [productQuery, setProductQuery] = useState("");
  const [selectedProductObj, setSelectedProductObj] = useState(null);

  const [items, setItems] = useState([]);

  const [quantity, setQuantity] = useState("");
  const [price, setPrice] = useState("");
  const [itemNotes, setItemNotes] = useState("");
  const [payment, setPayment] = useState("");
  const [saleNotes, setSaleNotes] = useState("");
  const [clientBalance, setClientBalance] = useState(null);
  const [stockWarning, setStockWarning] = useState(null);
  const [forceNote, setForceNote] = useState("");

  const clientRef = useRef(null);
  const productRef = useRef(null);
  const qtyRef = useRef(null);
  const priceRef = useRef(null);
  const paymentRef = useRef(null);

  useEffect(() => {
    setTimeout(() => clientRef.current?.focus(), 0);
  }, []);

  useEffect(() => {
    if (!selectedClient) { setClientBalance(null); return; }
    apiFetch(`${API}/clients/${selectedClient.id}/statement`)
      .then((r) => r.json())
      .then((data) => setClientBalance(data.total_balance))
      .catch(() => setClientBalance(null));
  }, [selectedClient]);

  const total = useMemo(() => {
    return items.reduce((acc, it) => acc + it.quantity * it.unit_price, 0);
  }, [items]);

  const addItem = () => {
    if (!selectedProductObj || !quantity || !price) return;

    const q = Number(quantity);
    const p = Number(price);
    if (!Number.isFinite(q) || q <= 0) return;
    if (!Number.isFinite(p) || p < 0) return;

    setItems((prev) => [
      ...prev,
      {
        product_id: selectedProductObj.id,
        name: selectedProductObj.name,
        quantity: q,
        unit_price: p,
        notes: itemNotes.trim() || null,
      },
    ]);

    setSelectedProductObj(null);
    setProductQuery("");
    setQuantity("");
    setPrice("");
    setItemNotes("");

    setTimeout(() => productRef.current?.focus(), 0);
  };

  const removeItem = (index) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const submitSale = async (force = false) => {
    if (!selectedClient) {
      pushToast("Seleccioná un cliente.", "error");
      return;
    }
    if (items.length === 0) {
      pushToast("Agregá al menos un producto.", "error");
      return;
    }

    let notesValue = saleNotes.trim() || null;
    if (force) {
      const stockNote = forceNote.trim() ? `[Stock externo: ${forceNote.trim()}]` : "[Stock externo]";
      notesValue = notesValue ? `${notesValue} | ${stockNote}` : stockNote;
    }

    const body = {
      client_id: selectedClient.id,
      sale_date: new Date().toISOString(),
      notes: notesValue,
      items: items.map((i) => ({
        product_id: i.product_id,
        quantity: i.quantity,
        unit_price: i.unit_price,
        notes: i.notes || null,
      })),
      initial_payment_amount: payment ? Number(payment) : 0,
    };

    const url = force ? `${API}/sales?force=true` : `${API}/sales`;
    const res = await apiFetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.status === 409) {
      const err = await res.json().catch(() => ({}));
      if (err.detail?.code === "STOCK_INSUFFICIENT") {
        setStockWarning(err.detail);
        setForceNote("");
        return;
      }
    }

    if (res.ok) {
      setItems([]);
      setPayment("");
      setSaleNotes("");
      setSelectedProductObj(null);
      setProductQuery("");
      setQuantity("");
      setPrice("");
      setItemNotes("");
      setSelectedClient(null);
      setClientQuery("");
      setClientBalance(null);
      setStockWarning(null);

      pushToast("Venta creada ✅", "success");
      setTimeout(() => clientRef.current?.focus(), 0);
    } else {
      const err = await res.json().catch(() => ({}));
      pushToast(err.detail || "Error al crear venta", "error");
    }
  };

  return (
    <>
      {stockWarning && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.75)",
            zIndex: 200,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            paddingTop: "calc(env(safe-area-inset-top, 0px) + 16px)",
            paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)",
            paddingLeft: "calc(env(safe-area-inset-left, 0px) + 16px)",
            paddingRight: "calc(env(safe-area-inset-right, 0px) + 16px)",
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 480,
              background: "#13131e",
              borderRadius: 16,
              border: "1px solid rgba(255,255,255,0.08)",
              padding: 20,
              display: "grid",
              gap: 14,
            }}
          >
            <div style={{ fontWeight: 900, fontSize: 16, color: "#fbbf24" }}>
              Stock insuficiente
            </div>
            <div style={{ display: "grid", gap: 8 }}>
              {stockWarning.items.map((it) => (
                <div
                  key={it.product_id}
                  style={{
                    border: "1px solid rgba(255,255,255,0.07)",
                    borderRadius: 10,
                    padding: "10px 12px",
                    background: "#0f0f19",
                    fontSize: 14,
                  }}
                >
                  <div style={{ fontWeight: 900, marginBottom: 4 }}>{it.product_name}</div>
                  <div style={{ color: "#8888a8", display: "flex", gap: 16, flexWrap: "wrap" }}>
                    <span>Pedido: <b style={{ color: "#fff" }}>{it.requested}</b></span>
                    <span>Disponible: <b style={{ color: it.available >= 0 ? "#34d399" : "#f87171" }}>{it.available}</b></span>
                    <span>Faltan: <b style={{ color: "#f87171" }}>{it.missing}</b></span>
                  </div>
                </div>
              ))}
            </div>
            <input
              placeholder="¿De dónde se obtiene el stock? (opcional)"
              value={forceNote}
              onChange={(e) => setForceNote(e.target.value)}
              style={{
                width: "100%",
                height: 44,
                fontSize: 15,
                borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.08)",
                background: "#0f0f19",
                color: "#fff",
                padding: "0 12px",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
            <div style={{ display: "flex", gap: 10 }}>
              <button
                type="button"
                onClick={() => setStockWarning(null)}
                style={{
                  flex: 1,
                  height: 44,
                  borderRadius: 10,
                  border: "1px solid rgba(255,255,255,0.11)",
                  background: "#0f0f19",
                  color: "#fff",
                  fontWeight: 800,
                  fontSize: 14,
                  cursor: "pointer",
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => { setStockWarning(null); submitSale(true); }}
                style={{
                  flex: 2,
                  height: 44,
                  borderRadius: 10,
                  border: "none",
                  background: "#6366f1",
                  color: "#fff",
                  fontWeight: 900,
                  fontSize: 14,
                  cursor: "pointer",
                }}
              >
                Confirmar igual
              </button>
            </div>
          </div>
        </div>
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
        setSelected={(c) => setSelectedClient(c ? { id: c.id, name: c.name, price_list_id: c.price_list_id } : null)}
      />

      {selectedClient && clientBalance !== null && (
        <div
          style={{
            border: "1px solid rgba(255,255,255,0.05)",
            background: "#0f0f19",
            borderRadius: 12,
            padding: "10px 14px",
            marginBottom: 10,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span style={{ color: "#8888a8", fontSize: 13 }}>Saldo actual del cliente</span>
          <span style={{ fontWeight: 900, fontSize: 15, color: Number(clientBalance) > 0 ? "#f87171" : "#34d399" }}>
            ${Number(clientBalance).toFixed(2)}
          </span>
        </div>
      )}

      <div style={{ borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: 14, marginTop: 6 }}>
        <h3 style={{ margin: "0 0 10px 0" }}>Agregar ítem</h3>

        <SearchDropdown
          inputRef={productRef}
          label="Producto"
          placeholder="Buscar producto..."
          items={products}
          getKey={(p) => p.id}
          getLabel={(p) => p.name}
          query={productQuery}
          setQuery={setProductQuery}
          selected={selectedProductObj}
          setSelected={(p) => {
            setSelectedProductObj(p || null);
            if (p) {
              const prices = p.prices || [];
              let match = prices.find((pr) => pr.price_list_id === selectedClient?.price_list_id);
              if (!match) {
                match = prices.find((pr) => pr.price_list_name?.toLowerCase() === "general");
              }
              if (match) setPrice(String(match.price));
              setTimeout(() => qtyRef.current?.focus(), 0);
            }
          }}
        />

        <input
          ref={qtyRef}
          inputMode="decimal"
          placeholder="Cantidad"
          style={{
            width: "100%",
            height: 48,
            fontSize: 16,
            marginBottom: 10,
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.08)",
            background: "#13131e",
            color: "#fff",
            padding: "0 12px",
            outline: "none",
            boxSizing: "border-box",
          }}
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              priceRef.current?.focus();
            }
          }}
        />

        <input
          ref={priceRef}
          inputMode="decimal"
          placeholder="Precio unitario"
          style={{
            width: "100%",
            height: 48,
            fontSize: 16,
            marginBottom: 10,
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.08)",
            background: "#13131e",
            color: "#fff",
            padding: "0 12px",
            outline: "none",
            boxSizing: "border-box",
          }}
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addItem();
            }
          }}
        />

        <input
          placeholder="Nota del ítem (opcional)"
          style={{
            width: "100%",
            height: 48,
            fontSize: 16,
            marginBottom: 10,
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.08)",
            background: "#13131e",
            color: "#fff",
            padding: "0 12px",
            outline: "none",
            boxSizing: "border-box",
          }}
          value={itemNotes}
          onChange={(e) => setItemNotes(e.target.value)}
        />

        <button
          style={{
            width: "100%",
            height: 52,
            fontSize: 16,
            fontWeight: 800,
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.08)",
            background: "#0f0f19",
            color: "#fff",
            boxSizing: "border-box",
          }}
          onClick={addItem}
        >
          + Agregar ítem
        </button>
      </div>

      <div style={{ marginTop: 16 }}>
        <h3 style={{ margin: "0 0 8px 0" }}>Items</h3>

        {items.length === 0 ? (
          <div style={{ color: "#7777a0" }}>Todavía no hay items.</div>
        ) : (
          <div
            style={{
              maxHeight: "38vh",
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: 10,
              border: "1px solid rgba(255,255,255,0.05)",
              borderRadius: 14,
              padding: 10,
              background: "#0f0f19",
              boxSizing: "border-box",
              boxShadow: "0 2px 12px rgba(0,0,0,0.25)",
            }}
          >
            {items.map((it, idx) => (
              <div
                key={idx}
                style={{
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 12,
                  padding: 12,
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 10,
                  background: "#13131e",
                  boxSizing: "border-box",
                }}
              >
                <div>
                  <div style={{ fontWeight: 800 }}>{it.name}</div>
                  <div style={{ color: "#8888a8" }}>
                    {it.quantity} × {it.unit_price} = ${(it.quantity * it.unit_price).toFixed(2)}
                  </div>
                  {it.notes && (
                    <div style={{ color: "#666688", fontSize: 12, marginTop: 2 }}>{it.notes}</div>
                  )}
                </div>

                <button
                  style={{
                    height: 40,
                    minWidth: 90,
                    borderRadius: 12,
                    border: "1px solid rgba(255,255,255,0.11)",
                    background: "#0f0f19",
                    color: "#fff",
                    fontWeight: 800,
                  }}
                  onClick={() => removeItem(idx)}
                >
                  Eliminar
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Barra inferior fija */}
      <div
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          background: "#09091a",
          borderTop: "1px solid rgba(255,255,255,0.05)",
          paddingTop: 12,
          paddingLeft: "calc(env(safe-area-inset-left, 0px) + 12px)",
          paddingRight: "calc(env(safe-area-inset-right, 0px) + 12px)",
          paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)",
          width: "100%",
          boxSizing: "border-box",
          overflowX: "hidden",
        }}
      >
        <div style={{ maxWidth: 520, margin: "0 auto", display: "grid", gap: 10, color: "#fff" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 900 }}>
            <span>Total</span>
            <span>${total.toFixed(2)}</span>
          </div>

          <input
            placeholder="Nota de la venta (opcional)"
            style={{
              width: "100%",
              height: 44,
              fontSize: 15,
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.08)",
              background: "#13131e",
              color: "#fff",
              padding: "0 12px",
              outline: "none",
              boxSizing: "border-box",
            }}
            value={saleNotes}
            onChange={(e) => setSaleNotes(e.target.value)}
          />

          <input
            ref={paymentRef}
            inputMode="decimal"
            placeholder="Pago inicial (opcional)"
            style={{
              width: "100%",
              height: 48,
              fontSize: 16,
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.08)",
              background: "#13131e",
              color: "#fff",
              padding: "0 12px",
              outline: "none",
              boxSizing: "border-box",
            }}
            value={payment}
            onChange={(e) => setPayment(e.target.value)}
          />

          <button
            style={{
              width: "100%",
              height: 54,
              fontSize: 16,
              fontWeight: 900,
              background: "#6366f1",
              color: "#fff",
              borderRadius: 12,
              border: "none",
              boxSizing: "border-box",
            }}
            onClick={submitSale}
          >
            CONFIRMAR VENTA
          </button>
        </div>
      </div>
    </>
  );
}

/** Pantalla: Productos */
function ProductsScreen({ products, priceLists, pushToast, onProductCreated, onPriceListCreated }) {
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
    border: "1px solid rgba(255,255,255,0.08)",
    background: "#13131e",
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
        <div style={{ fontWeight: 800, fontSize: 13, color: "#8888a8" }}>Precios de venta por lista</div>
        {priceLists.map((pl) => (
          <div key={pl.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <label style={{ flex: "0 0 140px", color: "#aaaac0", fontSize: 14, fontWeight: 700 }}>
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

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {showForm && (
        <div
          style={{
            border: "1px solid rgba(255,255,255,0.05)",
            background: "#0f0f19",
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
              style={{ width: 18, height: 18, accentColor: "#6366f1", cursor: "pointer" }}
            />
            <span style={{ color: "#aaaac0", fontSize: 14 }}>Es un servicio (no controla stock)</span>
          </label>
          {priceListsSection(priceInputs, setPriceInputs)}
          <button
            type="button"
            disabled={submitting}
            onClick={submit}
            style={{
              height: 52,
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.08)",
              background: submitting ? "#09091a" : "#0f0f19",
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
            border: "1px solid rgba(255,255,255,0.08)",
            background: "#13131e",
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
            border: "1px solid rgba(255,255,255,0.08)",
            background: showForm ? "rgba(99,102,241,0.2)" : "#13131e",
            color: showForm ? "#f87171" : "#818cf8",
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
          <div style={{ color: "#7777a0" }}>
            {products.length === 0
              ? "No hay productos. Creá uno con el botón +."
              : "Sin resultados para esa búsqueda."}
          </div>
        ) : (
          filtered.map((p) => (
            <div
              key={p.id}
              style={{
                border: "1px solid rgba(255,255,255,0.05)",
                background: "#0f0f19",
                borderRadius: 14,
                padding: 14,
                display: "grid",
                gap: 8,
                boxShadow: "0 2px 12px rgba(0,0,0,0.25)",
              }}
            >
              {editingId === p.id ? (
                <>
                  <div style={{ fontWeight: 900, fontSize: 13, color: "#8888a8" }}>Editando producto</div>
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
                      style={{ width: 18, height: 18, accentColor: "#6366f1", cursor: "pointer" }}
                    />
                    <span style={{ color: "#aaaac0", fontSize: 14 }}>Activo</span>
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", userSelect: "none" }}>
                    <input
                      type="checkbox"
                      checked={editIsService}
                      onChange={(e) => setEditIsService(e.target.checked)}
                      style={{ width: 18, height: 18, accentColor: "#6366f1", cursor: "pointer" }}
                    />
                    <span style={{ color: "#aaaac0", fontSize: 14 }}>Es un servicio (no controla stock)</span>
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
                        border: "1px solid rgba(255,255,255,0.08)",
                        background: editSubmitting ? "#09091a" : "#0f0f19",
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
                        border: "1px solid rgba(255,255,255,0.08)",
                        background: "#0f0f19",
                        color: "#7777a0",
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
                      <div style={{ color: "#666688", fontSize: 13 }}>{p.type}</div>
                      <button
                        type="button"
                        onClick={() => { setShowForm(false); startEdit(p); }}
                        style={{
                          height: 34,
                          padding: "0 12px",
                          borderRadius: 10,
                          border: "1px solid rgba(255,255,255,0.11)",
                          background: "#0f0f19",
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
                    <div style={{ display: "flex", justifyContent: "space-between", color: "#aaaac0", fontSize: 14 }}>
                      <span>Precio costo</span>
                      <span style={{ fontWeight: 800 }}>${Number(p.cost_price).toFixed(2)}</span>
                    </div>
                  )}

                  {p.prices && p.prices.length > 0 && (
                    <div style={{ display: "grid", gap: 4, borderTop: "1px solid rgba(255,255,255,0.07)", paddingTop: 8 }}>
                      <div style={{ color: "#55556a", fontSize: 12 }}>Precios de venta</div>
                      {p.prices.map((pr) => (
                        <div
                          key={pr.price_list_id}
                          style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}
                        >
                          <span style={{ color: "#8888a8" }}>{pr.price_list_name}</span>
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
          border: "1px solid rgba(255,255,255,0.05)",
          background: "#0f0f19",
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
              border: "1px solid rgba(255,255,255,0.11)",
              background: showPlForm ? "#13131e" : "#0f0f19",
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
                  border: "1px solid rgba(255,255,255,0.08)",
                  background: "#13131e",
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
                border: "1px solid rgba(255,255,255,0.08)",
                background: "#13131e",
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
                border: "1px solid rgba(255,255,255,0.08)",
                background: plSubmitting ? "#09091a" : "#0f0f19",
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
    border: "1px solid rgba(255,255,255,0.08)", background: "#13131e", color: "#fff",
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
    <div style={{ display: "grid", gap: 12 }}>
      {/* Tabs */}
      <div style={{ display: "flex", gap: 8 }}>
        {[["current", "Stock actual"], ["entries", "Ingresos"]].map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            style={{
              flex: 1, height: 40, borderRadius: 10, border: "1px solid rgba(255,255,255,0.08)",
              background: tab === key ? "#6366f1" : "#13131e",
              color: tab === key ? "#fff" : "#8888a8",
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
            height: 44, borderRadius: 10, border: "1px solid rgba(255,255,255,0.11)",
            background: "#13131e", color: "#fff", fontWeight: 800, fontSize: 15, cursor: "pointer",
          }}
        >
          + Nuevo ingreso
        </button>
      )}

      {/* Formulario crear/editar */}
      {showForm && (
        <div style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 16, background: "#0f0f19", display: "grid", gap: 12, boxShadow: "0 2px 16px rgba(0,0,0,0.3)" }}>
          <div style={{ fontWeight: 900, fontSize: 15 }}>
            {editingEntry ? "Editar ingreso" : "Nuevo ingreso de stock"}
          </div>

          <div>
            <label style={{ display: "block", marginBottom: 6, fontSize: 13, color: "#8888a8" }}>Fecha</label>
            <input
              type="datetime-local"
              value={formDate}
              onChange={(e) => setFormDate(e.target.value)}
              style={inputStyle}
            />
          </div>

          <div>
            <label style={{ display: "block", marginBottom: 6, fontSize: 13, color: "#8888a8" }}>Nota (opcional)</label>
            <input
              placeholder="Nota del ingreso..."
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
              style={inputStyle}
            />
          </div>

          {/* Agregar ítem al formulario */}
          <div style={{ border: "1px solid rgba(255,255,255,0.05)", borderRadius: 10, padding: 12, display: "grid", gap: 8 }}>
            <div style={{ fontSize: 13, color: "#8888a8", fontWeight: 700 }}>Agregar producto</div>
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
                height: 40, borderRadius: 10, border: "1px solid rgba(255,255,255,0.11)",
                background: "#13131e", color: "#fff", fontWeight: 800, cursor: "pointer",
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
                    border: "1px solid rgba(255,255,255,0.05)", borderRadius: 8, padding: "8px 12px", background: "#0f0f19",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 14 }}>{it.product_name}</div>
                    <div style={{ color: "#8888a8", fontSize: 13 }}>{fmtQty(it.quantity)} u.</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeFormItem(idx)}
                    style={{
                      height: 32, width: 36, borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)",
                      background: "#0f0f19", color: "#f87171", fontWeight: 900, cursor: "pointer",
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
                flex: 1, height: 44, borderRadius: 10, border: "1px solid rgba(255,255,255,0.11)",
                background: "#0f0f19", color: "#fff", fontWeight: 800, cursor: "pointer",
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
                background: "#6366f1", color: "#fff", fontWeight: 900, cursor: "pointer",
              }}
            >
              {formSubmitting ? "Guardando..." : (editingEntry ? "Actualizar" : "Guardar ingreso")}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ color: "#7777a0" }}>Cargando...</div>
      ) : tab === "current" ? (
        currentStock.length === 0 ? (
          <div style={{ color: "#7777a0" }}>Sin datos de stock. Cargá un ingreso primero.</div>
        ) : (
          currentStock.map((s) => (
            <div
              key={s.product_id}
              style={{
                border: "1px solid rgba(255,255,255,0.05)", background: "#0f0f19", borderRadius: 14, padding: 14, display: "grid", gap: 6, boxShadow: "0 2px 12px rgba(0,0,0,0.25)",
              }}
            >
              <div style={{ fontWeight: 900, fontSize: 15 }}>{s.product_name}</div>
              <div style={{ fontSize: 12, color: "#666688" }}>{s.product_type}</div>
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 14, color: "#aaaac0", marginTop: 4 }}>
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
          ))
        )
      ) : (
        entries.length === 0 ? (
          <div style={{ color: "#7777a0" }}>No hay ingresos de stock.</div>
        ) : (
          entries.map((e) => (
            <div
              key={e.id}
              style={{ border: "1px solid rgba(255,255,255,0.05)", background: "#0f0f19", borderRadius: 14, overflow: "hidden", boxShadow: "0 2px 12px rgba(0,0,0,0.25)" }}
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
                  {e.notes && <div style={{ fontSize: 12, color: "#666688", marginTop: 2 }}>{e.notes}</div>}
                  <div style={{ fontSize: 12, color: "#55556a", marginTop: 2 }}>{e.items.length} producto{e.items.length !== 1 ? "s" : ""}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button
                    type="button"
                    onClick={(ev) => { ev.stopPropagation(); openEditForm(e); setTab("entries"); }}
                    style={{
                      height: 32, padding: "0 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)",
                      background: "#13131e", color: "#fff", fontWeight: 800, fontSize: 12, cursor: "pointer",
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
                    <div key={it.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 14, color: "#aaaac0" }}>
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
    <div style={{ display: "grid", gap: 12 }}>
      <input
        placeholder="Buscar por cliente..."
        style={{
          width: "100%",
          height: 48,
          fontSize: 16,
          borderRadius: 12,
          border: "1px solid rgba(255,255,255,0.08)",
          background: "#13131e",
          color: "#fff",
          padding: "0 12px",
          outline: "none",
          boxSizing: "border-box",
        }}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {loading ? (
        <div style={{ color: "#7777a0" }}>Cargando...</div>
      ) : error ? (
        <div style={{ color: "#f87171" }}>{error}</div>
      ) : filtered.length === 0 ? (
        <div style={{ color: "#7777a0" }}>
          {debtors.length === 0 ? "No hay deudores. Todos los clientes están al día." : "Sin resultados."}
        </div>
      ) : (
        filtered.map((d) => (
          <div
            key={d.client_id}
            style={{
              border: "1px solid rgba(255,255,255,0.05)",
              background: "#0f0f19",
              borderRadius: 14,
              padding: 14,
              display: "grid",
              gap: 6,
              boxShadow: "0 2px 12px rgba(0,0,0,0.25)",
            }}
          >
            <div style={{ fontWeight: 900, fontSize: 16 }}>{d.client_name}</div>
            <div style={{ display: "flex", justifyContent: "space-between", color: "#aaaac0", fontSize: 14 }}>
              <span>Entregado</span>
              <span style={{ fontWeight: 800 }}>${fmt(d.total_delivered)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", color: "#aaaac0", fontSize: 14 }}>
              <span>Pagado</span>
              <span style={{ fontWeight: 800 }}>${fmt(d.total_paid)}</span>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontWeight: 900,
                borderTop: "1px solid rgba(255,255,255,0.07)",
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

const SCREEN_OPTIONS = [
  { key: "sale",    label: "Nueva venta" },
  { key: "client",  label: "Cliente" },
  { key: "debtors", label: "Deudores" },
  { key: "products",label: "Productos" },
  { key: "stock",   label: "Stock" },
];

/** Pantalla: Usuarios (solo admin) */
function UsersScreen({ pushToast, currentUser }) {
  const [activeTab, setActiveTab] = useState("users");
  const [roles, setRoles] = useState([]);

  const inputStyle = {
    height: 48, fontSize: 15, borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.08)", background: "#13131e",
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
        border: activeTab === key ? "1px solid #6366f1" : "1px solid rgba(255,255,255,0.08)",
        background: activeTab === key ? "rgba(99,102,241,0.15)" : "#0f0f19",
        color: activeTab === key ? "#818cf8" : "#8888a8",
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
          style={{ height: 44, borderRadius: 12, border: "1px solid rgba(255,255,255,0.08)", background: showForm ? "#1a1a28" : "#0f0f19", color: "#fff", fontWeight: 900, cursor: "pointer" }}>
          {showForm ? "Cancelar" : "+ Nuevo usuario"}
        </button>

        {showForm && (
          <div style={{ border: "1px solid rgba(255,255,255,0.05)", background: "#0f0f19", borderRadius: 14, padding: 14, display: "grid", gap: 10 }}>
            <div style={{ fontWeight: 900 }}>Nuevo usuario</div>
            <input style={inputStyle} placeholder="Nombre de usuario" value={newUsername} onChange={(e) => setNewUsername(e.target.value)} />
            <input style={inputStyle} type="password" placeholder="Contraseña (mín. 8 caracteres)" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            <select style={selectStyle} value={newRole} onChange={(e) => setNewRole(e.target.value)}>
              {roles.map((r) => <option key={r.id} value={r.name}>{r.name.charAt(0).toUpperCase() + r.name.slice(1)}</option>)}
            </select>
            <button type="button" disabled={submitting} onClick={createUser}
              style={{ height: 48, borderRadius: 12, border: "none", background: submitting ? "#3b3b8a" : "#6366f1", color: "#fff", fontWeight: 900, cursor: "pointer" }}>
              {submitting ? "Creando..." : "Crear usuario"}
            </button>
          </div>
        )}

        {loading ? <div style={{ color: "#7777a0" }}>Cargando...</div> : users.map((u) => (
          <div key={u.id} style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, background: "#13131e", padding: 14, display: "grid", gap: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontWeight: 900, fontSize: 15 }}>{u.username}</div>
                <div style={{ fontSize: 12, color: u.role === "admin" ? "#6366f1" : "#8888a8", fontWeight: 700, marginTop: 2 }}>
                  {u.role.charAt(0).toUpperCase() + u.role.slice(1)}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {u.id !== currentUser.id && (
                  <select value={u.role} onChange={(e) => changeRole(u, e.target.value)}
                    style={{ height: 34, borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)", background: "#0f0f19", color: "#fff", padding: "0 8px", fontSize: 13, cursor: "pointer" }}>
                    {roles.map((r) => <option key={r.id} value={r.name}>{r.name.charAt(0).toUpperCase() + r.name.slice(1)}</option>)}
                  </select>
                )}
                <button type="button" onClick={() => { setChangePwdId(u.id); setChangePwdValue(""); }}
                  style={{ height: 34, padding: "0 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)", background: "#0f0f19", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                  Cambiar clave
                </button>
                {u.id !== currentUser.id && (
                  <button type="button" onClick={() => toggleActive(u)}
                    style={{ height: 34, padding: "0 12px", borderRadius: 8, border: "none", background: u.active ? "rgba(248,113,113,0.15)" : "rgba(52,211,153,0.15)", color: u.active ? "#f87171" : "#34d399", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                    {u.active ? "Desactivar" : "Activar"}
                  </button>
                )}
              </div>
            </div>
            {!u.active && <div style={{ fontSize: 12, color: "#f87171", fontWeight: 700 }}>● Inactivo</div>}
            {changePwdId === u.id && (
              <div style={{ display: "grid", gap: 8, borderTop: "1px solid rgba(255,255,255,0.07)", paddingTop: 10 }}>
                <div style={{ fontWeight: 800, fontSize: 13, color: "#8888a8" }}>NUEVA CONTRASEÑA</div>
                <input style={inputStyle} type="password" placeholder="Mínimo 8 caracteres" value={changePwdValue} onChange={(e) => setChangePwdValue(e.target.value)} />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <button type="button" onClick={() => { setChangePwdId(null); setChangePwdValue(""); }}
                    style={{ height: 40, borderRadius: 10, border: "1px solid rgba(255,255,255,0.08)", background: "#0f0f19", color: "#fff", fontWeight: 700, cursor: "pointer" }}>
                    Cancelar
                  </button>
                  <button type="button" disabled={changePwdSubmitting} onClick={submitChangePwd}
                    style={{ height: 40, borderRadius: 10, border: "none", background: changePwdSubmitting ? "#3b3b8a" : "#6366f1", color: "#fff", fontWeight: 900, cursor: "pointer" }}>
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
            style={{ height: 44, borderRadius: 12, border: "1px solid rgba(255,255,255,0.08)", background: "#0f0f19", color: "#fff", fontWeight: 900, cursor: "pointer" }}>
            + Nuevo rol
          </button>
        )}

        {showForm && (
          <div style={{ border: "1px solid rgba(255,255,255,0.05)", background: "#0f0f19", borderRadius: 14, padding: 14, display: "grid", gap: 12 }}>
            <div style={{ fontWeight: 900 }}>{editingRole ? "Editar rol" : "Nuevo rol"}</div>
            <input
              style={{ ...inputStyle, opacity: editingRole?.is_system ? 0.5 : 1 }}
              placeholder="Nombre del rol"
              value={formName}
              disabled={editingRole?.is_system}
              onChange={(e) => setFormName(e.target.value)}
            />
            <div style={{ display: "grid", gap: 8 }}>
              <div style={{ fontSize: 13, color: "#8888a8", fontWeight: 700 }}>PANTALLAS HABILITADAS</div>
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
                      style={{ width: 18, height: 18, accentColor: "#6366f1", cursor: locked ? "default" : "pointer" }}
                    />
                    <span style={{ fontWeight: 700, fontSize: 14 }}>{label}</span>
                  </label>
                );
              })}
              {isAdminRole(editingRole) && (
                <div style={{ fontSize: 12, color: "#8888a8" }}>El rol admin siempre tiene acceso a todo.</div>
              )}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <button type="button" onClick={cancelForm}
                style={{ height: 44, borderRadius: 12, border: "1px solid rgba(255,255,255,0.08)", background: "#0f0f19", color: "#fff", fontWeight: 700, cursor: "pointer" }}>
                Cancelar
              </button>
              <button type="button" disabled={submitting} onClick={saveRole}
                style={{ height: 44, borderRadius: 12, border: "none", background: submitting ? "#3b3b8a" : "#6366f1", color: "#fff", fontWeight: 900, cursor: "pointer" }}>
                {submitting ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </div>
        )}

        {roles.map((r) => (
          <div key={r.id} style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, background: "#13131e", padding: 14, display: "grid", gap: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontWeight: 900, fontSize: 15 }}>{r.name.charAt(0).toUpperCase() + r.name.slice(1)}</span>
                  {r.is_system && <span style={{ fontSize: 11, background: "rgba(99,102,241,0.15)", color: "#818cf8", borderRadius: 6, padding: "2px 7px", fontWeight: 700 }}>sistema</span>}
                </div>
                <div style={{ fontSize: 12, color: "#7777a0", marginTop: 4 }}>
                  {isAdminRole(r) ? "Acceso completo" : r.permissions.length === 0 ? "Sin pantallas habilitadas" : r.permissions.map(permLabel).join(", ")}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" onClick={() => openEdit(r)}
                  style={{ height: 32, padding: "0 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)", background: "#0f0f19", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
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
    <div style={{ display: "grid", gap: 12 }}>
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
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const userRef = useRef(null);

  useEffect(() => {
    setTimeout(() => userRef.current?.focus(), 0);
    document.documentElement.style.background = "#0c0c14";
    document.body.style.background = "#0c0c14";
    document.body.style.margin = "0";
  }, []);

  const submit = async (e) => {
    e?.preventDefault();
    if (!username.trim() || !password) return;
    setLoading(true);
    setError("");
    try {
      // El estándar OAuth2 exige form data (no JSON) en el endpoint de token
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
    width: "100%", height: 48, fontSize: 16, borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.08)", background: "#13131e", color: "#fff",
    padding: "0 14px", outline: "none", boxSizing: "border-box",
  };

  return (
    <div
      style={{
        minHeight: "100dvh", background: "#0c0c14", display: "flex",
        alignItems: "center", justifyContent: "center",
        paddingTop: "calc(env(safe-area-inset-top, 0px) + 16px)",
        paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)",
        paddingLeft: "calc(env(safe-area-inset-left, 0px) + 16px)",
        paddingRight: "calc(env(safe-area-inset-right, 0px) + 16px)",
      }}
    >
      <form
        onSubmit={submit}
        style={{
          width: "100%", maxWidth: 360, display: "grid", gap: 14,
          border: "1px solid rgba(99,102,241,0.25)", borderRadius: 18, padding: 24, background: "#13131e",
          boxShadow: "0 0 40px rgba(99,102,241,0.08), 0 8px 32px rgba(0,0,0,0.5)",
          fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
        }}
      >
        <div style={{ fontWeight: 900, fontSize: 20, marginBottom: 4 }}>
          Sistema de Ventas
        </div>

        <div>
          <label style={{ display: "block", marginBottom: 6, fontSize: 13, color: "#8888a8" }}>
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
          <label style={{ display: "block", marginBottom: 6, fontSize: 13, color: "#8888a8" }}>
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
                position: "absolute",
                right: 0,
                top: 0,
                height: 48,
                width: 48,
                border: "none",
                background: "transparent",
                color: "#8888a8",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 16,
              }}
              tabIndex={-1}
            >
              {showPassword ? "🙈" : "👁"}
            </button>
          </div>
        </div>

        {error && (
          <div style={{ color: "#f87171", fontSize: 14, fontWeight: 700 }}>{error}</div>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{
            height: 48, borderRadius: 12, border: "none",
            background: loading ? "#1a1a28" : "#6366f1", color: loading ? "#55556a" : "#fff",
            fontWeight: 900, fontSize: 16, cursor: loading ? "default" : "pointer", marginTop: 4,
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
  const [screen, setScreen] = useState(() => {
    // Arrancar en la primera pantalla disponible según permisos
    const all = Object.keys(SCREEN_LABELS);
    return all.find((s) => canSee(currentUser, s)) ?? "sale";
  });
  const [clients, setClients] = useState([]);
  const [products, setProducts] = useState([]);
  const [priceLists, setPriceLists] = useState([]);

  // Toast state
  const [toasts, setToasts] = useState([]);

  const removeToast = (id) => setToasts((prev) => prev.filter((t) => t.id !== id));

  const pushToast = (message, type = "info", ms = 2200) => {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    setToasts((prev) => [...prev, { id, message, type }]);
    window.setTimeout(() => removeToast(id), ms);
  };

  const refreshClients = async () => {
    const res = await apiFetch(`${API}/clients`);
    const data = await res.json();
    setClients(data);
  };

  const refreshProducts = async () => {
    const res = await apiFetch(`${API}/products`);
    const data = await res.json();
    setProducts(data);
  };

  const refreshPriceLists = async () => {
    const res = await apiFetch(`${API}/price-lists`);
    const data = await res.json();
    setPriceLists(data);
  };

  // Evitar scroll horizontal (Safari iOS / overflow)
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

  useEffect(() => {
    // iOS Safari a veces queda con offset al cambiar pantallas
    try {
      window.scrollTo(0, 0);
      document.documentElement.scrollLeft = 0;
      document.body.scrollLeft = 0;
    } catch {}
  }, [screen]);

  // Si el screen actual quedó sin permiso (ej: admin cambió permisos del rol),
  // redirigir a la primera pantalla disponible
  useEffect(() => {
    if (!canSee(currentUser, screen)) {
      const first = Object.keys(SCREEN_LABELS).find((s) => canSee(currentUser, s));
      if (first) setScreen(first);
    }
  }, [screen, currentUser]);

  useEffect(() => {
    const prevBgHtml = document.documentElement.style.background;
    const prevBgBody = document.body.style.background;
    const prevMargin = document.body.style.margin;

    document.documentElement.style.background = "#0c0c14";
    document.body.style.background = "#0c0c14";
    document.body.style.margin = "0";

    return () => {
      document.documentElement.style.background = prevBgHtml;
      document.body.style.background = prevBgBody;
      document.body.style.margin = prevMargin;
    };
  }, []);

  useEffect(() => {
    refreshClients();
    refreshProducts();
    refreshPriceLists();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <ToastHost toasts={toasts} removeToast={removeToast} />

      <div
        style={{
          minHeight: "100dvh",
          background: "#0c0c14",
          display: "flex",
          justifyContent: "center",
          overflowX: "hidden",
          width: "100%",
        }}
      >
      <div
        style={{
          width: "100%",
          maxWidth: 520,
          /* Padding lateral incluye safe area para notch/Dynamic Island lateral */
          paddingTop: "calc(env(safe-area-inset-top, 0px) + 16px)",
          paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 220px)",
          paddingLeft: "calc(env(safe-area-inset-left, 0px) + 16px)",
          paddingRight: "calc(env(safe-area-inset-right, 0px) + 16px)",
          color: "#fff",
          boxSizing: "border-box",
          overflowX: "hidden",
          fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
        }}
      >
        <NavBar screen={screen} setScreen={setScreen} onLogout={onLogout} currentUser={currentUser} />

        {screen === "sale" ? (
          <NewSaleScreen clients={clients} products={products} pushToast={pushToast} />
        ) : screen === "client" ? (
          <ClientScreen
            clients={clients}
            products={products}
            priceLists={priceLists}
            pushToast={pushToast}
            onClientCreated={refreshClients}
          />
        ) : screen === "debtors" ? (
          <DebtorsScreen pushToast={pushToast} />
        ) : screen === "stock" ? (
          <StockScreen products={products} pushToast={pushToast} />
        ) : screen === "users" ? (
          <UsersScreen pushToast={pushToast} currentUser={currentUser} />
        ) : (
          <ProductsScreen
            products={products}
            priceLists={priceLists}
            pushToast={pushToast}
            onProductCreated={refreshProducts}
            onPriceListCreated={refreshPriceLists}
          />
        )}
      </div>
      </div>
    </>
  );
}
