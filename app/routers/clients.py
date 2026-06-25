from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from ..database import get_db
from ..models import Client
from ..schemas import ClientCreate, ClientOut, ClientUpdate, SupplierPaymentCreate, SupplierPaymentOut, SupplierPurchaseRow

from sqlalchemy import func
from decimal import Decimal
from ..models import Sale, SaleItem, Payment, Product, SupplierPayment
from ..models import PriceList
from ..schemas import PriceListOut, PriceListCreate
from ..schemas import ClientStatementOut, SaleStatementRow
from ..schemas import ClientDeliveriesOut, ClientDeliveryRow, ClientDebtRow
from ..schemas import ClientPaymentCreate, ClientPaymentRow

from zoneinfo import ZoneInfo
from datetime import datetime

router = APIRouter(prefix="/clients", tags=["clients"])

@router.post("", response_model=ClientOut, status_code=201)
def create_client(payload: ClientCreate, db: Session = Depends(get_db)):
    name = (payload.name or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Nombre requerido")

    exists = db.query(Client).filter(Client.name == name).first()
    if exists:
        raise HTTPException(status_code=400, detail="Cliente ya existe (nombre exacto).")

    default_pl_id = ensure_default_price_list_id(db)
    pl_id = payload.price_list_id or default_pl_id

    pl = db.query(PriceList).filter(PriceList.id == pl_id, PriceList.active == True).first()
    if not pl:
        raise HTTPException(status_code=400, detail="Lista de precios inválida")

    c = Client(
        name=name,
        phone=payload.phone,
        notes=payload.notes,
        price_list_id=pl_id,
        is_supplier=payload.is_supplier,
    )
    db.add(c)
    db.commit()
    db.refresh(c)
    return c

@router.get("", response_model=List[ClientOut])
def list_clients(is_supplier: bool = None, db: Session = Depends(get_db)):
    q = db.query(Client)
    if is_supplier is not None:
        q = q.filter(Client.is_supplier == is_supplier)
    return q.order_by(Client.id.desc()).all()

@router.put("/{client_id}", response_model=ClientOut)
def update_client(client_id: int, payload: ClientUpdate, db: Session = Depends(get_db)):
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Cliente no encontrado.")
    if payload.name is not None:
        name = payload.name.strip()
        if not name:
            raise HTTPException(status_code=400, detail="Nombre requerido.")
        client.name = name
    if payload.phone is not None:
        client.phone = payload.phone or None
    if payload.notes is not None:
        client.notes = payload.notes or None
    if payload.price_list_id is not None:
        client.price_list_id = payload.price_list_id
    if payload.is_supplier is not None:
        client.is_supplier = payload.is_supplier
    db.commit()
    db.refresh(client)
    return client

@router.get("/{client_id}/statement", response_model=ClientStatementOut)
def client_statement(client_id: int, db: Session = Depends(get_db)):
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Cliente no existe.")

    # Totales por venta: total items
    items_totals_subq = (
        db.query(
            SaleItem.sale_id.label("sale_id"),
            func.coalesce(func.sum(SaleItem.quantity * SaleItem.unit_price), 0).label("total"),
        )
        .group_by(SaleItem.sale_id)
        .subquery()
    )

    # Totales por venta: pagos
    payments_totals_subq = (
        db.query(
            Payment.sale_id.label("sale_id"),
            func.coalesce(func.sum(Payment.amount), 0).label("paid"),
        )
        .group_by(Payment.sale_id)
        .subquery()
    )

    rows = (
        db.query(
            Sale.id.label("sale_id"),
            Sale.sale_date.label("sale_date"),
            Sale.sale_type.label("sale_type"),
            func.coalesce(items_totals_subq.c.total, 0).label("total"),
            func.coalesce(payments_totals_subq.c.paid, 0).label("paid"),
        )
        .outerjoin(items_totals_subq, items_totals_subq.c.sale_id == Sale.id)
        .outerjoin(payments_totals_subq, payments_totals_subq.c.sale_id == Sale.id)
        .filter(Sale.client_id == client_id, Sale.sale_type == "sale")
        .order_by(Sale.sale_date.desc(), Sale.id.desc())
        .all()
    )

    sales_out: list[SaleStatementRow] = []

    total_delivered = Decimal("0.00")
    paid_applied = Decimal("0.00")

    for r in rows:
        total = Decimal(str(r.total)).quantize(Decimal("0.01"))
        paid = Decimal(str(r.paid)).quantize(Decimal("0.01"))
        balance = (total - paid).quantize(Decimal("0.01"))

        total_delivered += total
        paid_applied += paid

        sales_out.append(SaleStatementRow(
            sale_id=r.sale_id,
            sale_date=r.sale_date,
            sale_type=r.sale_type,
            total=total,
            paid=paid,
            balance=balance,
        ))

    # ✅ pagos generales (sale_id NULL) + (opcionalmente) todos los pagos del cliente
    total_paid_all = db.query(func.coalesce(func.sum(Payment.amount), 0)) \
        .filter(Payment.client_id == client_id) \
        .scalar()

    total_paid_all_dec = Decimal(str(total_paid_all)).quantize(Decimal("0.01"))
    total_balance = (total_delivered - total_paid_all_dec).quantize(Decimal("0.01"))

    return ClientStatementOut(
        client_id=client.id,
        client_name=client.name,
        total_balance=total_balance.quantize(Decimal("0.01")),
        sales=sales_out,
    )

@router.get("/{client_id}/deliveries", response_model=ClientDeliveriesOut)
def client_deliveries(client_id: int, sale_type: str = None, db: Session = Depends(get_db)):
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Cliente no existe.")

    q = (
        db.query(
            Sale.id.label("sale_id"),
            Sale.sale_date.label("sale_date"),
            Product.id.label("product_id"),
            Product.name.label("product_name"),
            Product.type.label("product_type"),
            SaleItem.quantity.label("quantity"),
            SaleItem.unit_price.label("unit_price"),
            SaleItem.notes.label("notes"),
        )
        .join(SaleItem, SaleItem.sale_id == Sale.id)
        .join(Product, Product.id == SaleItem.product_id)
        .filter(Sale.client_id == client_id)
    )
    if sale_type:
        q = q.filter(Sale.sale_type == sale_type)
    rows = q.order_by(Sale.sale_date.desc(), Sale.id.desc(), Product.name.asc()).all()

    deliveries: list[ClientDeliveryRow] = []
    for r in rows:
        qty = Decimal(str(r.quantity))
        price = Decimal(str(r.unit_price))
        deliveries.append(
            ClientDeliveryRow(
                sale_id=r.sale_id,
                sale_date=r.sale_date,
                product_id=r.product_id,
                product_name=r.product_name,
                product_type=r.product_type,
                quantity=qty,
                unit_price=price,
                subtotal=(qty * price).quantize(Decimal("0.01")),
                notes=r.notes,
            )
        )

    return ClientDeliveriesOut(
        client_id=client.id,
        client_name=client.name,
        deliveries=deliveries,
    )

AR_TZ = ZoneInfo("America/Argentina/Cordoba")

@router.post("/{client_id}/payments", status_code=status.HTTP_201_CREATED)
def add_client_payment(client_id: int, payload: ClientPaymentCreate, db: Session = Depends(get_db)):
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Cliente no existe.")

    payment_dt = payload.payment_date
    if payment_dt is None:
        payment_dt = datetime.now(AR_TZ)
    else:
        if payment_dt.tzinfo is None:
            payment_dt = payment_dt.replace(tzinfo=AR_TZ)
        else:
            payment_dt = payment_dt.astimezone(AR_TZ)

    p = Payment(
        client_id=client_id,
        sale_id=None,  # pago general
        payment_date=payment_dt,
        amount=payload.amount,
        notes=payload.notes or "Pago a cuenta"
    )
    db.add(p)
    db.commit()
    db.refresh(p)
    return {"payment_id": p.id, "client_id": client_id, "amount": str(p.amount), "payment_date": p.payment_date}

@router.put("/{client_id}/payments/{payment_id}", status_code=200)
def update_client_payment(client_id: int, payment_id: int, payload: ClientPaymentCreate, db: Session = Depends(get_db)):
    payment = db.query(Payment).filter(Payment.id == payment_id, Payment.client_id == client_id).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Pago no existe.")

    payment_dt = payload.payment_date
    if payment_dt is None:
        payment_dt = payment.payment_date  # mantener la fecha existente
    else:
        if payment_dt.tzinfo is None:
            payment_dt = payment_dt.replace(tzinfo=AR_TZ)
        else:
            payment_dt = payment_dt.astimezone(AR_TZ)

    payment.amount = payload.amount
    payment.notes = payload.notes
    payment.payment_date = payment_dt
    db.commit()
    return {"payment_id": payment.id, "amount": str(payment.amount), "payment_date": payment.payment_date}


@router.delete("/{client_id}/payments/{payment_id}", status_code=204)
def delete_client_payment(client_id: int, payment_id: int, db: Session = Depends(get_db)):
    payment = db.query(Payment).filter(Payment.id == payment_id, Payment.client_id == client_id).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Pago no existe.")
    db.delete(payment)
    db.commit()

@router.get("/debtors", response_model=list[ClientDebtRow])
def list_debtors(db: Session = Depends(get_db)):
    # Total entregado por cliente (sum items * price), solo ventas tipo "sale"
    delivered_subq = (
        db.query(
            Sale.client_id.label("client_id"),
            func.coalesce(func.sum(SaleItem.quantity * SaleItem.unit_price), 0).label("total_delivered"),
        )
        .join(SaleItem, SaleItem.sale_id == Sale.id)
        .filter(Sale.sale_type == "sale")
        .group_by(Sale.client_id)
        .subquery()
    )

    # Total pagado por cliente (incluye pagos generales y aplicados)
    paid_subq = (
        db.query(
            Payment.client_id.label("client_id"),
            func.coalesce(func.sum(Payment.amount), 0).label("total_paid"),
        )
        .group_by(Payment.client_id)
        .subquery()
    )

    rows = (
        db.query(
            Client.id.label("client_id"),
            Client.name.label("client_name"),
            func.coalesce(delivered_subq.c.total_delivered, 0).label("total_delivered"),
            func.coalesce(paid_subq.c.total_paid, 0).label("total_paid"),
        )
        .outerjoin(delivered_subq, delivered_subq.c.client_id == Client.id)
        .outerjoin(paid_subq, paid_subq.c.client_id == Client.id)
        .filter(Client.is_supplier == False)  # noqa: E712
        .all()
    )

    out: list[ClientDebtRow] = []
    for r in rows:
        delivered = Decimal(str(r.total_delivered)).quantize(Decimal("0.01"))
        paid = Decimal(str(r.total_paid)).quantize(Decimal("0.01"))
        balance = (delivered - paid).quantize(Decimal("0.01"))

        if balance > 0:
            out.append(ClientDebtRow(
                client_id=r.client_id,
                client_name=r.client_name,
                total_delivered=delivered,
                total_paid=paid,
                balance=balance,
            ))

    # más deudores arriba
    out.sort(key=lambda x: x.balance, reverse=True)
    return out

@router.get("/{client_id}/payments", response_model=list[ClientPaymentRow])
def list_client_payments(client_id: int, db: Session = Depends(get_db)):
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Cliente no existe.")

    rows = (
        db.query(Payment)
        .filter(Payment.client_id == client_id)
        .order_by(Payment.payment_date.desc(), Payment.id.desc())
        .all()
    )

    out: list[ClientPaymentRow] = []
    for p in rows:
        out.append(ClientPaymentRow(
            payment_id=p.id,
            payment_date=p.payment_date,
            amount=Decimal(str(p.amount)).quantize(Decimal("0.01")),
            notes=p.notes,
            sale_id=p.sale_id,
            kind="general" if p.sale_id is None else "sale",
        ))
    return out

@router.get("/{client_id}/purchases", response_model=list[SupplierPurchaseRow])
def list_supplier_purchases(client_id: int, db: Session = Depends(get_db)):
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Proveedor no existe.")

    items_totals_subq = (
        db.query(
            SaleItem.sale_id.label("sale_id"),
            func.coalesce(func.sum(SaleItem.quantity * SaleItem.unit_price), 0).label("total"),
        )
        .group_by(SaleItem.sale_id)
        .subquery()
    )
    paid_subq = (
        db.query(
            SupplierPayment.purchase_id.label("sale_id"),
            func.coalesce(func.sum(SupplierPayment.amount), 0).label("paid"),
        )
        .filter(SupplierPayment.purchase_id.isnot(None))
        .group_by(SupplierPayment.purchase_id)
        .subquery()
    )

    rows = (
        db.query(
            Sale.id.label("sale_id"),
            Sale.sale_date.label("sale_date"),
            Sale.notes.label("notes"),
            func.coalesce(items_totals_subq.c.total, 0).label("total"),
            func.coalesce(paid_subq.c.paid, 0).label("paid"),
        )
        .outerjoin(items_totals_subq, items_totals_subq.c.sale_id == Sale.id)
        .outerjoin(paid_subq, paid_subq.c.sale_id == Sale.id)
        .filter(Sale.client_id == client_id, Sale.sale_type == "purchase")
        .order_by(Sale.sale_date.desc(), Sale.id.desc())
        .all()
    )

    out = []
    for r in rows:
        total = Decimal(str(r.total)).quantize(Decimal("0.01"))
        paid = Decimal(str(r.paid)).quantize(Decimal("0.01"))
        out.append(SupplierPurchaseRow(
            sale_id=r.sale_id,
            sale_date=r.sale_date,
            notes=r.notes,
            total=total,
            paid=paid,
            balance=(total - paid).quantize(Decimal("0.01")),
        ))
    return out


@router.post("/{client_id}/supplier-payments", response_model=SupplierPaymentOut, status_code=status.HTTP_201_CREATED)
def add_supplier_payment(client_id: int, payload: SupplierPaymentCreate, db: Session = Depends(get_db)):
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Proveedor no existe.")

    payment_dt = payload.payment_date
    if payment_dt is None:
        payment_dt = datetime.now(AR_TZ)
    else:
        if payment_dt.tzinfo is None:
            payment_dt = payment_dt.replace(tzinfo=AR_TZ)
        else:
            payment_dt = payment_dt.astimezone(AR_TZ)

    sp = SupplierPayment(
        supplier_id=client_id,
        purchase_id=payload.purchase_id,
        payment_date=payment_dt,
        amount=payload.amount,
        notes=payload.notes,
    )
    db.add(sp)
    db.commit()
    db.refresh(sp)
    return sp


@router.get("/{client_id}/supplier-payments", response_model=list[SupplierPaymentOut])
def list_supplier_payments(client_id: int, db: Session = Depends(get_db)):
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Proveedor no existe.")

    return (
        db.query(SupplierPayment)
        .filter(SupplierPayment.supplier_id == client_id)
        .order_by(SupplierPayment.payment_date.desc(), SupplierPayment.id.desc())
        .all()
    )


def ensure_default_price_list_id(db: Session) -> int:
    pl = db.query(PriceList).filter(PriceList.name == "General").first()
    if pl:
        return pl.id
    pl = PriceList(name="General", active=True)
    db.add(pl)
    db.commit()
    db.refresh(pl)
    return pl.id
