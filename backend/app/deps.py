from uuid import UUID

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer

from app.db import fetch_one
from app.security import decode_token

oauth2 = OAuth2PasswordBearer(tokenUrl="auth/token")

PACIENTE_SELECT = """
    SELECT p.id, p.usuario_id, p.nutricionista_id, u.nombre, u.email,
           p.fecha_nacimiento, p.sexo, p.telefono, p.altura_cm, p.nivel_actividad,
           p.objetivo, p.alergias, p.condiciones, p.notas, p.created_at,
           n.nombre AS nutricionista_nombre
    FROM pacientes p
    JOIN usuarios u ON u.id = p.usuario_id
    LEFT JOIN usuarios n ON n.id = p.nutricionista_id
"""


def current_user(token: str = Depends(oauth2)) -> dict:
    payload = decode_token(token)
    user = fetch_one(
        "SELECT id, email, nombre, rol, activo FROM usuarios WHERE id = %s", (payload["sub"],)
    )
    if not user or not user["activo"]:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Sesión inválida o expirada")
    return user


def require_roles(*roles: str):
    def dep(user: dict = Depends(current_user)) -> dict:
        if user["rol"] not in roles:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "No tienes permiso para esta acción")
        return user
    return dep


def paciente_accesible(paciente_id: UUID, user: dict) -> dict:
    """Devuelve la ficha del paciente si `user` puede verla; si no, 404 (no revela existencia)."""
    p = fetch_one(PACIENTE_SELECT + " WHERE p.id = %s", (paciente_id,))
    ok = p and (
        user["rol"] == "admin"
        or (user["rol"] == "nutricionista" and p["nutricionista_id"] == user["id"])
        or (user["rol"] == "paciente" and p["usuario_id"] == user["id"])
    )
    if not ok:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Paciente no encontrado")
    return p


def paciente_de_usuario(user: dict) -> dict:
    p = fetch_one(PACIENTE_SELECT + " WHERE p.usuario_id = %s", (user["id"],))
    if not p:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Ficha de paciente no encontrada")
    return p


def resolver_paciente(paciente_id: UUID | None, user: dict) -> dict:
    """Paciente: siempre el propio. Personal: el indicado por `paciente_id`."""
    if user["rol"] == "paciente":
        return paciente_de_usuario(user)
    if paciente_id is None:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "paciente_id es obligatorio")
    return paciente_accesible(paciente_id, user)
