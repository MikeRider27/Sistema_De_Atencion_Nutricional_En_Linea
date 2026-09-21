import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";

const puntos = [
  ["📈", "Seguimiento de progreso", "Peso, IMC y medidas con gráficas claras de tu evolución."],
  ["🍽️", "Planes personalizados", "Planes alimenticios de tu nutricionista, descargables en PDF."],
  ["📅", "Citas en línea", "Agenda consultas virtuales o presenciales en los horarios disponibles."],
  ["🤖", "Apoyo con IA", "Propuestas de plan que tu nutricionista revisa y ajusta antes de compartirlas."],
];

export default function Inicio() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) router.replace("/dashboard");
  }, [loading, user, router]);

  return (
    <>
      <Head>
        <title>SANL · Atención nutricional en línea</title>
      </Head>
      <main className="mx-auto flex min-h-screen max-w-4xl flex-col justify-center px-6 py-16">
        <p className="text-sm font-semibold uppercase tracking-widest text-emerald-600">Sistema de Atención Nutricional en Línea</p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">Tu nutrición, acompañada por profesionales.</h1>
        <p className="mt-4 max-w-2xl text-lg text-slate-600 dark:text-slate-400">
          Consulta a tu nutricionista, sigue tu plan y registra tu avance desde cualquier lugar.
        </p>
        <div className="mt-8 flex gap-3">
          <Link href="/registro" className="rounded-lg bg-emerald-600 px-5 py-2.5 font-medium text-white hover:bg-emerald-700">Crear cuenta</Link>
          <Link href="/login" className="rounded-lg border border-slate-300 px-5 py-2.5 font-medium hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800">Iniciar sesión</Link>
        </div>
        <ul className="mt-14 grid gap-4 sm:grid-cols-2">
          {puntos.map(([icono, titulo, texto]) => (
            <li key={titulo} className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
              <span className="text-2xl" aria-hidden>{icono}</span>
              <h2 className="mt-2 font-semibold">{titulo}</h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{texto}</p>
            </li>
          ))}
        </ul>
      </main>
    </>
  );
}
