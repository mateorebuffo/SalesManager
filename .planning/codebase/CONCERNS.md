# Codebase Concerns

**Analysis Date:** 2026-06-10

## Tech Debt

**No Automated Testing Framework:**
- Issue: Codebase lacks unit tests, integration tests, and E2E tests entirely. Zero test files found in repo.
- Files: All core files (`app/main.py`, `app/routers/*.py`, `app/models.py`) lack corresponding test coverage
- Impact: Regression bugs go undetected, refactoring is risky, critical payment/stock logic cannot be validated before deployment
- Fix approach: Establish pytest + fixtures for unit tests; add integration tests for routers; mock DB calls; test payment/stock validation logic first

**Hardcoded Permission Strings Across Multiple Files:**
- Issue: `ALL_PERMISSIONS = ["sale", "client", "debtors", "products", "stock"]` defined in both `app/main.py` (line 41) and `app/routers/auth.py` (line 14)
- Files: `app/main.py:41`, `app/routers/auth.py:14`, `app/schemas.py:332`
- Impact: Permission changes require updates in 3+ places; inconsistency risks breaking auth flow
- Fix approach: Define `ALL_PERMISSIONS` once in a shared constants module (`app/constants.py` or similar), import it everywhere

**Argentina Timezone Hardcoded in Multiple Files:**
- Issue: `AR_TZ = ZoneInfo("America/Argentina/Cordoba")` repeated in `app/routers/sales.py:17`, `app/routers/clients.py:179`, `app/routers/stock.py:13`, `app/schemas.py:84`
- Files: 4 separate definitions, same timezone
- Impact: Timezone logic is scattered; if timezone changes, requires updates in 4 places; confusing for new developers
- Fix approach: Define once in `app/config.py`, import as `from app.config import AR_TZ`

**No Input Validation on URLs/Parameters:**
- Issue: Router functions accept arbitrary integers for IDs (`client_id`, `product_id`, `sale_id`) without range validation
- Files: `app/routers/clients.py:56`, `app/routers/sales.py:131`, `app/routers/stock.py:126`, and many others
- Impact: Invalid/negative IDs silently return 404 without helpful error messages; fuzzing could cause issues
- Fix approach: Add Pydantic validators to ensure positive integers; use `Field(gt=0)` in schemas

**Missing Null Checks in Related Data:**
- Issue: `app/routers/stock.py:75` accesses `it.product.name` with fallback to `str(it.product_id)` only if product is None; product FK relationship could theoretically be orphaned
- Files: `app/routers/stock.py:75`, `app/routers/stock.py:174`
- Impact: If cascade delete fails, returns product ID instead of product name in response (inconsistent)
- Fix approach: Ensure FK constraints are properly set up; test cascade delete; handle None explicitly in type hints

## Known Bugs

**Payment Creation Missing client_id in Update Path:**
- Issue: `app/routers/clients.py:208-227` has `update_client_payment()` that modifies existing payment but never sets `client_id` (line 224 only updates `amount`, `notes`, `payment_date`)
- Symptoms: If payment record is loaded from DB, `client_id` is already set. But if a new payment is created via this endpoint's logic, it would fail FK constraint.
- Files: `app/routers/clients.py:223-225`
- Trigger: POST then PUT on same payment; payment remains intact but pattern is inconsistent
- Workaround: None needed currently (FK is required on insert), but code comment is missing to explain why client_id isn't updated

**Duplicate Stock Calculation Logic:**
- Issue: Stock balance calculation (`stock_in - stock_out`) repeated in `app/routers/sales.py:43-54`, `app/routers/sales.py:180-193`, and `app/routers/stock.py:18-27`
- Symptoms: Three separate implementations of the same calculation; risk of divergence if one is fixed but others aren't
- Files: `app/routers/sales.py:43-54`, `app/routers/sales.py:180-193`, `app/routers/stock.py:18-27`
- Trigger: Any stock-related query; already triggered on every sale/stock endpoint
- Workaround: Create a helper function `_get_stock_balance(db, product_id)` in a shared module

**Product Lookup Doesn't Verify Price List Exists:**
- Issue: `app/routers/clients.py:36` verifies price list is active, but `app/routers/products.py:110-112` checks if price list exists without verifying active status
- Symptoms: Can assign an inactive price list to a product's price, silently fails validation
- Files: `app/routers/clients.py:36`, `app/routers/products.py:110-112`
- Trigger: Use inactive price list ID in product price upsert
- Workaround: Add active check in product price upsert

## Security Considerations

**Weak SECRET_KEY Validation:**
- Risk: `app/auth.py:22-24` checks `len(SECRET_KEY) < 64` but HS256 with key < 64 chars is cryptographically weak; does not prevent reuse of common keys
- Files: `app/auth.py:22-24`
- Current mitigation: RuntimeError raised if < 64 chars
- Recommendations: 
  - Use 128+ character key (HS256 should use key >= key size in bits / 8; 256 bits = 32 bytes minimum)
  - Add check that SECRET_KEY is not a default/weak value (e.g., "secret", "password")
  - Document minimum entropy requirements in .env.example

**No Request Signing or CSRF Protection:**
- Risk: API accepts POST/PUT/DELETE without CSRF tokens; frontend must be same-origin or CORS is sufficient
- Files: `app/main.py:107-114` (CORS config)
- Current mitigation: CORS configured, rate limiting on auth endpoints
- Recommendations:
  - Document that frontend must include Origin header correctly
  - Consider adding state-based CSRF tokens for sensitive mutations (sale deletion, payment reversal)

**Bcrypt Hash Strength Not Verified:**
- Risk: `app/auth.py:41` uses `bcrypt.gensalt()` with default cost (12); acceptable but not explicitly documented; cost could be weak if library defaults change
- Files: `app/auth.py:41`
- Current mitigation: bcrypt cost defaults to ~12, which is acceptable (2024 standard is 12-13)
- Recommendations:
  - Explicitly set cost: `bcrypt.gensalt(rounds=13)` to future-proof
  - Document password hashing strategy

**Disabled SQL Echo in Production but Query Logging Missing:**
- Risk: `app/database.py:19` sets `echo=False`; no structured query logging for audit trail
- Files: `app/database.py:19`
- Current mitigation: echo disabled prevents info leaks
- Recommendations:
  - Add SQLAlchemy event listeners to log executed queries (DDL only, not sensitive data)
  - Implement audit logging for payment/sale mutations

**No Rate Limiting on Most Endpoints:**
- Risk: Only `/auth/token` (10/min), `/users` POST (10/min), and `/password` PUT (5/min) are rate-limited; CRUD endpoints unbounded
- Files: `app/routers/auth.py:18`, `app/routers/users.py:24`, `app/routers/users.py:74`, `app/main.py:26` (global 300/min default)
- Current mitigation: Global limit of 300/minute exists (line 26)
- Recommendations:
  - Tighten global to 100/min
  - Add stricter limits to sensitive endpoints: `/sales/*/payments` (20/min), `/clients/*/payments` (20/min)

## Performance Bottlenecks

**N+1 Query Problem in Product List Endpoint:**
- Problem: `app/routers/products.py:76` iterates products and calls `_build_product_out(p, db)` for each, which queries prices separately (line 15-19)
- Files: `app/routers/products.py:67-76`
- Cause: `list_products()` loops over products and issues a fresh query per product to get prices
- Improvement path:
  - Use SQLAlchemy `selectinload(Product.prices)` to eagerly load prices in one query
  - Refactor to: `products = db.query(Product).options(selectinload(Product.prices)).all()`
  - Build prices dict once, reuse in response

**Inefficient Debtors Query Without Indices:**
- Problem: `app/routers/clients.py:238-290` uses complex subqueries for delivered/paid amounts; no index on `Payment.client_id` or `SaleItem.sale_id`
- Files: `app/routers/clients.py:241-259`
- Cause: Two large subqueries joined to clients table; full table scan on payments/sales if no indices
- Improvement path:
  - Ensure `CREATE INDEX idx_payment_client_id ON payments(client_id)` and similar
  - Consider materialized view if debtors list is queried often
  - Cache results (Redis) with 5-min TTL

**Stock Calculation Repeated on Every Sale Create:**
- Problem: `app/routers/sales.py:43-66` calculates available stock for ALL products in request; if sale has 20 items, 40 queries (stock_in + stock_out per product)
- Files: `app/routers/sales.py:42-71`
- Cause: Loop over items, build maps separately instead of in single query
- Improvement path:
  - Query all product IDs' stock in one call using `IN` clause
  - Build maps upfront, use in validation loop

**PaymentCreate Validated Multiple Times:**
- Problem: `app/routers/sales.py:244` and `app/routers/clients.py:182` both validate amount > 0 in schema AND in endpoint logic (overpayment check)
- Files: `app/schemas.py:156-163`, `app/routers/sales.py:272`, `app/routers/clients.py:182`
- Cause: Schema validation + business logic validation = 2x work
- Improvement path: Move business logic (overpayment check) to Pydantic validator using context

## Fragile Areas

**Sale Update Logic Overwrites Without Rollback:**
- Files: `app/routers/sales.py:169-240`
- Why fragile: `db.query(SaleItem).filter(...).delete()` (line 216) removes old items; if new item insert fails, orphaned payment records remain (no FK constraint from Payment to SaleItem, but semantically broken)
- Safe modification: Wrap item deletion and insertion in try/except with rollback; consider NOT deleting but marking as inactive
- Test coverage: No tests verify partial failure scenarios

**Client Debtors List Uses In-Memory Sorting:**
- Files: `app/routers/clients.py:288-290`
- Why fragile: Fetches all clients + aggregates, THEN sorts in Python (line 289: `out.sort(...)`); O(n log n) in-app when DB can do O(log n)
- Safe modification: Move sort to SQL: `db.query(...).order_by(desc(balance)).all()` before building response
- Test coverage: No test for debtors order correctness

**Hard Requirement for ADMIN_USERNAME/ADMIN_PASSWORD on Boot:**
- Files: `app/main.py:59-76`
- Why fragile: If env vars missing and no users exist, startup logs "critical" but app still starts. Manual user creation required via API (no way to add first user if auth is required for POST /users)
- Safe modification:
  - Provide fallback admin creation via CLI script or endpoint that checks if user count == 0
  - Or allow POST /users with special bootstrap token (one-time use)
- Test coverage: No test for admin initialization failure mode

**Role Permission System Allows Invalid Transitions:**
- Files: `app/routers/users.py:60-61`
- Why fragile: Check `current_user.role != "admin"` to prevent role downgrade, but doesn't check if NEW role exists in DB (line 63 does check, but late)
- Safe modification: Validate role exists before any auth checks
- Test coverage: No test for invalid role assignment

## Scaling Limits

**In-Memory Session Management:**
- Current capacity: SQLAlchemy SessionLocal per request; connection pool default is ~5-20 connections
- Limit: ~20-50 concurrent requests before DB connection pool exhaustion
- Scaling path:
  - Use pgBouncer or PgPool for connection pooling (increase to 100+ connections)
  - Switch to async SQLAlchemy (AsyncSession) with asyncio to handle >1000 concurrent requests
  - Implement circuit breaker for DB failures

**No Pagination on List Endpoints:**
- Current capacity: Fetches ALL clients, products, roles, users into memory
- Limit: 10,000+ records = multi-second response time
- Scaling path:
  - Add `?limit=50&offset=0` query params to all list endpoints
  - Use keyset pagination (ID-based) for better performance on large datasets
  - Add index on primary keys (already present but ensure they're used)

**No Caching Layer:**
- Current capacity: Price lists, roles, and debtors list queried fresh every request
- Limit: Read-heavy endpoints (debtors, stock) slow down proportionally to data size
- Scaling path:
  - Add Redis cache (5-min TTL) for GET endpoints
  - Invalidate on write (POST/PUT/DELETE)
  - Use cache headers (ETag, Last-Modified)

**Single Database Instance (No Replication):**
- Current capacity: PostgreSQL single instance
- Limit: If DB goes down, entire system unavailable; no read replicas for scaling queries
- Scaling path:
  - Implement read replicas (async standby)
  - Use connection pooling service
  - Plan for backup/restore (WAL archiving)

## Dependencies at Risk

**Deprecated psycopg3 Binary Driver:**
- Risk: `requirements.txt` uses `psycopg[binary]==3.3.2`; binary wheels may not support future Python versions; psycopg project recommends source install for production
- Impact: Upgrade path to Python 3.13+ may require recompilation; Docker builds may fail on ARM64
- Migration plan: Switch to `psycopg[c]` or pure Python fallback; ensure CI tests on multiple architectures

**FastAPI 0.129.0 (Potentially Outdated):**
- Risk: FastAPI 0.150+ available; no pinning strategy for CVEs
- Impact: Security fixes may not be automatically applied
- Migration plan: Set up Dependabot or similar to alert on new versions; pin to major.minor (e.g., `~=0.130.0`)

**PyJWT 2.11.0 (Last 2.x Release):**
- Risk: PyJWT 3.0 may introduce breaking changes; 2.x is in maintenance mode
- Impact: Future Python 3.14+ may drop support for PyJWT 2.x
- Migration plan: Test upgrade path to 3.0 in development; plan migration timeline

## Missing Critical Features

**No Audit Logging:**
- Problem: No record of who created/modified sales, payments, or users; cannot answer "who changed this sale?"
- Blocks: Compliance audits, dispute resolution, fraud investigation
- Recommendation: Implement audit table with (user_id, action, table_name, old_value, new_value, timestamp)

**No Soft Delete (Cascading Hard Deletes Only):**
- Problem: DELETE operations cascade and permanently remove data; cannot recover accidentally deleted sales or payments
- Blocks: Data recovery, historical analysis, regulatory compliance (many countries require 7-year retention)
- Recommendation: Add `is_deleted` boolean columns to Sale, Payment, Client; modify queries to filter out deleted records

**No API Documentation for Error Codes:**
- Problem: HTTPException detail varies (strings, dicts); frontend cannot reliably parse errors
- Blocks: Proper error handling in frontend; internationalization
- Recommendation: Define error code enum (e.g., "STOCK_INSUFFICIENT", "PAYMENT_EXCEEDS_BALANCE"), return structured errors

**No Admin Dashboard Endpoint:**
- Problem: No single endpoint to retrieve system health, user count, recent sales volume, etc.
- Blocks: Admin monitoring; ops alerting
- Recommendation: Add GET `/admin/dashboard` returning (user_count, total_sales, total_payments, recent_transactions)

**No Backup/Restore Functionality:**
- Problem: No built-in export of sales/payments/clients; disaster recovery depends on DB backups alone
- Blocks: Data portability, manual recovery
- Recommendation: Add POST `/admin/export` (CSV/JSON), POST `/admin/import` (with validation)

## Test Coverage Gaps

**Payment Logic Untested:**
- What's not tested: Partial payments, overpayment rejection, payment date normalization, multi-method payments
- Files: `app/routers/sales.py:244-290`, `app/routers/clients.py:182-206`
- Risk: Critical business logic (balance calculations) could break silently
- Priority: High — payment bugs directly impact financials

**Stock Validation Untested:**
- What's not tested: Stock insufficient error responses, force=true bypass, cascade effects on sale update, negative stock edge cases
- Files: `app/routers/sales.py:42-71`, `app/routers/sales.py:180-210`
- Risk: Sales could exceed available stock if validation is disabled accidentally
- Priority: High — stock bugs cause unfulfillable orders

**Authorization Untested:**
- What's not tested: require_admin dependency, role-based access control, permission inheritance, token expiry
- Files: `app/auth.py:91-98`, `app/routers/users.py`, `app/routers/roles.py`
- Risk: Permission leaks could allow operators to perform admin actions
- Priority: High — auth bugs are security bugs

**Database Constraints Untested:**
- What's not tested: Unique constraints on (type, name), FK cascade behavior, transaction rollback on constraint violations
- Files: `app/models.py`
- Risk: Integrity violations could corrupt data
- Priority: Medium — should be tested in integration tests

---

*Concerns audit: 2026-06-10*
