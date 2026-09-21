import { useState, type FormEvent } from "react";
import Layout from "@/components/Layout";
import { Alert, Badge, Button, Card, Cargando, Field, Vacio, inputCls } from "@/components/ui";
import { api, useFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { fechaHora, hora, hoyISO } from "@/lib/format";
import type { Cita, Paciente, Slot } from "@/lib/types";

function NuevaCitaPaciente({ onCreada }: { onCreada: () => void }) {
  const { data: ficha } = useFetch<Paciente>("/pacientes/me");
  const [dia, setDia] = useState(hoyISO());
  const { data: slots } = useFetch<Slot[]>(ficha?.nutricionista_id ? `/citas/disponibilidad?nutricionista_id=${ficha.nutricionista_id}&fecha=${dia}` : null);
  const [err, setErr] = useState("");
  const [elegido, setElegido] = useState("");

  if (!ficha) return <Cargando />;
  if (!ficha.nutricionista_id) return <Alert kind="info">Aún no tienes nutricionista asignado, así que no puedes agendar citas.</Alert>;

  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setErr("");
    try {
      await api("/citas", { body: { inicio: elegido, modalidad: f.get("modalidad"), motivo: String(f.get("motivo")) || null } });
      setElegido("");
      onCreada();
    } catch (x) {
      setErr((x as Error).message);
    }
  }

  return (
    <form onSubmit={enviar} className="space-y-3">
      {err && <Alert>{err}</Alert>}
      <p className="text-sm text-slate-500">Con {ficha.nutricionista_nombre}</p>
      <Field label="Día"><input type="date" min={hoyISO()} value={dia} onChange={(e) => { setDia(e.target.value); setElegido(""); }} className={inputCls} /></Field>
      <div>
        <span className="text-sm font-medium">Horarios</span>
        {!slots ? <Cargando /> : slots.length === 0 ? <p className="py-2 text-sm text-slate-500">Sin atención este día (fin de semana).</p> : (
          <div className="mt-1 grid grid-cols-3 gap-2">
            {slots.map((s) => (
              <button key={s.inicio} type="button" disabled={!s.disponible} onClick={() => setElegido(s.inicio)} aria-pressed={elegido === s.inicio}
                className={`rounded-lg border px-2 py-1.5 text-sm ${elegido === s.inicio ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-300 hover:border-emerald-500 dark:border-slate-700"} disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-slate-300`}>
                {hora(s.inicio)}
              </button>
            ))}
          </div>
        )}
      </div>
      <Field label="Modalidad">
        <select name="modalidad" className={inputCls} defaultValue="virtual"><option value="virtual">Virtual (videollamada)</option><option value="presencial">Presencial</option></select>
      </Field>
      <Field label="Motivo"><input name="motivo" maxLength={500} className={inputCls} /></Field>
      <Button type="submit" disabled={!elegido} className="w-full">Agendar cita</Button>
    </form>
  );
}

function NuevaCitaPersonal({ onCreada }: { onCreada: () => void }) {
  const { data: pacientes } = useFetch<Paciente[]>("/pacientes");
  const [err, setErr] = useState("");

  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setErr("");
    try {
      await api("/citas", { body: { paciente_id: f.get("paciente"), inicio: new Date(String(f.get("inicio"))).toISOString(), duracion_min: Number(f.get("duracion")), modalidad: f.get("modalidad"), motivo: String(f.get("motivo")) || null } });
      onCreada();
    } catch (x) {
      setErr((x as Error).message);
    }
  }

  return (
    <form onSubmit={enviar} className="space-y-3">
      {err && <Alert>{err}</Alert>}
      <Field label="Paciente">
        <select name="paciente" required className={inputCls} defaultValue="">
          <option value="" disabled>Selecciona…</option>
          {pacientes?.filter((p) => p.nutricionista_id).map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
        </select>
      </Field>
      <Field label="Inicio"><input name="inicio" type="datetime-local" required className={inputCls} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Duración"><select name="duracion" className={inputCls} defaultValue="60">{[30, 45, 60, 90].map((m) => <option key={m} value={m}>{m} min</option>)}</select></Field>
        <Field label="Modalidad"><select name="modalidad" className={inputCls} defaultValue="virtual"><option value="virtual">Virtual</option><option value="presencial">Presencial</option></select></Field>
      </div>
      <Field label="Motivo"><input name="motivo" maxLength={500} className={inputCls} /></Field>
      <Button type="submit" className="w-full">Agendar</Button>
    </form>
  );
}

export default function Citas() {
  const { user } = useAuth();
  const { data, error, reload } = useFetch<Cita[]>("/citas");
  const [err, setErr] = useState("");
  const esPaciente = user?.rol === "paciente";

  async function estado(id: string, estado: string) {
    setErr("");
    try {
      await api(`/citas/${id}`, { method: "PATCH", body: { estado } });
      reload();
    } catch (x) {
      setErr((x as Error).message);
    }
  }

  const ahora = Date.now();
  const proximas = data?.filter((c) => c.estado === "programada" && new Date(c.fin).getTime() >= ahora) ?? [];
  const otras = data?.filter((c) => !proximas.includes(c)).reverse() ?? [];

  const fila = (c: Cita, acciones: boolean) => (
    <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
      <div>
        <p className="font-medium">{esPaciente ? c.nutricionista_nombre : c.paciente_nombre} <Badge valor={c.estado} /></p>
        <p className="text-slate-500">{fechaHora(c.inicio)} · {c.modalidad}{c.motivo ? ` · ${c.motivo}` : ""}</p>
        {acciones && c.enlace_video && <a href={c.enlace_video} target="_blank" rel="noopener noreferrer" className="text-emerald-700 hover:underline dark:text-emerald-400">Unirse a la videollamada ↗</a>}
      </div>
      {acciones && (
        <div className="flex gap-2">
          {!esPaciente && <Button variant="secondary" onClick={() => estado(c.id, "completada")}>Completada</Button>}
          {!esPaciente && <Button variant="ghost" onClick={() => estado(c.id, "no_asistio")}>No asistió</Button>}
          <Button variant="ghost" onClick={() => confirm("¿Cancelar esta cita?") && estado(c.id, "cancelada")}>Cancelar</Button>
        </div>
      )}
    </li>
  );

  return (
    <Layout titulo="Citas">
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {(error || err) && <Alert>{error || err}</Alert>}
          <Card title="Próximas">
            {!data ? <Cargando /> : proximas.length === 0 ? <Vacio>No hay citas programadas.</Vacio> : <ul className="divide-y divide-slate-100 dark:divide-slate-800">{proximas.map((c) => fila(c, true))}</ul>}
          </Card>
          <Card title="Historial">
            {!data ? null : otras.length === 0 ? <Vacio>Sin historial.</Vacio> : <ul className="divide-y divide-slate-100 dark:divide-slate-800">{otras.slice(0, 30).map((c) => fila(c, false))}</ul>}
          </Card>
        </div>
        <Card title="Agendar cita" className="h-fit">
          {esPaciente ? <NuevaCitaPaciente onCreada={reload} /> : <NuevaCitaPersonal onCreada={reload} />}
        </Card>
      </div>
    </Layout>
  );
}
