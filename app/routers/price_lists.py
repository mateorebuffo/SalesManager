from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import PriceList
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