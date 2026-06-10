<!-- refreshed: 2026-06-10 -->
# Architecture

**Analysis Date:** 2026-06-10

## System Overview

Sistema Ventas is a two-tier business management system for managing sales, inventory, clients, and payments. It separates backend API logic from frontend UI, communicating over HTTP/REST with JWT authentication.

```text
┌──────────────────────────────────────────────────────────────────┐
│                    Frontend (React/Vite)                         │
│              `ventas-front/src/App.jsx`                          │
│  ┌──────────────────┬──────────────────┬───────────────────┐   │
│  │  Login Screen    │  SaleScreen      │  Admin Screens    │   │
│  │                  │  (primary UI)    │  (Users/Roles)    │   │
│  └──────────────────┴──────────────────┴───────────────────┘   │
└────────────────────────┬─────────────────────────────────────────┘
                         │ HTTP/REST
                         │ Authorization: Bearer <JWT>
                         ▼
┌──────────────────────────────────────────────────────────────────┐
│         FastAPI Application Layer                                │
│              `app/main.py`                                       │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ Rate Limiter (300/min) │ CORS Middleware │ Security Headers│ │
│  │ JWT Auth via Depends  │ Error Handlers                     │ │
│  └────────────────────────────────────────────────────────────┘ │
└────────────────────┬────────────────────────────────────────────┘
                     │ Dependency Injection
                     ▼
┌──────────────────────────────────────────────────────────────────┐
│         Router/Endpoint Layer                                    │
│       `app/routers/`                                             │
│  ┌─────────────┬──────────┬──────────┬──────────┬──────────┐   │
│  │   auth.py   │clients.py│ sales.py │products  │  stock   │   │
│  │  /auth/     │/clients/ │ /sales/  │ /products│  /stock/ │   │
│  │   token     │statement │ payments │ prices   │ entries  │   │
│  └─────────────┴──────────┴──────────┴──────────┴──────────┘   │
│  ┌──────────┬──────────────┐                                    │
│  │users.py  │  roles.py    │                                    │
│  │/users/   │  /roles/     │                                    │
│  │(admin)   │  (admin)     │                                    │
│  └──────────┴──────────────┘                                    │
└────────────────────┬─────────────────────────────────────────────┘
                     │ Database Query
                     │ Session (SQLAlchemy ORM)
                     ▼
┌──────────────────────────────────────────────────────────────────┐
│         Data Access Layer (SQLAlchemy ORM)                       │
│  Models: `app/models.py`                                         │
│  Schemas: `app/schemas.py` (Pydantic validation)                │
│  Database: `app/database.py`                                     │
│  ┌─────────┬─────────┬────────┬──────────┬──────────┐           │
│  │ Client  │ Product │ Sale   │ Payment  │PriceList │           │
│  │         │         │        │          │          │           │
│  │ id, name│ id, name│ id,    │ id,      │ id, name │           │
│  │ phone   │ type    │ client │ client   │ prices   │           │
│  │ notes   │ cost_   │ items  │ amount   │          │           │
│  │ price_  │ price   │ dates  │ date     │          │           │
│  │ list_id │ service │ notes  │ notes    │          │           │
│  │         │ active  │        │ sale_id  │          │           │
│  └─────────┴─────────┴────────┴──────────┴──────────┘           │
│  ┌──────────┬────────────┐                                      │
│  │ SaleItem │ StockItem  │                                      │
│  │ StockEntry Role │ User  │                                    │
│  └──────────┴────────────┘                                      │
└──────────────────────┬──────────────────────────────────────────┘
                       │ SQL
                       ▼
         ┌─────────────────────────────┐
         │  PostgreSQL Database        │
         │  (DATABASE_URL via .env)    │
         └─────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| **FastAPI App** | Initialize routers, middleware, security, seed data | `app/main.py` |
| **Auth Module** | JWT generation, password hashing, token validation, dependencies | `app/auth.py` |
| **Database** | SQLAlchemy engine config, session factory, Base model | `app/database.py` |
| **Models** | SQLAlchemy ORM entity definitions | `app/models.py` |
| **Schemas** | Pydantic validation schemas for input/output | `app/schemas.py` |
| **Auth Router** | Login endpoint, token issuance | `app/routers/auth.py` |
| **Clients Router** | Client CRUD, statement, deliveries, payments | `app/routers/clients.py` |
| **Sales Router** | Sale creation, item management, payment application | `app/routers/sales.py` |
| **Products Router** | Product CRUD, price management | `app/routers/products.py` |
| **Stock Router** | Stock entries, inventory tracking | `app/routers/stock.py` |
| **Price Lists Router** | Price list CRUD | `app/routers/price_lists.py` |
| **Users Router** | User CRUD (admin only) | `app/routers/users.py` |
| **Roles Router** | Role CRUD (admin only) | `app/routers/roles.py` |
| **Frontend App** | State management, screen routing, API communication | `ventas-front/src/App.jsx` |
| **Frontend Screens** | Rendered UI for sales, clients, admin panels | `ventas-front/src/design/screens/` |

## Pattern Overview

**Overall:** FastAPI REST API with SQLAlchemy ORM backend, React SPA frontend. Token-based authentication, role-based access control, transactional payment tracking.

**Key Characteristics:**
- **Stateless API**: JWT tokens embed user identity; no session state on server
- **Role-based Authorization**: Admin vs. Operator roles with permission sets (["sale", "client", "debtors", "products", "stock"])
- **Transactional Payments**: Payments can be general (global client credit) or sale-specific (payment toward specific invoice)
- **Stock Validation**: Pre-sale stock availability check (can be bypassed by admin with force=true)
- **Multi-tier Pricing**: Products can have different prices per price list; clients are assigned price lists
- **Decimal Precision**: All monetary values stored as Numeric(12,2); quantities as Numeric(12,3) to support fractional units

## Layers

**Presentation (Frontend):**
- Purpose: Render UI for sales entry, client management, debtors, inventory, admin screens
- Location: `ventas-front/src/`
- Contains: React components, design tokens, icons, app shell
- Depends on: API (via apiFetch helper with JWT injection)
- Used by: End users (sales staff, admin)

**API/Endpoint Layer (Backend):**
- Purpose: Handle HTTP requests, validate input schemas, apply business logic, return JSON responses
- Location: `app/routers/`
- Contains: FastAPI router definitions, dependency injection, error handling
- Depends on: Database layer (Session), Auth layer (get_current_user, require_admin)
- Used by: Frontend via HTTP; other routers via imports

**Domain/Business Logic:**
- Purpose: Core business rules (stock validation, payment calculations, client balance, permission checks)
- Location: Distributed across `app/routers/*` (no separate business logic module)
- Contains: Sale creation with stock checks, payment application logic, client statement calculation
- Depends on: Data Access layer (ORM models, queries)
- Used by: Routers

**Data Access Layer (Persistence):**
- Purpose: Define entities, relationships, database operations
- Location: `app/models.py` (SQLAlchemy ORM)
- Contains: Client, Product, Sale, SaleItem, Payment, PriceList, ProductPrice, StockEntry, StockItem, Role, User
- Depends on: SQLAlchemy, database connection
- Used by: Routers via SQLAlchemy Session

**Authentication/Authorization:**
- Purpose: Validate credentials, issue tokens, enforce role/permission checks
- Location: `app/auth.py`
- Contains: JWT creation/validation, password hashing (bcrypt), CurrentUser dataclass, require_admin dependency
- Depends on: Environment secrets (SECRET_KEY, ALGORITHM)
- Used by: All protected routers via Depends(get_current_user) or Depends(require_admin)

**Configuration/Infrastructure:**
- Purpose: Database connection, environment loading, app initialization
- Location: `app/database.py`, `app/main.py`, `.env`
- Contains: DATABASE_URL, SECRET_KEY, ADMIN credentials, CORS/rate-limiting setup
- Depends on: Environment variables (dotenv)
- Used by: All layers

## Data Flow

### Primary Request Path (Create Sale)

1. **Frontend UI** — User fills in sale items, client, date, initial payment
   - Location: `ventas-front/src/design/screens/SaleScreen.jsx`
   
2. **apiFetch call** — POST `/sales` with SaleCreate payload
   - Location: `ventas-front/src/App.jsx` (apiFetch wrapper)
   - Includes: Authorization Bearer header with JWT
   
3. **Endpoint Handler** — FastAPI router receives POST `/sales`
   - Location: `app/routers/sales.py` line 19 (create_sale)
   - Validates: SaleCreate schema (dates, items not empty, amounts valid)
   
4. **Business Logic** — Validate client, products, stock availability
   - Depends on: `get_current_user`, `require_admin` (for force=true)
   - Stock check: Compare SaleItem quantities against (StockItem.in - SaleItem.out)
   - If insufficient and not forced, returns 409 with details
   
5. **Transaction Creation** — Create Sale + SaleItems in DB
   - Location: `app/routers/sales.py` lines 80–98
   - Flush (not commit) to obtain sale.id for items
   
6. **Payment Application** — If initial_payment_amount > 0, create Payment record
   - Links to: Sale if sale_id provided, or Client if general payment
   - Calculates: sale.balance = total_items - total_payments
   
7. **Commit & Response** — Return SaleSummaryOut with (sale_id, total, paid, balance)
   - Location: `app/routers/sales.py` line 110+

### Secondary Flow (Client Statement)

1. **Frontend** — User clicks client → see statement of sales & payments
   - Location: `ventas-front/src/` (state management, data fetch)
   
2. **GET `/clients/{id}/statement`** — Endpoint aggregates sales + payments
   - Location: `app/routers/clients.py` lines 55–93
   - Subqueries: Join SaleItems (total per sale) and Payments (paid per sale)
   - Output: List of sales with individual balances + client total balance
   
3. **Frontend Render** — Display statement with sale-by-sale breakdown

### Authentication Flow

1. **POST `/auth/token`** with username & password
   - Location: `app/routers/auth.py`
   - Validates: User exists, password matches (bcrypt.checkpw)
   - Fetches: User.role → looks up Role (permissions)
   
2. **create_token()** — Generates JWT with (sub, uid, role, permissions, exp, iat)
   - Location: `app/auth.py` line 48
   - Signed with: SECRET_KEY (HS256)
   - Expires: TOKEN_EXPIRE_HOURS (2 hours)
   
3. **Frontend Stores Token** — localStorage["auth_token"]
   - Location: `ventas-front/src/App.jsx` (login handler)
   
4. **apiFetch Injects Token** — Every request includes Authorization: Bearer <token>
   - Location: `ventas-front/src/App.jsx` lines 52–66
   - On 401: Clears token, calls _onUnauthorized callback (login redirect)
   
5. **get_current_user()** — Dependency validates token
   - Location: `app/auth.py` line 62
   - Decodes JWT (no DB query—trust signature)
   - Returns CurrentUser(id, username, role, permissions)
   - On expired/invalid: Returns 401 Unauthorized

**State Management:**
- Frontend: React hooks (useState, useRef, useMemo) manage screens, form data, toasts
- Backend: No session state; stateless via JWT
- Database: PostgreSQL source of truth for all entity state

## Key Abstractions

**CurrentUser (Auth):**
- Purpose: Represents authenticated user with role & permissions
- Examples: `app/auth.py` line 32 (dataclass)
- Pattern: Injected as dependency in protected endpoints; permissions checked for feature access

**SaleCreate / SaleSummaryOut (Domain Model):**
- Purpose: Validates incoming sale requests; standardizes sale response
- Examples: `app/schemas.py` lines 86–127
- Pattern: Pydantic dataclass with field validators; ensures monetary/quantity bounds (12,2 and 12,3 precision)

**SessionLocal (Database Connection):**
- Purpose: Provides per-request database session
- Examples: `app/database.py` line 21 (sessionmaker), `app/main.py` line 12
- Pattern: Dependency injection via `Depends(get_db)` yields session, auto-closes in finally

**apiFetch (Frontend HTTP):**
- Purpose: Wraps fetch() to inject auth header, handle 401s
- Examples: `ventas-front/src/App.jsx` lines 52–66
- Pattern: All API calls go through this wrapper; centralizes token management

## Entry Points

**Backend:**
- Location: `app/main.py` (FastAPI app instance)
- Triggers: ASGI server (Uvicorn) loads module, runs _seed(), registers routers
- Responsibilities:
  - Create tables via SQLAlchemy
  - Seed admin role + initial admin user
  - Configure middleware (CORS, rate-limit, security headers)
  - Register all routers
  - Handle /health check
  
**Frontend:**
- Location: `ventas-front/src/main.jsx` (React root)
- Triggers: Vite dev server or build output in browser
- Responsibilities:
  - Create React root, render App.jsx
  - App.jsx manages global state (auth_token, screens, permissions)
  - Routes to login or dashboard screens based on auth state

**Public Endpoints (no JWT required):**
- `GET /health` — Health check
- `POST /auth/token` — Login

**Protected Endpoints (all require JWT):**
- All other `/clients`, `/sales`, `/products`, `/stock`, `/users`, `/roles`, `/price-lists` endpoints

## Architectural Constraints

- **Threading:** Single-threaded event loop per ASGI worker; Python GIL limits true parallelism; CPU-bound tasks block event loop
- **Global state:** SECRET_KEY loaded from environment at module import (immutable); rate limiter state in app.state.limiter; no persistent singleton state beyond DB
- **Circular imports:** None detected; clean dependency direction from endpoints → routers → models/auth/database
- **Request Lifetime:** Each HTTP request gets own SQLAlchemy Session via dependency injection; auto-closed after response
- **Token Lifetime:** 2 hours (TOKEN_EXPIRE_HOURS); frontend must re-login after expiration
- **Stock Uniqueness:** No row-level lock on stock; concurrent sales could over-allocate; relies on force flag + admin awareness
- **Timezone:** All timestamps stored in UTC (timezone=True in columns); displayed as America/Argentina/Cordoba (AR_TZ) in schemas

## Anti-Patterns

### Monolithic Sale Creation

**What happens:** `create_sale` endpoint handles validation, stock checks, sale creation, item insertion, and initial payment—all in one 100+ line function.

**Why it's wrong:** Hard to unit test individual concerns; changes to payment logic require retesting sale creation; complex transaction scope.

**Do this instead:** Separate into service functions (validate_stock, apply_payment, create_sale_items) in `app/services/sales.py`, call from endpoint. Keep endpoint thin.

### Subquery Complexity in Clients Router

**What happens:** `client_statement` endpoint contains inline SQLAlchemy subqueries for items_totals and payments_totals, duplicated logic across `clients.py`.

**Why it's wrong:** Hard to reuse; difficult to understand; query logic buried in endpoint; risk of missing balance edge cases if logic copied to another endpoint.

**Do this instead:** Extract to `app/services/client_statements.py` with functions like `get_sale_statement_rows(db, client_id)` that handle subquery logic. Call from endpoint.

### Direct Relationship Queries in Routers

**What happens:** Routers directly call `db.query(Client).filter(...)` without any abstraction; each router reimplements similar query patterns.

**Why it's wrong:** Database interaction logic scattered across 7 routers; hard to enforce consistent filtering/ordering; difficult to add caching or change query strategy later.

**Do this instead:** Create repository layer (e.g., `app/repositories/client_repo.py`) with methods like `get_client_by_id(db, id)`, `list_clients_ordered(db)`. Routers call repo methods.

### Float-Based Calculations (Avoided)

**What happens:** Code uses Decimal instead of float for monetary calculations—this is actually correct.

**Why it's right:** Decimal(12,2) prevents floating-point rounding errors in payment totals; important for accounting accuracy.

## Error Handling

**Strategy:** HTTP status codes + JSON detail fields; try/catch at endpoint level; validation at schema level.

**Patterns:**
- `HTTPException(status_code=404, detail="...")` — Resource not found
- `HTTPException(status_code=400, detail="...")` — Validation failure (bad input)
- `HTTPException(status_code=409, detail={...})` — Conflict (stock insufficient); includes sub-details for UI
- `HTTPException(status_code=403, detail="...")` — Permission denied (role check failed)
- Pydantic validators raise `ValueError` (auto-converted to 422 Unprocessable Entity)
- JWT decode errors (ExpiredSignatureError, InvalidTokenError) return 401

## Cross-Cutting Concerns

**Logging:** Standard Python logging module; main.py uses logger for seed operations, sales.py logs force=true overrides; no centralized request logging configured.

**Validation:** Pydantic schemas at endpoint input layer; SQL constraints (UNIQUE, NOT NULL, CHECK) at database layer; custom validators for amounts, dates, stock.

**Authentication:** JWT via OAuth2 Bearer scheme; token embedded in Authorization header; valid for 2 hours; decoded in get_current_user (no DB query on each request).

**Rate Limiting:** slowapi limiter; global 300 requests/minute per client IP; applied via app.state.limiter; rate-limit-exceeded returns 429.

**CORS:** Conditional based on environment:
- Production: Allow only ALLOWED_ORIGIN env var (must be set)
- Development: Allow localhost:* via regex pattern

**Security Headers:**
- X-Content-Type-Options: nosniff
- X-Frame-Options: DENY
- Referrer-Policy: strict-origin-when-cross-origin
- X-XSS-Protection: 1; mode=block
- Permissions-Policy: geolocation=(), microphone=(), camera=()
- Cache-Control: no-store (except /static)

---

*Architecture analysis: 2026-06-10*
