from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..auth import CurrentUser, get_current_user, hash_password, require_admin
from ..database import get_db
from ..models import Role, User
from ..schemas import UserCreate, UserOut, UserPasswordUpdate, UserUpdate

router = APIRouter(prefix="/users", tags=["users"])


@router.get("", response_model=list[UserOut])
def list_users(
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_admin),
):
    return db.query(User).order_by(User.id).all()


@router.post("", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_user(
    payload: UserCreate,
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_admin),
):
    if db.query(User).filter(User.username == payload.username).first():
        raise HTTPException(status_code=400, detail="El nombre de usuario ya existe.")
    if not db.query(Role).filter(Role.name == payload.role).first():
        raise HTTPException(status_code=400, detail=f"El rol '{payload.role}' no existe.")
    user = User(
        username=payload.username,
        hashed_password=hash_password(payload.password),
        role=payload.role,
        active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.put("/{user_id}", response_model=UserOut)
def update_user(
    user_id: int,
    payload: UserUpdate,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_admin),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado.")
    if payload.active is False and user.id == current_user.id:
        raise HTTPException(status_code=400, detail="No podés desactivar tu propio usuario.")
    # No se puede cambiar el propio rol (evita quedarse sin acceso admin)
    if payload.role is not None and user.id == current_user.id and payload.role != "admin":
        raise HTTPException(status_code=400, detail="No podés cambiar tu propio rol de admin.")
    if payload.role is not None:
        if not db.query(Role).filter(Role.name == payload.role).first():
            raise HTTPException(status_code=400, detail=f"El rol '{payload.role}' no existe.")
        user.role = payload.role
    if payload.active is not None:
        user.active = payload.active
    db.commit()
    db.refresh(user)
    return user


@router.put("/{user_id}/password", status_code=status.HTTP_204_NO_CONTENT)
def change_password(
    user_id: int,
    payload: UserPasswordUpdate,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    if current_user.role != "admin" and current_user.id != user_id:
        raise HTTPException(status_code=403, detail="No tenés permiso para cambiar esta contraseña.")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado.")
    user.hashed_password = hash_password(payload.new_password)
    db.commit()
