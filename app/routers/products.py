from datetime import date, datetime, time, timedelta
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy import func
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from typing import List, Literal, Optional

from ..auth import CurrentUser, get_current_user
from ..database import get_db
from ..models import Product, ProductPrice, PriceList, Notification, Sale, SaleItem
from ..schemas import ProductCreate, ProductUpdate, ProductOut, ProductPriceOut, ProductPriceUpsert, AR_TZ

router = APIRouter(prefix="/products", tags=["products"])


def _build_product_out(product: Product, db: Session) -> ProductOut:
    """Construye ProductOut incluyendo precios de todas las listas."""
    rows = (
        db.query(ProductPrice, PriceList.name.label("price_list_name"))
        .join(PriceList, PriceList.id == ProductPrice.price_list_id)
        .filter(ProductPrice.product_id == product.id)
        .all()
    )
    prices = [
        ProductPriceOut(
            price_list_id=pp.price_list_id,
            price_list_name=name,
            price=pp.price,
        )
        for pp, name in rows
    ]
    return ProductOut(
        id=product.id,
        name=product.name,
        type=product.type,
        cost_price=product.cost_price,
        active=product.active,
        is_service=product.is_service,
        created_at=product.created_at,
        prices=prices,
    )


@router.post("", response_model=ProductOut, status_code=status.HTTP_201_CREATED)
def create_product(
    payload: ProductCreate,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    existing = db.query(Product).filter(
        Product.name == payload.name,
        Product.type == payload.type,
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="Ya existe un producto con ese nombre en ese tipo.")

    product = Product(
        name=payload.name,
        type=payload.type,
        cost_price=payload.cost_price,
        active=payload.active,
        is_service=payload.is_service,
    )
    db.add(product)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Ya existe un producto con ese nombre en ese tipo.")
    db.refresh(product)

    if current_user.role != "admin":
        db.add(Notification(
            triggered_by_id=current_user.id,
            triggered_by_username=current_user.username,
            action_type="nuevo_producto",
            detail={"product_id": product.id, "nombre": product.name, "tipo": product.type},
        ))
        db.commit()

    return _build_product_out(product, db)


@router.get("", response_model=List[ProductOut])
def list_products(
    include_inactive: bool = Query(False, description="Si es true, incluye productos inactivos"),
    db: Session = Depends(get_db),
):
    q = db.query(Product)
    if not include_inactive:
        q = q.filter(Product.active == True)  # noqa: E712
    products = q.order_by(Product.id.desc()).all()
    return [_build_product_out(p, db) for p in products]


@router.get("/sales-summary")
def sales_summary(
    group_by: Literal["product", "type"] = "product",
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    client_id: Optional[int] = None,
    db: Session = Depends(get_db),
):
    """Cantidades vendidas agrupadas por producto o categoría (excluye compras a proveedores)."""
    cols = [Product.type] if group_by == "type" else [Product.id, Product.name, Product.type]
    qty = func.sum(SaleItem.quantity).label("quantity")
    amount = func.sum(SaleItem.quantity * SaleItem.unit_price).label("amount")
    q = (
        db.query(*cols, qty, amount)
        .join(Sale, Sale.id == SaleItem.sale_id)
        .join(Product, Product.id == SaleItem.product_id)
        .filter(Sale.sale_type == "sale")
    )
    if date_from:
        q = q.filter(Sale.sale_date >= datetime.combine(date_from, time.min, AR_TZ))
    if date_to:
        q = q.filter(Sale.sale_date < datetime.combine(date_to + timedelta(days=1), time.min, AR_TZ))
    if client_id:
        q = q.filter(Sale.client_id == client_id)
    rows = q.group_by(*cols).order_by(qty.desc()).all()

    if group_by == "type":
        return [{"type": r.type, "quantity": float(r.quantity), "amount": round(float(r.amount), 2)} for r in rows]
    return [
        {"product_id": r.id, "name": r.name, "type": r.type, "quantity": float(r.quantity), "amount": round(float(r.amount), 2)}
        for r in rows
    ]


@router.put("/{product_id}", response_model=ProductOut)
def update_product(
    product_id: int,
    payload: ProductUpdate,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Producto no existe.")

    product.name = payload.name
    product.type = payload.type
    product.cost_price = payload.cost_price
    product.active = payload.active
    product.is_service = payload.is_service

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Ya existe un producto con ese nombre en ese tipo.")
    db.refresh(product)

    if current_user.role != "admin":
        db.add(Notification(
            triggered_by_id=current_user.id,
            triggered_by_username=current_user.username,
            action_type="edicion_producto",
            detail={"product_id": product.id, "nombre": product.name, "tipo": product.type, "activo": product.active},
        ))
        db.commit()

    return _build_product_out(product, db)


@router.post("/{product_id}/prices", response_model=ProductPriceOut, status_code=status.HTTP_200_OK)
def upsert_product_price(
    product_id: int,
    payload: ProductPriceUpsert,
    db: Session = Depends(get_db),
):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Producto no existe.")

    price_list = db.query(PriceList).filter(PriceList.id == payload.price_list_id).first()
    if not price_list:
        raise HTTPException(status_code=404, detail="Lista de precios no existe.")

    pp = db.query(ProductPrice).filter(
        ProductPrice.product_id == product_id,
        ProductPrice.price_list_id == payload.price_list_id,
    ).first()

    if pp:
        pp.price = payload.price
    else:
        pp = ProductPrice(
            product_id=product_id,
            price_list_id=payload.price_list_id,
            price=payload.price,
        )
        db.add(pp)

    db.commit()
    db.refresh(pp)
    return ProductPriceOut(
        price_list_id=pp.price_list_id,
        price_list_name=price_list.name,
        price=pp.price,
    )
