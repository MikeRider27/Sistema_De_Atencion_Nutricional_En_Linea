import uuid
from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient

from app import db
from app.main import app
from app.security import hash_password

PASSWORD = "Prueba1234!"


@pytest.fixture(scope="session")
def client():
    with TestClient(app) as c:
        yield c


def _email(prefijo: str) -> str:
    return f"{prefijo}-{uuid.uuid4().hex[:8]}@example.com"


def crear_usuario(rol: str, nombre: str = "Usuario Prueba") -> dict:
    email = _email(rol)
    u = db.fetch_one("INSERT INTO usuarios (email, password_hash, nombre, rol) VALUES (%s,%s,%s,%s) RETURNING id",
                     (email, hash_password(PASSWORD), nombre, rol))
    return {"id": u["id"], "email": email}


def login(client, email: str) -> dict:
    r = client.post("/auth/login", json={"email": email, "password": PASSWORD})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


@pytest.fixture()
def nutri(client):
    u = crear_usuario("nutricionista", "Nutri Prueba")
    return {**u, "h": login(client, u["email"])}


@pytest.fixture()
def admin(client):
    u = crear_usuario("admin", "Admin Prueba")
    return {**u, "h": login(client, u["email"])}


def registrar_paciente(client, nutri_id=None, **extra) -> dict:
    email = _email("paciente")
    r = client.post("/auth/registro", json={"email": email, "password": PASSWORD, "nombre": "Paciente Prueba",
                                            "nutricionista_id": str(nutri_id) if nutri_id else None,
                                            "altura_cm": 170, "sexo": "F", "fecha_nacimiento": "1990-05-01", **extra})
    assert r.status_code == 201, r.text
    d = r.json()
    return {"email": email, "pid": d["usuario"]["paciente_id"], "h": {"Authorization": f"Bearer {d['access_token']}"}}


@pytest.fixture()
def paciente(client, nutri):
    return registrar_paciente(client, nutri["id"])


def proximo_dia_habil(dias_min=3) -> datetime:
    d = datetime.now(timezone.utc) + timedelta(days=dias_min)
    while d.weekday() >= 5:
        d += timedelta(days=1)
    return d
