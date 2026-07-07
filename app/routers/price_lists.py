from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Client, PriceList
from app.schemas import PriceListOut, PriceListCreate

router = APIRouter(prefix="/price-lists", tags=["price-lists"])


@router.get("", response_model=list[PriceListOut])
def list_price_lists(db: Session = Depends(get_db)):
    return (
        db.query(PriceList)
        .filter(PriceList.active == True)
        .order_by(PriceList.name.asc())
        .all()
    )


@router.post("", response_model=PriceListOut, status_code=status.HTTP_201_CREATED)
def create_price_list(payload: PriceListCreate, db: Session = Depends(get_db)):
    name = (payload.name or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Nombre requerido")

    exists = db.query(PriceList).filter(PriceList.name == name).first()
    if exists:
        raise HTTPException(status_code=400, detail="Ya existe una lista con ese nombre")

    pl = PriceList(name=name, active=payload.active)
    db.add(pl)
    db.commit()
    db.refresh(pl)
    return pl


@router.put("/{price_list_id}", response_model=PriceListOut)
def update_price_list(price_list_id: int, payload: PriceListCreate, db: Session = Depends(get_db)):
    pl = db.query(PriceList).filter(PriceList.id == price_list_id).first()
    if not pl:
        raise HTTPException(status_code=404, detail="Lista no encontrada")

    name = (payload.name or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Nombre requerido")

    dup = db.query(PriceList).filter(PriceList.name == name, PriceList.id != price_list_id).first()
    if dup:
        raise HTTPException(status_code=400, detail="Ya existe una lista con ese nombre")

    pl.name = name
    pl.active = payload.active
    db.commit()
    db.refresh(pl)
    return pl


@router.delete("/{price_list_id}", status_code=204)
def delete_price_list(price_list_id: int, db: Session = Depends(get_db)):
    pl = db.query(PriceList).filter(PriceList.id == price_list_id).first()
    if not pl:
        raise HTTPException(status_code=404, detail="Lista no encontrada")

    clients_using = db.query(Client).filter(Client.price_list_id == price_list_id).count()
    if clients_using > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Esta lista tiene {clients_using} cliente(s) asignado(s). Reasignales otra lista primero.",
        )

    db.delete(pl)
    db.commit()