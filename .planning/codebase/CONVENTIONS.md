# Coding Conventions

**Analysis Date:** 2026-06-10

## Naming Patterns

**Files:**
- Python backend: `lowercase_with_underscores.py` (e.g., `models.py`, `schemas.py`, `routers/`, `price_lists.py`)
- Frontend: `CamelCase.jsx` for React components (e.g., `SaleScreen.jsx`, `AppShell.jsx`), `lowercase.js` for utilities (e.g., `tokens.js`)
- Routers: Named after plural resource (e.g., `clients.py`, `products.py`, `sales.py`, `users.py`)

**Functions:**
- Python: `snake_case` for all functions (e.g., `create_token()`, `verify_password()`, `get_current_user()`, `_build_product_out()`)
- Leading underscore for helper/internal functions (e.g., `_seed()`, `_build_product_out()`, `_is_prod`)
- React: PascalCase for component functions (e.g., `Sidebar()`, `BottomNav()`, `AppShell()`)
- React: camelCase for non-component functions (e.g., `apiFetch()`, `canSee()`, `parseToken()`)

**Variables:**
- Python: `snake_case` for all variables and constants at module level (e.g., `AR_TZ`, `logger`, `limiter`, `ALL_PERMISSIONS`)
- React: `camelCase` for all variables, state, and refs (e.g., `currentUser`, `setScreen`, `inputRef`, `wrapRef`)
- Database models: PascalCase for class names (e.g., `Client`, `Product`, `SaleItem`, `Payment`)
- Pydantic schemas: PascalCase for class names, ending with suffix (e.g., `ClientOut`, `ProductCreate`, `SaleDetailOut`)

**Types/Classes:**
- SQLAlchemy models: PascalCase (e.g., `Client`, `Product`, `Sale`, `User`, `Role`)
- Pydantic schemas: PascalCase with descriptive suffix — `Create` for creation payloads, `Out`/`Update`/`Row` for response patterns
- React components: PascalCase (e.g., `SearchDropdown`, `ToastHost`, `AppShell`)

## Code Style

**Formatting:**
- Python: No linter/formatter configured (PEP 8 implied from code)
- Frontend: ESLint configured in `ventas-front/eslint.config.js`
  - Supports JSX, React Hooks
  - Target: ES2020+
  - Modules: ES6

**Linting:**
- Python: No explicit linting tool
- Frontend: ESLint with rules:
  - `no-unused-vars`: Allows uppercase/underscore-prefixed vars (`[A-Z_]` pattern)
  - React Hooks: Recommended rules enforced
  - React Refresh: Vite plugin rules enforced

**Line length:** No explicit limit observed; code varies 80-120 chars per line

**Indentation:** 2 spaces in JavaScript/React, 4 spaces implied for Python (standard)

## Import Organization

**Python Order:**
1. Standard library (`os`, `logging`, `datetime`, `dataclasses`, etc.)
2. Third-party (FastAPI, SQLAlchemy, Pydantic, bcrypt, jwt, etc.)
3. Local relative imports (`from .auth`, `from ..models`, etc.)

**Pattern observations:**
- Imports are grouped but NOT formally separated with blank lines (though best practice would add them)
- Relative imports use `..` for parent package (`from ..auth import ...`)
- Relative imports from current package use `.` (rare in this codebase)

**Python examples:**
```python
# Standard library first
import logging
import os
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

# Third-party next
import bcrypt
import jwt
from fastapi import APIRouter, Depends, HTTPException

# Local last
from ..auth import create_token, verify_password
from ..database import get_db
from ..models import User
from ..schemas import UserCreate
```

**JavaScript/React Order:**
1. React/built-in imports
2. Local/relative imports

```javascript
// React/npm
import { useEffect, useMemo, useRef, useState } from "react";
import { themes } from "./design/tokens";

// Local files
import { AppShell as NewShell } from "./design/AppShell";
import SaleScreen from "./design/screens/SaleScreen";
```

**Path Aliases:**
- None configured; all imports are explicit relative paths

## Error Handling

**Patterns:**
- HTTPException is the standard for all endpoint errors
- Status codes used: 400 (bad request), 401 (unauthorized), 403 (forbidden), 404 (not found), 409 (conflict/duplicate), 201 (created)
- Error detail is always a string message for simple cases
- Complex errors (stock insufficiency) return dict with `code` and nested `items`: `{"code": "STOCK_INSUFFICIENT", "items": [...]}`

**Error handling style:**
```python
# Basic validation → 400
if not name:
    raise HTTPException(status_code=400, detail="Nombre requerido")

# Resource not found → 404
if not user:
    raise HTTPException(status_code=404, detail="Usuario no encontrado.")

# Duplicate/conflict → 409
if existing:
    raise HTTPException(status_code=409, detail="Ya existe un producto con ese nombre en ese tipo.")

# Permission denied → 403
if current_user.role != "admin":
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Solo un administrador...")

# Unauthorized (JWT) → 401
# Handled by auth.py, not in routers
```

**Integrity constraints:**
```python
# Try/except for database uniqueness
try:
    db.commit()
except IntegrityError:
    db.rollback()
    raise HTTPException(status_code=409, detail="Ya existe...")
```

**Logging:**
- Backend: Uses `logging.getLogger(__name__)` at module level
- Only used for warnings and critical info (not regular debug/info on every operation)
- Example: `logger.warning("Venta creada con force=True (stock omitido)...")` in `sales.py`
- Frontend: No logger; uses console implicitly (see App.jsx apiFetch error handling via conditional callback)

## Comments

**When to Comment:**
- File headers: Module name and purpose (e.g., `# app/main.py`)
- Long blocks: Section dividers using ASCII art (e.g., `# ── Rate limiter ──────────────────────────────────────────────`)
- Complex queries: Inline comments for subqueries and intent (seen in `clients.py`)
- Auth module: Full docstring describing JWT flow at top of file

**JSDoc/TSDoc:**
- Python: Docstrings used for module-level functions and classes:
  - Function docstring: Single-line description (e.g., `"""Genera un JWT con id, username, role, permissions y expiración."""`)
  - No type hints in docstrings; types are in function signature with Python 3.10+ annotations
- React: No JSDoc observed; inline comments only where necessary

**Example docstring pattern:**
```python
def create_token(user_id: int, username: str, role: str, permissions: list) -> str:
    """Genera un JWT con id, username, role, permissions y expiración."""
```

## Function Design

**Size:** Functions are generally short (5-30 lines) with clear responsibility

**Parameters:**
- Route handlers typically receive dependencies last: `db: Session = Depends(get_db)`
- Auth dependencies: `current_user: CurrentUser = Depends(get_current_user)`
- Query parameters: `include_inactive: bool = Query(False, description="...")`
- Request bodies: `payload: SomeSchema`

**Return Values:**
- Endpoint handlers return Pydantic schemas (`response_model=ClientOut`)
- DB operations: Return SQLAlchemy ORM objects or lists
- Auth functions: Return dataclass `CurrentUser` or string (JWT)
- Frontend: Functions return JSX or primitive types

## Module Design

**Exports:**
- Backend: Each router exports `router` as `APIRouter` instance for inclusion in `main.py`
- Backend: `auth.py` exports specific functions: `get_current_user()`, `require_admin()`, `create_token()`, `hash_password()`
- Frontend: Components exported as default or named exports; utilities exported individually

**Barrel Files:**
- Not used in this codebase; imports are explicit from their respective modules
- Example: `from .routers.clients import router as clients_router` (not from a single `__init__.py`)

**Helper Functions:**
- Extracted as `_function_name` if private/internal (e.g., `_seed()`, `_build_product_out()`)
- Placed at module level before they're used
- Example in `products.py`: `_build_product_out()` defined at top, used in multiple endpoints

## Decimal and Numeric Handling

**Numeric precision:**
- Currency amounts: `Numeric(12, 2)` in DB, `Decimal` in Pydantic, validated with max bounds
- Quantities: `Numeric(12, 3)` in DB (allows 0.001 precision for weights)
- Constants define limits: `_MAX_AMOUNT = Decimal("9999999999.99")`
- All decimal arithmetic uses `Decimal` type, not float
- Validators ensure positive values where appropriate

**Timezone handling:**
- All datetimes use `ZoneInfo("America/Argentina/Cordoba")` (AR_TZ constant)
- Defined in `schemas.py` and imported across routers
- Validators normalize incoming datetimes to AR_TZ
- No future dates allowed (5-minute margin for clock skew)

## Pydantic Validation

**Pattern:**
```python
from pydantic import field_validator

class MySchema(BaseModel):
    amount: Decimal
    
    @field_validator("amount")
    @classmethod
    def validate_amount(cls, v: Decimal):
        if v <= 0:
            raise ValueError("amount debe ser > 0")
        if v > _MAX_AMOUNT:
            raise ValueError(f"amount no puede superar {_MAX_AMOUNT}")
        return v
```

**Key characteristics:**
- Use `@field_validator` decorator (Pydantic v2 style)
- Validators are `@classmethod`
- Return the validated value
- Raise `ValueError` for failures (Pydantic converts to 422)

---

*Convention analysis: 2026-06-10*
