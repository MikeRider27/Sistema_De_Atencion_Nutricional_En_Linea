from datetime import date, datetime, time, timedelta
from uuid import UUID, uuid4
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException

from app.config import get_settings
from app.db import fetch_all, fetch_one, update_dynamic
from app.deps import current_user, paciente_accesible, resolver_paciente
from app.schemas import CitaIn, CitaUpdateIn, EstadoCita

router = APIRouter(prefix="/citas", tags=["citas"])

CITA_SELECT = """
    SELECT c.*, up.nombre AS paciente_nombre, un.nombre AS nutricionista_nombre
    FROM citas c
    JOIN pacientes p ON p.id = c.paciente_id
    JOIN usuarios up ON up.id = p.usuario_id
    JOIN usuarios un ON un.id = c.nutricionista_id
"""


def _tz() -> ZoneInfo:
    return ZoneInfo(get_settings().app_timezone)


def _aware(dt: datetime) -> datetime:
    return dt if dt.tzinfo else dt.replace(tzinfo=_tz())


def _get_cita(cita_id: UUID, user: dict) -> dict:
    c = fetch_one(CITA_SELECT + " WHERE c.id = %s", (cita_id,))
    if not c:
        raise HTTPException(404, "Cita no encontrada")
    paciente_accesible(c["paciente_id"], user)  # 404 si no tiene acceso
    return c


@router.get("")
def listar(desde: date | None = None, hasta: date | None = None, estado: EstadoCita | None = None,
           user: dict = Depends(current_user)):
    where, params = ["(%s::date IS NULL OR c.inicio >= %s::date)", "(%s::date IS NULL OR c.inicio < %s::date + 1)",
                     "(%s::text IS NULL OR c.estado::text = %s)"], [desde, desde, hasta, hasta, estado, estado]
    if user["rol"] == "nutricionista":
        where.append("c.nutricionista_id = %s"); params.append(user["id"])
    elif user["rol"] == "paciente":
        where.append("p.usuario_id = %s"); params.append(user["id"])
    return fetch_all(CITA_SELECT + " WHERE " + " AND ".join(where) + " ORDER BY c.inicio LIMIT 500", params)


@router.get("/disponibilidad")
def disponibilidad(nutricionista_id: UUID, fecha: date, user: dict = Depends(current_user)):
    """Horarios de 1 h (lun-vie, dentro de la jornada) con su estado libre/ocupado."""
    s, tz = get_settings(), _tz()
    if not fetch_one("SELECT 1 FROM usuarios WHERE id = %s AND rol = 'nutricionista' AND activo", (nutricionista_id,)):
        raise HTTPException(404, "Nutricionista no encontrado")
    if fecha.weekday() >= 5:
        return []
    dia_ini = datetime.combine(fecha, time(0), tz)
    ocupadas = fetch_all(
        "SELECT inicio, fin FROM citas WHERE nutricionista_id = %s AND estado = 'programada' "
        "AND inicio < %s AND fin > %s", (nutricionista_id, dia_ini + timedelta(days=1), dia_ini))
    ahora = datetime.now(tz)
    slots = []
    for h in range(s.jornada_inicio, s.jornada_fin):
        ini = datetime.combine(fecha, time(h), tz)
        fin = ini + timedelta(hours=1)
        libre = ini > ahora and not any(o["inicio"] < fin and o["fin"] > ini for o in ocupadas)
        slots.append({"inicio": ini, "fin": fin, "disponible": libre})
    return slots


@router.post("", status_code=201)
def crear(data: CitaIn, user: dict = Depends(current_user)):
    p = resolver_paciente(data.paciente_id, user)
    nutri_id = p["nutricionista_id"] if user["rol"] != "nutricionista" else user["id"]
    if not nutri_id:
        raise HTTPException(409, "El paciente aún no tiene nutricionista asignado")
    inicio = _aware(data.inicio)
    if inicio <= datetime.now(inicio.tzinfo):
        raise HTTPException(422, "La cita debe ser en el futuro")
    fin = inicio + timedelta(minutes=data.duracion_min)
    if user["rol"] == "paciente":  # el paciente sólo puede reservar dentro de la jornada laboral
        s, tz = get_settings(), _tz()
        ini_loc, fin_loc = inicio.astimezone(tz), fin.astimezone(tz)
        fuera = (ini_loc.weekday() >= 5 or ini_loc.hour < s.jornada_inicio
                 or fin_loc.date() != ini_loc.date() or fin_loc.hour + fin_loc.minute / 60 > s.jornada_fin)
        if fuera:
            raise HTTPException(422, "Horario fuera de la jornada de atención (lun-vie)")
    cita_id = uuid4()
    enlace = f"https://meet.jit.si/sanl-{cita_id.hex}" if data.modalidad == "virtual" else None
    fetch_one(
        "INSERT INTO citas (id, paciente_id, nutricionista_id, inicio, fin, modalidad, motivo, enlace_video) "
        "VALUES (%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id",
        (cita_id, p["id"], nutri_id, inicio, fin, data.modalidad, data.motivo, enlace))
    return fetch_one(CITA_SELECT + " WHERE c.id = %s", (cita_id,))


@router.patch("/{cita_id}")
def actualizar(cita_id: UUID, data: CitaUpdateIn, user: dict = Depends(current_user)):
    c = _get_cita(cita_id, user)
    cambios = data.model_dump(exclude_unset=True)
    if user["rol"] == "paciente":
        if set(cambios) - {"estado"} or cambios.get("estado") != "cancelada":
            raise HTTPException(403, "Como paciente sólo puedes cancelar tu cita")
    if c["estado"] != "programada" and set(cambios) - {"notas"}:
        raise HTTPException(409, "Sólo las citas programadas pueden modificarse")
    if "inicio" in cambios or "duracion_min" in cambios:
        ini = _aware(cambios.pop("inicio", None) or c["inicio"])
        dur = cambios.pop("duracion_min", None) or int((c["fin"] - c["inicio"]).total_seconds() // 60)
        if ini <= datetime.now(ini.tzinfo):
            raise HTTPException(422, "La cita debe ser en el futuro")
        cambios["inicio"], cambios["fin"] = ini, ini + timedelta(minutes=dur)
    update_dynamic("citas", cita_id, cambios, {"estado", "inicio", "fin", "modalidad", "motivo", "notas"})
    return fetch_one(CITA_SELECT + " WHERE c.id = %s", (cita_id,))
