import { useState, type FormEvent } from "react";
import AlimentoPicker from "./AlimentoPicker";
import { Alert, Barra, Button, Card, Cargando, Field, Vacio, inputCls } from "@/components/ui";
import { api, useFetch } from "@/lib/api";
import { hoyISO, num } from "@/lib/format";
import { ETIQUETA_COMIDA, TIPOS_COMIDA, type Alimento, type Diario } from "@/lib/types";

/** Diario de comidas. `editable` sólo para el propio paciente; el personal lo consulta en modo lectura. */
export default function DiarioPanel({ pacienteId, editable }: { pacienteId?: string; editable: boolean }) {
  const [dia, setDia] = useState(hoyISO());
  const { data, error, reload } = useFetch<Diario>(`/diario?fecha=${dia}${pacienteId ? `&paciente_id=${pacienteId}` : ""}`);
  const [alimento, setAlimento] = useState<Alimento | null>(null);
  const [err, setErr] = useState("");

  async function agregar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!alimento) return setErr("Selecciona un alimento");
    const f = new FormData(e.currentTarget);
    setErr("");
    try {
      await api("/diario", { body: { fecha: dia, tipo_comida: f.get("tipo"), alimento_id: alimento.id, cantidad_g: Number(f.get("cantidad")) } });
      reload();
    } catch (x) {
      setErr((x as Error).message);
    }
  }

  async function borrar(id: string) {
    await api(`/diario/${id}`, { method: "DELETE" });
    reload();
  }

  const t = data?.totales, o = data?.objetivo;
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <Card title="Resumen del día" action={<input type="date" value={dia} max={hoyISO()} onChange={(e) => e.target.value && setDia(e.target.value)} className={`${inputCls} !w-auto`} aria-label="Día" />}>
          {error ? <Alert>{error}</Alert> : !t ? <Cargando /> : (
            <div className="grid gap-3 sm:grid-cols-2">
              <Barra etiqueta="Calorías" valor={t.kcal} objetivo={o?.kcal} unidad="kcal" />
              <Barra etiqueta="Proteína" valor={t.proteina_g} objetivo={o?.proteina_g} unidad="g" />
              <Barra etiqueta="Carbohidratos" valor={t.carbohidratos_g} objetivo={o?.carbohidratos_g} unidad="g" />
              <Barra etiqueta="Grasa" valor={t.grasa_g} objetivo={o?.grasa_g} unidad="g" />
            </div>
          )}
        </Card>
        <Card title="Comidas registradas">
          {!data ? null : data.registros.length === 0 ? <Vacio>Sin registros para este día.</Vacio> : (
            TIPOS_COMIDA.map((tipo) => {
              const filas = data.registros.filter((r) => r.tipo_comida === tipo);
              if (!filas.length) return null;
              return (
                <div key={tipo} className="mb-4 last:mb-0">
                  <h3 className="mb-1 text-sm font-semibold text-slate-600 dark:text-slate-400">{ETIQUETA_COMIDA[tipo]}</h3>
                  <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filas.map((r) => (
                      <li key={r.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                        <span>{r.alimento} <span className="text-slate-500">· {num(r.cantidad_g)} g</span></span>
                        <span className="flex items-center gap-3">
                          <span className="text-slate-500">{num(r.kcal)} kcal</span>
                          {editable && <button onClick={() => borrar(r.id)} className="text-xs text-red-600 hover:underline" aria-label={`Quitar ${r.alimento}`}>Quitar</button>}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })
          )}
        </Card>
      </div>
      {editable && (
        <Card title="Agregar alimento" className="h-fit">
          <form onSubmit={agregar} className="space-y-3">
            {err && <Alert>{err}</Alert>}
            <Field label="Comida">
              <select name="tipo" className={inputCls} defaultValue="desayuno">
                {TIPOS_COMIDA.map((x) => <option key={x} value={x}>{ETIQUETA_COMIDA[x]}</option>)}
              </select>
            </Field>
            <AlimentoPicker onChange={setAlimento} />
            <Field label="Cantidad (g)"><input name="cantidad" type="number" min={1} max={5000} step="0.1" required defaultValue={100} className={inputCls} /></Field>
            <Button type="submit" className="w-full">Agregar</Button>
          </form>
        </Card>
      )}
    </div>
  );
}
