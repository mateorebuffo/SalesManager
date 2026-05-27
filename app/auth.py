"""
Autenticación JWT para el sistema de ventas.

Flujo:
  1. POST /auth/token  →  verifica usuario en BD, devuelve JWT firmado
  2. Cada request protegido incluye: Authorization: Bearer <token>
  3. get_current_user() decodifica el token y devuelve CurrentUser(id, username, role)
  4. require_admin() extiende get_current_user() y exige role == "admin"
"""
import os
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from dotenv import load_dotenv
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer

load_dotenv()

SECRET_KEY = os.environ["SECRET_KEY"]
if len(SECRET_KEY) < 64:
    raise RuntimeError("SECRET_KEY debe tener al menos 64 caracteres.")

ALGORITHM = "HS256"
TOKEN_EXPIRE_HOURS = 2

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/token")


@dataclass
class CurrentUser:
    id: int
    username: str
    role: str
    permissions: list = field(default_factory=list)


def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())


def create_token(user_id: int, username: str, role: str, permissions: list) -> str:
    """Genera un JWT con id, username, role, permissions y expiración."""
    now = datetime.now(timezone.utc)
    payload = {
        "sub": username,
        "uid": user_id,
        "role": role,
        "permissions": permissions,
        "exp": now + timedelta(hours=TOKEN_EXPIRE_HOURS),
        "iat": now,
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def get_current_user(token: str = Depends(oauth2_scheme)) -> CurrentUser:
    """
    Decodifica el JWT y devuelve el usuario. No consulta la BD
    (la validez viene garantizada por la firma del token).
    """
    credentials_exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Token inválido o expirado",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        user_id: int = payload.get("uid")
        role: str = payload.get("role")
        if not username or not user_id or not role:
            raise credentials_exc
        permissions: list = payload.get("permissions", [])
        return CurrentUser(id=user_id, username=username, role=role, permissions=permissions)
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token expirado",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except jwt.InvalidTokenError:
        raise credentials_exc


def require_admin(current_user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
    """Dependency que exige role == 'admin'. Lanza 403 si es operator."""
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Se requieren permisos de administrador.",
        )
    return current_user
