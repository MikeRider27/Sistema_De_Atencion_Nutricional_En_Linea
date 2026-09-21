from datetime import date

from fpdf import FPDF

DIAS = {1: "Lunes", 2: "Martes", 3: "Miércoles", 4: "Jueves", 5: "Viernes", 6: "Sábado", 7: "Domingo"}
COMIDAS = {"desayuno": "Desayuno", "colacion_am": "Colación AM", "almuerzo": "Almuerzo",
           "colacion_pm": "Colación PM", "cena": "Cena"}


def _t(s) -> str:
    """Las fuentes base de PDF sólo cubren latin-1: lo demás se sustituye por '?'."""
    return "" if s is None else str(s).encode("latin-1", "replace").decode("latin-1")


def _n(v) -> str:
    return "-" if v is None else f"{v:g}"


def plan_pdf(plan: dict, paciente: str, nutricionista: str, comidas: list[dict]) -> bytes:
    pdf = FPDF()
    pdf.set_auto_page_break(True, 15)
    pdf.add_page()

    pdf.set_font("Helvetica", "B", 18)
    pdf.cell(0, 10, _t(plan["titulo"]), new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 10)
    pdf.set_text_color(90)
    pdf.cell(0, 6, _t(f"Paciente: {paciente}   |   Nutricionista: {nutricionista}"), new_x="LMARGIN", new_y="NEXT")
    fin = f" al {plan['fecha_fin']:%d/%m/%Y}" if plan.get("fecha_fin") else ""
    pdf.cell(0, 6, _t(f"Vigencia: desde {plan['fecha_inicio']:%d/%m/%Y}{fin}   |   Generado: {date.today():%d/%m/%Y}"),
             new_x="LMARGIN", new_y="NEXT")
    pdf.set_text_color(0)
    pdf.ln(3)

    if plan.get("objetivo_kcal"):
        pdf.set_font("Helvetica", "B", 11)
        pdf.cell(0, 7, _t(
            f"Objetivo diario: {plan['objetivo_kcal']} kcal | Proteína {_n(plan.get('objetivo_proteina_g'))} g | "
            f"Carbohidratos {_n(plan.get('objetivo_carbohidratos_g'))} g | Grasa {_n(plan.get('objetivo_grasa_g'))} g"),
            new_x="LMARGIN", new_y="NEXT")
    if plan.get("notas"):
        pdf.set_font("Helvetica", "I", 10)
        pdf.multi_cell(0, 5, _t(plan["notas"]), new_x="LMARGIN", new_y="NEXT")
    pdf.ln(2)

    dias = sorted({c["dia_semana"] for c in comidas})
    for d in dias:
        del_dia = [c for c in comidas if c["dia_semana"] == d]
        total = sum(c["kcal"] or 0 for c in del_dia)
        pdf.set_font("Helvetica", "B", 12)
        pdf.cell(0, 8, _t(f"{DIAS[d]}  ({total:g} kcal)"), new_x="LMARGIN", new_y="NEXT")
        pdf.set_font("Helvetica", "", 9)
        with pdf.table(col_widths=(28, 92, 20, 20, 30), text_align=("LEFT", "LEFT", "RIGHT", "RIGHT", "LEFT")) as t:
            h = t.row()
            for col in ("Comida", "Descripción", "Cant. (g)", "kcal", "P / C / G (g)"):
                h.cell(_t(col), style=None)
            for c in del_dia:
                r = t.row()
                r.cell(_t(COMIDAS[c["tipo_comida"]]))
                r.cell(_t(c["descripcion"]))
                r.cell(_n(c["cantidad_g"]))
                r.cell(_n(c["kcal"]))
                r.cell(f"{_n(c['proteina_g'])} / {_n(c['carbohidratos_g'])} / {_n(c['grasa_g'])}")
        pdf.ln(4)

    pdf.set_font("Helvetica", "I", 8)
    pdf.set_text_color(120)
    pdf.multi_cell(0, 4, _t("Este plan es una guía elaborada por tu nutricionista. Consulta con él o ella antes de "
                            "hacer cambios y ante cualquier molestia o condición médica."), new_x="LMARGIN", new_y="NEXT")
    return bytes(pdf.output())
