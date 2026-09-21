import logging
from contextlib import asynccontextmanager

import psycopg
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app import bootstrap, db
from app.config import get_settings
from app.routers import admin, alimentos, auth, citas, diario, ia, pacientes, planes

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("sanl")


@asynccontextmanager
async def lifespan(_: FastAPI):
    get_settings()  # falla temprano si falta configuración obligatoria
    db.init_pool()
    bootstrap.run()
    yield
    db.close_pool()


app = FastAPI(title="SANL - Sistema de Atención Nutricional en Línea", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware, allow_origins=get_settings().cors_list, allow_credentials=False,
    allow_methods=["*"], allow_headers=["*"],
)

for r in (auth, admin, pacientes, citas, alimentos, planes, diario, ia):
    app.include_router(r.router)

# Mensajes amigables para las restricciones de la base de datos.
_MENSAJES = {
    "usuarios_email_key": "El correo ya está registrado.",
    "alimentos_nombre_uk": "Ya existe un alimento con ese nombre.",
    "planes_un_activo_por_paciente": "El paciente ya tiene un plan activo.",
    "citas_sin_traslape_nutricionista": "Ese horario ya está ocupado.",
    "citas_sin_traslape_paciente": "El paciente ya tiene una cita en ese horario.",
}


@app.exception_handler(psycopg.errors.IntegrityError)
async def _integridad(_: Request, exc: psycopg.errors.IntegrityError):
    nombre = exc.diag.constraint_name or ""
    if isinstance(exc, (psycopg.errors.UniqueViolation, psycopg.errors.ExclusionViolation)):
        return JSONResponse({"detail": _MENSAJES.get(nombre, "Ya existe un registro con esos datos.")}, 409)
    if isinstance(exc, psycopg.errors.ForeignKeyViolation):
        return JSONResponse({"detail": "El registro está relacionado con otros datos o referencia algo inexistente."}, 409)
    return JSONResponse({"detail": f"Datos fuera de los límites permitidos ({nombre})."}, 422)


@app.exception_handler(psycopg.errors.DataError)
@app.exception_handler(psycopg.errors.RaiseException)
async def _datos(_: Request, exc: psycopg.Error):
    return JSONResponse({"detail": exc.diag.message_primary or "Datos inválidos."}, 422)


@app.get("/health", tags=["sistema"])
def health():
    try:
        db.fetch_one("SELECT 1")
    except Exception:
        return JSONResponse({"status": "error", "db": False}, 503)
    return {"status": "ok", "db": True, "ia": get_settings().ia_configurada}
