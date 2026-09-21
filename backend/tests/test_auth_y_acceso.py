from tests.conftest import PASSWORD, crear_usuario, login, registrar_paciente


def test_health(client):
    r = client.get("/health")
    assert r.status_code == 200 and r.json()["db"] is True


def test_registro_login_me(client, nutri):
    p = registrar_paciente(client, nutri["id"])
    me = client.get("/auth/me", headers=p["h"]).json()
    assert me["rol"] == "paciente" and me["paciente_id"] == p["pid"]
    assert "password_hash" not in me


def test_registro_correo_duplicado_da_409(client):
    p = registrar_paciente(client)
    r = client.post("/auth/registro", json={"email": p["email"].upper(), "password": PASSWORD, "nombre": "Otro Nombre"})
    assert r.status_code == 409 and "correo" in r.json()["detail"].lower()


def test_password_corta_rechazada(client):
    r = client.post("/auth/registro", json={"email": "x@example.com", "password": "123", "nombre": "Nombre"})
    assert r.status_code == 422


def test_login_incorrecto_y_bloqueo(client):
    u = crear_usuario("paciente")
    for _ in range(5):
        assert client.post("/auth/login", json={"email": u["email"], "password": "mala-contraseña"}).status_code == 401
    # tras 5 fallos, incluso la contraseña correcta queda bloqueada temporalmente
    assert client.post("/auth/login", json={"email": u["email"], "password": PASSWORD}).status_code == 429


def test_sin_token_401(client):
    assert client.get("/pacientes").status_code == 401
    assert client.get("/auth/me", headers={"Authorization": "Bearer basura"}).status_code == 401


def test_usuario_desactivado_pierde_acceso(client, admin):
    u = crear_usuario("nutricionista")
    h = login(client, u["email"])
    assert client.get("/pacientes", headers=h).status_code == 200
    assert client.patch(f"/admin/usuarios/{u['id']}/activo", params={"activo": False}, headers=admin["h"]).status_code == 200
    assert client.get("/pacientes", headers=h).status_code == 401


def test_paciente_no_ve_a_otros_ni_lista(client, nutri):
    a, b = registrar_paciente(client, nutri["id"]), registrar_paciente(client, nutri["id"])
    assert client.get(f"/pacientes/{b['pid']}", headers=a["h"]).status_code == 404
    assert client.get("/pacientes", headers=a["h"]).status_code == 403
    assert client.get(f"/pacientes/{a['pid']}/mediciones", headers=a["h"]).status_code == 200


def test_nutricionista_sólo_ve_a_sus_pacientes(client, nutri):
    otro = crear_usuario("nutricionista")
    ajeno = registrar_paciente(client, otro["id"])
    propio = registrar_paciente(client, nutri["id"])
    ids = {p["id"] for p in client.get("/pacientes", headers=nutri["h"]).json()}
    assert propio["pid"] in ids and ajeno["pid"] not in ids
    assert client.get(f"/pacientes/{ajeno['pid']}", headers=nutri["h"]).status_code == 404


def test_tomar_paciente_sin_asignar(client, nutri):
    libre = registrar_paciente(client)
    assert libre["pid"] not in {p["id"] for p in client.get("/pacientes", headers=nutri["h"]).json()}
    assert client.post(f"/pacientes/{libre['pid']}/tomar", headers=nutri["h"]).status_code == 200
    assert client.post(f"/pacientes/{libre['pid']}/tomar", headers=nutri["h"]).status_code == 409


def test_paciente_no_puede_cambiarse_de_nutricionista_ni_editar_notas(client, paciente):
    assert client.patch(f"/pacientes/{paciente['pid']}", headers=paciente["h"],
                        json={"notas": "x"}).status_code == 403
    r = client.patch(f"/pacientes/{paciente['pid']}", headers=paciente["h"],
                     json={"alergias": [" nueces ", "nueces", ""], "nivel_actividad": "moderado"})
    assert r.status_code == 200 and r.json()["alergias"] == ["nueces"]


def test_solo_admin_crea_nutricionistas(client, nutri, admin):
    body = {"email": "nuevo-nutri@example.com", "password": PASSWORD, "nombre": "Nuevo Nutri", "rol": "nutricionista"}
    assert client.post("/admin/usuarios", json=body, headers=nutri["h"]).status_code == 403
    assert client.post("/admin/usuarios", json=body, headers=admin["h"]).status_code == 201
