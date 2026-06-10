# Codebase Structure

**Analysis Date:** 2026-06-10

## Directory Layout

```
sistema_ventas/                           # Root directory
├── .env                                  # Environment variables (secrets, DATABASE_URL, SECRET_KEY)
├── .env.local                            # Local overrides (not committed)
├── .gitignore                            # Git ignore rules
├── .claude/                              # Claude project metadata
│   └── projects/
│       └── [project-id]/
│           └── memory/MEMORY.md          # Project-specific context & conventions
├── .planning/                            # GSD planning output
│   └── codebase/
│       ├── ARCHITECTURE.md               # System design, layers, data flow
│       ├── STRUCTURE.md                  # This file: directory layout & file purpose
│       ├── CONVENTIONS.md                # Naming, style, patterns (if generated)
│       ├── TESTING.md                    # Test framework, patterns (if generated)
│       ├── STACK.md                      # Technology versions (if generated)
│       └── INTEGRATIONS.md               # External services (if generated)
├── app/                                  # Backend FastAPI application
│   ├── __init__.py                       # Package marker
│   ├── main.py                           # FastAPI app, routers, middleware, seed
│   ├── auth.py                           # JWT generation, validation, dependencies
│   ├── database.py                       # SQLAlchemy engine, SessionLocal, Base
│   ├── models.py                         # SQLAlchemy ORM entity definitions
│   ├── schemas.py                        # Pydantic validation schemas
│   └── routers/                          # Endpoint handlers by domain
│       ├── auth.py                       # POST /auth/token (login)
│       ├── clients.py                    # /clients (CRUD, statement, deliveries, payments)
│       ├── sales.py                      # /sales (create, list, payments, detail)
│       ├── products.py                   # /products (CRUD, prices)
│       ├── price_lists.py                # /price-lists (CRUD)
│       ├── stock.py                      # /stock (entries, tracking)
│       ├── users.py                      # /users (CRUD—admin only)
│       └── roles.py                      # /roles (CRUD—admin only)
├── ventas-front/                         # Frontend React/Vite application
│   ├── package.json                      # NPM dependencies, scripts
│   ├── package-lock.json                 # Locked dependency versions
│   ├── vite.config.js                    # Vite build config
│   ├── eslint.config.js                  # ESLint rules
│   ├── index.html                        # HTML entry point
│   └── src/                              # React source code
│       ├── main.jsx                      # React root, createRoot(App)
│       ├── App.jsx                       # Main app component, router, state management
│       ├── index.css                     # Global CSS
│       └── design/                       # Design system & screens
│           ├── styles.css                # Component styles
│           ├── tokens.js                 # Design tokens (colors, typography, spacing)
│           ├── AppShell.jsx              # Layout shell (header, nav, content area)
│           ├── Icons.jsx                 # SVG icon components
│           ├── primitives.jsx            # Reusable form/UI primitives
│           └── screens/
│               └── SaleScreen.jsx        # Main sales entry UI
├── venv/                                 # Python virtual environment (not committed)
├── node_modules/                         # NPM packages (not committed)
├── requirements.txt                      # Python dependencies (pip)
├── runtime.txt                           # Python version for deployment
├── Procfile                              # Heroku/deployment process definition
├── netlify.toml                          # Netlify frontend deploy config
├── Conceptos.txt                         # Domain notes (business concepts)
└── Problemas_resueltos.txt               # Resolved issues log
```

## Directory Purposes

**`.env`:**
- Purpose: Secrets and configuration (DATABASE_URL, SECRET_KEY, admin credentials)
- Contains: Environment variables loaded by dotenv
- Key files: `.env` (main), `.env.local` (local overrides, ignored by git)
- Never commit: Secrets, credentials, API keys

**`app/`:**
- Purpose: Backend FastAPI application
- Contains: ORM models, authentication, API endpoints, data access
- Key files: `main.py` (entry), `auth.py` (JWT logic), `database.py` (DB connection)

**`app/routers/`:**
- Purpose: Domain-organized endpoint handlers
- Contains: FastAPI router definitions grouped by feature (clients, sales, products, etc.)
- Key files: `sales.py` (largest, 290 lines; sale creation + payment logic), `clients.py` (325 lines; statement calc)

**`ventas-front/`:**
- Purpose: Frontend React/Vite application
- Contains: React components, design system, app state management
- Key files: `src/App.jsx` (main app logic, routing, auth state), `src/design/screens/SaleScreen.jsx` (primary UI)

**`ventas-front/src/design/`:**
- Purpose: Design system and reusable UI components
- Contains: Tokens (colors, typography), primitives (buttons, inputs), icons, app shell
- Key files: `tokens.js` (design values), `primitives.jsx` (form components), `AppShell.jsx` (page layout)

**`.planning/codebase/`:**
- Purpose: GSD-generated codebase analysis documents
- Contains: Architecture, structure, conventions, testing patterns, concerns
- Key files: All *.md files in this directory (ARCHITECTURE.md, STRUCTURE.md, etc.)

**`venv/` and `node_modules/`:**
- Purpose: Package caches (Python and NPM)
- Generated: Yes
- Committed: No (listed in .gitignore)

## Key File Locations

**Entry Points:**
- Backend: `app/main.py` — FastAPI app instance, routers registered, middleware configured
- Frontend: `ventas-front/src/main.jsx` — React createRoot, renders App.jsx

**Configuration:**
- Backend: `app/database.py` — SQLAlchemy connection, Base declarative model
- Backend: `app/auth.py` — JWT config (SECRET_KEY, ALGORITHM, TOKEN_EXPIRE_HOURS)
- Frontend: `ventas-front/src/App.jsx` — API endpoint URL (VITE_API_URL env var or localhost:8000)
- Frontend: `ventas-front/vite.config.js` — Vite dev server, build config

**Core Logic:**
- Backend: `app/models.py` — SQLAlchemy entity definitions (Client, Product, Sale, Payment, etc.)
- Backend: `app/schemas.py` — Pydantic validation (SaleCreate, ClientOut, PaymentCreate, etc.)
- Backend: `app/routers/sales.py` — Sale creation, stock validation, payment application
- Backend: `app/routers/clients.py` — Client CRUD, statement calculation, deliveries
- Frontend: `ventas-front/src/App.jsx` — Screen routing, auth state, toast management, data fetch

**Testing:**
- Backend: None currently configured; would add `tests/test_*.py`
- Frontend: None currently configured; would add `src/__tests__/` or `*.test.jsx`

**Utilities:**
- Backend: `app/auth.py` — hash_password, verify_password, create_token, get_current_user, require_admin
- Frontend: `ventas-front/src/App.jsx` — apiFetch (HTTP wrapper), parseToken, canSee, localToday helpers

## Naming Conventions

**Files:**
- Backend modules: `snake_case.py` (e.g., `auth.py`, `database.py`, `models.py`)
- Backend routers: `snake_case.py` in `routers/` directory (e.g., `clients.py`, `sales.py`)
- Frontend components: `PascalCase.jsx` (e.g., `App.jsx`, `SaleScreen.jsx`, `AppShell.jsx`)
- Frontend utilities: `camelCase.js` (e.g., `tokens.js`)
- Test files: `test_*.py` (backend) or `*.test.jsx` (frontend, not yet used)

**Directories:**
- Backend: `snake_case/` (e.g., `routers/`, `services/` if added)
- Frontend: `camelCase/` (e.g., `design/`, `screens/`)
- Features: `PascalCase` in Pydantic schema names (e.g., `SaleCreate`, `ClientOut`)

**Functions/Variables:**
- Backend: `snake_case` (e.g., `create_token`, `get_current_user`, `validate_stock`)
- Frontend: `camelCase` (e.g., `apiFetch`, `parseToken`, `localToday`)
- React components: `PascalCase` (e.g., `SaleScreen`, `SearchDropdown`, `ToastHost`)

**Types:**
- Pydantic models: `PascalCase` (e.g., `SaleCreate`, `ClientOut`, `PaymentCreate`)
- SQLAlchemy models: `PascalCase` (e.g., `Client`, `Product`, `Sale`)
- TypeScript (if added): `PascalCase` for types, `camelCase` for instances

**REST Routes:**
- Plural resource names: `/clients`, `/sales`, `/products`, `/users`, `/roles`
- Nested resources: `/clients/{id}/statement`, `/clients/{id}/deliveries`
- Actions as verbs: `/auth/token`, `/stock/entries`, `/stock/current`
- Query params for filters: `?force=true`, `?include_inactive=true`

## Where to Add New Code

**New Endpoint (e.g., GET /clients/{id}/notes):**
- Primary code: `app/routers/clients.py` — Add function with @router.get decorator
- Schema input: `app/schemas.py` — Add Pydantic model if new request/response shape
- Dependency injection: Use existing `Depends(get_db)`, `Depends(get_current_user)` from imports
- Auth check: If admin-only, use `Depends(require_admin)` instead of `get_current_user`

**New Domain Feature (e.g., Discounts):**
- Model: `app/models.py` — Add Discount, DiscountItem SQLAlchemy classes
- Schema: `app/schemas.py` — Add DiscountCreate, DiscountOut Pydantic classes
- Router: Create `app/routers/discounts.py` with CRUD endpoints
- Register: `app/main.py` line 94 — Add `app.include_router(discounts_router, dependencies=_auth)`
- Business logic: Keep in router endpoint functions; extract to `app/services/discounts.py` if complex

**New Service/Library (e.g., Notifications):**
- Location: `app/services/notifications.py` (new directory `app/services/` if not exists)
- Pattern: Define functions (e.g., `send_email(...)`, `send_sms(...)`) that routers can call
- Configuration: Add env vars to `.env` (SMTP settings, API keys, etc.)
- Testing: Add `tests/test_notifications.py` when test suite created

**Frontend Screen (e.g., Customers Analytics):**
- Primary code: `ventas-front/src/design/screens/AnalyticsScreen.jsx`
- Routing: Add case in `ventas-front/src/App.jsx` main render logic (look for screen routing)
- Styling: Use design tokens from `ventas-front/src/design/tokens.js`; CSS in `ventas-front/src/design/styles.css`
- API calls: Use `apiFetch()` helper to fetch data; handle 401s automatically
- Permissions: Wrap screen in canSee() check in App.jsx (add permission to role.permissions in backend)

**Utilities/Helpers (e.g., formatCurrency):**
- Backend: `app/utils.py` (new file) — Python helper functions
- Frontend: `ventas-front/src/utils.js` (if not exists) — JavaScript helper functions
- Both: Export functions; import in routers or components as needed

**Database Schema Change (e.g., Add column to Product):**
- Step 1: Update `app/models.py` — Modify Product class, add new Column
- Step 2: Create Alembic migration: `alembic revision --autogenerate -m "Add field to Product"`
- Step 3: Apply: `alembic upgrade head`
- Step 4: Update `app/schemas.py` — Add field to ProductCreate, ProductOut schemas
- Step 5: Update routers — Handle new field in endpoint logic if needed
- Note: If Alembic not yet set up, SQL migrations may be manual; DATABASE_URL auto-creates tables from models on first run

## Special Directories

**`venv/`:**
- Purpose: Python virtual environment
- Generated: Yes (created by `python -m venv venv`)
- Committed: No

**`node_modules/`:**
- Purpose: NPM package cache
- Generated: Yes (created by `npm install`)
- Committed: No

**`.git/`:**
- Purpose: Git repository metadata
- Generated: Yes (created by `git init`)
- Committed: N/A (git internal)

**`.planning/`:**
- Purpose: GSD (Claude Code) planning and analysis output
- Generated: Yes (created by `/gsd-map-codebase` commands)
- Committed: Yes (contains project knowledge; useful for future commands)

**`__pycache__/` (if present):**
- Purpose: Python bytecode cache
- Generated: Yes
- Committed: No (in .gitignore)

## API Endpoint Locations

All endpoints defined in `app/routers/`:

| Endpoint | File | Function | Auth |
|----------|------|----------|------|
| `POST /auth/token` | `auth.py` | login | None |
| `GET /health` | `main.py` | health | None |
| `POST /clients` | `clients.py` | create_client | JWT |
| `GET /clients` | `clients.py` | list_clients | JWT |
| `GET /clients/{id}/statement` | `clients.py` | client_statement | JWT |
| `GET /clients/{id}/deliveries` | `clients.py` | client_deliveries | JWT |
| `GET /clients/{id}/payments` | `clients.py` | client_payments | JWT |
| `GET /clients/debtors` | `clients.py` | debtors_list | JWT |
| `POST /clients/{id}/payments` | `clients.py` | create_client_payment | JWT |
| `POST /sales` | `sales.py` | create_sale | JWT |
| `GET /sales` | `sales.py` | list_sales | JWT |
| `GET /sales/{id}` | `sales.py` | get_sale | JWT |
| `POST /sales/{id}/payments` | `sales.py` | create_sale_payment | JWT |
| `GET /products` | `products.py` | list_products | JWT |
| `POST /products` | `products.py` | create_product | JWT |
| `PUT /products/{id}` | `products.py` | update_product | JWT |
| `GET /price-lists` | `price_lists.py` | list_price_lists | JWT |
| `POST /price-lists` | `price_lists.py` | create_price_list | JWT |
| `POST /stock/entries` | `stock.py` | create_stock_entry | JWT |
| `GET /stock/current` | `stock.py` | get_current_stock | JWT |
| `GET /users` | `users.py` | list_users | Admin |
| `POST /users` | `users.py` | create_user | Admin |
| `PUT /users/{id}` | `users.py` | update_user | Admin |
| `GET /roles` | `roles.py` | list_roles | Admin |
| `POST /roles` | `roles.py` | create_role | Admin |
| `PUT /roles/{id}` | `roles.py` | update_role | Admin |

---

*Structure analysis: 2026-06-10*
