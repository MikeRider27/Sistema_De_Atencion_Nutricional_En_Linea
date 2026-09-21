import Link from "next/link";
import Layout from "@/components/Layout";
import { Alert, Badge, Card, Cargando, Vacio } from "@/components/ui";
import { useFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { fecha, num } from "@/lib/format";
import type { Plan } from "@/lib/types";

export default function Planes() {
  const { user } = useAuth();
  const { data, error } = useFetch<Plan[]>("/planes");
  const esPaciente = user?.rol === "paciente";

  return (
    <Layout titulo={esPaciente ? "Mi plan alimenticio" : "Planes alimenticios"}>
      <Card>
        {error ? <Alert>{error}</Alert> : !data ? <Cargando /> : data.length === 0 ? (
          <Vacio>{esPaciente ? "Tu nutricionista aún no te ha compartido un plan." : "Aún no hay planes. Crea uno desde la ficha de un paciente."}</Vacio>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {data.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <Link href={`/planes/${p.id}`} className="font-medium hover:underline">{p.titulo}</Link>
                  <p className="text-sm text-slate-500">
                    {!esPaciente && <>{p.paciente_nombre} · </>}Desde {fecha(p.fecha_inicio)}
                    {p.objetivo_kcal ? ` · ${num(p.objetivo_kcal)} kcal/día` : ""}{p.generado_por_ia ? " · IA" : ""}
                  </p>
                </div>
                <Badge valor={p.estado} />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </Layout>
  );
}
