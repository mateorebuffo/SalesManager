# app/main.py
import logging
import os

from fastapi import Depends, FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from .auth import get_current_user, hash_password
from .database import engine, SessionLocal
from .models import Base, Role, User
from .routers.auth import router as auth_router
from .routers.clients import router as clients_router
from .routers.products import router as products_router
from .routers.price_lists import router as price_lists_router
from .routers.roles import router as roles_router
from .routers.sales import router as sales_router
from .routers.stock import router as stock_router
from .routers.users import router as users_router

logger = logging.getLogger(__name__)

# ── Rate limiter ──────────────────────────────────────────────────────────────
limiter = Limiter(key_func=get_remote_address, default_limits=["300/minute"])

app = FastAPI(
    title="Sistema de Ventas",
    docs_url=None if os.getenv("ENVIRONMENT") == "production" else "/docs",
    redoc_url=None if os.getenv("ENVIRONMENT") == "production" else "/redoc",
    openapi_url=None if os.getenv("ENVIRONMENT") == "production" else "/openapi.json",
)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ── Tablas ────────────────────────────────────────────────────────────────────
Base.metadata.create_all(bind=engine)

# ── Pantallas disponibles para permisos ───────────────────────────────────────
ALL_PERMISSIONS = ["sale", "client", "debtors", "products", "stock"]


# ── Seed inicial ──────────────────────────────────────────────────────────────
def _seed():
    db = SessionLocal()
    try:
        # 1) Roles de sistema (siempre se verifican al arrancar)
        if not db.query(Role).filter(Role.name == "admin").first():
            db.add(Role(name="admin", permissions=ALL_PERMISSIONS, is_system=True))
            logger.info("Rol 'admin' creado.")

        if not db.query(Role).filter(Role.name == "operator").first():
            db.add(Role(name="operator", permissions=ALL_PERMISSIONS, is_system=False))
            logger.info("Rol 'operator' creado.")

        db.commit()

        # 2) Usuario admin inicial (solo si no hay ningún usuario)
        if db.query(User).count() == 0:
            admin_username = os.getenv("ADMIN_USERNAME", "").strip()
            admin_password = os.getenv("ADMIN_PASSWORD", "").strip()
            if not admin_username or not admin_password:
                logger.critical(
                    "No hay usuarios y ADMIN_USERNAME/ADMIN_PASSWORD no están definidos. "
                    "El sistema no podrá autenticarse."
                )
            else:
                db.add(User(
                    username=admin_username,
                    hashed_password=hash_password(admin_password),
                    role="admin",
                    active=True,
                ))
                db.commit()
                logger.info("Admin inicial creado: '%s'", admin_username)
    finally:
        db.close()


_seed()


# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(auth_router)

_auth = [Depends(get_current_user)]
app.include_router(clients_router,     dependencies=_auth)
app.include_router(products_router,    dependencies=_auth)
app.include_router(sales_router,       dependencies=_auth)
app.include_router(price_lists_router, dependencies=_auth)
app.include_router(stock_router,       dependencies=_auth)
app.include_router(users_router,       dependencies=_auth)
app.include_router(roles_router,       dependencies=_auth)


@app.get("/health")
def health():
    return {"status": "ok"}


# ── CORS ──────────────────────────────────────────────────────────────────────
_prod_origin = os.getenv("ALLOWED_ORIGIN", "").strip()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[_prod_origin] if _prod_origin else [],
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1|192\.168\.0\.\d{1,3})(:\d{1,5})?$",
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Content-Type", "Authorization"],
)


# ── Security headers ──────────────────────────────────────────────────────────
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response: Response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
    if not request.url.path.startswith("/static"):
        response.headers["Cache-Control"] = "no-store"
        response.headers["Pragma"] = "no-cache"
    return response
