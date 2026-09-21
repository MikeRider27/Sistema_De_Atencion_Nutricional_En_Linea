/** Acepta "YYYY-MM-DD" (fecha sin hora) o un ISO completo. */
export function fecha(v: string) {
  const d = /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T00:00:00`) : new Date(v);
  return d.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
}

export function fechaHora(v: string) {
  return new Date(v).toLocaleString("es-MX", { weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function hora(v: string) {
  return new Date(v).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
}

export function hoyISO() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

export const num = (v: number | null | undefined, d = 0) => (v === null || v === undefined ? "–" : v.toLocaleString("es-MX", { maximumFractionDigits: d }));
