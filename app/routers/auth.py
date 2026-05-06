from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.orm import Session

from ..auth import create_token, verify_password
from ..database import get_db
from ..models import Role, User

limiter = Limiter(key_func=get_remote_address)
router = APIRouter(prefix="/auth", tags=["auth"])

ALL_PERMISSIONS = ["sale", "client", "debtors", "products", "stock"]


@router.post("/token")
@limiter.limit("10/minute")
def login(request: Request, form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    """Login. Recibe usuario + contraseña (form data OAuth2). Devuelve JWT."""
    user = (
        db.query(User)
        .filter(User.username == form.username, User.active == True)  # noqa: E712
        .first()
    )
    if not user or not verify_password(form.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Credenciales incorrectas")

    # Admin siempre tiene todos los permisos (garantía en código)
    if user.role == "admin":
        permissions = ALL_PERMISSIONS
    else:
        role_obj = db.query(Role).filter(Role.name == user.role).first()
        permissions = role_obj.permissions if role_obj else []

    token = create_token(user_id=user.id, username=user.username, role=user.role, permissions=permissions)
    return {"access_token": token, "token_type": "bearer"}
