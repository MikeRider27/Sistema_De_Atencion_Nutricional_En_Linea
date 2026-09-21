from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response

from app.db import fetch_all, fetch_one, transaction, update_dynamic
from app.deps import current_user, paciente_accesible, require_roles
from app.schemas import ComidaIn, PlanIn, PlanUpdateIn
from app.services.pdf import plan_pdf

router = APIRouter(prefix="/planes", tags=["planes"])
personal = Depends(require_roles("admin", "nutricionista"))

PLAN_SELECT = """
    SELECT pl.*, up.nombre AS paciente_nombre, un.nombre AS nutricionista_nombre
    FROM planes_alimenticios pl
    JOIN pacientes p ON p.id = pl.paciente_id
    JOIN usuarios up ON up.id = p.usuario_id
    JOIN usuarios un ON un.id = pl.nutricionista_id
"""


def guardar_plan(conn, data: PlanIn, nutricionista_id) -> UUID:
    """Inserta plan + comidas en la transacción `conn`. Completa macros desde el catálogo si faltan."""
    if data.estado == "activo":
        _finalizar_activo(conn, data.paciente_id)
    plan = conn.execute(
        "INSERT INTO planes_alimenticios (paciente_id, nutricionista_id, titulo, objetivo_kcal, objetivo_proteina_g, "
        "objetivo_carbohidratos_g, objetivo_grasa_g, fecha_inicio, fecha_fin, estado, notas, generado_por_ia) "
        "VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id",
        (data.paciente_id, nutricionista_id, data.titulo, data.objetivo_kcal, data.objetivo_proteina_g,
         data.objetivo_carbohidratos_g, data.objetivo_grasa_g, data.fecha_inicio, data.fecha_fin, data.estado,
         data.notas, data.generado_por_ia),
    ).fetchone()
    for c in data.comidas:
        vals = _con_macros(conn, c)
        conn.execute(
            "INSERT INTO plan_comidas (plan_id, dia_semana, tipo_comida, alimento_id, descripcion, cantidad_g, kcal, "
            "proteina_g, carbohidratos_g, grasa_g) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)",
            (plan["id"], c.dia_semana, c.tipo_comida, c.alimento_id, c.descripcion, c.cantidad_g, *vals))
    return plan["id"]


def _con_macros(conn, c: ComidaIn) -> tuple:
    if c.alimento_id and c.cantidad_g and c.kcal is None:
        a = conn.execute("SELECT kcal, proteina_g, carbohidratos_g, grasa_g FROM alimentos WHERE id = %s",
                         (c.alimento_id,)).fetchone()
        if not a:
            raise HTTPException(422, f"Alimento {c.alimento_id} no existe")
        f = c.cantidad_g / 100
        return tuple(round(a[k] * f, 1) for k in ("kcal", "proteina_g", "carbohidratos_g", "grasa_g"))
    return c.kcal, c.proteina_g, c.carbohidratos_g, c.grasa_g


def _finalizar_activo(conn, paciente_id, excepto=None):
    conn.execute(
        "UPDATE planes_alimenticios SET estado = 'finalizado', fecha_fin = coalesce(fecha_fin, current_date) "
        "WHERE paciente_id = %s AND estado = 'activo' AND id IS DISTINCT FROM %s", (paciente_id, excepto))


def _plan_completo(plan_id: UUID, user: dict) -> dict:
    plan = fetch_one(PLAN_SELECT + " WHERE pl.id = %s", (plan_id,))
    if not plan:
        raise HTTPException(404, "Plan no encontrado")
    paciente_accesible(plan["paciente_id"], user)
    if user["rol"] == "paciente" and plan["estado"] == "borrador":
        raise HTTPException(404, "Plan no encontrado")  # los borradores no se muestran al paciente
    plan["comidas"] = fetch_all(
        "SELECT * FROM plan_comidas WHERE plan_id = %s ORDER BY dia_semana, "
        "array_position(enum_range(NULL::tipo_comida), tipo_comida)", (plan_id,))
    return plan


@router.get("")
def listar(paciente_id: UUID | None = None, user: dict = Depends(current_user)):
    where, params = [], []
    if user["rol"] == "paciente":
        where += ["p.usuario_id = %s", "pl.estado <> 'borrador'"]; params.append(user["id"])
    elif user["rol"] == "nutricionista":
        where.append("p.nutricionista_id = %s"); params.append(user["id"])
    if paciente_id:
        where.append("pl.paciente_id = %s"); params.append(paciente_id)
    return fetch_all(PLAN_SELECT + (" WHERE " + " AND ".join(where) if where else "") +
                     " ORDER BY pl.fecha_inicio DESC, pl.created_at DESC LIMIT 200", params)


@router.post("", status_code=201)
def crear(data: PlanIn, user: dict = personal):
    paciente_accesible(data.paciente_id, user)
    with transaction() as conn:
        plan_id = guardar_plan(conn, data, user["id"])
    return _plan_completo(plan_id, user)


@router.get("/{plan_id}")
def detalle(plan_id: UUID, user: dict = Depends(current_user)):
    return _plan_completo(plan_id, user)


@router.patch("/{plan_id}")
def actualizar(plan_id: UUID, data: PlanUpdateIn, user: dict = personal):
    plan = _plan_completo(plan_id, user)
    cambios = data.model_dump(exclude_unset=True)
    with transaction() as conn:
        if cambios.get("estado") == "activo":
            _finalizar_activo(conn, plan["paciente_id"], excepto=plan_id)
        cols = [k for k in cambios if k in PlanUpdateIn.model_fields]
        if cols:
            conn.execute(f"UPDATE planes_alimenticios SET {', '.join(f'{c} = %s' for c in cols)} WHERE id = %s",
                         [cambios[c] for c in cols] + [plan_id])
    return _plan_completo(plan_id, user)


@router.delete("/{plan_id}", status_code=204)
def borrar(plan_id: UUID, user: dict = personal):
    _plan_completo(plan_id, user)
    fetch_one("DELETE FROM planes_alimenticios WHERE id = %s RETURNING id", (plan_id,))


@router.get("/{plan_id}/pdf")
def descargar_pdf(plan_id: UUID, user: dict = Depends(current_user)):
    plan = _plan_completo(plan_id, user)
    pdf = plan_pdf(plan, plan["paciente_nombre"], plan["nutricionista_nombre"], plan["comidas"])
    return Response(pdf, media_type="application/pdf",
                    headers={"Content-Disposition": f'attachment; filename="plan-{plan_id}.pdf"'})
