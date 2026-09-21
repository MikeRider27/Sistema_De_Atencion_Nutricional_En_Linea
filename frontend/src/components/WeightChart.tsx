import type { Medicion } from "@/lib/types";
import { fecha } from "@/lib/format";

/** Gráfica de peso en SVG puro (sin dependencias). */
export default function WeightChart({ datos }: { datos: Medicion[] }) {
  if (datos.length < 2) return <p className="py-8 text-center text-sm text-slate-500">Registra al menos dos mediciones para ver la evolución.</p>;

  const W = 640, H = 220, P = { t: 16, r: 16, b: 28, l: 44 };
  const pesos = datos.map((d) => d.peso_kg);
  const min = Math.floor(Math.min(...pesos) - 1), max = Math.ceil(Math.max(...pesos) + 1);
  const x = (i: number) => P.l + (i / (datos.length - 1)) * (W - P.l - P.r);
  const y = (v: number) => P.t + (1 - (v - min) / (max - min)) * (H - P.t - P.b);
  const linea = datos.map((d, i) => `${x(i)},${y(d.peso_kg)}`).join(" ");
  const ticks = [min, (min + max) / 2, max];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Evolución del peso en kilogramos">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={P.l} x2={W - P.r} y1={y(t)} y2={y(t)} className="stroke-slate-200 dark:stroke-slate-800" />
          <text x={P.l - 8} y={y(t) + 4} textAnchor="end" className="fill-slate-500 text-[11px]">{t.toFixed(1)}</text>
        </g>
      ))}
      <polyline points={linea} fill="none" strokeWidth={2.5} strokeLinejoin="round" className="stroke-emerald-600" />
      {datos.map((d, i) => (
        <circle key={d.id} cx={x(i)} cy={y(d.peso_kg)} r={4} className="fill-emerald-600 stroke-white dark:stroke-slate-900" strokeWidth={2}>
          <title>{`${fecha(d.fecha)}: ${d.peso_kg} kg (IMC ${d.imc})`}</title>
        </circle>
      ))}
      <text x={P.l} y={H - 8} className="fill-slate-500 text-[11px]">{fecha(datos[0].fecha)}</text>
      <text x={W - P.r} y={H - 8} textAnchor="end" className="fill-slate-500 text-[11px]">{fecha(datos[datos.length - 1].fecha)}</text>
    </svg>
  );
}
