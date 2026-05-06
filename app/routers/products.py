from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from typing import List

from ..database import get_db
from ..models import Product, ProductPrice, PriceList
from ..schemas import ProductCreate, ProductUpdate, ProductOut, ProductPriceOut, ProductPriceUpsert

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
def create_product(payload: ProductCreate, db: Session = Depends(get_db)):
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


@router.put("/{product_id}", response_model=ProductOut)
def update_product(product_id: int, payload: ProductUpdate, db: Session = Depends(get_db)):
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
