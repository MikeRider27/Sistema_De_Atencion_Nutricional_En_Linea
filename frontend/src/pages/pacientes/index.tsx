import Link from "next/link";
import { useState, type FormEvent } from "react";
import Layout from "@/components/Layout";
import { Alert, Button, Card, Cargando, Field, Vacio, inputCls } from "@/components/ui";
import { api, useFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { Paciente } from "@/lib/types";

export default function Pacientes() {
  const { user } = useAuth();
  const [q, setQ] = useState("");
  const [libres, setLibres] = useState(false);
  const { data, error, reload } = useFetch<Paciente[]>(`/pacientes?sin_asignar=${libres}${q ? `&q=${encodeURIComponent(q)}` : ""}`);
  const [err, setErr] = useState("");
  const [mostrarForm, setForm] = useState(false);

  async function crear(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const v = (k: string) => String(f.get(k) ?? "").trim() || null;
    setErr("");
    try {
      await api("/pacientes", { body: { nombre: v("nombre"), email: v("email"), password: f.get("password"), sexo: v("sexo"), fecha_nacimiento: v("nac"), altura_cm: v("altura") ? Number(v("altura")) : null } });
      setForm(false);
      reload();
    } catch (x) {
      setErr((x as Error).message);
    }
  }

  async function tomar(id: string) {
    await api(`/pacientes/${id}/tomar`, { method: "POST" });
    reload();
  }

  return (
    <Layout titulo="Pacientes" roles={["nutricionista", "admin"]}>
      <div className="flex flex-wrap items-center gap-3">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre o correo…" aria-label="Buscar" className={`${inputCls} max-w-sm`} />
        {user?.rol === "nutricionista" && (
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={libres} onChange={(e) => setLibres(e.target.checked)} /> Incluir pacientes sin nutricionista</label>
        )}
        <Button className="ml-auto" onClick={() => setForm((v) => !v)}>{mostrarForm ? "Cerrar" : "Nuevo paciente"}</Button>
      </div>

      {mostrarForm && (
        <Card title="Nuevo paciente">
          <form onSubmit={crear} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {err && <div className="sm:col-span-full"><Alert>{err}</Alert></div>}
            <Field label="Nombre"><input name="nombre" required minLength={2} className={inputCls} /></Field>
            <Field label="Correo"><input name="email" type="email" required className={inputCls} /></Field>
            <Field label="Contraseña inicial" hint="Mínimo 8 caracteres; el paciente puede cambiarla luego."><input name="password" type="text" required minLength={8} className={inputCls} /></Field>
            <Field label="Nacimiento"><input name="nac" type="date" className={inputCls} /></Field>
            <Field label="Sexo"><select name="sexo" className={inputCls} defaultValue=""><option value="">—</option><option value="F">Femenino</option><option value="M">Masculino</option></select></Field>
            <Field label="Estatura (cm)"><input name="altura" type="number" step="0.1" min={50} max={250} className={inputCls} /></Field>
            <div className="sm:col-span-full"><Button type="submit">Crear paciente</Button></div>
          </form>
        </Card>
      )}

      <Card>
        {error ? <Alert>{error}</Alert> : !data ? <Cargando /> : data.length === 0 ? <Vacio>No hay pacientes que mostrar.</Vacio> : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {data.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <Link href={`/pacientes/${p.id}`} className="font-medium hover:underline">{p.nombre}</Link>
                  <p className="text-sm text-slate-500">{p.email}{p.objetivo ? ` · ${p.objetivo}` : ""}</p>
                </div>
                {p.nutricionista_id ? (
                  user?.rol === "admin" && <span className="text-sm text-slate-500">{p.nutricionista_nombre}</span>
                ) : user?.rol === "nutricionista" ? (
                  <Button variant="secondary" onClick={() => tomar(p.id)}>Tomar paciente</Button>
                ) : <span className="text-sm text-amber-600">Sin nutricionista</span>}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </Layout>
  );
}
