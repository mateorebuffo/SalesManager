# External Integrations

**Analysis Date:** 2026-06-10

## APIs & External Services

**None Detected.**

This codebase does not currently integrate with third-party APIs (e.g., Stripe, payment gateways, SMS providers, email services, etc.). All functionality is self-contained within the backend and frontend.

## Data Storage

**Database:**
- PostgreSQL (required)
  - Connection: `DATABASE_URL` environment variable
  - Client: SQLAlchemy ORM (`app/database.py`)
  - Schema: Auto-created from SQLAlchemy models on startup (`app/main.py:38`)
  - Tables: clients, products, sales, sale_items, payments, price_lists, product_prices, stock_entries, stock_items, roles, users

**File Storage:**
- Local filesystem only (no external storage integration like S3, GCS, etc.)

**Caching:**
- None (requests are served directly from database)

## Authentication & Identity

**Auth Provider:**
- Custom JWT-based authentication
  - Implementation: `app/auth.py`
  - Token algorithm: HS256 (HMAC with SHA-256)
  - Token expiration: 2 hours (`TOKEN_EXPIRE_HOURS = 2`)
  - Password hashing: bcrypt with salt
  - Token validation: Checked on every protected endpoint via `get_current_user()` dependency
  - Credentials stored: Username and hashed password in `users` table
  - Seed process: Creates `admin` and `operator` roles on startup, seeds initial admin user from `ADMIN_USERNAME`/`ADMIN_PASSWORD` if no users exist

**Authorization:**
- Role-based access control (RBAC)
  - Roles defined in `roles` table (admin, operator)
  - Permissions: JSON list field (e.g., ["sale", "client", "debtors", "products", "stock"])
  - Admin enforcement: `require_admin()` decorator checks role == "admin" → 403 Forbidden if not

## Monitoring & Observability

**Error Tracking:**
- None detected (no Sentry, DataDog, etc.)

**Logs:**
- Python logging module via `logging.getLogger(__name__)` in `app/main.py`
- Output to stdout (suitable for containerized/cloud deployments)
- Log levels: INFO for startup seed, CRITICAL for missing env vars

## CI/CD & Deployment

**Hosting:**
- Backend: Heroku or Railway compatible (via `Procfile` and `runtime.txt`)
- Frontend: Netlify (via `netlify.toml` with build command and publish directory)

**CI Pipeline:**
- None detected (no GitHub Actions, GitLab CI, CircleCI, etc.)
- Manual deployment required

**Deployment Command (Backend):**
```
uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

**Deployment Flow (Frontend):**
1. Netlify detects push to repo
2. Runs: `npm run build` from `ventas-front/` directory
3. Publishes: `ventas-front/dist/` to CDN
4. Redirects: All routes to `/index.html` for SPA routing

## Environment Configuration

**Required env vars:**
- `DATABASE_URL` - PostgreSQL connection string (e.g., `postgresql+psycopg://user:pass@host:5432/dbname`)
  - Auto-converted from `postgresql://` to `postgresql+psycopg://` if needed (Railway compatibility)
  - SSL mode auto-set: "disable" for localhost, "require" for remote
- `SECRET_KEY` - JWT signing key (minimum 64 characters, critical for token security)
- `ADMIN_USERNAME` - Initial admin user (seed only, ignored if users exist)
- `ADMIN_PASSWORD` - Initial admin password (seed only, ignored if users exist)
- `ENVIRONMENT` - Set to "production" to disable OpenAPI docs
- `ALLOWED_ORIGIN` - CORS allowed origin in production (e.g., `https://yourdomain.com`)

**Frontend env vars (optional):**
- `VITE_API_URL` - Backend API base URL (defaults to `http://{hostname}:8000` if not set)

**Secrets location:**
- `.env` file (not committed to git, per `.gitignore`)
- Production: Stored in platform's secret management (Heroku Config Vars, Railway Variables, etc.)

## Security Headers

The backend adds the following HTTP security headers on every response (`app/main.py:118-129`):
- `X-Content-Type-Options: nosniff` - Prevents MIME type sniffing
- `X-Frame-Options: DENY` - Disables clickjacking
- `Referrer-Policy: strict-origin-when-cross-origin` - Controls referrer exposure
- `X-XSS-Protection: 1; mode=block` - Legacy XSS protection
- `Permissions-Policy: geolocation=(), microphone=(), camera=()` - Disables unused browser APIs
- `Cache-Control: no-store` - Prevents caching of sensitive pages (except `/static`)
- `Pragma: no-cache` - Legacy cache control

## CORS Configuration

- **Development:** Allows localhost:* and 127.0.0.1:* via regex pattern
- **Production:** Only allows `ALLOWED_ORIGIN` env var (must be explicitly set)
- Allowed methods: GET, POST, PUT, DELETE
- Allowed headers: Content-Type, Authorization
- Credentials: Enabled (allows cookies/auth headers)

## Rate Limiting

- Global limit: 300 requests per minute per IP
- Enforced via slowapi middleware
- Exceeding limit returns 429 Too Many Requests

## Webhooks & Callbacks

**Incoming:** None

**Outgoing:** None

---

*Integration audit: 2026-06-10*
