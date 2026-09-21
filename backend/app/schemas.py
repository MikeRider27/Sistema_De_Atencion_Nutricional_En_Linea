from datetime import date, datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field, field_validator

Rol = Literal["admin", "nutricionista", "paciente"]
Sexo = Literal["F", "M"]
Actividad = Literal["sedentario", "ligero", "moderado", "intenso", "muy_intenso"]
TipoComida = Literal["desayuno", "colacion_am", "almuerzo", "colacion_pm", "cena"]
EstadoCita = Literal["programada", "completada", "cancelada", "no_asistio"]
EstadoPlan = Literal["borrador", "activo", "finalizado"]
Modalidad = Literal["virtual", "presencial"]

Password = Field(min_length=8, max_length=72)


def _limpiar_lista(v: list[str]) -> list[str]:
    return sorted({x.strip() for x in v if x and x.strip()})


# ---- Auth / usuarios -------------------------------------------------------
class LoginIn(BaseModel):
    email: str = Field(max_length=254)
    password: str


class RegistroIn(BaseModel):
    email: EmailStr
    password: str = Password
    nombre: str = Field(min_length=2, max_length=120)
    nutricionista_id: UUID | None = None
    fecha_nacimiento: date | None = None
    sexo: Sexo | None = None
    altura_cm: float | None = Field(None, ge=50, le=250)


class UsuarioOut(BaseModel):
    id: UUID
    email: str
    nombre: str
    rol: Rol
    paciente_id: UUID | None = None


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    usuario: UsuarioOut


class UsuarioAdminIn(BaseModel):
    email: EmailStr
    password: str = Password
    nombre: str = Field(min_length=2, max_length=120)
    rol: Rol


# ---- Pacientes -------------------------------------------------------------
class PacienteCrearIn(BaseModel):
    email: EmailStr
    password: str = Password
    nombre: str = Field(min_length=2, max_length=120)
    fecha_nacimiento: date | None = None
    sexo: Sexo | None = None
    telefono: str | None = None
    altura_cm: float | None = Field(None, ge=50, le=250)
    nivel_actividad: Actividad = "ligero"
    objetivo: str | None = None
    alergias: list[str] = []
    condiciones: list[str] = []
    nutricionista_id: UUID | None = None  # sólo lo respeta el admin


class PacienteUpdateIn(BaseModel):
    fecha_nacimiento: date | None = None
    sexo: Sexo | None = None
    telefono: str | None = None
    altura_cm: float | None = Field(None, ge=50, le=250)
    nivel_actividad: Actividad | None = None
    objetivo: str | None = None
    alergias: list[str] | None = None
    condiciones: list[str] | None = None
    notas: str | None = None
    nutricionista_id: UUID | None = None

    @field_validator("alergias", "condiciones")
    @classmethod
    def _lista(cls, v):
        return None if v is None else _limpiar_lista(v)


class MedicionIn(BaseModel):
    fecha: date = Field(default_factory=date.today)
    peso_kg: float = Field(ge=2, le=500)
    altura_cm: float | None = Field(None, ge=50, le=250)
    cintura_cm: float | None = Field(None, ge=20, le=300)
    cadera_cm: float | None = Field(None, ge=20, le=300)
    grasa_pct: float | None = Field(None, ge=1, le=80)
    notas: str | None = None

    @field_validator("fecha")
    @classmethod
    def _no_futura(cls, v: date):
        if v > date.today():
            raise ValueError("La fecha de la medición no puede ser futura")
        return v


# ---- Citas -----------------------------------------------------------------
class CitaIn(BaseModel):
    paciente_id: UUID | None = None
    inicio: datetime
    duracion_min: int = Field(60, ge=15, le=240)
    modalidad: Modalidad = "virtual"
    motivo: str | None = Field(None, max_length=500)


class CitaUpdateIn(BaseModel):
    estado: EstadoCita | None = None
    inicio: datetime | None = None
    duracion_min: int | None = Field(None, ge=15, le=240)
    modalidad: Modalidad | None = None
    motivo: str | None = Field(None, max_length=500)
    notas: str | None = None


# ---- Alimentos -------------------------------------------------------------
class AlimentoIn(BaseModel):
    nombre: str = Field(min_length=2, max_length=120)
    categoria: str = Field(min_length=2, max_length=60)
    kcal: float = Field(ge=0, le=900)
    proteina_g: float = Field(0, ge=0, le=100)
    carbohidratos_g: float = Field(0, ge=0, le=100)
    grasa_g: float = Field(0, ge=0, le=100)
    fibra_g: float = Field(0, ge=0, le=100)


# ---- Planes ----------------------------------------------------------------
class ComidaIn(BaseModel):
    dia_semana: int = Field(ge=1, le=7)
    tipo_comida: TipoComida
    alimento_id: int | None = None
    descripcion: str = Field(min_length=1, max_length=300)
    cantidad_g: float | None = Field(None, gt=0, le=5000)
    kcal: float | None = Field(None, ge=0, le=5000)
    proteina_g: float | None = Field(None, ge=0, le=500)
    carbohidratos_g: float | None = Field(None, ge=0, le=500)
    grasa_g: float | None = Field(None, ge=0, le=500)


class PlanIn(BaseModel):
    paciente_id: UUID
    titulo: str = Field(min_length=1, max_length=150)
    objetivo_kcal: int | None = Field(None, ge=500, le=6000)
    objetivo_proteina_g: int | None = Field(None, ge=0, le=1000)
    objetivo_carbohidratos_g: int | None = Field(None, ge=0, le=1500)
    objetivo_grasa_g: int | None = Field(None, ge=0, le=600)
    fecha_inicio: date = Field(default_factory=date.today)
    fecha_fin: date | None = None
    estado: EstadoPlan = "borrador"
    notas: str | None = None
    comidas: list[ComidaIn] = Field(default=[], max_length=200)
    generado_por_ia: bool = False


class PlanUpdateIn(BaseModel):
    titulo: str | None = Field(None, min_length=1, max_length=150)
    objetivo_kcal: int | None = Field(None, ge=500, le=6000)
    objetivo_proteina_g: int | None = None
    objetivo_carbohidratos_g: int | None = None
    objetivo_grasa_g: int | None = None
    fecha_fin: date | None = None
    estado: EstadoPlan | None = None
    notas: str | None = None


# ---- Diario ----------------------------------------------------------------
class DiarioIn(BaseModel):
    fecha: date = Field(default_factory=date.today)
    tipo_comida: TipoComida
    alimento_id: int
    cantidad_g: float = Field(gt=0, le=5000)
    notas: str | None = Field(None, max_length=300)


# ---- IA --------------------------------------------------------------------
class IAPlanIn(BaseModel):
    paciente_id: UUID
    instrucciones: str | None = Field(None, max_length=1000)
    dias: int = Field(7, ge=1, le=7)
    guardar: bool = False  # True => se guarda como plan en borrador


class PlanIA(BaseModel):
    """Contrato que se le exige al modelo (se valida antes de usarlo)."""
    titulo: str = Field(max_length=150)
    objetivo_kcal: int = Field(ge=800, le=5000)
    objetivo_proteina_g: int = Field(ge=0, le=500)
    objetivo_carbohidratos_g: int = Field(ge=0, le=800)
    objetivo_grasa_g: int = Field(ge=0, le=400)
    notas: str = ""
    comidas: list[ComidaIn] = Field(min_length=1, max_length=200)
