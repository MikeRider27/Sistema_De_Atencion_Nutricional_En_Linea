from datetime import date, timedelta

from tests.conftest import proximo_dia_habil, registrar_paciente


def test_medicion_calcula_imc_y_hace_upsert(client, paciente):
    url = f"/pacientes/{paciente['pid']}/mediciones"
    r = client.post(url, headers=paciente["h"], json={"peso_kg": 70, "fecha": str(date.today())})
    assert r.status_code == 201 and r.json()["imc"] == 24.2  # 70 / 1.70^2
    client.post(url, headers=paciente["h"], json={"peso_kg": 68, "fecha": str(date.today())})
    lista = client.get(url, headers=paciente["h"]).json()
    assert len(lista) == 1 and lista[0]["peso_kg"] == 68


def test_medicion_valida_rangos_y_fecha_futura(client, paciente):
    url = f"/pacientes/{paciente['pid']}/mediciones"
    assert client.post(url, headers=paciente["h"], json={"peso_kg": 1}).status_code == 422
    manana = str(date.today() + timedelta(days=1))
    assert client.post(url, headers=paciente["h"], json={"peso_kg": 70, "fecha": manana}).status_code == 422


def test_progreso_y_resumen(client, paciente):
    url = f"/pacientes/{paciente['pid']}/mediciones"
    client.post(url, headers=paciente["h"], json={"peso_kg": 72, "fecha": str(date.today() - timedelta(days=7))})
    client.post(url, headers=paciente["h"], json={"peso_kg": 70.5})
    ms = client.get(url, headers=paciente["h"]).json()
    assert ms[-1]["delta_anterior_kg"] == -1.5 and ms[-1]["delta_inicial_kg"] == -1.5
    res = client.get(f"/pacientes/{paciente['pid']}/resumen", headers=paciente["h"]).json()
    assert res["imc_categoria"] == "Normal" and res["gasto_total_kcal"] > res["tmb_kcal"] > 1000


def test_citas_traslape_y_permisos(client, nutri, paciente):
    otro = registrar_paciente(client, nutri["id"])
    ini = proximo_dia_habil().replace(hour=17, minute=0, second=0, microsecond=0)
    r = client.post("/citas", headers=nutri["h"], json={"paciente_id": paciente["pid"], "inicio": ini.isoformat()})
    assert r.status_code == 201, r.text
    cita = r.json()
    assert cita["enlace_video"].startswith("https://meet.jit.si/")

    # otro paciente del mismo nutricionista en el mismo horario -> conflicto
    r = client.post("/citas", headers=nutri["h"], json={"paciente_id": otro["pid"], "inicio": ini.isoformat()})
    assert r.status_code == 409
    # cita contigua sí se permite
    r = client.post("/citas", headers=nutri["h"],
                    json={"paciente_id": otro["pid"], "inicio": (ini + timedelta(hours=1)).isoformat()})
    assert r.status_code == 201

    # el paciente sólo puede cancelar
    assert client.patch(f"/citas/{cita['id']}", headers=paciente["h"], json={"notas": "hola"}).status_code == 403
    assert client.patch(f"/citas/{cita['id']}", headers=paciente["h"], json={"estado": "cancelada"}).status_code == 200
    # la cita cancelada libera el horario
    r = client.post("/citas", headers=nutri["h"], json={"paciente_id": otro["pid"], "inicio": ini.isoformat()})
    assert r.status_code == 201, r.text


def test_cita_en_el_pasado_rechazada(client, nutri, paciente):
    pasado = (proximo_dia_habil() - timedelta(days=30)).isoformat()
    assert client.post("/citas", headers=nutri["h"], json={"paciente_id": paciente["pid"], "inicio": pasado}).status_code == 422


def test_paciente_sin_nutricionista_no_puede_agendar(client):
    p = registrar_paciente(client)
    r = client.post("/citas", headers=p["h"], json={"inicio": proximo_dia_habil().isoformat()})
    assert r.status_code == 409


def test_disponibilidad_marca_ocupados(client, nutri, paciente):
    dia = proximo_dia_habil()
    slots = client.get("/citas/disponibilidad", headers=paciente["h"],
                       params={"nutricionista_id": str(nutri["id"]), "fecha": dia.date().isoformat()}).json()
    assert len(slots) == 8 and all(s["disponible"] for s in slots)
    libre = slots[2]
    r = client.post("/citas", headers=paciente["h"], json={"inicio": libre["inicio"]})
    assert r.status_code == 201, r.text
    slots = client.get("/citas/disponibilidad", headers=paciente["h"],
                       params={"nutricionista_id": str(nutri["id"]), "fecha": dia.date().isoformat()}).json()
    assert [s["disponible"] for s in slots].count(False) == 1
