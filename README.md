# Sales Manager

![Python](https://img.shields.io/badge/python-3.11+-blue)
![FastAPI](https://img.shields.io/badge/FastAPI-0.129-005571)
![React](https://img.shields.io/badge/React-19-61DAFB)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-SQLAlchemy_2.0-336791)
![License: MIT](https://img.shields.io/badge/license-MIT-green)

A sales, client, stock, and supplier management system designed for point-of-sale (POS) counter use. Includes inventory control, running accounts (accounts receivable/payable), price lists, and an admin panel with roles and permissions.

## Why this exists

This system was built to replace manual sales, running-account, and stock management at a store counter, migrating a real business workflow with multiple employees, client-specific price lists, and suppliers who need to be paid using the same running-account logic as clients who owe money. It's designed for daily counter use, with access from both desktop and mobile.

## Screenshots

**New sale with running-account payment method** — the sale flow supports running account, cash, transfer, or crypto, with an optional partial-payment toggle.

![New sale](screenshots/nueva-venta.png)

**Recording a payment against a client's account** — payments are recorded independently of any sale, updating the total balance in real time.

![Register payment](screenshots/registrar-pago.png)

**Creating a client with the supplier flag** — the "Is supplier" checkbox is the visual interface for the design decision to model suppliers as clients, reusing the same form and logic.

![Create client / supplier](screenshots/crear-cliente-proveedor.png)

**Product with per-list pricing** — each product can have a different price depending on the price list assigned to the client (General, General with discount, Wholesale).

![New product with price lists](screenshots/nuevo-producto-precios.png)

**Roles configurable per screen** — the Admin role has full access; roles like Operator are configured with granular permissions per section.

![Roles](screenshots/roles.png)

## Technical highlights

- **Payment model decoupled from sales**: a payment can be tied to a specific sale (`sale_id`) or be a general credit to the client's account (`sale_id = null`), and the client's balance aggregates both types without duplicating logic.
- **Suppliers modeled as clients** (`is_supplier = true`) in the same table, reusing all the CRUD, payment system, and account statement logic instead of duplicating code for a distinct business concept.
- **Permissions embedded in the JWT**: the token includes `role` and `permissions[]`, letting the frontend adapt the UI without an extra server request on every load.
- **Hot migrations**: new columns are added via `ALTER TABLE IF NOT EXISTS` on app startup — a pragmatic decision for a project of this size, avoiding the overhead of an external migration tool.
- **Derived, not modeled, product categories**: there's no categories table; each product's `type` field acts as one, with UI for grouping, batch renaming, and management built directly on top of existing values.
- **Audit notifications**: every action by an operator (sale, product, or stock entry) generates a notification for the admin, giving visibility without manually reviewing logs.

## Features

### Sales & Payments
- Create sales with multiple items, quantities, and per-unit prices
- Optional initial payment when creating a sale
- Additional payments: tied to a specific sale or as a general credit to the client
- Edit sales (date, notes, items)
- Per-client account statement: total delivered, total paid, pending balance

### Clients
- Full CRUD with name, phone, notes, and assigned price list
- Soft delete via `active` field
- Deliveries view: history of products sold to the client
- Payments view: all client payments with inline edit and delete
- Debtors screen: clients with a pending balance, sorted by amount

### Products & Pricing
- Product CRUD with cost price, type/category, and a service flag
- Categories as a free-text field on products, with UI for batch renaming and deleting
- Multiple price lists: each product can have a different price per list
- Products marked as a service don't consume stock
- Soft delete for products

### Stock
- Stock entries with date, notes, and items (product + quantity)
- Current stock calculated as `stock_in − stock_out` per product
- Sales automatically deduct stock; only admin can force a sale without stock
- Edit and delete entries

### Suppliers
- Suppliers are clients with `is_supplier = true` — same table, same CRUD
- Records purchases from the supplier (sales of type `purchase`)
- Supplier payments with inline edit and delete
- Pending balance per supplier

### Users & Roles
- Users with password, role, and active/inactive status
- Configurable roles with per-screen permissions (`sale`, `client`, `products`, `stock`, `suppliers`, `debtors`)
- Two system roles: `admin` (full access) and `operator` (configurable)
- Admin can create custom roles, change passwords, and deactivate accounts

### Admin Notifications
- When an operator creates or edits a sale, product, or stock entry, a notification is generated for the admin
- Notifications panel with unread count and per-action detail

## Stack

| Layer | Technology |
|---|---|
| Backend | FastAPI 0.129 + Python 3.11 |
| Database | PostgreSQL (psycopg 3) |
| ORM | SQLAlchemy 2.0 |
| Auth | JWT (PyJWT) + bcrypt |
| Frontend | React 19 + Vite 8 |
| Backend deploy | Railway (Procfile) |
| Frontend deploy | Railway |

## Architecture

```
sistema_ventas/
├── app/
│   ├── main.py              # Entry point: CORS, rate limiter, initial seed, hot migrations
│   ├── models.py            # SQLAlchemy models
│   ├── schemas.py           # Pydantic schemas (input/output validation)
│   ├── auth.py              # JWT, password hashing, CurrentUser, require_admin
│   ├── database.py          # Engine, SessionLocal, Base, get_db()
│   └── routers/
│       ├── auth.py          # POST /auth/token
│       ├── clients.py       # /clients — CRUD, payments, account statement, debtors
│       ├── sales.py         # /sales — CRUD, per-sale payments
│       ├── products.py      # /products — CRUD, per-list pricing
│       ├── price_lists.py   # /price-lists — CRUD
│       ├── stock.py         # /stock — current stock, entries
│       ├── suppliers.py     # Supplier logic (lives in clients.py)
│       ├── users.py         # /users — admin only
│       ├── roles.py         # /roles — admin only
│       └── notifications.py # /notifications — admin only
│
└── ventas-front/
    └── src/
        ├── App.jsx          # Full SPA: all screens and UI logic
        └── design/
            └── AppShell.jsx # Layout, navigation, top bar, notifications bell
```

## Key design decisions

- **Payments decoupled from sales**: a payment can be tied to a specific sale (`sale_id`) or be a general credit to the client (`sale_id = null`). The client's balance aggregates both types.
- **Suppliers as clients**: instead of a separate table, suppliers are clients with `is_supplier = true`. This simplifies the model and reuses all payment and account-statement logic.
- **Hot migrations**: new columns are added via `ALTER TABLE IF NOT EXISTS` on app startup, with no external migration tool.
- **Derived product categories**: there's no categories table; each product's `type` field acts as its category. The UI groups, renames (batch update), and manages categories based on existing values.
- **Fixed timezone**: everything is processed in `America/Argentina/Cordoba`. Future dates are blocked with a 5-minute margin.
- **Role in the JWT**: the token includes `role` and `permissions[]`, letting the frontend adapt the UI without an extra request to the server.

## Main Endpoints

```
POST   /auth/token                                  Login → JWT

GET    /clients                                     List clients (filters: is_supplier, active)
POST   /clients                                     Create client
PUT    /clients/{id}                                Update client
GET    /clients/debtors                             Clients with balance > 0
GET    /clients/{id}/statement                      Account statement
GET    /clients/{id}/deliveries                     Delivered items
POST   /clients/{id}/payments                       General payment
PUT    /clients/{id}/payments/{payment_id}          Edit payment
DELETE /clients/{id}/payments/{payment_id}          Delete payment
POST   /clients/{id}/supplier-payments              Payment to supplier
PUT    /clients/{id}/supplier-payments/{payment_id} Edit supplier payment
DELETE /clients/{id}/supplier-payments/{payment_id} Delete supplier payment

POST   /sales                                       Create sale (optional initial payment)
GET    /sales/{id}                                  Sale detail
PUT    /sales/{id}                                  Edit sale
POST   /sales/{id}/payments                         Payment tied to a sale

GET    /products                                    List products
POST   /products                                    Create product
PUT    /products/{id}                               Edit product
POST   /products/{id}/prices                        Upsert price per list

GET    /price-lists                                 List price lists
POST   /price-lists                                 Create list
PUT    /price-lists/{id}                            Rename list
DELETE /price-lists/{id}                             Delete list (blocked if it has clients)

GET    /stock/current                               Current stock per product
GET    /stock/entries                               Entry history
POST   /stock/entries                               Create entry
PUT    /stock/entries/{id}                          Edit entry
DELETE /stock/entries/{id}                          Delete entry

GET    /users                                       List users (admin)
POST   /users                                       Create user (admin)
PUT    /users/{id}                                  Update role/status (admin)
PUT    /users/{id}/password                         Change password (admin)

GET    /roles                                       List roles
POST   /roles                                       Create role (admin)
PUT    /roles/{id}                                  Edit role (admin)
DELETE /roles/{id}                                  Delete role (admin, non-system only)

GET    /notifications/count                         Unread count (admin)
GET    /notifications                               Last 100 notifications (admin)
POST   /notifications/read-all                      Mark all as read (admin)

GET    /health                                      Health check
```

## Running locally

### Requirements
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

Create `.env` in the root:
```
DATABASE_URL=postgresql+psycopg://user:password@localhost/sistema_ventas
SECRET_KEY=change_this_to_a_key_of_at_least_32_characters
ADMIN_USERNAME=admin
ADMIN_PASSWORD=a_secure_password
ENVIRONMENT=development
ALLOWED_ORIGIN=http://localhost:5173
```

```bash
uvicorn app.main:app --reload
# Docs available at http://localhost:8000/docs
```

### Frontend
```bash
cd ventas-front
npm install
npm run dev
# Available at http://localhost:5173
```

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL URL with the psycopg driver |
| `SECRET_KEY` | Yes | Key for signing JWTs (minimum 32 characters) |
| `ADMIN_USERNAME` | Yes (first run) | Initial admin username |
| `ADMIN_PASSWORD` | Yes (first run) | Initial admin password (min. 8 characters) |
| `ENVIRONMENT` | No | `production` disables Swagger and relaxes CORS |
| `ALLOWED_ORIGIN` | Yes in prod | Frontend URL for CORS |

## Deploy

Both the backend and frontend are deployed on Railway.

The backend runs via `Procfile`:
```
web: uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

## Roadmap / Ideas

- [ ] Natural-language interface over account statements and stock (e.g. "who owes me more than $50,000?", "which products are below minimum stock?")
- [ ] Automatic low-stock alerts
- [ ] Export account statements to PDF

## License

MIT
