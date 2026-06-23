from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from decimal import Decimal
from pydantic import field_validator
from zoneinfo import ZoneInfo

# Límite superior para evitar overflow en columnas Numeric(12,2)
_MAX_AMOUNT = Decimal("9999999999.99")
_MAX_QTY    = Decimal("999999.999")


class ProductPriceOut(BaseModel):
    price_list_id: int
    price_list_name: str
    price: Decimal

    model_config = {"from_attributes": True}

class ProductPriceUpsert(BaseModel):
    price_list_id: int
    price: Decimal

    @field_validator("price")
    @classmethod
    def validate_price(cls, v: Decimal):
        if v < 0:
            raise ValueError("price debe ser >= 0")
        if v > _MAX_AMOUNT:
            raise ValueError(f"price no puede superar {_MAX_AMOUNT}")
        return v

class ProductCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    type: str = Field(min_length=1, max_length=80)
    cost_price: Optional[Decimal] = None
    active: bool = True
    is_service: bool = False

class ProductUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    type: str = Field(min_length=1, max_length=80)
    cost_price: Optional[Decimal] = None
    active: bool = True
    is_service: bool = False

class ProductOut(BaseModel):
    id: int
    name: str
    type: str
    cost_price: Optional[Decimal] = None
    active: bool
    is_service: bool = False
    created_at: datetime
    prices: list[ProductPriceOut] = []

    model_config = {"from_attributes": True}

class SaleItemCreate(BaseModel):
    product_id: int
    quantity: Decimal
    unit_price: Decimal
    notes: Optional[str] = Field(default=None, max_length=500)

    @field_validator("quantity")
    @classmethod
    def validate_quantity(cls, v: Decimal):
        if v <= 0:
            raise ValueError("quantity debe ser > 0")
        if v > _MAX_QTY:
            raise ValueError(f"quantity no puede superar {_MAX_QTY}")
        return v

    @field_validator("unit_price")
    @classmethod
    def validate_unit_price(cls, v: Decimal):
        if v < 0:
            raise ValueError("unit_price debe ser >= 0")
        if v > _MAX_AMOUNT:
            raise ValueError(f"unit_price no puede superar {_MAX_AMOUNT}")
        return v


AR_TZ = ZoneInfo("America/Argentina/Cordoba")

class SaleCreate(BaseModel):
    client_id: int
    sale_date: datetime
    notes: Optional[str] = Field(default=None, max_length=500)
    items: List[SaleItemCreate]
    initial_payment_amount: Optional[Decimal] = None
    initial_payment_method: Optional[str] = Field(default=None, max_length=80)
    initial_payment_notes: Optional[str] = Field(default=None, max_length=1000)
    sale_type: str = "sale"  # "sale" | "purchase"

    @field_validator("sale_date")
    @classmethod
    def normalize_sale_date(cls, v: datetime):
        if v.tzinfo is None:
            v = v.replace(tzinfo=AR_TZ)
        else:
            v = v.astimezone(AR_TZ)
        # No permitir fechas futuras (margen de 5 min por diferencia de relojes)
        from datetime import timedelta
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

class SaleSummaryOut(BaseModel):
    sale_id: int
    total: Decimal
    paid: Decimal
    balance: Decimal

class SaleStatementRow(BaseModel):
    sale_id: int
    sale_date: datetime
    total: Decimal
    paid: Decimal
    balance: Decimal
    sale_type: str = "sale"

class ClientStatementOut(BaseModel):
    client_id: int
    client_name: str
    total_balance: Decimal
    sales: list[SaleStatementRow]

class ClientDeliveryRow(BaseModel):
    sale_id: int
    sale_date: datetime
    product_id: int
    product_name: str
    product_type: str | None = None
    quantity: Decimal
    unit_price: Decimal
    subtotal: Decimal
    notes: str | None = None

class ClientDeliveriesOut(BaseModel):
    client_id: int
    client_name: str
    deliveries: list[ClientDeliveryRow]

class ClientPaymentCreate(BaseModel):
    amount: Decimal
    payment_date: Optional[datetime] = None
    notes: Optional[str] = Field(default=None, max_length=500)

    @field_validator("amount")
    @classmethod
    def validate_amount(cls, v: Decimal):
        if v <= 0:
            raise ValueError("amount debe ser > 0")
        if v > _MAX_AMOUNT:
            raise ValueError(f"amount no puede superar {_MAX_AMOUNT}")
        return v

class PaymentCreate(BaseModel):
    amount: Decimal
    payment_date: Optional[datetime] = None
    notes: Optional[str] = Field(default=None, max_length=500)

    @field_validator("amount")
    @classmethod
    def validate_amount(cls, v: Decimal):
        if v <= 0:
            raise ValueError("amount debe ser > 0")
        if v > _MAX_AMOUNT:
            raise ValueError(f"amount no puede superar {_MAX_AMOUNT}")
        return v

class SaleBalanceOut(BaseModel):
    sale_id: int
    total: Decimal
    paid: Decimal
    balance: Decimal

class ClientDebtRow(BaseModel):
    client_id: int
    client_name: str
    total_delivered: Decimal
    total_paid: Decimal
    balance: Decimal

class ClientPaymentRow(BaseModel):
    payment_id: int
    payment_date: datetime
    amount: Decimal
    notes: str | None = None
    sale_id: int | None = None
    kind: str  # "general" o "sale"

class PriceListOut(BaseModel):
    id: int
    name: str
    active: bool
    class Config:
        from_attributes = True

class PriceListCreate(BaseModel):
    name: str
    active: bool = True

class ClientCreate(BaseModel):
    name: str
    phone: Optional[str] = None
    notes: Optional[str] = None
    price_list_id: Optional[int] = None
    is_supplier: bool = False

class ClientOut(BaseModel):
    id: int
    name: str
    phone: Optional[str] = None
    notes: Optional[str] = None
    price_list_id: Optional[int] = None
    is_supplier: bool = False
    class Config:
        from_attributes = True

class SaleItemOut(BaseModel):
    id: int
    product_id: int
    product_name: str
    quantity: Decimal
    unit_price: Decimal
    notes: Optional[str] = None

    model_config = {"from_attributes": True}

class SaleDetailOut(BaseModel):
    sale_id: int
    client_id: int
    sale_date: datetime
    notes: Optional[str] = None
    items: list[SaleItemOut]
    total: Decimal
    paid: Decimal
    balance: Decimal
    sale_type: str = "sale"

class SaleUpdate(BaseModel):
    sale_date: Optional[datetime] = None
    notes: Optional[str] = Field(default=None, max_length=500)
    items: List[SaleItemCreate]

    @field_validator("sale_date")
    @classmethod
    def normalize_sale_date(cls, v: datetime):
        if v is None:
            return v
        if v.tzinfo is None:
            v = v.replace(tzinfo=AR_TZ)
        else:
            v = v.astimezone(AR_TZ)
        from datetime import timedelta
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

class StockItemCreate(BaseModel):
    product_id: int
    quantity: Decimal

    @field_validator("quantity")
    @classmethod
    def validate_quantity(cls, v: Decimal):
        if v <= 0:
            raise ValueError("quantity debe ser > 0")
        if v > _MAX_QTY:
            raise ValueError(f"quantity no puede superar {_MAX_QTY}")
        return v

class StockItemOut(BaseModel):
    id: int
    product_id: int
    product_name: str
    quantity: Decimal

    model_config = {"from_attributes": True}

class StockEntryCreate(BaseModel):
    entry_date: datetime
    notes: Optional[str] = Field(default=None, max_length=500)
    items: List[StockItemCreate]

    @field_validator("items")
    @classmethod
    def validate_items(cls, v):
        if not v:
            raise ValueError("items no puede estar vacío")
        return v

class StockEntryUpdate(BaseModel):
    entry_date: Optional[datetime] = None
    notes: Optional[str] = Field(default=None, max_length=500)
    items: Optional[List[StockItemCreate]] = None

class StockEntryOut(BaseModel):
    id: int
    entry_date: datetime
    notes: Optional[str] = None
    created_at: datetime
    items: list[StockItemOut] = []

    model_config = {"from_attributes": True}

class ProductStockOut(BaseModel):
    product_id: int
    product_name: str
    product_type: str
    is_service: bool = False
    stock_in: Decimal
    stock_out: Decimal
    current_stock: Decimal


# ── Proveedores ───────────────────────────────────────────────────────────────

class SupplierPaymentCreate(BaseModel):
    amount: Decimal
    purchase_id: Optional[int] = None
    payment_date: Optional[datetime] = None
    notes: Optional[str] = Field(default=None, max_length=500)

    @field_validator("amount")
    @classmethod
    def validate_amount(cls, v: Decimal):
        if v <= 0:
            raise ValueError("amount debe ser > 0")
        if v > _MAX_AMOUNT:
            raise ValueError(f"amount no puede superar {_MAX_AMOUNT}")
        return v

class SupplierPaymentOut(BaseModel):
    id: int
    supplier_id: int
    purchase_id: Optional[int] = None
    payment_date: datetime
    amount: Decimal
    notes: Optional[str] = None

    model_config = {"from_attributes": True}

class SupplierPurchaseRow(BaseModel):
    sale_id: int
    sale_date: datetime
    notes: Optional[str] = None
    total: Decimal
    paid: Decimal
    balance: Decimal


# ── Usuarios ──────────────────────────────────────────────────────────────────

_VALID_SCREENS = {"sale", "client", "debtors", "products", "stock"}

class UserCreate(BaseModel):
    username: str = Field(min_length=3, max_length=80)
    password: str = Field(max_length=200)
    role: str = Field(default="operator", min_length=1, max_length=50)

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str):
        if len(v) < 8:
            raise ValueError("La contraseña debe tener al menos 8 caracteres")
        return v


class UserUpdate(BaseModel):
    role: Optional[str] = Field(default=None, min_length=1, max_length=50)
    active: Optional[bool] = None


class UserPasswordUpdate(BaseModel):
    new_password: str = Field(max_length=200)

    @field_validator("new_password")
    @classmethod
    def validate_password(cls, v: str):
        if len(v) < 8:
            raise ValueError("La contraseña debe tener al menos 8 caracteres")
        return v


class UserOut(BaseModel):
    id: int
    username: str
    role: str
    active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Roles ─────────────────────────────────────────────────────────────────────

class RoleOut(BaseModel):
    id: int
    name: str
    permissions: list[str]
    is_system: bool

    model_config = {"from_attributes": True}


class RoleCreate(BaseModel):
    name: str = Field(min_length=1, max_length=50)
    permissions: list[str] = []

    @field_validator("permissions")
    @classmethod
    def validate_permissions(cls, v: list[str]):
        invalid = [p for p in v if p not in _VALID_SCREENS]
        if invalid:
            raise ValueError(f"Pantallas inválidas: {invalid}. Opciones: {sorted(_VALID_SCREENS)}")
        if len(v) != len(set(v)):
            raise ValueError("No puede haber pantallas duplicadas")
        return v


class RoleUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=50)
    permissions: Optional[list[str]] = None

    @field_validator("permissions")
    @classmethod
    def validate_permissions(cls, v: Optional[list[str]]):
        if v is None:
            return v
        invalid = [p for p in v if p not in _VALID_SCREENS]
        if invalid:
            raise ValueError(f"Pantallas inválidas: {invalid}. Opciones: {sorted(_VALID_SCREENS)}")
        if len(v) != len(set(v)):
            raise ValueError("No puede haber pantallas duplicadas")
        return v

    model_config = {"from_attributes": True}