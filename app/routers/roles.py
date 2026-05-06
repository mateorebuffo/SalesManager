from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..auth import CurrentUser, get_current_user, require_admin
from ..database import get_db
from ..models import Role, User
from ..schemas import RoleCreate, RoleOut, RoleUpdate

router = APIRouter(prefix="/roles", tags=["roles"])


@router.get("", response_model=list[RoleOut])
def list_roles(
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(get_current_user),
):
    return db.query(Role).order_by(Role.id).all()


@router.post("", response_model=RoleOut, status_code=status.HTTP_201_CREATED)
def create_role(
    payload: RoleCreate,
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_admin),
):
    if db.query(Role).filter(Role.name == payload.name).first():
        raise HTTPException(status_code=400, detail="Ya existe un rol con ese nombre.")
    role = Role(name=payload.name, permissions=payload.permissions, is_system=False)
    db.add(role)
    db.commit()
    db.refresh(role)
    return role


@router.put("/{role_id}", response_model=RoleOut)
def update_role(
    role_id: int,
    payload: RoleUpdate,
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_admin),
):
    role = db.query(Role).filter(Role.id == role_id).first()
    if not role:
        raise HTTPException(status_code=404, detail="Rol no encontrado.")
    if payload.name is not None:
        if role.is_system:
            raise HTTPException(status_code=400, detail="No se puede renombrar un rol de sistema.")
        existing = db.query(Role).filter(Role.name == payload.name, Role.id != role_id).first()
        if existing:
            raise HTTPException(status_code=400, detail="Ya existe un rol con ese nombre.")
        role.name = payload.name
    if payload.permissions is not None:
        if role.name == "admin":
            raise HTTPException(status_code=400, detail="No se pueden modificar los permisos del rol admin.")
        role.permissions = payload.permissions
    db.commit()
    db.refresh(role)
    return role


@router.delete("/{role_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_role(
    role_id: int,
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_admin),
):
    role = db.query(Role).filter(Role.id == role_id).first()
    if not role:
        raise HTTPException(status_code=404, detail="Rol no encontrado.")
    if role.is_system:
        raise HTTPException(status_code=400, detail="No se puede eliminar un rol de sistema.")
    assigned = db.query(User).filter(User.role == role.name).first()
    if assigned:
        raise HTTPException(status_code=400, detail="El rol tiene usuarios asignados. Reasignálos antes de eliminarlo.")
    db.delete(role)
    db.commit()
