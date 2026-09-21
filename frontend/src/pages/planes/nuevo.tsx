import { useRouter } from "next/router";
import { useState, type FormEvent } from "react";
import Layout from "@/components/Layout";
import AlimentoPicker from "@/components/panels/AlimentoPicker";
import { Alert, Button, Card, Field, inputCls } from "@/components/ui";
import { api, useFetch } from "@/lib/api";
import { DIAS, ETIQUETA_COMIDA, TIPOS_COMIDA, type Alimento, type Paciente, type TipoComida } from "@/lib/types";

interface Item {
  dia_semana: number;
  tipo_comida: TipoComida;
  descripcion: string;
  alimento_id: number | null;
  cantidad_g: number | null;
}

export default function NuevoPlan() {
  const router = useRouter();
  const pacienteId = typeof router.query.paciente === "string" ? router.query.paciente : null;
  const { data: p } = useFetch<Paciente>(pacienteId ? `/pacientes/${pacienteId}` : null);
  const [items, setItems] = useState<Item[]>([]);
  const [dia, setDia] = useState(1);
  const [tipo, setTipo] = useState<TipoComida>("desayuno");
  const [alimento, setAlimento] = useState<Alimento | null>(null);
  const [cantidad, setCantidad] = useState(100);
  const [desc, setDesc] = useState("");
  const [err, setErr] = useState("");

  function agregar() {
    const descripcion = desc.trim() || alimento?.nombre;
    if (!descripcion) return setErr("Escribe una descripción o elige un alimento");
    setErr("");
    setItems((v) => [...v, { dia_semana: dia, tipo_comida: tipo, descripcion, alimento_id: alimento?.id ?? null, cantidad_g: alimento ? cantidad : null }]);
    setDesc("");
  }

  async function guardar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const n = (k: string) => (f.get(k) ? Number(f.get(k)) : null);
    setErr("");
    try {
      const plan = await api<{ id: string }>("/planes", {
        body: { paciente_id: pacienteId, titulo: f.get("titulo"), objetivo_kcal: n("kcal"), objetivo_proteina_g: n("p"), objetivo_carbohidratos_g: n("c"), objetivo_grasa_g: n("g"), estado: f.get("estado"), notas: String(f.get("notas")) || null, comidas: items },
      });
      router.push(`/planes/${plan.id}`);
    } catch (x) {
      setErr((x as Error).message);
    }
  }

  return (
    <Layout titulo="Nuevo plan alimenticio" roles={["nutricionista", "admin"]}>
      {!pacienteId ? <Alert>Abre esta página desde la ficha de un paciente.</Alert> : (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card title={`Datos del plan${p ? ` · ${p.nombre}` : ""}`}>
            <form id="plan" onSubmit={guardar} className="space-y-3">
              {err && <Alert>{err}</Alert>}
              {p && (p.alergias.length > 0 || p.condiciones.length > 0) && (
                <Alert kind="info">Ten en cuenta — Alergias: {p.alergias.join(", ") || "ninguna"} · Condiciones: {p.condiciones.join(", ") || "ninguna"}</Alert>
              )}
              <Field label="Título"><input name="titulo" required maxLength={150} className={inputCls} /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Objetivo kcal"><input name="kcal" type="number" min={500} max={6000} className={inputCls} /></Field>
                <Field label="Proteína (g)"><input name="p" type="number" min={0} className={inputCls} /></Field>
                <Field label="Carbohidratos (g)"><input name="c" type="number" min={0} className={inputCls} /></Field>
                <Field label="Grasa (g)"><input name="g" type="number" min={0} className={inputCls} /></Field>
              </div>
              <Field label="Estado inicial" hint="Al activar un plan, el activo anterior se finaliza automáticamente.">
                <select name="estado" defaultValue="borrador" className={inputCls}><option value="borrador">Borrador</option><option value="activo">Activo</option></select>
              </Field>
              <Field label="Notas"><textarea name="notas" rows={3} className={inputCls} /></Field>
              <Button type="submit" disabled={items.length === 0} className="w-full">Guardar plan ({items.length} comidas)</Button>
            </form>
          </Card>

          <div className="space-y-6">
            <Card title="Agregar comida">
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Día"><select value={dia} onChange={(e) => setDia(Number(e.target.value))} className={inputCls}>{DIAS.map((d, i) => <option key={d} value={i + 1}>{d}</option>)}</select></Field>
                  <Field label="Comida"><select value={tipo} onChange={(e) => setTipo(e.target.value as TipoComida)} className={inputCls}>{TIPOS_COMIDA.map((t) => <option key={t} value={t}>{ETIQUETA_COMIDA[t]}</option>)}</select></Field>
                </div>
                <AlimentoPicker onChange={setAlimento} />
                {alimento && <Field label="Cantidad (g)" hint="Las calorías y macros se calculan del catálogo."><input type="number" min={1} value={cantidad} onChange={(e) => setCantidad(Number(e.target.value))} className={inputCls} /></Field>}
                <Field label="Descripción" hint="Opcional si eliges un alimento"><input value={desc} onChange={(e) => setDesc(e.target.value)} className={inputCls} /></Field>
                <Button variant="secondary" onClick={agregar} className="w-full">Agregar al plan</Button>
              </div>
            </Card>
            <Card title="Comidas del plan">
              {items.length === 0 ? <p className="text-sm text-slate-500">Aún no hay comidas.</p> : (
                <ul className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
                  {[...items.entries()].sort(([, a], [, b]) => a.dia_semana - b.dia_semana || TIPOS_COMIDA.indexOf(a.tipo_comida) - TIPOS_COMIDA.indexOf(b.tipo_comida)).map(([i, it]) => (
                    <li key={i} className="flex justify-between gap-3 py-2">
                      <span><b>{DIAS[it.dia_semana - 1]}</b> · {ETIQUETA_COMIDA[it.tipo_comida]} — {it.descripcion}{it.cantidad_g ? ` (${it.cantidad_g} g)` : ""}</span>
                      <button onClick={() => setItems((v) => v.filter((_, j) => j !== i))} className="text-xs text-red-600 hover:underline">Quitar</button>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </div>
      )}
    </Layout>
  );
}
