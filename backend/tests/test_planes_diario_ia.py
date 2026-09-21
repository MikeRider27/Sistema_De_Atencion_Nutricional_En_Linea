from datetime import date

from app.schemas import PlanIA
from tests.conftest import registrar_paciente

COMIDA = {"dia_semana": 1, "tipo_comida": "desayuno", "descripcion": "Avena", "alimento_id": 3, "cantidad_g": 50}


def _plan(client, nutri, paciente, **extra):
    r = client.post("/planes", headers=nutri["h"], json={"paciente_id": paciente["pid"], "titulo": "Plan",
                                                        "comidas": [COMIDA], **extra})
    assert r.status_code == 201, r.text
    return r.json()


def test_plan_calcula_macros_desde_catalogo(client, nutri, paciente):
    plan = _plan(client, nutri, paciente)
    assert plan["comidas"][0]["kcal"] == 194.5  # avena 389 kcal/100 g * 50 g


def test_paciente_no_crea_planes_ni_ve_borradores(client, nutri, paciente):
    body = {"paciente_id": paciente["pid"], "titulo": "Hack"}
    assert client.post("/planes", headers=paciente["h"], json=body).status_code == 403
    borrador = _plan(client, nutri, paciente)
    assert client.get(f"/planes/{borrador['id']}", headers=paciente["h"]).status_code == 404
    assert client.get("/planes", headers=paciente["h"]).json() == []
    client.patch(f"/planes/{borrador['id']}", headers=nutri["h"], json={"estado": "activo"})
    assert client.get(f"/planes/{borrador['id']}", headers=paciente["h"]).status_code == 200


def test_activar_plan_finaliza_el_anterior(client, nutri, paciente):
    a = _plan(client, nutri, paciente, estado="activo")
    b = _plan(client, nutri, paciente)
    assert client.patch(f"/planes/{b['id']}", headers=nutri["h"], json={"estado": "activo"}).json()["estado"] == "activo"
    assert client.get(f"/planes/{a['id']}", headers=nutri["h"]).json()["estado"] == "finalizado"


def test_nutricionista_ajeno_no_toca_el_plan(client, nutri, paciente):
    plan = _plan(client, nutri, paciente)
    from tests.conftest import crear_usuario, login
    otro = login(client, crear_usuario("nutricionista")["email"])
    assert client.get(f"/planes/{plan['id']}", headers=otro).status_code == 404
    assert client.delete(f"/planes/{plan['id']}", headers=otro).status_code == 404


def test_pdf_del_plan(client, nutri, paciente):
    plan = _plan(client, nutri, paciente, notas="Beber 2 L de agua – ñandú ✓")
    r = client.get(f"/planes/{plan['id']}/pdf", headers=nutri["h"])
    assert r.status_code == 200 and r.content.startswith(b"%PDF")


def test_diario_totales_y_objetivo(client, nutri, paciente):
    _plan(client, nutri, paciente, estado="activo", objetivo_kcal=1800)
    h = paciente["h"]
    r = client.post("/diario", headers=h, json={"tipo_comida": "almuerzo", "alimento_id": 1, "cantidad_g": 200})
    assert r.status_code == 201
    d = client.get("/diario", headers=h).json()
    assert d["totales"]["kcal"] == 260 and d["objetivo"]["kcal"] == 1800 and len(d["registros"]) == 1
    assert client.delete(f"/diario/{r.json()['id']}", headers=h).status_code == 204
    assert client.get("/diario", headers=h).json()["totales"]["kcal"] == 0


def test_diario_aislado_entre_pacientes(client, nutri, paciente):
    otro = registrar_paciente(client, nutri["id"])
    r = client.post("/diario", headers=paciente["h"], json={"tipo_comida": "cena", "alimento_id": 1, "cantidad_g": 100})
    assert client.delete(f"/diario/{r.json()['id']}", headers=otro["h"]).status_code == 404
    # el nutricionista ve el diario de su paciente, pero no escribe en él
    assert client.get("/diario", headers=nutri["h"], params={"paciente_id": paciente["pid"]}).status_code == 200
    assert client.post("/diario", headers=nutri["h"], json={"tipo_comida": "cena", "alimento_id": 1, "cantidad_g": 1}).status_code == 403


def test_alimentos_busqueda_y_alta(client, nutri, paciente):
    r = client.get("/alimentos", headers=paciente["h"], params={"q": "pollo"}).json()
    assert r and "pollo" in r[0]["nombre"].lower()
    assert client.post("/alimentos", headers=paciente["h"], json={"nombre": "Nuevo", "categoria": "X", "kcal": 1}).status_code == 403
    body = {"nombre": "Tofu firme", "categoria": "Leguminosas", "kcal": 144, "proteina_g": 17, "grasa_g": 9}
    assert client.post("/alimentos", headers=nutri["h"], json=body).status_code in (201, 409)
    imposible = {"nombre": "Imposible", "categoria": "X", "kcal": 10, "proteina_g": 90, "grasa_g": 90}
    assert client.post("/alimentos", headers=nutri["h"], json=imposible).status_code == 422


def test_ia_sin_llave_devuelve_503(client, nutri, paciente):
    r = client.post("/ia/plan", headers=nutri["h"], json={"paciente_id": paciente["pid"]})
    assert r.status_code == 503
    assert client.post("/ia/plan", headers=paciente["h"], json={"paciente_id": paciente["pid"]}).status_code == 403


def test_ia_guarda_borrador_y_bitacora(client, nutri, paciente, monkeypatch):
    propuesta = PlanIA(titulo="Propuesta IA", objetivo_kcal=1800, objetivo_proteina_g=110,
                       objetivo_carbohidratos_g=200, objetivo_grasa_g=55, comidas=[COMIDA | {"kcal": 300}])
    capturado = {}

    def falso(contexto, instrucciones, dias):
        capturado.update(contexto)
        return propuesta, "modelo-falso"

    monkeypatch.setattr("app.services.ia.generar_plan", falso)
    r = client.post("/ia/plan", headers=nutri["h"], json={"paciente_id": paciente["pid"], "guardar": True})
    assert r.status_code == 200, r.text
    plan = client.get(f"/planes/{r.json()['plan_id']}", headers=nutri["h"]).json()
    assert plan["estado"] == "borrador" and plan["generado_por_ia"] is True
    # privacidad: el modelo no recibe datos identificables
    assert not {"nombre", "email", "telefono"} & capturado.keys()
    assert len(client.get(f"/ia/historial/{paciente['pid']}", headers=nutri["h"]).json()) == 1


def test_ia_valida_contrato_de_respuesta():
    import json
    import pytest
    from app.services.ia import _extraer_json
    assert _extraer_json('```json\n{"a": 1}\n```') == {"a": 1}
    with pytest.raises(Exception):
        PlanIA.model_validate({"titulo": "x", "objetivo_kcal": 10})
