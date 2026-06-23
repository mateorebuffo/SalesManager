# app/models.py
from sqlalchemy import Column, Integer, String, DateTime, func, Boolean, ForeignKey, Numeric, UniqueConstraint, JSON
from sqlalchemy.orm import relationship
from .database import Base

class Client(Base):
    __tablename__ = "clients"

    id = Column(Integer, primary_key=True, index=True)  # int autoincremental
    name = Column(String(120), nullable=False)
    phone = Column(String(50), nullable=True)
    notes = Column(String(500), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    price_list_id = Column(Integer, ForeignKey("price_lists.id"), nullable=True, index=True)
    is_supplier = Column(Boolean, nullable=False, server_default="false")
    price_list = relationship("PriceList")

class Product(Base):
    __tablename__ = "products"
    __table_args__ = (
        UniqueConstraint("type", "name", name="uq_products_type_name"),
    )

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(120), nullable=False)
    type = Column(String(80), nullable=False)  # importante: NO NULL
    active = Column(Boolean, nullable=False, server_default="true")
    is_service = Column(Boolean, nullable=False, server_default="false")
    cost_price = Column(Numeric(12, 2), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

class Sale(Base):
    __tablename__ = "sales"

    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=False)

    sale_date = Column(DateTime(timezone=True), nullable=False)  # editable (puede ser pasado)
    notes = Column(String(500), nullable=True)
    sale_type = Column(String(20), nullable=False, server_default="sale")  # "sale" | "purchase"
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    client = relationship("Client")
    items = relationship("SaleItem", back_populates="sale", cascade="all, delete-orphan")
    payments = relationship("Payment", back_populates="sale", cascade="all, delete-orphan")


class SaleItem(Base):
    __tablename__ = "sale_items"

    id = Column(Integer, primary_key=True, index=True)
    sale_id = Column(Integer, ForeignKey("sales.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)

    quantity = Column(Numeric(12, 3), nullable=False)      # permite 1.5 kg, etc.
    unit_price = Column(Numeric(12, 2), nullable=False)    # montos con 2 decimales
    notes = Column(String(500), nullable=True)

    sale = relationship("Sale", back_populates="items")
    product = relationship("Product")


class Payment(Base):
    __tablename__ = "payments"

    id = Column(Integer, primary_key=True, index=True)

    client_id = Column(Integer, ForeignKey("clients.id"), nullable=False)
    sale_id = Column(Integer, ForeignKey("sales.id"), nullable=True)

    payment_date = Column(DateTime(timezone=True), nullable=False)
    amount = Column(Numeric(12, 2), nullable=False)
    notes = Column(String(500), nullable=True)

    sale = relationship("Sale", back_populates="payments")
    client = relationship("Client")


class PriceList(Base):
    __tablename__ = "price_lists"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(120), nullable=False, unique=True, index=True)
    active = Column(Boolean, nullable=False, default=True)

    # opcional
    prices = relationship("ProductPrice", back_populates="price_list")


class ProductPrice(Base):
    __tablename__ = "product_prices"
    __table_args__ = (
        UniqueConstraint("price_list_id", "product_id", name="uq_product_price_list_product"),
    )

    id = Column(Integer, primary_key=True, index=True)
    price_list_id = Column(Integer, ForeignKey("price_lists.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True)
    price = Column(Numeric(12, 2), nullable=False)

    price_list = relationship("PriceList", back_populates="prices")
    product = relationship("Product")


class StockEntry(Base):
    __tablename__ = "stock_entries"

    id = Column(Integer, primary_key=True, index=True)
    entry_date = Column(DateTime(timezone=True), nullable=False)
    notes = Column(String(500), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    items = relationship("StockItem", back_populates="entry", cascade="all, delete-orphan")


class StockItem(Base):
    __tablename__ = "stock_items"

    id = Column(Integer, primary_key=True, index=True)
    stock_entry_id = Column(Integer, ForeignKey("stock_entries.id"), nullable=False, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False, index=True)
    quantity = Column(Numeric(12, 3), nullable=False)

    entry = relationship("StockEntry", back_populates="items")
    product = relationship("Product")


class SupplierPayment(Base):
    __tablename__ = "supplier_payments"

    id = Column(Integer, primary_key=True, index=True)
    supplier_id = Column(Integer, ForeignKey("clients.id"), nullable=False, index=True)
    purchase_id = Column(Integer, ForeignKey("sales.id"), nullable=True, index=True)
    payment_date = Column(DateTime(timezone=True), nullable=False)
    amount = Column(Numeric(12, 2), nullable=False)
    notes = Column(String(500), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    supplier = relationship("Client")
    purchase = relationship("Sale")


class Role(Base):
    __tablename__ = "roles"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), unique=True, nullable=False, index=True)
    permissions = Column(JSON, nullable=False, default=list)  # ["sale", "client", ...]
    is_system = Column(Boolean, nullable=False, server_default="false")


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(80), unique=True, nullable=False, index=True)
    hashed_password = Column(String(200), nullable=False)
    role = Column(String(50), nullable=False, server_default="operator")  # nombre del rol
    active = Column(Boolean, nullable=False, server_default="true")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
