# Testing Patterns

**Analysis Date:** 2026-06-10

## Test Framework

**Status:** No test framework configured

- No test runner (pytest, unittest, vitest, etc.) detected in dependencies
- No test files present in repository
- `requirements.txt` (`C:\Users\Mateo\Documents\Proyectos\sistema_ventas\requirements.txt`) contains only production dependencies: FastAPI, SQLAlchemy, Pydantic, bcrypt, JWT, etc.
- Frontend `package.json` lists only dev dependencies for build/linting (Vite, ESLint), no testing tools

**Run Commands:**
```bash
# No test commands configured
# Manual testing required or testing tools need to be set up
```

## Frontend Testing Status

**Runner:** Not configured

**Assertion Library:** Not configured

**Current state:**
- ESLint available for linting (`npm run lint`)
- No Jest, Vitest, or other test runner
- No test files in `ventas-front/src/`

## Backend Testing Status

**Framework:** Not configured

**Current state:**
- No pytest configuration file
- No test directory (`tests/`, `test_*.py` files)
- No conftest.py
- No fixtures or factories

## Test Structure (If Implemented)

### Recommended Backend Pattern (Currently Not Used)

Based on codebase conventions, tests should follow this structure:

**File Organization:**
- Location: `tests/` directory (alongside `app/`)
- Naming: `test_<module>.py` (e.g., `test_auth.py`, `test_clients.py`)
- Separation: Co-located by router/module, not by test type

**Directory structure (proposed):**
```
tests/
  __init__.py
  conftest.py           # Pytest fixtures, DB setup
  test_auth.py          # Auth router tests
  test_clients.py       # Clients router tests
  test_products.py      # Products router tests
  test_sales.py         # Sales router tests
  test_stock.py         # Stock router tests
  test_users.py         # Users router tests
  test_roles.py         # Roles router tests
```

## Frontend Testing Pattern (If Implemented)

**Location:** Co-located with components
- `src/design/screens/SaleScreen.test.jsx`
- `src/design/AppShell.test.jsx`
- `src/App.test.jsx`

## Mocking

**Backend mocking approach (when tests are added):**
- SQLAlchemy ORM objects: Use fixtures with in-memory SQLite or mock database
- HTTP clients: Mock external API calls (if any added in future)
- Current code: No external APIs mocked (system is self-contained)

**Frontend mocking approach (when tests are added):**
- API calls via `apiFetch()` — mock `fetch` globally or mock function directly
- LocalStorage — mock for auth token storage/retrieval
- React context/hooks — mock dependencies

## Validation in Codebase (Current Testing Substitute)

Since no formal test suite exists, validation occurs at:

### Backend Route-Level Validation

**Pydantic schemas validate request payloads:**
```python
# Example from schemas.py
class SaleCreate(BaseModel):
    client_id: int
    sale_date: datetime
    items: List[SaleItemCreate]
    
    @field_validator("sale_date")
    @classmethod
    def normalize_sale_date(cls, v: datetime):
        if v.tzinfo is None:
            v = v.replace(tzinfo=AR_TZ)
        # Check no future dates
        now = datetime.now(AR_TZ)
        if v > now + timedelta(minutes=5):
            raise ValueError("sale_date no puede ser una fecha futura")
        return v
    
    @field_validator("items")
    @classmethod
    def validate_items(cls, v):
        if not v:
            raise ValueError("items no puede estar vacío")
        return v
```

**Endpoint handlers validate business logic:**
```python
# Example from sales.py create_sale endpoint
# 1) Client exists
if not client:
    raise HTTPException(status_code=404, detail="Cliente no existe.")

# 2) Products exist and are active
if len(products) != len(set(product_ids)):
    raise HTTPException(status_code=400, detail="Uno o más productos no existen...")

# 3) Stock availability (unless admin forces)
if not force:
    # Check stock_in - stock_out >= requested quantity
    available = Decimal(str(stock_in_map.get(it.product_id, 0))) - Decimal(...)
    if it.quantity > available:
        insufficient.append({...})
```

### Auth Validation

**JWT signature validation in auth.py:**
```python
def get_current_user(token: str = Depends(oauth2_scheme)) -> CurrentUser:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        # Token expiry checked by jwt library
        # Signature verified by jwt.decode
        username = payload.get("sub")
        user_id = payload.get("uid")
        role = payload.get("role")
        if not username or not user_id or not role:
            raise credentials_exc
        return CurrentUser(...)
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expirado")
    except jwt.InvalidTokenError:
        raise credentials_exc
```

### Frontend Validation

**Token parsing (client-side check, not cryptographic):**
```javascript
// From App.jsx
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

// Error handling in apiFetch
if (res.status === 401) {
    localStorage.removeItem("auth_token");
    _onUnauthorized?.();  // Redirects to login
}
```

## Coverage

**Requirements:** None enforced (no coverage tool configured)

**Recommended approach if testing is added:**
- Use pytest-cov for backend
- Use vitest with c8 for frontend
- Aim for >80% coverage on critical paths (auth, sales, stock validation)

## Test Types (Guidelines for Future Implementation)

### Unit Tests (When Implemented)

**Scope:** Individual functions, validation rules

**What to test:**
- `hash_password()` and `verify_password()` behavior
- Pydantic validators (e.g., `normalize_sale_date()`, `validate_amount()`)
- Helper functions like `_build_product_out()`
- Permission checking: `require_admin()`, `canSee()`

**What NOT to test:**
- Database round-trips (use integration tests)
- Full request/response cycles (use integration tests)

### Integration Tests (When Implemented)

**Scope:** Full request cycles with real database

**What to test:**
- `POST /clients` → client created in DB
- `POST /sales` with `force=False` → stock validation works
- `POST /sales` with `force=True` and admin token → bypasses stock check
- `POST /auth/token` with invalid credentials → 401
- `POST /auth/token` with valid credentials → returns JWT with correct claims
- `GET /clients/{id}/statement` → calculations are correct
- `GET /sales/{id}/payments` → payment list includes both general and sale-specific

**Pattern (recommended with pytest and TestClient):**
```python
# tests/conftest.py
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal, engine

@pytest.fixture
def client():
    # Reset DB
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    
    return TestClient(app)

@pytest.fixture
def auth_token(client):
    # Create admin user and return token
    response = client.post("/auth/token", data={"username": "admin", "password": "testpass123"})
    return response.json()["access_token"]

# tests/test_sales.py
def test_create_sale_with_insufficient_stock(client):
    # Setup: create client, product, minimal stock
    # Action: POST /sales with quantity > stock
    # Assert: 409 response with STOCK_INSUFFICIENT code
    pass

def test_create_sale_admin_force(client, auth_token):
    # Setup: create client, product, NO stock
    # Action: POST /sales?force=true with admin token
    # Assert: 201 response, sale created
    pass
```

### E2E Tests (Not Used)

**Status:** Not configured

**Recommendation:** If added, use Playwright or Cypress for full app flow:
- Login → Create sale → View statement → Make payment
- Mobile and desktop viewport tests (app is responsive)

## Manual Testing Notes

**Current validation approach (no automated tests):**
- Backend: curl/Postman requests to endpoints
- Frontend: Browser DevTools console for errors
- Database: Direct SQL queries to verify state

**Key flows to manually validate:**
1. Login with invalid credentials → 401
2. Create product with duplicate name/type → 409
3. Create sale with insufficient stock → 409 with item details
4. Admin force=true sale with no stock → 201
5. Payment amount > remaining balance → 400
6. JWT expiry after 2 hours → 401 on next request
7. Mobile responsive layout (< 900px) uses bottom nav, > 900px uses sidebar

## Database Isolation (For Testing)

**Pattern (not implemented, but recommended):**

Use in-memory SQLite for tests:
```python
# conftest.py
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
```

Or use transactions that rollback:
```python
# Rollback after each test
@pytest.fixture
def db():
    connection = engine.connect()
    transaction = connection.begin()
    session = SessionLocal(bind=connection)
    yield session
    session.close()
    transaction.rollback()
    connection.close()
```

## Critical Areas Without Formal Tests (Risk)

1. **Stock validation logic** (`sales.py` `create_sale()`) — complex Decimal arithmetic
2. **Payment calculations** (`clients.py` — balance, paid, total aggregations)
3. **JWT expiry and claims** (`auth.py` `create_token()`, `get_current_user()`)
4. **Permission filtering** (NavBar, screen visibility logic in `App.jsx`)
5. **Timezone normalization** (all `@field_validator("sale_date")` in `schemas.py`)
6. **Decimal precision** — overflow scenarios with `_MAX_AMOUNT`, `_MAX_QTY`

---

*Testing analysis: 2026-06-10*
