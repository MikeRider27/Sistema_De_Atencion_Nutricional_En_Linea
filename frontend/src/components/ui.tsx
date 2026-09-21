import type { ButtonHTMLAttributes, ReactNode } from "react";

export const inputCls =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 " +
  "focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 disabled:opacity-60 " +
  "dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100";

export function Card({ title, action, children, className = "" }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 ${className}`}>
      {(title || action) && (
        <header className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold">{title}</h2>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

type Variant = "primary" | "secondary" | "danger" | "ghost";
const variantes: Record<Variant, string> = {
  primary: "bg-emerald-600 text-white hover:bg-emerald-700 disabled:hover:bg-emerald-600",
  secondary: "border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800",
  danger: "bg-red-600 text-white hover:bg-red-700",
  ghost: "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800",
};

export function Button({ variant = "primary", className = "", ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type="button"
      {...p}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${variantes[variant]} ${className}`}
    />
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{label}</span>
      {children}
      {hint && <span className="block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

export function Alert({ kind = "error", children }: { kind?: "error" | "ok" | "info"; children: ReactNode }) {
  const c = {
    error: "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200",
    ok: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
    info: "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-900 dark:bg-sky-950 dark:text-sky-200",
  }[kind];
  return (
    <div role={kind === "error" ? "alert" : "status"} className={`rounded-lg border px-3 py-2 text-sm ${c}`}>
      {children}
    </div>
  );
}

export function Cargando({ texto = "Cargando…" }: { texto?: string }) {
  return <p className="py-6 text-center text-sm text-slate-500">{texto}</p>;
}

export function Vacio({ children }: { children: ReactNode }) {
  return <p className="rounded-lg border border-dashed border-slate-300 py-8 text-center text-sm text-slate-500 dark:border-slate-700">{children}</p>;
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

const colores: Record<string, string> = {
  programada: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200",
  completada: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  cancelada: "bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
  no_asistio: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
  borrador: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
  activo: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  finalizado: "bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
};

export function Badge({ valor }: { valor: string }) {
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${colores[valor] ?? colores.cancelada}`}>{valor.replace("_", " ")}</span>;
}

/** Barra de progreso hacia un objetivo (se pone ámbar si se excede). */
export function Barra({ etiqueta, valor, objetivo, unidad }: { etiqueta: string; valor: number; objetivo?: number | null; unidad: string }) {
  const pct = objetivo ? Math.min(100, (valor / objetivo) * 100) : 0;
  const excede = !!objetivo && valor > objetivo * 1.05;
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs">
        <span className="font-medium">{etiqueta}</span>
        <span className="text-slate-500">
          {Math.round(valor)}
          {objetivo ? ` / ${objetivo}` : ""} {unidad}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
        <div className={`h-full rounded-full ${excede ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${objetivo ? pct : 0}%` }} />
      </div>
    </div>
  );
}
