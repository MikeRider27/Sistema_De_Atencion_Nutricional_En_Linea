from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException

from app.db import execute, fetch_all, fetch_one
from app.deps import current_user, require_roles, resolver_paciente
from app.schemas import DiarioIn

router = APIRouter(prefix="/diario", tags=["diario"])


@router.get("")
def dia(fecha: date | None = None, paciente_id: UUID | None = None, user: dict = Depends(current_user)):
    p = resolver_paciente(paciente_id, user)
    fecha = fecha or date.today()
    registros = fetch_all(
        "SELECT d.id, d.fecha, d.tipo_comida, d.cantidad_g, d.notas, a.id AS alimento_id, a.nombre AS alimento, "
        "round(a.kcal * d.cantidad_g / 100, 1) AS kcal, round(a.proteina_g * d.cantidad_g / 100, 1) AS proteina_g, "
        "round(a.carbohidratos_g * d.cantidad_g / 100, 1) AS carbohidratos_g, round(a.grasa_g * d.cantidad_g / 100, 1) AS grasa_g "
        "FROM diario_alimentos d JOIN alimentos a ON a.id = d.alimento_id "
        "WHERE d.paciente_id = %s AND d.fecha = %s ORDER BY d.created_at", (p["id"], fecha))
    totales = fetch_one(
        "SELECT coalesce(kcal,0) AS kcal, coalesce(proteina_g,0) AS proteina_g, coalesce(carbohidratos_g,0) AS carbohidratos_g, "
        "coalesce(grasa_g,0) AS grasa_g, coalesce(fibra_g,0) AS fibra_g FROM "
        "(SELECT 1) x LEFT JOIN v_diario_resumen v ON v.paciente_id = %s AND v.fecha = %s", (p["id"], fecha))
    objetivo = fetch_one(
        "SELECT objetivo_kcal AS kcal, objetivo_proteina_g AS proteina_g, objetivo_carbohidratos_g AS carbohidratos_g, "
        "objetivo_grasa_g AS grasa_g FROM planes_alimenticios WHERE paciente_id = %s AND estado = 'activo'", (p["id"],))
    return {"fecha": fecha, "registros": registros, "totales": totales, "objetivo": objetivo}


@router.get("/resumen", summary="Totales diarios en un rango (para gráficas de adherencia)")
def resumen(desde: date, hasta: date, paciente_id: UUID | None = None, user: dict = Depends(current_user)):
    p = resolver_paciente(paciente_id, user)
    if (hasta - desde).days > 366:
        raise HTTPException(422, "El rango máximo es de un año")
    return fetch_all("SELECT fecha, kcal, proteina_g, carbohidratos_g, grasa_g, fibra_g, registros "
                     "FROM v_diario_resumen WHERE paciente_id = %s AND fecha BETWEEN %s AND %s ORDER BY fecha",
                     (p["id"], desde, hasta))


@router.post("", status_code=201)
def registrar(data: DiarioIn, user: dict = Depends(require_roles("paciente"))):
    p = resolver_paciente(None, user)
    if data.fecha > date.today():
        raise HTTPException(422, "No puedes registrar comidas en el futuro")
    if not fetch_one("SELECT 1 FROM alimentos WHERE id = %s", (data.alimento_id,)):
        raise HTTPException(422, "Alimento no encontrado")
    return fetch_one(
        "INSERT INTO diario_alimentos (paciente_id, fecha, tipo_comida, alimento_id, cantidad_g, notas) "
        "VALUES (%s,%s,%s,%s,%s,%s) RETURNING *",
        (p["id"], data.fecha, data.tipo_comida, data.alimento_id, data.cantidad_g, data.notas))


@router.delete("/{registro_id}", status_code=204)
def borrar(registro_id: UUID, user: dict = Depends(require_roles("paciente"))):
    p = resolver_paciente(None, user)
    if not execute("DELETE FROM diario_alimentos WHERE id = %s AND paciente_id = %s", (registro_id, p["id"])):
        raise HTTPException(404, "Registro no encontrado")
