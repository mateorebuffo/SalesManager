# Sistema de Ventas

Sistema de gestión de ventas, clientes, stock y proveedores diseñado para uso en mostrador (POS). Incluye control de inventario, cuentas corrientes, listas de precios y un panel de administración con roles y permisos.

---

## Screenshots

| | |
|---|---|
| ![Nueva venta](screenshots/nueva-venta.png) | ![Registrar pago](screenshots/registrar-pago.png) |
| ![Crear cliente / proveedor](screenshots/crear-cliente-proveedor.png) | ![Nuevo producto y precios](screenshots/nuevo-producto-precios.png) |
| ![Roles y permisos](screenshots/roles.png) | |

---

## Stack

| Capa | Tecnología |
|------|-----------|
| Backend | FastAPI 0.129 + Python 3.11 |
| Base de datos | PostgreSQL (psycopg 3) |
| ORM | SQLAlchemy 2.0 |
| Auth | JWT (PyJWT) + bcrypt |
| Frontend | React 19 + Vite 8 |
| Deploy backend | Heroku / Railway (Procfile) |
| Deploy frontend | Netlify |

---

## Funcionalidades

### Ventas y pagos
- Creación de ventas con múltiples ítems, cantidades y precios por unidad
- Pago inicial al crear la venta (opcional)
- Pagos adicionales: asociados a una venta específica o como abono general al cliente
- Edición de ventas (fecha, notas, ítems)
- Estado de cuenta por cliente: total entregado, total pagado, saldo pendiente

### Clientes
- CRUD completo con nombre, teléfono, notas y lista de precios asignada
- Baja lógica (soft delete vía campo `active`)
- Vista de entregas: historial de productos vendidos al cliente
- Vista de pagos: todos los pagos del cliente con edición y eliminación inline
- Pantalla de deudores: clientes con saldo pendiente ordenados por monto

### Productos y precios
- CRUD de productos con precio de costo, tipo/categoría e indicador de servicio
- Categorías como campo libre en productos, con UI para renombrar en batch y eliminar
- Múltiples listas de precios: cada producto puede tener un precio diferente por lista
- Los productos marcados como servicio no consumen stock
- Baja lógica de productos

### Stock
- Ingresos de stock con fecha, notas e ítems (producto + cantidad)
- Stock actual calculado como `stock_in − stock_out` por producto
- Las ventas descontarán stock automáticamente; solo admin puede forzar venta sin stock
- Edición y eliminación de ingresos

### Proveedores
- Los proveedores son clientes con `is_supplier = true` — misma tabla, mismo CRUD
- Registro de compras al proveedor (ventas de tipo `purchase`)
- Pagos a proveedores con edición y eliminación inline
- Balance pendiente por proveedor

### Usuarios y roles
- Usuarios con contraseña, rol y estado activo/inactivo
- Roles configurables con permisos por pantalla (`sale`, `client`, `products`, `stock`, `suppliers`, `debtors`)
- Dos roles de sistema: `admin` (acceso total) y `operator` (configurable)
- Admin puede crear roles personalizados, cambiar contraseñas y desactivar cuentas

### Notificaciones para admin
- Cuando un operario crea o edita una venta, producto o ingreso de stock, se genera una notificación al admin
- Panel de notificaciones con conteo de no leídas y detalle de cada acción

---

## Arquitectura

```
sistema_ventas/
├── app/
│   ├── main.py              # Entrypoint: CORS, rate limiter, seed inicial, migraciones hot
│   ├── models.py            # Modelos SQLAlchemy
│   ├── schemas.py           # Schemas Pydantic (validación de entrada y salida)
│   ├── auth.py              # JWT, hash de contraseña, CurrentUser, require_admin
│   ├── database.py          # Engine, SessionLocal, Base, get_db()
│   └── routers/
│       ├── auth.py          # POST /auth/token
│       ├── clients.py       # /clients — CRUD, pagos, estado de cuenta, deudores
│       ├── sales.py         # /sales — CRUD, pagos por venta
│       ├── products.py      # /products — CRUD, precios por lista
│       ├── price_lists.py   # /price-lists — CRUD
│       ├── stock.py         # /stock — stock actual, ingresos
│       ├── suppliers.py     # Lógica de proveedores (en clients.py)
│       ├── users.py         # /users — solo admin
│       ├── roles.py         # /roles — solo admin
│       └── notifications.py # /notifications — solo admin
│
└── ventas-front/
    └── src/
        ├── App.jsx          # SPA completa: todas las pantallas y lógica de UI
        └── design/
            └── AppShell.jsx # Layout, navegación, barra superior, campana de notificaciones
```

### Decisiones de diseño destacadas

- **Pagos desacoplados de ventas**: un pago puede estar atado a una venta concreta (`sale_id`) o ser un abono general al cliente (`sale_id = null`). El balance del cliente agrega ambos tipos.
- **Proveedores como clientes**: en lugar de una tabla separada, los proveedores son clientes con `is_supplier = true`. Simplifica el modelo y reutiliza toda la lógica de pagos y estado de cuenta.
- **Migraciones en caliente**: columnas nuevas se agregan vía `ALTER TABLE IF NOT EXISTS` al iniciar la app, sin herramienta de migraciones externa.
- **Categorías de producto derivadas**: no existe una tabla de categorías; el campo `type` de cada producto actúa como categoría. La UI agrupa, renombra (batch update) y gestiona a partir de los valores existentes.
- **Timezone fijo**: todo se procesa en `America/Argentina/Cordoba`. Las fechas futuras están bloqueadas con margen de 5 minutos.
- **Rol en token JWT**: el token incluye `role` y `permissions[]`, lo que permite que el frontend adapte la UI sin request adicional al servidor.

---

## Endpoints principales

```
POST   /auth/token                                  Login → JWT

GET    /clients                                     Lista clientes (filtros: is_supplier, active)
POST   /clients                                     Crear cliente
PUT    /clients/{id}                                Actualizar cliente
GET    /clients/debtors                             Clientes con saldo > 0
GET    /clients/{id}/statement                      Estado de cuenta
GET    /clients/{id}/deliveries                     Ítems entregados
POST   /clients/{id}/payments                       Pago general
PUT    /clients/{id}/payments/{payment_id}          Editar pago
DELETE /clients/{id}/payments/{payment_id}          Eliminar pago
POST   /clients/{id}/supplier-payments              Pago a proveedor
PUT    /clients/{id}/supplier-payments/{payment_id} Editar pago a proveedor
DELETE /clients/{id}/supplier-payments/{payment_id} Eliminar pago a proveedor

POST   /sales                                       Crear venta (con pago inicial opcional)
GET    /sales/{id}                                  Detalle de venta
PUT    /sales/{id}                                  Editar venta
POST   /sales/{id}/payments                         Pago asociado a venta

GET    /products                                    Lista productos
POST   /products                                    Crear producto
PUT    /products/{id}                               Editar producto
POST   /products/{id}/prices                        Upsert precio por lista

GET    /price-lists                                 Lista listas de precios
POST   /price-lists                                 Crear lista
PUT    /price-lists/{id}                            Renombrar lista
DELETE /price-lists/{id}                            Eliminar lista (bloqueado si tiene clientes)

GET    /stock/current                               Stock actual por producto
GET    /stock/entries                               Historial de ingresos
POST   /stock/entries                               Crear ingreso
PUT    /stock/entries/{id}                          Editar ingreso
DELETE /stock/entries/{id}                          Eliminar ingreso

GET    /users                                       Lista usuarios (admin)
POST   /users                                       Crear usuario (admin)
PUT    /users/{id}                                  Actualizar rol/estado (admin)
PUT    /users/{id}/password                         Cambiar contraseña (admin)

GET    /roles                                       Lista roles
POST   /roles                                       Crear rol (admin)
PUT    /roles/{id}                                  Editar rol (admin)
DELETE /roles/{id}                                  Eliminar rol (admin, no sistema)

GET    /notifications/count                         Cantidad de no leídas (admin)
GET    /notifications                               Últimas 100 notificaciones (admin)
POST   /notifications/read-all                      Marcar todas como leídas (admin)

GET    /health                                      Health check
```

---

## Correr localmente

### Requisitos
- Python 3.11+
- Node.js 18+
- PostgreSQL

### Backend

```bash
python -m venv venv
source venv/bin/activate       # macOS/Linux
# .\venv\Scripts\activate      # Windows

pip install -r requirements.txt
```

Crear `.env` en la raíz:

```env
DATABASE_URL=postgresql+psycopg://usuario:contraseña@localhost/sistema_ventas
SECRET_KEY=cambia_esto_por_una_clave_de_al_menos_32_caracteres
ADMIN_USERNAME=admin
ADMIN_PASSWORD=contraseña_segura
ENVIRONMENT=development
ALLOWED_ORIGIN=http://localhost:5173
```

```bash
uvicorn app.main:app --reload
# Docs disponibles en http://localhost:8000/docs
```

### Frontend

```bash
cd ventas-front
npm install
npm run dev
# Disponible en http://localhost:5173
```

---

## Variables de entorno

| Variable | Requerida | Descripción |
|----------|-----------|-------------|
| `DATABASE_URL` | Sí | URL de PostgreSQL con driver psycopg |
| `SECRET_KEY` | Sí | Clave para firmar JWT (mínimo 32 caracteres) |
| `ADMIN_USERNAME` | Sí (primer arranque) | Usuario admin inicial |
| `ADMIN_PASSWORD` | Sí (primer arranque) | Contraseña admin inicial (mín. 8 caracteres) |
| `ENVIRONMENT` | No | `production` deshabilita Swagger y relaja CORS |
| `ALLOWED_ORIGIN` | Sí en prod | URL del frontend para CORS |

---

## Deploy

El backend está configurado para deployar en **Railway** o **Heroku** vía `Procfile`:

```
web: uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

El frontend está configurado para deployar en **Netlify** con redirects SPA (`netlify.toml` incluido).
