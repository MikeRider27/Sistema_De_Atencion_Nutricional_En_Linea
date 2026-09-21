import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useState, type FormEvent } from "react";
import { Alert, Button, Card, Field, inputCls } from "@/components/ui";
import { useAuth } from "@/lib/auth";

export default function Login() {
  const { login } = useAuth();
  const router = useRouter();
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setEnviando(true);
    setError("");
    try {
      await login(String(f.get("email")).trim(), String(f.get("password")));
      router.push("/dashboard");
    } catch (err) {
      setError((err as Error).message);
      setEnviando(false);
    }
  }

  return (
    <>
      <Head>
        <title>Iniciar sesión · SANL</title>
      </Head>
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4">
        <Link href="/" className="mb-6 text-center text-2xl font-bold text-emerald-700 dark:text-emerald-400">🥗 SANL</Link>
        <Card title="Iniciar sesión">
          <form onSubmit={enviar} className="space-y-4">
            {error && <Alert>{error}</Alert>}
            <Field label="Correo electrónico">
              <input name="email" type="email" required autoComplete="email" className={inputCls} />
            </Field>
            <Field label="Contraseña">
              <input name="password" type="password" required autoComplete="current-password" className={inputCls} />
            </Field>
            <Button type="submit" disabled={enviando} className="w-full">{enviando ? "Entrando…" : "Entrar"}</Button>
          </form>
          <p className="mt-4 text-center text-sm text-slate-600 dark:text-slate-400">
            ¿Aún no tienes cuenta? <Link href="/registro" className="font-medium text-emerald-700 hover:underline dark:text-emerald-400">Regístrate</Link>
          </p>
        </Card>
      </main>
    </>
  );
}
