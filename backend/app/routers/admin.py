from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException

from app.db import fetch_all, fetch_one
from app.deps import require_roles
from app.schemas import UsuarioAdminIn
from app.security import hash_password

router = APIRouter(prefix="/admin", tags=["admin"])
solo_admin = Depends(require_roles("admin"))


@router.get("/usuarios", dependencies=[solo_admin])
def listar_usuarios(rol: str | None = None):
    return fetch_all(
        "SELECT id, email, nombre, rol, activo, created_at FROM usuarios "
        "WHERE (%s::text IS NULL OR rol::text = %s) ORDER BY created_at DESC LIMIT 500",
        (rol, rol),
    )


@router.post("/usuarios", status_code=201, dependencies=[solo_admin])
def crear_usuario(data: UsuarioAdminIn):
    """Crea admins o nutricionistas. Los pacientes se crean con /pacientes o /auth/registro."""
    if data.rol == "paciente":
        raise HTTPException(422, "Los pacientes se crean con /pacientes")
    return fetch_one(
        "INSERT INTO usuarios (email, password_hash, nombre, rol) VALUES (%s, %s, %s, %s) "
        "RETURNING id, email, nombre, rol, activo",
        (data.email, hash_password(data.password), data.nombre.strip(), data.rol),
    )


@router.patch("/usuarios/{usuario_id}/activo", dependencies=[solo_admin])
def activar(usuario_id: UUID, activo: bool, admin: dict = Depends(require_roles("admin"))):
    if usuario_id == admin["id"] and not activo:
        raise HTTPException(409, "No puedes desactivar tu propia cuenta")
    u = fetch_one("UPDATE usuarios SET activo = %s WHERE id = %s RETURNING id, email, nombre, rol, activo",
                  (activo, usuario_id))
    if not u:
        raise HTTPException(404, "Usuario no encontrado")
    return u
