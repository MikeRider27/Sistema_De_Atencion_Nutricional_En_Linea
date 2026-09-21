from fastapi import APIRouter, Depends, Query

from app.db import fetch_all, fetch_one
from app.deps import current_user, require_roles
from app.schemas import AlimentoIn

router = APIRouter(prefix="/alimentos", tags=["alimentos"])


@router.get("", dependencies=[Depends(current_user)])
def buscar(q: str | None = None, categoria: str | None = None, limit: int = Query(50, ge=1, le=200)):
    return fetch_all(
        "SELECT * FROM alimentos WHERE (%s::text IS NULL OR nombre ILIKE %s OR similarity(nombre, %s) > 0.3) "
        "AND (%s::text IS NULL OR categoria = %s) "
        "ORDER BY (CASE WHEN %s::text IS NULL THEN 0 ELSE similarity(nombre, %s) END) DESC, nombre LIMIT %s",
        (q, f"%{q}%", q, categoria, categoria, q, q, limit))


@router.get("/categorias", dependencies=[Depends(current_user)])
def categorias():
    return [r["categoria"] for r in fetch_all("SELECT DISTINCT categoria FROM alimentos ORDER BY 1")]


@router.post("", status_code=201)
def crear(data: AlimentoIn, user: dict = Depends(require_roles("admin", "nutricionista"))):
    return fetch_one(
        "INSERT INTO alimentos (nombre, categoria, kcal, proteina_g, carbohidratos_g, grasa_g, fibra_g, creado_por) "
        "VALUES (%s,%s,%s,%s,%s,%s,%s,%s) RETURNING *",
        (data.nombre.strip(), data.categoria.strip(), data.kcal, data.proteina_g, data.carbohidratos_g,
         data.grasa_g, data.fibra_g, user["id"]))
