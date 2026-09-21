"""Datos iniciales opcionales: administrador desde variables de entorno y datos de demostración."""
import logging
from datetime import date, datetime, timedelta, timezone

from app.config import get_settings
from app.db import fetch_one, transaction
from app.security import hash_password

log = logging.getLogger("sanl.bootstrap")


def _crear_usuario(conn, email: str, nombre: str, rol: str, password: str):
    return conn.execute(
        "INSERT INTO usuarios (email, password_hash, nombre, rol) VALUES (%s,%s,%s,%s) "
        "ON CONFLICT (email) DO NOTHING RETURNING id", (email, hash_password(password), nombre, rol)).fetchone()


def run() -> None:
    s = get_settings()
    if s.admin_email and s.admin_password:
        with transaction() as conn:
            if _crear_usuario(conn, s.admin_email, "Administrador", "admin", s.admin_password):
                log.info("Administrador creado: %s", s.admin_email)
    if s.seed_demo_data:
        _demo(s.demo_password)


def _demo(password: str) -> None:
    if fetch_one("SELECT 1 FROM usuarios WHERE email = 'nutri@example.com'"):
        return
    log.warning("Cargando datos de DEMOSTRACIÓN (SEED_DEMO_DATA=true). No usar en producción.")
    hoy = date.today()
    with transaction() as conn:
        _crear_usuario(conn, "admin@example.com", "Admin Demo", "admin", password)
        nutri = _crear_usuario(conn, "nutri@example.com", "Dra. Laura Méndez", "nutricionista", password)["id"]
        pac = _crear_usuario(conn, "paciente@example.com", "Carlos Ramírez", "paciente", password)["id"]
        pid = conn.execute(
            "INSERT INTO pacientes (usuario_id, nutricionista_id, fecha_nacimiento, sexo, telefono, altura_cm, "
            "nivel_actividad, objetivo, alergias, condiciones) VALUES (%s,%s,%s,'M','555 123 4567',176,'ligero',"
            "'Bajar 8 kg de forma gradual', %s, %s) RETURNING id",
            (pac, nutri, date(1991, 4, 12), ["cacahuate"], ["prediabetes"])).fetchone()["id"]
        for semanas_atras, peso in enumerate([92.5, 91.8, 91.0, 90.6, 89.9, 89.2]):
            conn.execute("INSERT INTO mediciones (paciente_id, fecha, peso_kg, altura_cm, cintura_cm, grasa_pct) "
                         "VALUES (%s,%s,%s,176,%s,%s)",
                         (pid, hoy - timedelta(weeks=5 - semanas_atras), peso, 104 - semanas_atras * 0.8,
                          29.5 - semanas_atras * 0.4))
        plan = conn.execute(
            "INSERT INTO planes_alimenticios (paciente_id, nutricionista_id, titulo, objetivo_kcal, objetivo_proteina_g, "
            "objetivo_carbohidratos_g, objetivo_grasa_g, estado, notas) VALUES (%s,%s,'Plan de descenso gradual',1900,"
            "120,200,60,'activo','Priorizar fibra y evitar cacahuate.') RETURNING id", (pid, nutri)).fetchone()["id"]
        comidas = [("desayuno", "Avena con fresas y yogur natural", 250, 340, 17, 50, 8),
                   ("colacion_am", "Manzana con almendras", 150, 190, 5, 25, 9),
                   ("almuerzo", "Pechuga de pollo, arroz integral y brócoli", 400, 560, 45, 60, 12),
                   ("colacion_pm", "Yogur griego con nuez", 180, 250, 15, 10, 15),
                   ("cena", "Tilapia con ensalada y aguacate", 350, 420, 40, 12, 22)]
        for dia in range(1, 8):
            for tipo, desc, g, kcal, p_, c_, g_ in comidas:
                conn.execute("INSERT INTO plan_comidas (plan_id, dia_semana, tipo_comida, descripcion, cantidad_g, kcal, "
                             "proteina_g, carbohidratos_g, grasa_g) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)",
                             (plan, dia, tipo, desc, g, kcal, p_, c_, g_))
        manana = (datetime.now(timezone.utc) + timedelta(days=1)).replace(hour=16, minute=0, second=0, microsecond=0)
        conn.execute("INSERT INTO citas (paciente_id, nutricionista_id, inicio, fin, modalidad, motivo, enlace_video) "
                     "VALUES (%s,%s,%s,%s,'virtual','Seguimiento mensual','https://meet.jit.si/sanl-demo')",
                     (pid, nutri, manana, manana + timedelta(hours=1)))
