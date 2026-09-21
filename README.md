# SANL · Sistema de Atención Nutricional en Línea

Plataforma para que nutricionistas den seguimiento a sus pacientes: fichas clínicas, mediciones (peso/IMC),
agenda de citas, planes alimenticios (con PDF), diario de comidas y propuestas de plan asistidas por IA (Gemini).

| Capa | Tecnología |
|---|---|
| Frontend | Next.js 16 (Pages Router) · React 19 · Tailwind 4 |
| Backend | FastAPI · psycopg 3 · JWT · fpdf2 · google-genai |
| Base de datos | PostgreSQL 16 (esquema compatible con Supabase) |
| Orquestación | Docker Compose |

## Inicio rápido

```bash
./setup.sh                    # crea .env con secretos aleatorios
docker compose up -d --build  # (o: make up)
```

- App: <http://localhost:3100> · API/Swagger: <http://localhost:8100/docs> · PostgreSQL: `localhost:5433`
- Los puertos son configurables en `.env` (`FRONTEND_PORT`, `BACKEND_PORT`, `DB_PORT`) y sólo escuchan en `127.0.0.1`.
- Con `SEED_DEMO_DATA=true` (por defecto en `.env.example`) se crean cuentas de demostración, contraseña `Demo1234!`:
  `admin@example.com`, `nutri@example.com`, `paciente@example.com`. **Desactívalo fuera de desarrollo.**

## Roles

- **Paciente**: su progreso, plan (sólo planes no borrador), diario, citas y catálogo de alimentos.
- **Nutricionista**: sus pacientes (o los que se asigne con «Tomar paciente»), planes, agenda, IA.
- **Admin**: todo lo anterior + alta de nutricionistas/admins y activación de cuentas.

El acceso a cada paciente se verifica en el backend (`deps.paciente_accesible`); un paciente ajeno responde 404.

## Base de datos (`db/init/`)

Se ejecuta al crear el volumen. Para recrearla desde cero: `make reset` (**borra los datos**).

- Integridad en la base: `CHECK` de rangos, IMC como columna generada, enums, correo `citext`.
- `EXCLUDE` con `btree_gist`: un nutricionista o paciente **no puede tener citas traslapadas** (sin condiciones de carrera).
- Índice único parcial: **un solo plan activo por paciente**.
- Trigger que valida que `usuario_id` sea paciente y `nutricionista_id` nutricionista.
- Búsqueda de alimentos por similitud (`pg_trgm`); vistas `v_diario_resumen` y `v_progreso_paciente`.
- `sugerencias_ia`: bitácora de cada consulta al modelo.

Para usar Supabase en lugar del Postgres local, apunta `DATABASE_URL` del backend a la cadena de conexión de Supabase
y ejecuta `db/init/*.sql` en su editor SQL.

## IA (Gemini)

Opcional: define `GEMINI_API_KEY` en `.env`. Sin llave, el resto funciona y `/ia/plan` responde 503.
Al modelo sólo se envían datos clínicos mínimos (edad, sexo, medidas, alergias…), **nunca nombre, correo ni teléfono**.
La salida se valida contra un esquema y se guarda como **borrador**; el paciente no la ve hasta que el nutricionista la active.

## Pruebas

```bash
make test    # 30 pruebas del backend contra una BD PostgreSQL efímera (no toca tus datos)
```

## Notas de seguridad / producción

- El token JWT se guarda en `localStorage` (simple, pero expuesto a XSS); para producción considera cookies `HttpOnly`.
- El límite de intentos de login es en memoria (por proceso): con varias réplicas, muévelo a Redis o al proxy.
- Pon un proxy con HTTPS delante y no publiques el puerto de la base de datos.
- Los cálculos (Mifflin-St Jeor, reparto 25/45/30) son orientativos y no sustituyen el criterio profesional.
