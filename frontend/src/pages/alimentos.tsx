import { useState, type FormEvent } from "react";
import Layout from "@/components/Layout";
import { Alert, Button, Card, Cargando, Field, inputCls } from "@/components/ui";
import { api, useFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { num } from "@/lib/format";
import type { Alimento } from "@/lib/types";

export default function Alimentos() {
  const { user } = useAuth();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const { data, reload } = useFetch<Alimento[]>(`/alimentos?limit=200${q ? `&q=${encodeURIComponent(q)}` : ""}${cat ? `&categoria=${encodeURIComponent(cat)}` : ""}`);
  const { data: cats } = useFetch<string[]>("/alimentos/categorias");
  const [err, setErr] = useState("");
  const puedeCrear = user?.rol !== "paciente";

  async function crear(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    const n = (k: string) => Number(f.get(k) || 0);
    setErr("");
    try {
      await api("/alimentos", { body: { nombre: f.get("nombre"), categoria: f.get("categoria"), kcal: n("kcal"), proteina_g: n("p"), carbohidratos_g: n("c"), grasa_g: n("g"), fibra_g: n("f") } });
      form.reset();
      reload();
    } catch (x) {
      setErr((x as Error).message);
    }
  }

  return (
    <Layout titulo="Catálogo de alimentos">
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className={puedeCrear ? "lg:col-span-2" : "lg:col-span-3"}>
          <div className="mb-4 flex flex-wrap gap-3">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar…" aria-label="Buscar" className={`${inputCls} max-w-xs`} />
            <select value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Categoría" className={`${inputCls} max-w-xs`}>
              <option value="">Todas las categorías</option>
              {cats?.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          {!data ? <Cargando /> : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase text-slate-500">
                  <tr><th className="pb-2 pr-4 font-medium">Alimento</th>{["kcal", "Prot.", "Carb.", "Grasa", "Fibra"].map((h) => <th key={h} className="pb-2 pr-4 text-right font-medium">{h}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {data.map((a) => (
                    <tr key={a.id}>
                      <td className="py-2 pr-4"><span className="font-medium">{a.nombre}</span> <span className="text-xs text-slate-500">{a.categoria}</span></td>
                      {[a.kcal, a.proteina_g, a.carbohidratos_g, a.grasa_g, a.fibra_g].map((v, i) => <td key={i} className="pr-4 text-right tabular-nums">{num(v, 1)}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-3 text-xs text-slate-500">Valores por 100 g. {data.length} alimento(s).</p>
            </div>
          )}
        </Card>
        {puedeCrear && (
          <Card title="Agregar alimento" className="h-fit">
            <form onSubmit={crear} className="space-y-3">
              {err && <Alert>{err}</Alert>}
              <Field label="Nombre"><input name="nombre" required minLength={2} className={inputCls} /></Field>
              <Field label="Categoría"><input name="categoria" required list="cats" className={inputCls} /><datalist id="cats">{cats?.map((c) => <option key={c} value={c} />)}</datalist></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="kcal /100 g"><input name="kcal" type="number" step="0.1" min={0} max={900} required className={inputCls} /></Field>
                <Field label="Proteína (g)"><input name="p" type="number" step="0.1" min={0} className={inputCls} /></Field>
                <Field label="Carbohidratos (g)"><input name="c" type="number" step="0.1" min={0} className={inputCls} /></Field>
                <Field label="Grasa (g)"><input name="g" type="number" step="0.1" min={0} className={inputCls} /></Field>
                <Field label="Fibra (g)"><input name="f" type="number" step="0.1" min={0} className={inputCls} /></Field>
              </div>
              <Button type="submit" className="w-full">Guardar</Button>
            </form>
          </Card>
        )}
      </div>
    </Layout>
  );
}
