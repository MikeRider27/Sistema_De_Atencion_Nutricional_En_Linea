export type Rol = "admin" | "nutricionista" | "paciente";

export interface Usuario {
  id: string;
  email: string;
  nombre: string;
  rol: Rol;
  paciente_id: string | null;
}

export interface Paciente {
  id: string;
  usuario_id: string;
  nutricionista_id: string | null;
  nutricionista_nombre: string | null;
  nombre: string;
  email: string;
  fecha_nacimiento: string | null;
  sexo: "F" | "M" | null;
  telefono: string | null;
  altura_cm: number | null;
  nivel_actividad: string;
  objetivo: string | null;
  alergias: string[];
  condiciones: string[];
  notas: string | null;
}

export interface Medicion {
  id: string;
  fecha: string;
  peso_kg: number;
  altura_cm: number;
  cintura_cm: number | null;
  cadera_cm: number | null;
  grasa_pct: number | null;
  imc: number;
  delta_anterior_kg: number | null;
  delta_inicial_kg: number | null;
}

export interface Resumen {
  ultima_medicion: Medicion | null;
  imc_categoria: string | null;
  edad: number | null;
  tmb_kcal: number | null;
  gasto_total_kcal: number | null;
  macros_sugeridos: { proteina_g: number; carbohidratos_g: number; grasa_g: number } | null;
  plan_activo: { id: string; titulo: string; objetivo_kcal: number | null } | null;
  proxima_cita: { id: string; inicio: string; modalidad: string } | null;
}

export interface Cita {
  id: string;
  paciente_id: string;
  paciente_nombre: string;
  nutricionista_nombre: string;
  inicio: string;
  fin: string;
  modalidad: "virtual" | "presencial";
  estado: "programada" | "completada" | "cancelada" | "no_asistio";
  motivo: string | null;
  enlace_video: string | null;
}

export interface Slot {
  inicio: string;
  fin: string;
  disponible: boolean;
}

export interface Alimento {
  id: number;
  nombre: string;
  categoria: string;
  kcal: number;
  proteina_g: number;
  carbohidratos_g: number;
  grasa_g: number;
  fibra_g: number;
}

export const TIPOS_COMIDA = ["desayuno", "colacion_am", "almuerzo", "colacion_pm", "cena"] as const;
export type TipoComida = (typeof TIPOS_COMIDA)[number];

export const ETIQUETA_COMIDA: Record<TipoComida, string> = {
  desayuno: "Desayuno",
  colacion_am: "Colación AM",
  almuerzo: "Almuerzo",
  colacion_pm: "Colación PM",
  cena: "Cena",
};

export const DIAS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

export interface Comida {
  id?: string;
  dia_semana: number;
  tipo_comida: TipoComida;
  descripcion: string;
  cantidad_g: number | null;
  kcal: number | null;
  proteina_g: number | null;
  carbohidratos_g: number | null;
  grasa_g: number | null;
}

export interface Plan {
  id: string;
  paciente_id: string;
  paciente_nombre: string;
  nutricionista_nombre: string;
  titulo: string;
  objetivo_kcal: number | null;
  objetivo_proteina_g: number | null;
  objetivo_carbohidratos_g: number | null;
  objetivo_grasa_g: number | null;
  fecha_inicio: string;
  fecha_fin: string | null;
  estado: "borrador" | "activo" | "finalizado";
  generado_por_ia: boolean;
  notas: string | null;
  comidas?: Comida[];
}

export interface Macros {
  kcal: number;
  proteina_g: number;
  carbohidratos_g: number;
  grasa_g: number;
}

export interface RegistroDiario {
  id: string;
  tipo_comida: TipoComida;
  alimento: string;
  cantidad_g: number;
  kcal: number;
  proteina_g: number;
  carbohidratos_g: number;
  grasa_g: number;
}

export interface Diario {
  fecha: string;
  registros: RegistroDiario[];
  totales: Macros & { fibra_g: number };
  objetivo: Partial<Macros> | null;
}
