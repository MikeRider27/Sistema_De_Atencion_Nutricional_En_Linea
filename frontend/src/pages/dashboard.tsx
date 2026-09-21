import Link from "next/link";
import Layout from "@/components/Layout";
import { Alert, Badge, Card, Cargando, Stat, Vacio } from "@/components/ui";
import { useFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { fechaHora, hoyISO, num } from "@/lib/format";
import type { Cita, Paciente, Resumen } from "@/lib/types";

function VistaPaciente({ pid }: { pid: string }) {
  const { data: r, error } = useFetch<Resumen>(`/pacientes/${pid}/resumen`);
  const { data: ficha } = useFetch<Paciente>("/pacientes/me");
  if (error) return <Alert>{error}</Alert>;
  if (!r) return <Cargando />;
  const m = r.ultima_medicion;

  return (
    <>
      {ficha && !ficha.nutricionista_id && <Alert kind="info">Aún no tienes nutricionista asignado. Pídele a tu clínica que te asigne uno para poder agendar citas.</Alert>}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Peso actual" value={m ? `${num(m.peso_kg, 1)} kg` : "–"} hint={m?.delta_inicial_kg != null ? `${m.delta_inicial_kg > 0 ? "+" : ""}${num(m.delta_inicial_kg, 1)} kg desde el inicio` : "Registra tu primera medición"} />
        <Stat label="IMC" value={m ? num(m.imc, 1) : "–"} hint={r.imc_categoria ?? undefined} />
        <Stat label="Gasto diario estimado" value={r.gasto_total_kcal ? `${num(r.gasto_total_kcal)} kcal` : "–"} hint={r.gasto_total_kcal ? undefined : "Completa fecha de nacimiento y sexo"} />
        <Stat label="Próxima cita" value={r.proxima_cita ? fechaHora(r.proxima_cita.inicio) : "–"} hint={r.proxima_cita?.modalidad} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Mi plan" action={<Link href="/planes" className="text-sm font-medium text-emerald-700 hover:underline dark:text-emerald-400">Ver planes</Link>}>
          {r.plan_activo ? (
            <>
              <p className="font-medium">{r.plan_activo.titulo}</p>
              {r.plan_activo.objetivo_kcal && <p className="text-sm text-slate-500">Objetivo: {num(r.plan_activo.objetivo_kcal)} kcal al día</p>}
              <Link href={`/planes/${r.plan_activo.id}`} className="mt-3 inline-block text-sm font-medium text-emerald-700 hover:underline dark:text-emerald-400">Abrir plan →</Link>
            </>
          ) : <Vacio>Tu nutricionista aún no activa un plan.</Vacio>}
        </Card>
        <Card title="Hoy">
          <p className="mb-3 text-sm text-slate-600 dark:text-slate-400">Registra lo que comes para ver tus calorías y macronutrientes.</p>
          <Link href="/diario" className="text-sm font-medium text-emerald-700 hover:underline dark:text-emerald-400">Ir al diario →</Link>
        </Card>
      </div>
    </>
  );
}

function VistaPersonal() {
  const { data: pacientes } = useFetch<Paciente[]>("/pacientes");
  const { data: sinAsignar } = useFetch<Paciente[]>("/pacientes?sin_asignar=true");
  const { data: citas } = useFetch<Cita[]>(`/citas?desde=${hoyISO()}&estado=programada`);
  const { user } = useAuth();
  const libres = sinAsignar?.filter((p) => !p.nutricionista_id).length ?? 0;

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Pacientes" value={pacientes ? pacientes.length : "…"} />
        <Stat label="Citas próximas" value={citas ? citas.length : "…"} />
        {user?.rol === "nutricionista" && <Stat label="Sin nutricionista" value={sinAsignar ? libres : "…"} hint={libres ? <Link href="/pacientes" className="text-emerald-700 hover:underline dark:text-emerald-400">Ver y tomar</Link> : undefined} />}
      </div>
      <Card title="Próximas citas" action={<Link href="/citas" className="text-sm font-medium text-emerald-700 hover:underline dark:text-emerald-400">Agenda completa</Link>}>
        {!citas ? <Cargando /> : citas.length === 0 ? <Vacio>No hay citas programadas.</Vacio> : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {citas.slice(0, 6).map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <div>
                  <Link href={`/pacientes/${c.paciente_id}`} className="font-medium hover:underline">{c.paciente_nombre}</Link>
                  <p className="text-slate-500">{fechaHora(c.inicio)} · {c.modalidad}</p>
                </div>
                <Badge valor={c.estado} />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  return (
    <Layout titulo={user ? `Hola, ${user.nombre.split(" ")[0]}` : "Inicio"}>
      {user?.rol === "paciente" && user.paciente_id ? <VistaPaciente pid={user.paciente_id} /> : user ? <VistaPersonal /> : null}
    </Layout>
  );
}
