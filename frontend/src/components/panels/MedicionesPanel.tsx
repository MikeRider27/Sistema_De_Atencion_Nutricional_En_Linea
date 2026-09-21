import { useState, type FormEvent } from "react";
import WeightChart from "@/components/WeightChart";
import { Alert, Button, Card, Cargando, Field, Vacio, inputCls } from "@/components/ui";
import { api, useFetch } from "@/lib/api";
import { fecha, hoyISO, num } from "@/lib/format";
import type { Medicion } from "@/lib/types";

export default function MedicionesPanel({ pacienteId }: { pacienteId: string }) {
  const { data, error, reload } = useFetch<Medicion[]>(`/pacientes/${pacienteId}/mediciones`);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState(false);

  async function guardar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    const n = (k: string) => (String(f.get(k)) ? Number(f.get(k)) : null);
    setErr("");
    setOk(false);
    try {
      await api(`/pacientes/${pacienteId}/mediciones`, {
        body: { fecha: f.get("fecha"), peso_kg: n("peso_kg"), altura_cm: n("altura_cm"), cintura_cm: n("cintura_cm"), cadera_cm: n("cadera_cm"), grasa_pct: n("grasa_pct") },
      });
      form.reset();
      setOk(true);
      reload();
    } catch (x) {
      setErr((x as Error).message);
    }
  }

  async function borrar(id: string) {
    if (!confirm("¿Eliminar esta medición?")) return;
    await api(`/pacientes/${pacienteId}/mediciones/${id}`, { method: "DELETE" });
    reload();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card title="Evolución del peso" className="lg:col-span-2">
        {error ? <Alert>{error}</Alert> : !data ? <Cargando /> : <WeightChart datos={data} />}
      </Card>
      <Card title="Nueva medición">
        <form onSubmit={guardar} className="space-y-3">
          {err && <Alert>{err}</Alert>}
          {ok && <Alert kind="ok">Medición guardada.</Alert>}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Fecha"><input name="fecha" type="date" defaultValue={hoyISO()} max={hoyISO()} required className={inputCls} /></Field>
            <Field label="Peso (kg)"><input name="peso_kg" type="number" step="0.1" min={2} max={500} required className={inputCls} /></Field>
            <Field label="Estatura (cm)"><input name="altura_cm" type="number" step="0.1" min={50} max={250} className={inputCls} /></Field>
            <Field label="Grasa (%)"><input name="grasa_pct" type="number" step="0.1" min={1} max={80} className={inputCls} /></Field>
            <Field label="Cintura (cm)"><input name="cintura_cm" type="number" step="0.1" className={inputCls} /></Field>
            <Field label="Cadera (cm)"><input name="cadera_cm" type="number" step="0.1" className={inputCls} /></Field>
          </div>
          <Button type="submit" className="w-full">Guardar</Button>
        </form>
      </Card>
      <Card title="Historial" className="lg:col-span-3">
        {!data ? null : data.length === 0 ? <Vacio>Aún no hay mediciones.</Vacio> : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-slate-500">
                <tr>{["Fecha", "Peso", "IMC", "Δ anterior", "Cintura", "Grasa", ""].map((h) => <th key={h} className="pb-2 pr-4 font-medium">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {[...data].reverse().map((m) => (
                  <tr key={m.id}>
                    <td className="py-2 pr-4">{fecha(m.fecha)}</td>
                    <td className="pr-4">{num(m.peso_kg, 1)} kg</td>
                    <td className="pr-4">{num(m.imc, 1)}</td>
                    <td className={`pr-4 ${m.delta_anterior_kg && m.delta_anterior_kg < 0 ? "text-emerald-600" : ""}`}>{m.delta_anterior_kg == null ? "–" : `${m.delta_anterior_kg > 0 ? "+" : ""}${num(m.delta_anterior_kg, 1)} kg`}</td>
                    <td className="pr-4">{m.cintura_cm ? `${num(m.cintura_cm, 1)} cm` : "–"}</td>
                    <td className="pr-4">{m.grasa_pct ? `${num(m.grasa_pct, 1)} %` : "–"}</td>
                    <td className="text-right"><button onClick={() => borrar(m.id)} className="text-xs text-red-600 hover:underline">Eliminar</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
