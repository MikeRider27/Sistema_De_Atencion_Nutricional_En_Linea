"""Cálculos nutricionales básicos (Mifflin-St Jeor)."""
from datetime import date

FACTORES_ACTIVIDAD = {
    "sedentario": 1.2, "ligero": 1.375, "moderado": 1.55, "intenso": 1.725, "muy_intenso": 1.9,
}


def edad(fecha_nacimiento: date | None, hoy: date | None = None) -> int | None:
    if not fecha_nacimiento:
        return None
    hoy = hoy or date.today()
    return hoy.year - fecha_nacimiento.year - ((hoy.month, hoy.day) < (fecha_nacimiento.month, fecha_nacimiento.day))


def categoria_imc(imc: float) -> str:
    if imc < 18.5:
        return "Bajo peso"
    if imc < 25:
        return "Normal"
    if imc < 30:
        return "Sobrepeso"
    return "Obesidad"


def tmb(peso_kg: float, altura_cm: float, anios: int, sexo: str | None) -> float:
    base = 10 * peso_kg + 6.25 * altura_cm - 5 * anios
    ajuste = {"M": 5, "F": -161}.get(sexo or "", -78)  # sin dato de sexo: promedio
    return base + ajuste


def gasto_total(tmb_kcal: float, nivel_actividad: str) -> float:
    return tmb_kcal * FACTORES_ACTIVIDAD.get(nivel_actividad, 1.375)


def macros_sugeridos(kcal: float) -> dict:
    """Reparto 25 % proteína / 45 % carbohidratos / 30 % grasa."""
    return {
        "proteina_g": round(kcal * 0.25 / 4),
        "carbohidratos_g": round(kcal * 0.45 / 4),
        "grasa_g": round(kcal * 0.30 / 9),
    }
