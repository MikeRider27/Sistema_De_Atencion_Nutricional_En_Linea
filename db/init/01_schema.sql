-- ============================================================================
-- SANL - Sistema de Atención Nutricional en Línea
-- Esquema PostgreSQL 16 (compatible con Supabase)
-- Se ejecuta una sola vez al crear el volumen de datos.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS citext;     -- correos sin distinguir mayúsculas
CREATE EXTENSION IF NOT EXISTS btree_gist; -- exclusión de citas traslapadas
CREATE EXTENSION IF NOT EXISTS pg_trgm;    -- búsqueda de alimentos por similitud

-- ---------------------------------------------------------------------------
-- Tipos enumerados
-- ---------------------------------------------------------------------------
CREATE TYPE rol_usuario     AS ENUM ('admin', 'nutricionista', 'paciente');
CREATE TYPE sexo_biologico  AS ENUM ('F', 'M');
CREATE TYPE nivel_actividad AS ENUM ('sedentario', 'ligero', 'moderado', 'intenso', 'muy_intenso');
CREATE TYPE modalidad_cita  AS ENUM ('virtual', 'presencial');
CREATE TYPE estado_cita     AS ENUM ('programada', 'completada', 'cancelada', 'no_asistio');
CREATE TYPE tipo_comida     AS ENUM ('desayuno', 'colacion_am', 'almuerzo', 'colacion_pm', 'cena');
CREATE TYPE estado_plan     AS ENUM ('borrador', 'activo', 'finalizado');

-- ---------------------------------------------------------------------------
-- Funciones auxiliares
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- usuarios: cuentas de acceso (admin / nutricionista / paciente)
-- ---------------------------------------------------------------------------
CREATE TABLE usuarios (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email         citext      NOT NULL UNIQUE,
    password_hash text        NOT NULL,
    nombre        text        NOT NULL CHECK (length(btrim(nombre)) BETWEEN 2 AND 120),
    rol           rol_usuario NOT NULL,
    activo        boolean     NOT NULL DEFAULT true,
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT usuarios_email_formato CHECK (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')
);
CREATE INDEX usuarios_rol_idx ON usuarios (rol) WHERE activo;
CREATE TRIGGER usuarios_updated BEFORE UPDATE ON usuarios
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- pacientes: ficha clínica (1:1 con un usuario de rol 'paciente')
-- ---------------------------------------------------------------------------
CREATE TABLE pacientes (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id        uuid NOT NULL UNIQUE REFERENCES usuarios (id) ON DELETE CASCADE,
    nutricionista_id  uuid REFERENCES usuarios (id) ON DELETE SET NULL,
    fecha_nacimiento  date CHECK (fecha_nacimiento BETWEEN DATE '1900-01-01' AND CURRENT_DATE),
    sexo              sexo_biologico,
    telefono          text CHECK (telefono IS NULL OR telefono ~ '^[0-9+()\s-]{7,20}$'),
    altura_cm         numeric(5,1) CHECK (altura_cm BETWEEN 50 AND 250),
    nivel_actividad   nivel_actividad NOT NULL DEFAULT 'ligero',
    objetivo          text,
    alergias          text[] NOT NULL DEFAULT '{}',
    condiciones       text[] NOT NULL DEFAULT '{}',   -- diabetes, hipertensión, etc.
    notas             text,
    created_at        timestamptz NOT NULL DEFAULT now(),
    updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX pacientes_nutricionista_idx ON pacientes (nutricionista_id);
CREATE TRIGGER pacientes_updated BEFORE UPDATE ON pacientes
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Garantiza que usuario_id sea de rol paciente y nutricionista_id de rol nutricionista.
CREATE OR REPLACE FUNCTION validar_roles_paciente() RETURNS trigger AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM usuarios WHERE id = NEW.usuario_id AND rol = 'paciente') THEN
        RAISE EXCEPTION 'usuario_id % no tiene rol paciente', NEW.usuario_id;
    END IF;
    IF NEW.nutricionista_id IS NOT NULL AND
       NOT EXISTS (SELECT 1 FROM usuarios WHERE id = NEW.nutricionista_id AND rol = 'nutricionista') THEN
        RAISE EXCEPTION 'nutricionista_id % no tiene rol nutricionista', NEW.nutricionista_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER pacientes_validar_roles BEFORE INSERT OR UPDATE OF usuario_id, nutricionista_id ON pacientes
    FOR EACH ROW EXECUTE FUNCTION validar_roles_paciente();

-- ---------------------------------------------------------------------------
-- mediciones: seguimiento antropométrico. El IMC se calcula en la base.
-- ---------------------------------------------------------------------------
CREATE TABLE mediciones (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    paciente_id   uuid NOT NULL REFERENCES pacientes (id) ON DELETE CASCADE,
    fecha         date NOT NULL DEFAULT CURRENT_DATE,
    peso_kg       numeric(5,2) NOT NULL CHECK (peso_kg BETWEEN 2 AND 500),
    altura_cm     numeric(5,1) NOT NULL CHECK (altura_cm BETWEEN 50 AND 250),
    cintura_cm    numeric(5,1) CHECK (cintura_cm BETWEEN 20 AND 300),
    cadera_cm     numeric(5,1) CHECK (cadera_cm BETWEEN 20 AND 300),
    grasa_pct     numeric(4,1) CHECK (grasa_pct BETWEEN 1 AND 80),
    imc           numeric(4,1) GENERATED ALWAYS AS
                      (round(peso_kg / ((altura_cm / 100) * (altura_cm / 100)), 1)) STORED,
    notas         text,
    created_at    timestamptz NOT NULL DEFAULT now(),
    UNIQUE (paciente_id, fecha)
);
CREATE INDEX mediciones_paciente_fecha_idx ON mediciones (paciente_id, fecha DESC);

-- ---------------------------------------------------------------------------
-- citas: agenda. El EXCLUDE evita que un nutricionista o un paciente tengan
-- dos citas activas traslapadas (a nivel de base, sin condiciones de carrera).
-- ---------------------------------------------------------------------------
CREATE TABLE citas (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    paciente_id      uuid NOT NULL REFERENCES pacientes (id) ON DELETE CASCADE,
    nutricionista_id uuid NOT NULL REFERENCES usuarios (id) ON DELETE RESTRICT,
    inicio           timestamptz NOT NULL,
    fin              timestamptz NOT NULL,
    modalidad        modalidad_cita NOT NULL DEFAULT 'virtual',
    estado           estado_cita    NOT NULL DEFAULT 'programada',
    motivo           text,
    notas            text,
    enlace_video     text,
    created_at       timestamptz NOT NULL DEFAULT now(),
    updated_at       timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT citas_rango_valido CHECK (fin > inicio AND fin - inicio <= interval '4 hours'),
    CONSTRAINT citas_sin_traslape_nutricionista EXCLUDE USING gist (
        nutricionista_id WITH =, tstzrange(inicio, fin) WITH &&
    ) WHERE (estado = 'programada'),
    CONSTRAINT citas_sin_traslape_paciente EXCLUDE USING gist (
        paciente_id WITH =, tstzrange(inicio, fin) WITH &&
    ) WHERE (estado = 'programada')
);
CREATE INDEX citas_nutricionista_inicio_idx ON citas (nutricionista_id, inicio);
CREATE INDEX citas_paciente_inicio_idx      ON citas (paciente_id, inicio);
CREATE TRIGGER citas_updated BEFORE UPDATE ON citas
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- alimentos: catálogo. Valores nutricionales por 100 g.
-- ---------------------------------------------------------------------------
CREATE TABLE alimentos (
    id                  serial PRIMARY KEY,
    nombre              text NOT NULL,
    categoria           text NOT NULL,
    kcal                numeric(6,1) NOT NULL CHECK (kcal >= 0),
    proteina_g          numeric(5,1) NOT NULL DEFAULT 0 CHECK (proteina_g >= 0),
    carbohidratos_g     numeric(5,1) NOT NULL DEFAULT 0 CHECK (carbohidratos_g >= 0),
    grasa_g             numeric(5,1) NOT NULL DEFAULT 0 CHECK (grasa_g >= 0),
    fibra_g             numeric(5,1) NOT NULL DEFAULT 0 CHECK (fibra_g >= 0),
    creado_por          uuid REFERENCES usuarios (id) ON DELETE SET NULL,
    created_at          timestamptz NOT NULL DEFAULT now(),
    -- coherencia física: los macros no pueden exceder 100 g por 100 g de alimento
    CONSTRAINT alimentos_macros_coherentes CHECK (proteina_g + carbohidratos_g + grasa_g <= 100.5)
);
CREATE UNIQUE INDEX alimentos_nombre_uk   ON alimentos (lower(nombre));
CREATE INDEX        alimentos_nombre_trgm ON alimentos USING gin (nombre gin_trgm_ops);
CREATE INDEX        alimentos_categoria_idx ON alimentos (categoria);

-- ---------------------------------------------------------------------------
-- planes_alimenticios + plan_comidas
-- ---------------------------------------------------------------------------
CREATE TABLE planes_alimenticios (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    paciente_id      uuid NOT NULL REFERENCES pacientes (id) ON DELETE CASCADE,
    nutricionista_id uuid NOT NULL REFERENCES usuarios (id) ON DELETE RESTRICT,
    titulo           text NOT NULL CHECK (length(btrim(titulo)) > 0),
    objetivo_kcal    integer CHECK (objetivo_kcal BETWEEN 500 AND 6000),
    objetivo_proteina_g      integer CHECK (objetivo_proteina_g >= 0),
    objetivo_carbohidratos_g integer CHECK (objetivo_carbohidratos_g >= 0),
    objetivo_grasa_g         integer CHECK (objetivo_grasa_g >= 0),
    fecha_inicio     date NOT NULL DEFAULT CURRENT_DATE,
    fecha_fin        date,
    estado           estado_plan NOT NULL DEFAULT 'borrador',
    generado_por_ia  boolean NOT NULL DEFAULT false,
    notas            text,
    created_at       timestamptz NOT NULL DEFAULT now(),
    updated_at       timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT planes_fechas_validas CHECK (fecha_fin IS NULL OR fecha_fin >= fecha_inicio)
);
-- Un paciente sólo puede tener un plan activo a la vez.
CREATE UNIQUE INDEX planes_un_activo_por_paciente ON planes_alimenticios (paciente_id) WHERE estado = 'activo';
CREATE INDEX planes_paciente_idx ON planes_alimenticios (paciente_id, fecha_inicio DESC);
CREATE TRIGGER planes_updated BEFORE UPDATE ON planes_alimenticios
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE plan_comidas (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id      uuid NOT NULL REFERENCES planes_alimenticios (id) ON DELETE CASCADE,
    dia_semana   smallint NOT NULL CHECK (dia_semana BETWEEN 1 AND 7),  -- 1 = lunes
    tipo_comida  tipo_comida NOT NULL,
    alimento_id  integer REFERENCES alimentos (id) ON DELETE SET NULL,
    descripcion  text NOT NULL CHECK (length(btrim(descripcion)) > 0),
    cantidad_g   numeric(7,1) CHECK (cantidad_g > 0),
    kcal         numeric(6,1) CHECK (kcal >= 0),
    proteina_g   numeric(5,1) CHECK (proteina_g >= 0),
    carbohidratos_g numeric(5,1) CHECK (carbohidratos_g >= 0),
    grasa_g      numeric(5,1) CHECK (grasa_g >= 0)
);
CREATE INDEX plan_comidas_plan_idx ON plan_comidas (plan_id, dia_semana, tipo_comida);

-- ---------------------------------------------------------------------------
-- diario_alimentos: lo que el paciente registra que comió
-- ---------------------------------------------------------------------------
CREATE TABLE diario_alimentos (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    paciente_id uuid NOT NULL REFERENCES pacientes (id) ON DELETE CASCADE,
    fecha       date NOT NULL DEFAULT CURRENT_DATE,
    tipo_comida tipo_comida NOT NULL,
    alimento_id integer NOT NULL REFERENCES alimentos (id) ON DELETE RESTRICT,
    cantidad_g  numeric(7,1) NOT NULL CHECK (cantidad_g > 0 AND cantidad_g <= 5000),
    notas       text,
    created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX diario_paciente_fecha_idx ON diario_alimentos (paciente_id, fecha DESC);

-- ---------------------------------------------------------------------------
-- sugerencias_ia: bitácora de consultas al modelo (RF-11) para trazabilidad
-- ---------------------------------------------------------------------------
CREATE TABLE sugerencias_ia (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    paciente_id uuid NOT NULL REFERENCES pacientes (id) ON DELETE CASCADE,
    solicitado_por uuid REFERENCES usuarios (id) ON DELETE SET NULL,
    modelo      text NOT NULL,
    instrucciones text,
    respuesta   jsonb NOT NULL,
    plan_id     uuid REFERENCES planes_alimenticios (id) ON DELETE SET NULL,
    created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sugerencias_paciente_idx ON sugerencias_ia (paciente_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- Vistas de reporte
-- ---------------------------------------------------------------------------
-- Totales nutricionales del diario por paciente y día.
CREATE VIEW v_diario_resumen AS
SELECT d.paciente_id,
       d.fecha,
       round(sum(a.kcal            * d.cantidad_g / 100), 1) AS kcal,
       round(sum(a.proteina_g      * d.cantidad_g / 100), 1) AS proteina_g,
       round(sum(a.carbohidratos_g * d.cantidad_g / 100), 1) AS carbohidratos_g,
       round(sum(a.grasa_g         * d.cantidad_g / 100), 1) AS grasa_g,
       round(sum(a.fibra_g         * d.cantidad_g / 100), 1) AS fibra_g,
       count(*)                                              AS registros
FROM diario_alimentos d
JOIN alimentos a ON a.id = d.alimento_id
GROUP BY d.paciente_id, d.fecha;

-- Variación de peso frente a la medición anterior y a la primera.
CREATE VIEW v_progreso_paciente AS
SELECT m.*,
       m.peso_kg - lag(m.peso_kg)  OVER w AS delta_anterior_kg,
       m.peso_kg - first_value(m.peso_kg) OVER w_total AS delta_inicial_kg
FROM mediciones m
WINDOW w       AS (PARTITION BY m.paciente_id ORDER BY m.fecha),
       w_total AS (PARTITION BY m.paciente_id ORDER BY m.fecha
                   ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING);
