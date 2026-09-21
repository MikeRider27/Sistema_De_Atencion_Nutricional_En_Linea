from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm

from app.db import fetch_all, fetch_one, transaction
from app.deps import current_user
from app.schemas import LoginIn, RegistroIn, TokenOut, UsuarioOut
from app.security import (create_token, hash_password, limpiar_fallos, login_bloqueado,
                          registrar_fallo, verify_password)

router = APIRouter(tags=["auth"])


def _usuario_out(u: dict) -> UsuarioOut:
    p = fetch_one("SELECT id FROM pacientes WHERE usuario_id = %s", (u["id"],))
    return UsuarioOut(id=u["id"], email=u["email"], nombre=u["nombre"], rol=u["rol"],
                      paciente_id=p["id"] if p else None)


def _autenticar(request: Request, email: str, password: str) -> TokenOut:
    key = f"{request.client.host if request.client else '-'}:{email.lower()}"
    if login_bloqueado(key):
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS,
                            "Demasiados intentos fallidos. Intenta de nuevo en unos minutos.")
    u = fetch_one("SELECT id, email, nombre, rol, activo, password_hash FROM usuarios WHERE email = %s", (email,))
    if not verify_password(password, u["password_hash"] if u else None) or not u["activo"]:
        registrar_fallo(key)
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Correo o contraseña incorrectos")
    limpiar_fallos(key)
    return TokenOut(access_token=create_token(str(u["id"]), u["rol"]), usuario=_usuario_out(u))


@router.post("/auth/login", response_model=TokenOut)
def login(data: LoginIn, request: Request):
    return _autenticar(request, data.email, data.password)


@router.post("/auth/token", response_model=TokenOut, include_in_schema=True,
             summary="Login por formulario (para el botón Authorize de Swagger)")
def login_form(request: Request, form: OAuth2PasswordRequestForm = Depends()):
    return _autenticar(request, form.username, form.password)


@router.post("/auth/registro", response_model=TokenOut, status_code=status.HTTP_201_CREATED)
def registro(data: RegistroIn):
    if data.nutricionista_id and not fetch_one(
        "SELECT 1 FROM usuarios WHERE id = %s AND rol = 'nutricionista' AND activo", (data.nutricionista_id,)
    ):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Nutricionista no válido")
    with transaction() as conn:
        u = conn.execute(
            "INSERT INTO usuarios (email, password_hash, nombre, rol) VALUES (%s, %s, %s, 'paciente') "
            "RETURNING id, email, nombre, rol",
            (data.email, hash_password(data.password), data.nombre.strip()),
        ).fetchone()
        conn.execute(
            "INSERT INTO pacientes (usuario_id, nutricionista_id, fecha_nacimiento, sexo, altura_cm) "
            "VALUES (%s, %s, %s, %s, %s)",
            (u["id"], data.nutricionista_id, data.fecha_nacimiento, data.sexo, data.altura_cm),
        )
    return TokenOut(access_token=create_token(str(u["id"]), u["rol"]), usuario=_usuario_out(u))


@router.get("/auth/me", response_model=UsuarioOut)
def me(user: dict = Depends(current_user)):
    return _usuario_out(user)


@router.get("/nutricionistas", summary="Lista pública de nutricionistas activos (para elegir al registrarse)")
def nutricionistas():
    return fetch_all("SELECT id, nombre FROM usuarios WHERE rol = 'nutricionista' AND activo ORDER BY nombre")
