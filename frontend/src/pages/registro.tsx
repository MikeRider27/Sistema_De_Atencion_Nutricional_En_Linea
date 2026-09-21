import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useState, type FormEvent } from "react";
import { Alert, Button, Card, Field, inputCls } from "@/components/ui";
import { useFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export default function Registro() {
  const { registrar } = useAuth();
  const router = useRouter();
  const { data: nutris } = useFetch<{ id: string; nombre: string }[]>("/nutricionistas");
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const v = (k: string) => String(f.get(k) ?? "").trim() || null;
    setEnviando(true);
    setError("");
    try {
      await registrar({
        nombre: v("nombre"),
        email: v("email"),
        password: String(f.get("password")),
        nutricionista_id: v("nutricionista_id"),
        fecha_nacimiento: v("fecha_nacimiento"),
        sexo: v("sexo"),
        altura_cm: v("altura_cm") ? Number(v("altura_cm")) : null,
      });
      router.push("/dashboard");
    } catch (err) {
      setError((err as Error).message);
      setEnviando(false);
    }
  }

  return (
    <>
      <Head>
        <title>Crear cuenta · SANL</title>
      </Head>
      <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-4 py-10">
        <Link href="/" className="mb-6 text-center text-2xl font-bold text-emerald-700 dark:text-emerald-400">🥗 SANL</Link>
        <Card title="Crear cuenta de paciente">
          <form onSubmit={enviar} className="space-y-4">
            {error && <Alert>{error}</Alert>}
            <Field label="Nombre completo"><input name="nombre" required minLength={2} autoComplete="name" className={inputCls} /></Field>
            <Field label="Correo electrónico"><input name="email" type="email" required autoComplete="email" className={inputCls} /></Field>
            <Field label="Contraseña" hint="Mínimo 8 caracteres">
              <input name="password" type="password" required minLength={8} maxLength={72} autoComplete="new-password" className={inputCls} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Nacimiento"><input name="fecha_nacimiento" type="date" className={inputCls} /></Field>
              <Field label="Sexo">
                <select name="sexo" className={inputCls} defaultValue="">
                  <option value="">—</option><option value="F">Femenino</option><option value="M">Masculino</option>
                </select>
              </Field>
              <Field label="Estatura (cm)"><input name="altura_cm" type="number" min={50} max={250} step="0.1" className={inputCls} /></Field>
            </div>
            <Field label="Nutricionista" hint="Puedes elegirlo después; sin uno asignado no podrás agendar citas.">
              <select name="nutricionista_id" className={inputCls} defaultValue="">
                <option value="">Aún no lo sé</option>
                {nutris?.map((n) => <option key={n.id} value={n.id}>{n.nombre}</option>)}
              </select>
            </Field>
            <Button type="submit" disabled={enviando} className="w-full">{enviando ? "Creando…" : "Crear cuenta"}</Button>
          </form>
          <p className="mt-4 text-center text-sm text-slate-600 dark:text-slate-400">
            ¿Ya tienes cuenta? <Link href="/login" className="font-medium text-emerald-700 hover:underline dark:text-emerald-400">Inicia sesión</Link>
          </p>
        </Card>
      </main>
    </>
  );
}
