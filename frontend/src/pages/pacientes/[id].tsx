import Link from "next/link";
import { useRouter } from "next/router";
import { useState, type FormEvent } from "react";
import Layout from "@/components/Layout";
import DiarioPanel from "@/components/panels/DiarioPanel";
import MedicionesPanel from "@/components/panels/MedicionesPanel";
import { Alert, Badge, Button, Card, Cargando, Field, Stat, Vacio, inputCls } from "@/components/ui";
import { api, useFetch } from "@/lib/api";
import { fecha, num } from "@/lib/format";
import type { Paciente, Plan, Resumen } from "@/lib/types";

const TABS = ["Resumen", "Mediciones", "Diario", "Planes"] as const;

function FichaForm({ p, onGuardado }: { p: Paciente; onGuardado: () => void }) {
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  async function guardar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const lista = (k: string) => String(f.get(k)).split(",").map((s) => s.trim()).filter(Boolean);
    try {
      await api(`/pacientes/${p.id}`, {
        method: "PATCH",
        body: { objetivo: String(f.get("objetivo")) || null, nivel_actividad: f.get("nivel"), alergias: lista("alergias"), condiciones: lista("condiciones"), notas: String(f.get("notas")) || null, altura_cm: f.get("altura") ? Number(f.get("altura")) : null },
      });
      setMsg({ ok: true, t: "Ficha actualizada." });
      onGuardado();
    } catch (x) {
      setMsg({ ok: false, t: (x as Error).message });
    }
  }
  return (
    <form onSubmit={guardar} className="grid gap-3 sm:grid-cols-2">
      {msg && <div className="sm:col-span-2"><Alert kind={msg.ok ? "ok" : "error"}>{msg.t}</Alert></div>}
      <Field label="Objetivo"><input name="objetivo" defaultValue={p.objetivo ?? ""} className={inputCls} /></Field>
      <Field label="Nivel de actividad">
        <select name="nivel" defaultValue={p.nivel_actividad} className={inputCls}>
          {["sedentario", "ligero", "moderado", "intenso", "muy_intenso"].map((n) => <option key={n} value={n}>{n.replace("_", " ")}</option>)}
        </select>
      </Field>
      <Field label="Alergias" hint="Separadas por comas"><input name="alergias" defaultValue={p.alergias.join(", ")} className={inputCls} /></Field>
      <Field label="Condiciones" hint="Separadas por comas"><input name="condiciones" defaultValue={p.condiciones.join(", ")} className={inputCls} /></Field>
      <Field label="Estatura (cm)"><input name="altura" type="number" step="0.1" defaultValue={p.altura_cm ?? ""} className={inputCls} /></Field>
      <div className="sm:col-span-2"><Field label="Notas clínicas"><textarea name="notas" rows={3} defaultValue={p.notas ?? ""} className={inputCls} /></Field></div>
      <div><Button type="submit">Guardar ficha</Button></div>
    </form>
  );
}

function PlanesTab({ pid }: { pid: string }) {
  const router = useRouter();
  const { data: planes } = useFetch<Plan[]>(`/planes?paciente_id=${pid}`);
  const { data: ia } = useFetch<{ configurada: boolean; modelo: string }>("/ia/estado");
  const [instr, setInstr] = useState("");
  const [dias, setDias] = useState(7);
  const [cargando, setCargando] = useState(false);
  const [err, setErr] = useState("");

  async function generar() {
    setCargando(true);
    setErr("");
    try {
      const r = await api<{ plan_id: string }>("/ia/plan", { body: { paciente_id: pid, instrucciones: instr || null, dias, guardar: true } });
      router.push(`/planes/${r.plan_id}`);
    } catch (x) {
      setErr((x as Error).message);
      setCargando(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card title="Planes" className="lg:col-span-2" action={<Link href={`/planes/nuevo?paciente=${pid}`} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700">Nuevo plan</Link>}>
        {!planes ? <Cargando /> : planes.length === 0 ? <Vacio>Sin planes todavía.</Vacio> : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {planes.map((pl) => (
              <li key={pl.id} className="flex items-center justify-between gap-3 py-3">
                <div>
                  <Link href={`/planes/${pl.id}`} className="font-medium hover:underline">{pl.titulo}</Link>
                  <p className="text-sm text-slate-500">Desde {fecha(pl.fecha_inicio)}{pl.generado_por_ia ? " · generado con IA" : ""}</p>
                </div>
                <Badge valor={pl.estado} />
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card title="🤖 Propuesta con IA" className="h-fit">
        <div className="space-y-3">
          <p className="text-sm text-slate-500">Genera un borrador con los datos clínicos del paciente (sin nombre ni contacto). Siempre queda como borrador para tu revisión.</p>
          {ia && !ia.configurada && <Alert kind="info">Falta configurar GEMINI_API_KEY en el servidor.</Alert>}
          {err && <Alert>{err}</Alert>}
          <Field label="Indicaciones (opcional)"><textarea value={instr} onChange={(e) => setInstr(e.target.value)} rows={3} maxLength={1000} placeholder="Ej.: sin lácteos, presupuesto bajo, 1600 kcal" className={inputCls} /></Field>
          <Field label="Días"><select value={dias} onChange={(e) => setDias(Number(e.target.value))} className={inputCls}>{[1, 3, 5, 7].map((d) => <option key={d} value={d}>{d}</option>)}</select></Field>
          <Button onClick={generar} disabled={cargando || !ia?.configurada} className="w-full">{cargando ? "Generando… (puede tardar)" : "Generar borrador"}</Button>
        </div>
      </Card>
    </div>
  );
}

export default function PacienteDetalle() {
  const router = useRouter();
  const id = typeof router.query.id === "string" ? router.query.id : null;
  const { data: p, error, reload } = useFetch<Paciente>(id ? `/pacientes/${id}` : null);
  const { data: r } = useFetch<Resumen>(id ? `/pacientes/${id}/resumen` : null);
  const [tab, setTab] = useState<(typeof TABS)[number]>("Resumen");

  return (
    <Layout titulo={p?.nombre ?? "Paciente"} roles={["nutricionista", "admin"]}>
      {error ? <Alert>{error}</Alert> : !p || !id ? <Cargando /> : (
        <>
          <p className="-mt-4 text-sm text-slate-500">{p.email}{p.telefono ? ` · ${p.telefono}` : ""} · Nutricionista: {p.nutricionista_nombre ?? "sin asignar"}</p>
          <div role="tablist" className="flex gap-1 border-b border-slate-200 dark:border-slate-800">
            {TABS.map((t) => (
              <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
                className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${tab === t ? "border-emerald-600 text-emerald-700 dark:text-emerald-400" : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"}`}>{t}</button>
            ))}
          </div>

          {tab === "Resumen" && (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Stat label="Peso" value={r?.ultima_medicion ? `${num(r.ultima_medicion.peso_kg, 1)} kg` : "–"} />
                <Stat label="IMC" value={r?.ultima_medicion ? num(r.ultima_medicion.imc, 1) : "–"} hint={r?.imc_categoria ?? undefined} />
                <Stat label="Gasto estimado" value={r?.gasto_total_kcal ? `${num(r.gasto_total_kcal)} kcal` : "–"} hint={r?.macros_sugeridos ? `P ${r.macros_sugeridos.proteina_g} · C ${r.macros_sugeridos.carbohidratos_g} · G ${r.macros_sugeridos.grasa_g} g` : "Faltan datos (edad/sexo/medición)"} />
                <Stat label="Edad" value={r?.edad ?? "–"} />
              </div>
              <Card title="Ficha clínica"><FichaForm p={p} onGuardado={reload} /></Card>
            </>
          )}
          {tab === "Mediciones" && <MedicionesPanel pacienteId={id} />}
          {tab === "Diario" && <DiarioPanel pacienteId={id} editable={false} />}
          {tab === "Planes" && <PlanesTab pid={id} />}
        </>
      )}
    </Layout>
  );
}
