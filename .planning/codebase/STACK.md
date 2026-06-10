# Technology Stack

**Analysis Date:** 2026-06-10

## Languages

**Primary:**
- Python 3.11 - Backend API (FastAPI)
- JavaScript - Frontend React application

**Secondary:**
- SQL - PostgreSQL database queries via SQLAlchemy ORM

## Runtime

**Environment:**
- Python 3.11 (specified in `runtime.txt`)
- Node.js (for frontend build via Vite)

**Package Manager:**
- pip - Python dependencies (from `requirements.txt`)
- npm - Node.js dependencies (frontend in `ventas-front/package.json` and lockfile)
- Lockfiles: `requirements.txt` (pinned versions), `package-lock.json`

## Frameworks

**Core Backend:**
- FastAPI 0.129.0 - REST API framework (`app/main.py`)
- Uvicorn 0.41.0 - ASGI server

**Core Frontend:**
- React 19.2.0 - UI framework (`ventas-front/src/App.jsx`)
- Vite 8.0.0-beta.13 - Build tool and dev server (`ventas-front/vite.config.js`)

**ORM/Database:**
- SQLAlchemy 2.0.46 - Database ORM layer (`app/database.py`, `app/models.py`)
- psycopg[binary] 3.3.2 - PostgreSQL adapter for Python

**Authentication:**
- PyJWT 2.11.0 - JWT token creation/verification (`app/auth.py`)
- bcrypt 4.3.0 - Password hashing (`app/auth.py`)

**API Security:**
- slowapi 0.1.9 - Rate limiting (300 requests/minute default in `app/main.py`)
- CORS middleware - Built into FastAPI

**Frontend Build/Dev:**
- @vitejs/plugin-react 5.1.1 - React support in Vite
- ESLint 9.39.1 - JavaScript linting (`ventas-front/eslint.config.js`)
- eslint-plugin-react-hooks 7.0.1 - React hooks linting
- eslint-plugin-react-refresh 0.4.24 - React Fast Refresh linting

**Development/Utilities:**
- python-dotenv 1.2.1 - Environment variable management (`app/database.py`, `app/auth.py`)
- python-multipart 0.0.22 - Multipart form parsing for FastAPI
- serve 14.2.4 - Static file server for production frontend (in `package.json` scripts)

## Key Dependencies

**Critical:**
- FastAPI - Defines the entire REST API structure and routing
- SQLAlchemy - ORM for all database interactions (critical for data persistence)
- PostgreSQL (psycopg) - Primary data store
- React - Entire frontend UI layer
- PyJWT - Authentication token validation on every protected route
- bcrypt - Credential security (admin login)

**Infrastructure:**
- slowapi - Prevents abuse via rate limiting (300/min global)
- python-dotenv - Configuration management (secrets, database URLs)
- Vite - Frontend development and production builds
- ESLint - Code quality enforcement in frontend

## Configuration

**Environment:**
- `.env` file (not committed, contains secrets)
- Required environment variables:
  - `DATABASE_URL` - PostgreSQL connection string (with automatic `postgresql+psycopg://` conversion for Railway)
  - `SECRET_KEY` - JWT signing key (minimum 64 characters required in `app/auth.py`)
  - `ADMIN_USERNAME` - Initial admin user for database seed
  - `ADMIN_PASSWORD` - Initial admin password for database seed
  - `ENVIRONMENT` - Set to "production" to disable OpenAPI docs (`/docs`, `/redoc`)
  - `ALLOWED_ORIGIN` - CORS origin for production (required if not in dev mode)
- Frontend environment: `VITE_API_URL` - Backend API endpoint (defaults to `http://{hostname}:8000`)

**Build:**
- Backend: `Procfile` defines Heroku/Railway deployment command (`uvicorn app.main:app --host 0.0.0.0 --port $PORT`)
- Frontend: `netlify.toml` defines Netlify deployment (builds `ventas-front`, publishes `ventas-front/dist`)

## Platform Requirements

**Development:**
- Python 3.11+
- PostgreSQL database (local or remote connection via DATABASE_URL)
- Node.js 18+ (for frontend)
- pip and npm/npx

**Production:**
- Python 3.11+ runtime (Heroku/Railway compatible via `runtime.txt`)
- PostgreSQL database (Railway, Render, AWS RDS, or similar)
- Frontend deployed to Netlify (via `netlify.toml`) or any static host
- CORS origin configured in production
- JWT SECRET_KEY with 64+ characters minimum

## Database Schema Basics

- PostgreSQL with SQLAlchemy ORM
- Core tables: `clients`, `products`, `sales`, `sale_items`, `payments`, `price_lists`, `product_prices`, `stock_entries`, `stock_items`, `roles`, `users`
- Decimal precision: Numeric(12,2) for currency, Numeric(12,3) for quantities
- Timezone-aware timestamps using `DateTime(timezone=True)`
- Automatic schema creation on startup via `Base.metadata.create_all()`

---

*Stack analysis: 2026-06-10*
