import { useState, type FormEvent } from "react";
import Layout from "@/components/Layout";
import { Alert, Badge, Button, Card, Cargando, Field, inputCls } from "@/components/ui";
import { api, useFetch } from "@/lib/api";
import { fecha } from "@/lib/format";

interface U { id: string; email: string; nombre: string; rol: string; activo: boolean; created_at: string }

export default function Usuarios() {
  const { data, reload } = useFetch<U[]>("/admin/usuarios");
  const [err, setErr] = useState("");

  async function crear(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    setErr("");
    try {
      await api("/admin/usuarios", { body: { nombre: f.get("nombre"), email: f.get("email"), password: f.get("password"), rol: f.get("rol") } });
      form.reset();
      reload();
    } catch (x) {
      setErr((x as Error).message);
    }
  }

  async function alternar(u: U) {
    setErr("");
    try {
      await api(`/admin/usuarios/${u.id}/activo`, { method: "PATCH", params: { activo: !u.activo } });
      reload();
    } catch (x) {
      setErr((x as Error).message);
    }
  }

  return (
    <Layout titulo="Usuarios" roles={["admin"]}>
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          {err && <Alert>{err}</Alert>}
          {!data ? <Cargando /> : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {data.map((u) => (
                <li key={u.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                  <div>
                    <p className="font-medium">{u.nombre} <Badge valor={u.activo ? "activo" : "finalizado"} /></p>
                    <p className="text-slate-500">{u.email} · {u.rol} · alta {fecha(u.created_at)}</p>
                  </div>
                  <Button variant="secondary" onClick={() => alternar(u)}>{u.activo ? "Desactivar" : "Activar"}</Button>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Nuevo nutricionista / admin" className="h-fit">
          <form onSubmit={crear} className="space-y-3">
            <Field label="Nombre"><input name="nombre" required minLength={2} className={inputCls} /></Field>
            <Field label="Correo"><input name="email" type="email" required className={inputCls} /></Field>
            <Field label="Contraseña"><input name="password" type="text" required minLength={8} className={inputCls} /></Field>
            <Field label="Rol"><select name="rol" className={inputCls} defaultValue="nutricionista"><option value="nutricionista">Nutricionista</option><option value="admin">Administrador</option></select></Field>
            <Button type="submit" className="w-full">Crear</Button>
          </form>
        </Card>
      </div>
    </Layout>
  );
}
