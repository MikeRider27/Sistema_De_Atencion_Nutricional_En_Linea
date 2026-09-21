import { useRouter } from "next/router";
import { useState } from "react";
import Layout from "@/components/Layout";
import { Alert, Badge, Button, Card, Cargando } from "@/components/ui";
import { api, descargar, useFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { fecha, num } from "@/lib/format";
import { DIAS, ETIQUETA_COMIDA, type Plan } from "@/lib/types";

export default function PlanDetalle() {
  const router = useRouter();
  const { user } = useAuth();
  const id = typeof router.query.id === "string" ? router.query.id : null;
  const { data: plan, error, reload } = useFetch<Plan>(id ? `/planes/${id}` : null);
  const [err, setErr] = useState("");
  const personal = user?.rol !== "paciente";

  async function accion(fn: () => Promise<unknown>) {
    setErr("");
    try {
      await fn();
    } catch (x) {
      setErr((x as Error).message);
    }
  }

  const dias = plan ? [...new Set((plan.comidas ?? []).map((c) => c.dia_semana))].sort() : [];

  return (
    <Layout titulo={plan?.titulo ?? "Plan"}>
      {error ? <Alert>{error}</Alert> : !plan ? <Cargando /> : (
        <>
          {(err) && <Alert>{err}</Alert>}
          {plan.generado_por_ia && personal && <Alert kind="info">Propuesta generada por IA: revísala y ajústala antes de activarla y compartirla con el paciente.</Alert>}
          <div className="flex flex-wrap items-center gap-3">
            <Badge valor={plan.estado} />
            <span className="text-sm text-slate-500">
              {personal && <>{plan.paciente_nombre} · </>}Desde {fecha(plan.fecha_inicio)}{plan.fecha_fin ? ` hasta ${fecha(plan.fecha_fin)}` : ""} · por {plan.nutricionista_nombre}
            </span>
            <div className="ml-auto flex gap-2">
              <Button variant="secondary" onClick={() => accion(() => descargar(`/planes/${plan.id}/pdf`, `plan-${plan.titulo}.pdf`))}>Descargar PDF</Button>
              {personal && plan.estado !== "activo" && plan.estado !== "finalizado" && <Button onClick={() => accion(async () => { await api(`/planes/${plan.id}`, { method: "PATCH", body: { estado: "activo" } }); reload(); })}>Activar</Button>}
              {personal && plan.estado === "activo" && <Button variant="secondary" onClick={() => accion(async () => { await api(`/planes/${plan.id}`, { method: "PATCH", body: { estado: "finalizado" } }); reload(); })}>Finalizar</Button>}
              {personal && <Button variant="danger" onClick={() => confirm("¿Eliminar este plan?") && accion(async () => { await api(`/planes/${plan.id}`, { method: "DELETE" }); router.push("/planes"); })}>Eliminar</Button>}
            </div>
          </div>

          {plan.objetivo_kcal && (
            <div className="grid gap-3 sm:grid-cols-4">
              {[["Calorías", plan.objetivo_kcal, "kcal"], ["Proteína", plan.objetivo_proteina_g, "g"], ["Carbohidratos", plan.objetivo_carbohidratos_g, "g"], ["Grasa", plan.objetivo_grasa_g, "g"]].map(([l, v, u]) => (
                <div key={String(l)} className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                  <p className="text-xs uppercase text-slate-500">{l}</p>
                  <p className="text-xl font-semibold">{v ? num(Number(v)) : "–"} <span className="text-sm font-normal text-slate-500">{u}</span></p>
                </div>
              ))}
            </div>
          )}
          {plan.notas && <Card title="Notas"><p className="whitespace-pre-line text-sm">{plan.notas}</p></Card>}

          <div className="grid gap-4 lg:grid-cols-2">
            {dias.map((d) => {
              const comidas = plan.comidas!.filter((c) => c.dia_semana === d);
              const total = comidas.reduce((s, c) => s + (c.kcal ?? 0), 0);
              return (
                <Card key={d} title={DIAS[d - 1]} action={<span className="text-sm text-slate-500">{num(total)} kcal</span>}>
                  <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                    {comidas.map((c, i) => (
                      <li key={i} className="py-2 text-sm">
                        <div className="flex justify-between gap-3">
                          <span className="font-medium">{ETIQUETA_COMIDA[c.tipo_comida]}</span>
                          <span className="text-slate-500">{c.kcal != null ? `${num(c.kcal)} kcal` : ""}</span>
                        </div>
                        <p className="text-slate-600 dark:text-slate-400">{c.descripcion}{c.cantidad_g ? ` · ${num(c.cantidad_g)} g` : ""}</p>
                      </li>
                    ))}
                  </ul>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </Layout>
  );
}
