from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException

from app.db import execute, fetch_all, fetch_one, transaction, update_dynamic
from app.deps import (PACIENTE_SELECT, current_user, paciente_accesible, paciente_de_usuario,
                      require_roles)
from app.schemas import MedicionIn, PacienteCrearIn, PacienteUpdateIn
from app.security import hash_password
from app.services import nutricion

router = APIRouter(tags=["pacientes"])
personal = Depends(require_roles("admin", "nutricionista"))

CAMPOS_PACIENTE = {"fecha_nacimiento", "sexo", "telefono", "altura_cm", "nivel_actividad",
                   "objetivo", "alergias", "condiciones"}
CAMPOS_PERSONAL = CAMPOS_PACIENTE | {"notas"}


@router.get("/pacientes")
def listar(q: str | None = None, sin_asignar: bool = False, user: dict = personal):
    where, params = [], []
    if user["rol"] == "nutricionista":
        where.append("(p.nutricionista_id = %s OR (%s AND p.nutricionista_id IS NULL))")
        params += [user["id"], sin_asignar]
    if q:
        where.append("(u.nombre ILIKE %s OR u.email ILIKE %s)")
        params += [f"%{q}%", f"%{q}%"]
    sql = PACIENTE_SELECT + (" WHERE " + " AND ".join(where) if where else "") + " ORDER BY u.nombre LIMIT 200"
    return fetch_all(sql, params)


@router.post("/pacientes", status_code=201)
def crear(data: PacienteCrearIn, user: dict = personal):
    nutri_id = user["id"] if user["rol"] == "nutricionista" else data.nutricionista_id
    with transaction() as conn:
        u = conn.execute(
            "INSERT INTO usuarios (email, password_hash, nombre, rol) VALUES (%s, %s, %s, 'paciente') RETURNING id",
            (data.email, hash_password(data.password), data.nombre.strip()),
        ).fetchone()
        p = conn.execute(
            "INSERT INTO pacientes (usuario_id, nutricionista_id, fecha_nacimiento, sexo, telefono, altura_cm, "
            "nivel_actividad, objetivo, alergias, condiciones) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id",
            (u["id"], nutri_id, data.fecha_nacimiento, data.sexo, data.telefono, data.altura_cm,
             data.nivel_actividad, data.objetivo, data.alergias, data.condiciones),
        ).fetchone()
    return paciente_accesible(p["id"], user)


@router.get("/pacientes/me")
def mi_ficha(user: dict = Depends(require_roles("paciente"))):
    return paciente_de_usuario(user)


@router.get("/pacientes/{paciente_id}")
def detalle(paciente_id: UUID, user: dict = Depends(current_user)):
    return paciente_accesible(paciente_id, user)


@router.patch("/pacientes/{paciente_id}")
def actualizar(paciente_id: UUID, data: PacienteUpdateIn, user: dict = Depends(current_user)):
    paciente_accesible(paciente_id, user)
    cambios = data.model_dump(exclude_unset=True)
    permitidos = set(CAMPOS_PACIENTE if user["rol"] == "paciente" else CAMPOS_PERSONAL)
    if user["rol"] == "admin":
        permitidos.add("nutricionista_id")
    elif "nutricionista_id" in cambios:
        raise HTTPException(403, "Sólo un administrador puede reasignar nutricionista")
    if "notas" in cambios and user["rol"] == "paciente":
        raise HTTPException(403, "Las notas clínicas sólo las edita el personal")
    update_dynamic("pacientes", paciente_id, cambios, permitidos)
    return paciente_accesible(paciente_id, user)


@router.post("/pacientes/{paciente_id}/tomar", summary="Un nutricionista se asigna un paciente sin nutricionista")
def tomar(paciente_id: UUID, user: dict = Depends(require_roles("nutricionista"))):
    n = execute("UPDATE pacientes SET nutricionista_id = %s WHERE id = %s AND nutricionista_id IS NULL",
                (user["id"], paciente_id))
    if not n:
        raise HTTPException(409, "El paciente no existe o ya tiene nutricionista")
    return paciente_accesible(paciente_id, user)


# ---- Mediciones ------------------------------------------------------------
@router.get("/pacientes/{paciente_id}/mediciones")
def mediciones(paciente_id: UUID, user: dict = Depends(current_user)):
    paciente_accesible(paciente_id, user)
    return fetch_all("SELECT * FROM v_progreso_paciente WHERE paciente_id = %s ORDER BY fecha", (paciente_id,))


@router.post("/pacientes/{paciente_id}/mediciones", status_code=201)
def registrar_medicion(paciente_id: UUID, data: MedicionIn, user: dict = Depends(current_user)):
    p = paciente_accesible(paciente_id, user)
    altura = data.altura_cm or p["altura_cm"]
    if not altura:
        raise HTTPException(422, "Indica la altura (cm): el paciente aún no la tiene registrada")
    m = fetch_one(
        "INSERT INTO mediciones (paciente_id, fecha, peso_kg, altura_cm, cintura_cm, cadera_cm, grasa_pct, notas) "
        "VALUES (%s,%s,%s,%s,%s,%s,%s,%s) "
        "ON CONFLICT (paciente_id, fecha) DO UPDATE SET peso_kg = EXCLUDED.peso_kg, altura_cm = EXCLUDED.altura_cm, "
        "cintura_cm = EXCLUDED.cintura_cm, cadera_cm = EXCLUDED.cadera_cm, grasa_pct = EXCLUDED.grasa_pct, "
        "notas = EXCLUDED.notas RETURNING *",
        (paciente_id, data.fecha, data.peso_kg, altura, data.cintura_cm, data.cadera_cm, data.grasa_pct, data.notas),
    )
    if not p["altura_cm"]:
        execute("UPDATE pacientes SET altura_cm = %s WHERE id = %s", (altura, paciente_id))
    return m


@router.delete("/pacientes/{paciente_id}/mediciones/{medicion_id}", status_code=204)
def borrar_medicion(paciente_id: UUID, medicion_id: UUID, user: dict = Depends(current_user)):
    paciente_accesible(paciente_id, user)
    if not execute("DELETE FROM mediciones WHERE id = %s AND paciente_id = %s", (medicion_id, paciente_id)):
        raise HTTPException(404, "Medición no encontrada")


@router.get("/pacientes/{paciente_id}/resumen")
def resumen(paciente_id: UUID, user: dict = Depends(current_user)):
    """Última medición, IMC y estimación de gasto energético (Mifflin-St Jeor)."""
    p = paciente_accesible(paciente_id, user)
    m = fetch_one("SELECT * FROM v_progreso_paciente WHERE paciente_id = %s ORDER BY fecha DESC LIMIT 1", (paciente_id,))
    out = {"ultima_medicion": m, "imc_categoria": None, "edad": nutricion.edad(p["fecha_nacimiento"]),
           "tmb_kcal": None, "gasto_total_kcal": None, "macros_sugeridos": None,
           "plan_activo": fetch_one("SELECT id, titulo, objetivo_kcal FROM planes_alimenticios "
                                    "WHERE paciente_id = %s AND estado = 'activo'", (paciente_id,)),
           "proxima_cita": fetch_one("SELECT id, inicio, modalidad FROM citas WHERE paciente_id = %s "
                                     "AND estado = 'programada' AND inicio > now() ORDER BY inicio LIMIT 1",
                                     (paciente_id,))}
    if m:
        out["imc_categoria"] = nutricion.categoria_imc(m["imc"])
        if out["edad"] is not None:
            t = nutricion.tmb(m["peso_kg"], m["altura_cm"], out["edad"], p["sexo"])
            g = nutricion.gasto_total(t, p["nivel_actividad"])
            out.update(tmb_kcal=round(t), gasto_total_kcal=round(g), macros_sugeridos=nutricion.macros_sugeridos(g))
    return out
