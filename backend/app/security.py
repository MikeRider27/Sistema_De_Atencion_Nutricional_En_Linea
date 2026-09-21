import time
from collections import defaultdict, deque
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from fastapi import HTTPException, status

from app.config import get_settings

_DUMMY_HASH = bcrypt.hashpw(b"dummy", bcrypt.gensalt()).decode()


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode()[:72], bcrypt.gensalt()).decode()


def verify_password(password: str, hashed: str | None) -> bool:
    # Se compara siempre contra un hash (aunque el usuario no exista) para no filtrar por tiempo.
    try:
        return bcrypt.checkpw(password.encode()[:72], (hashed or _DUMMY_HASH).encode()) and hashed is not None
    except ValueError:
        return False


def create_token(user_id: str, rol: str) -> str:
    s = get_settings()
    exp = datetime.now(timezone.utc) + timedelta(minutes=s.jwt_expire_minutes)
    return jwt.encode({"sub": user_id, "rol": rol, "exp": exp}, s.jwt_secret, algorithm="HS256")


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, get_settings().jwt_secret, algorithms=["HS256"])
    except jwt.PyJWTError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Sesión inválida o expirada",
                            headers={"WWW-Authenticate": "Bearer"})


# --- Límite de intentos de login (en memoria: por proceso, suficiente para una sola instancia) ---
_MAX_FALLOS, _VENTANA_S = 5, 15 * 60
_fallos: dict[str, deque[float]] = defaultdict(deque)


def _purgar(key: str) -> deque[float]:
    q = _fallos[key]
    while q and q[0] < time.monotonic() - _VENTANA_S:
        q.popleft()
    return q


def login_bloqueado(key: str) -> bool:
    return len(_purgar(key)) >= _MAX_FALLOS


def registrar_fallo(key: str) -> None:
    _purgar(key).append(time.monotonic())


def limpiar_fallos(key: str) -> None:
    _fallos.pop(key, None)
