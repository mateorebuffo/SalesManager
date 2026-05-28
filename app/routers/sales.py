import logging
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from decimal import Decimal
from datetime import datetime
from zoneinfo import ZoneInfo

from ..auth import CurrentUser, get_current_user
from ..database import get_db
from ..models import Client, Product, Sale, SaleItem, Payment, StockItem
from ..schemas import SaleCreate, SaleSummaryOut, PaymentCreate, SaleBalanceOut, SaleDetailOut, SaleItemOut, SaleUpdate

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/sales", tags=["sales"])

AR_TZ = ZoneInfo("America/Argentina/Cordoba")

@router.post("", response_model=SaleSummaryOut, status_code=status.HTTP_201_CREATED)
def create_sale(
    payload: SaleCreate,
    force: bool = False,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    # Solo admin puede forzar ventas ignorando stock
    if force and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Solo un administrador puede forzar ventas sin stock.")

    # 1) validar cliente
    client = db.query(Client).filter(Client.id == payload.client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Cliente no existe.")

    # 2) validar productos (y que estén activos)
    product_ids = [i.product_id for i in payload.items]
    products = db.query(Product).filter(Product.id.in_(product_ids), Product.active == True).all()  # noqa: E712
    if len(products) != len(set(product_ids)):
        raise HTTPException(status_code=400, detail="Uno o más productos no existen o están inactivos.")

    # 2b) verificar stock disponible (si no se fuerza)
    if not force:
        stock_in_map = dict(
            db.query(StockItem.product_id, func.coalesce(func.sum(StockItem.quantity), 0))
            .filter(StockItem.product_id.in_(product_ids))
            .group_by(StockItem.product_id)
            .all()
        )
        stock_out_map = dict(
            db.query(SaleItem.product_id, func.coalesce(func.sum(SaleItem.quantity), 0))
            .filter(SaleItem.product_id.in_(product_ids))
            .group_by(SaleItem.product_id)
            .all()
        )
        product_map = {p.id: p for p in products}
        insufficient = []
        for it in payload.items:
            available = Decimal(str(stock_in_map.get(it.product_id, 0))) - Decimal(str(stock_out_map.get(it.product_id, 0)))
            if it.quantity > available:
                insufficient.append({
                    "product_id": it.product_id,
                    "product_name": product_map[it.product_id].name,
                    "requested": float(it.quantity),
                    "available": float(available),
                    "missing": float(it.quantity - available),
                })
        if insufficient:
            raise HTTPException(
                status_code=409,
                detail={"code": "STOCK_INSUFFICIENT", "items": insufficient},
            )
    else:
        logger.warning(
            "Venta creada con force=True (stock omitido). client_id=%s productos=%s",
            payload.client_id,
            [i.product_id for i in payload.items],
        )

    # 3) crear venta + items en transacción
    sale = Sale(
        client_id=payload.client_id,
        sale_date=payload.sale_date,
        notes=payload.notes,
    )
    db.add(sale)
    db.flush()  # obtiene sale.id sin commit

    total = Decimal("0.00")
    for it in payload.items:
        subtotal = (it.quantity * it.unit_price)
        total += subtotal
        db.add(SaleItem(
            sale_id=sale.id,
            product_id=it.product_id,
            quantity=it.quantity,
            unit_price=it.unit_price,
            notes=it.notes
        ))

    paid = Decimal("0.00")
    if payload.initial_payment_amount is not None and payload.initial_payment_amount > 0:
        if payload.initial_payment_amount > total:
            raise HTTPException(status_code=400, detail="El pago inicial no puede ser mayor al total.")
        paid = payload.initial_payment_amount

        if payload.initial_payment_notes:
            payment_notes = payload.initial_payment_notes
        else:
            is_partial = paid < total
            method_str = f" {payload.initial_payment_method}" if payload.initial_payment_method else ""
            payment_notes = (
                f"Pago parcial Venta #{sale.id}{method_str}" if is_partial
                else f"Pago completo Venta #{sale.id}{method_str}"
            )
        db.add(Payment(
            client_id=sale.client_id,
            sale_id=sale.id,
            payment_date=datetime.now(AR_TZ),
            amount=paid,
            notes=payment_notes
        ))

    db.commit()
    return SaleSummaryOut(
        sale_id=sale.id,
        total=total.quantize(Decimal("0.01")),
        paid=paid.quantize(Decimal("0.01")),
        balance=(total - paid).quantize(Decimal("0.01")),
    )

@router.get("/{sale_id}", response_model=SaleDetailOut)
def get_sale(sale_id: int, db: Session = Depends(get_db)):
    sale = db.query(Sale).filter(Sale.id == sale_id).first()
    if not sale:
        raise HTTPException(status_code=404, detail="Venta no existe.")

    total = db.query(func.coalesce(func.sum(SaleItem.quantity * SaleItem.unit_price), 0)) \
              .filter(SaleItem.sale_id == sale_id).scalar()
    paid = db.query(func.coalesce(func.sum(Payment.amount), 0)) \
             .filter(Payment.sale_id == sale_id).scalar()

    total_dec = Decimal(str(total)).quantize(Decimal("0.01"))
    paid_dec = Decimal(str(paid)).quantize(Decimal("0.01"))

    items = [
        SaleItemOut(
            id=it.id,
            product_id=it.product_id,
            product_name=it.product.name,
            quantity=it.quantity,
            unit_price=it.unit_price,
            notes=it.notes,
        )
        for it in sale.items
    ]

    return SaleDetailOut(
        sale_id=sale.id,
        client_id=sale.client_id,
        sale_date=sale.sale_date,
        notes=sale.notes,
        items=items,
        total=total_dec,
        paid=paid_dec,
        balance=(total_dec - paid_dec).quantize(Decimal("0.01")),
    )


@router.put("/{sale_id}", response_model=SaleSummaryOut)
def update_sale(sale_id: int, payload: SaleUpdate, force: bool = False, db: Session = Depends(get_db)):
    sale = db.query(Sale).filter(Sale.id == sale_id).first()
    if not sale:
        raise HTTPException(status_code=404, detail="Venta no existe.")

    product_ids = [i.product_id for i in payload.items]
    products = db.query(Product).filter(Product.id.in_(product_ids), Product.active == True).all()  # noqa: E712
    if len(products) != len(set(product_ids)):
        raise HTTPException(status_code=400, detail="Uno o más productos no existen o están inactivos.")

    if not force:
        stock_in_map = dict(
            db.query(StockItem.product_id, func.coalesce(func.sum(StockItem.quantity), 0))
            .filter(StockItem.product_id.in_(product_ids))
            .group_by(StockItem.product_id)
            .all()
        )
        # Stock out excluyendo esta venta (sus items viejos se van a reemplazar)
        stock_out_map = dict(
            db.query(SaleItem.product_id, func.coalesce(func.sum(SaleItem.quantity), 0))
            .filter(SaleItem.product_id.in_(product_ids), SaleItem.sale_id != sale_id)
            .group_by(SaleItem.product_id)
            .all()
        )
        product_map = {p.id: p for p in products}
        insufficient = []
        for it in payload.items:
            available = Decimal(str(stock_in_map.get(it.product_id, 0))) - Decimal(str(stock_out_map.get(it.product_id, 0)))
            if it.quantity > available:
                insufficient.append({
                    "product_id": it.product_id,
                    "product_name": product_map[it.product_id].name,
                    "requested": float(it.quantity),
                    "available": float(available),
                    "missing": float(it.quantity - available),
                })
        if insufficient:
            raise HTTPException(
                status_code=409,
                detail={"code": "STOCK_INSUFFICIENT", "items": insufficient},
            )

    if payload.sale_date is not None:
        sale.sale_date = payload.sale_date
    sale.notes = payload.notes

    db.query(SaleItem).filter(SaleItem.sale_id == sale_id).delete()

    total = Decimal("0.00")
    for it in payload.items:
        total += it.quantity * it.unit_price
        db.add(SaleItem(
            sale_id=sale_id,
            product_id=it.product_id,
            quantity=it.quantity,
            unit_price=it.unit_price,
            notes=it.notes,
        ))

    db.commit()

    paid = db.query(func.coalesce(func.sum(Payment.amount), 0)) \
             .filter(Payment.sale_id == sale_id).scalar()
    paid_dec = Decimal(str(paid)).quantize(Decimal("0.01"))

    return SaleSummaryOut(
        sale_id=sale_id,
        total=total.quantize(Decimal("0.01")),
        paid=paid_dec,
        balance=(total - paid_dec).quantize(Decimal("0.01")),
    )


@router.post("/{sale_id}/payments", response_model=SaleBalanceOut, status_code=status.HTTP_201_CREATED)
def add_payment(sale_id: int, payload: PaymentCreate, db: Session = Depends(get_db)):
    sale = db.query(Sale).filter(Sale.id == sale_id).first()
    if not sale:
        raise HTTPException(status_code=404, detail="Venta no existe.")

    # Normalizar fecha del pago a Argentina
    payment_dt = payload.payment_date
    if payment_dt is None:
        payment_dt = datetime.now(AR_TZ)
    else:
        if payment_dt.tzinfo is None:
            payment_dt = payment_dt.replace(tzinfo=AR_TZ)
        else:
            payment_dt = payment_dt.astimezone(AR_TZ)

    amount = payload.amount

    # Calcular total y pagado para validar sobrepago (opcional)
    total = db.query(func.coalesce(func.sum(SaleItem.quantity * SaleItem.unit_price), 0)) \
              .filter(SaleItem.sale_id == sale_id).scalar()

    paid = db.query(func.coalesce(func.sum(Payment.amount), 0)) \
             .filter(Payment.sale_id == sale_id).scalar()

    total_dec = Decimal(str(total)).quantize(Decimal("0.01"))
    paid_dec = Decimal(str(paid)).quantize(Decimal("0.01"))
    balance_dec = (total_dec - paid_dec).quantize(Decimal("0.01"))

    if amount > balance_dec:
        raise HTTPException(status_code=400, detail=f"El pago ({amount}) no puede ser mayor al saldo ({balance_dec}).")

    db.add(Payment(
        client_id=sale.client_id,  # ✅ FIX clave
        sale_id=sale_id,
        payment_date=payment_dt,
        amount=amount,
        notes=payload.notes
    ))
    db.commit()

    # Recalcular pagado
    paid_after = db.query(func.coalesce(func.sum(Payment.amount), 0)) \
                   .filter(Payment.sale_id == sale_id).scalar()

    paid_after_dec = Decimal(str(paid_after)).quantize(Decimal("0.01"))
    balance_after_dec = (total_dec - paid_after_dec).quantize(Decimal("0.01"))

    return SaleBalanceOut(sale_id=sale_id, total=total_dec, paid=paid_after_dec, balance=balance_after_dec)