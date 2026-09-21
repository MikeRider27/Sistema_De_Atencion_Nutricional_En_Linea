import json
from uuid import UUID

from fastapi import APIRouter, Depends

from app.db import fetch_all, fetch_one, transaction
from app.deps import paciente_accesible, require_roles
from app.routers.planes import _plan_completo, guardar_plan
from app.schemas import IAPlanIn, PlanIn
from app.services import ia, nutricion

router = APIRouter(prefix="/ia", tags=["ia"])
personal = Depends(require_roles("admin", "nutricionista"))


@router.get("/estado")
def estado(user: dict = personal):
    from app.config import get_settings
    s = get_settings()
    return {"configurada": s.ia_configurada, "modelo": s.gemini_model}


@router.post("/plan")
def sugerir_plan(data: IAPlanIn, user: dict = personal):
    p = paciente_accesible(data.paciente_id, user)
    m = fetch_one("SELECT peso_kg, altura_cm FROM mediciones WHERE paciente_id = %s ORDER BY fecha DESC LIMIT 1",
                  (p["id"],))
    anios = nutricion.edad(p["fecha_nacimiento"])
    contexto = {"edad": anios, "sexo": p["sexo"], "nivel_actividad": p["nivel_actividad"],
                "objetivo": p["objetivo"], "alergias": p["alergias"], "condiciones": p["condiciones"],
                "peso_kg": m and m["peso_kg"], "altura_cm": (m and m["altura_cm"]) or p["altura_cm"]}
    if m and anios is not None:
        t = nutricion.tmb(m["peso_kg"], m["altura_cm"], anios, p["sexo"])
        contexto["gasto_total_estimado_kcal"] = round(nutricion.gasto_total(t, p["nivel_actividad"]))

    propuesta, modelo = ia.generar_plan(contexto, data.instrucciones, data.dias)

    plan_id = None
    with transaction() as conn:
        if data.guardar:
            plan_id = guardar_plan(conn, PlanIn(paciente_id=p["id"], estado="borrador", generado_por_ia=True,
                                                **propuesta.model_dump()), user["id"])
        conn.execute(
            "INSERT INTO sugerencias_ia (paciente_id, solicitado_por, modelo, instrucciones, respuesta, plan_id) "
            "VALUES (%s,%s,%s,%s,%s::jsonb,%s)",
            (p["id"], user["id"], modelo, data.instrucciones, json.dumps(propuesta.model_dump()), plan_id))
    return {"propuesta": propuesta, "plan_id": plan_id,
            "aviso": "Propuesta generada por IA: revísala y ajústala antes de compartirla con el paciente."}


@router.get("/historial/{paciente_id}")
def historial(paciente_id: UUID, user: dict = personal):
    paciente_accesible(paciente_id, user)
    return fetch_all("SELECT id, modelo, instrucciones, plan_id, created_at, respuesta->>'titulo' AS titulo "
                     "FROM sugerencias_ia WHERE paciente_id = %s ORDER BY created_at DESC LIMIT 50", (paciente_id,))
