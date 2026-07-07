from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, selectinload
from sqlalchemy import func
from decimal import Decimal
from zoneinfo import ZoneInfo

from ..auth import CurrentUser, get_current_user
from ..database import get_db
from ..models import Product, StockEntry, StockItem, SaleItem, Notification
from ..schemas import StockEntryCreate, StockEntryUpdate, StockEntryOut, ProductStockOut, StockItemOut

router = APIRouter(prefix="/stock", tags=["stock"])

AR_TZ = ZoneInfo("America/Argentina/Cordoba")


@router.get("/current", response_model=list[ProductStockOut])
def get_current_stock(db: Session = Depends(get_db)):
    stock_in_subq = (
        db.query(StockItem.product_id, func.coalesce(func.sum(StockItem.quantity), 0).label("total_in"))
        .group_by(StockItem.product_id)
        .subquery()
    )
    stock_out_subq = (
        db.query(SaleItem.product_id, func.coalesce(func.sum(SaleItem.quantity), 0).label("total_out"))
        .group_by(SaleItem.product_id)
        .subquery()
    )

    rows = (
        db.query(
            Product,
            func.coalesce(stock_in_subq.c.total_in, 0).label("stock_in"),
            func.coalesce(stock_out_subq.c.total_out, 0).label("stock_out"),
        )
        .outerjoin(stock_in_subq, Product.id == stock_in_subq.c.product_id)
        .outerjoin(stock_out_subq, Product.id == stock_out_subq.c.product_id)
        .filter(Product.active == True)  # noqa: E712
        .order_by(Product.type, Product.name)
        .all()
    )

    return [
        ProductStockOut(
            product_id=p.id,
            product_name=p.name,
            product_type=p.type,
            is_service=p.is_service,
            stock_in=Decimal(str(sin)).quantize(Decimal("0.001")),
            stock_out=Decimal(str(sout)).quantize(Decimal("0.001")),
            current_stock=(Decimal(str(sin)) - Decimal(str(sout))).quantize(Decimal("0.001")),
        )
        for p, sin, sout in rows
    ]


@router.get("/entries", response_model=list[StockEntryOut])
def list_stock_entries(db: Session = Depends(get_db)):
    entries = (
        db.query(StockEntry)
        .options(selectinload(StockEntry.items).selectinload(StockItem.product))
        .order_by(StockEntry.entry_date.desc())
        .all()
    )

    return [
        StockEntryOut(
            id=e.id,
            entry_date=e.entry_date,
            notes=e.notes,
            created_at=e.created_at,
            items=[
                StockItemOut(
                    id=it.id,
                    product_id=it.product_id,
                    product_name=it.product.name if it.product else str(it.product_id),
                    quantity=it.quantity,
                )
                for it in e.items
            ],
        )
        for e in entries
    ]


@router.post("/entries", response_model=StockEntryOut, status_code=status.HTTP_201_CREATED)
def create_stock_entry(
    payload: StockEntryCreate,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    product_ids = [it.product_id for it in payload.items]
    products = db.query(Product).filter(Product.id.in_(product_ids), Product.active == True).all()  # noqa: E712
    if len(products) != len(set(product_ids)):
        raise HTTPException(status_code=400, detail="Uno o más productos no existen o están inactivos.")

    entry_date = payload.entry_date
    if entry_date.tzinfo is None:
        entry_date = entry_date.replace(tzinfo=AR_TZ)
    else:
        entry_date = entry_date.astimezone(AR_TZ)

    entry = StockEntry(entry_date=entry_date, notes=payload.notes)
    db.add(entry)
    db.flush()

    product_map = {p.id: p for p in products}
    items_out = []
    for it in payload.items:
        si = StockItem(stock_entry_id=entry.id, product_id=it.product_id, quantity=it.quantity)
        db.add(si)
        db.flush()
        items_out.append(StockItemOut(
            id=si.id,
            product_id=it.product_id,
            product_name=product_map[it.product_id].name,
            quantity=it.quantity,
        ))

    db.commit()

    if current_user.role != "admin":
        db.add(Notification(
            triggered_by_id=current_user.id,
            triggered_by_username=current_user.username,
            action_type="nueva_entrada_stock",
            detail={
                "entry_id": entry.id,
                "items": [{"producto": product_map[it.product_id].name, "cantidad": float(it.quantity)} for it in payload.items],
            },
        ))
        db.commit()

    return StockEntryOut(
        id=entry.id,
        entry_date=entry.entry_date,
        notes=entry.notes,
        created_at=entry.created_at,
        items=items_out,
    )


@router.delete("/entries/{entry_id}", status_code=204)
def delete_stock_entry(
    entry_id: int,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    entry = db.query(StockEntry).filter(StockEntry.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Ingreso no existe.")
    db.delete(entry)
    db.commit()


@router.put("/entries/{entry_id}", response_model=StockEntryOut)
def update_stock_entry(
    entry_id: int,
    payload: StockEntryUpdate,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    entry = (
        db.query(StockEntry)
        .options(selectinload(StockEntry.items).selectinload(StockItem.product))
        .filter(StockEntry.id == entry_id)
        .first()
    )
    if not entry:
        raise HTTPException(status_code=404, detail="Ingreso no existe.")

    if payload.entry_date is not None:
        entry_date = payload.entry_date
        if entry_date.tzinfo is None:
            entry_date = entry_date.replace(tzinfo=AR_TZ)
        else:
            entry_date = entry_date.astimezone(AR_TZ)
        entry.entry_date = entry_date

    if payload.notes is not None:
        entry.notes = payload.notes or None

    if payload.items is not None:
        product_ids = [it.product_id for it in payload.items]
        products = db.query(Product).filter(Product.id.in_(product_ids), Product.active == True).all()  # noqa: E712
        if len(products) != len(set(product_ids)):
            raise HTTPException(status_code=400, detail="Uno o más productos no existen o están inactivos.")

        for old in entry.items:
            db.delete(old)
        db.flush()

        product_map = {p.id: p for p in products}
        items_out = []
        for it in payload.items:
            si = StockItem(stock_entry_id=entry.id, product_id=it.product_id, quantity=it.quantity)
            db.add(si)
            db.flush()
            items_out.append(StockItemOut(
                id=si.id,
                product_id=it.product_id,
                product_name=product_map[it.product_id].name,
                quantity=it.quantity,
            ))
    else:
        items_out = [
            StockItemOut(
                id=it.id,
                product_id=it.product_id,
                product_name=it.product.name if it.product else str(it.product_id),
                quantity=it.quantity,
            )
            for it in entry.items
        ]

    db.commit()

    if current_user.role != "admin":
        db.add(Notification(
            triggered_by_id=current_user.id,
            triggered_by_username=current_user.username,
            action_type="edicion_entrada_stock",
            detail={
                "entry_id": entry_id,
                "items_count": len(payload.items) if payload.items else 0,
            },
        ))
        db.commit()

    return StockEntryOut(
        id=entry.id,
        entry_date=entry.entry_date,
        notes=entry.notes,
        created_at=entry.created_at,
        items=items_out,
    )
