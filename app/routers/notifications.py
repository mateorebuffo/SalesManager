from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from ..auth import require_admin, CurrentUser
from ..database import get_db
from ..models import Notification
from ..schemas import NotificationOut

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("/count")
def get_notification_count(
    current_user: CurrentUser = Depends(require_admin),
    db: Session = Depends(get_db),
):
    count = db.query(Notification).filter(Notification.is_read == False).count()  # noqa: E712
    return {"count": count}


@router.get("", response_model=list[NotificationOut])
def get_notifications(
    current_user: CurrentUser = Depends(require_admin),
    db: Session = Depends(get_db),
):
    return db.query(Notification).order_by(Notification.created_at.desc()).limit(100).all()


@router.post("/read-all", status_code=200)
def mark_all_read(
    current_user: CurrentUser = Depends(require_admin),
    db: Session = Depends(get_db),
):
    db.query(Notification).filter(Notification.is_read == False).update({"is_read": True})  # noqa: E712
    db.commit()
    return {"ok": True}
