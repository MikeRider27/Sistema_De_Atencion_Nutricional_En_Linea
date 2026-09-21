import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, type ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import type { Rol } from "@/lib/types";
import { Cargando } from "./ui";

const MENU: Record<Rol, { href: string; texto: string }[]> = {
  paciente: [
    { href: "/dashboard", texto: "Inicio" },
    { href: "/progreso", texto: "Mi progreso" },
    { href: "/planes", texto: "Mi plan" },
    { href: "/diario", texto: "Diario" },
    { href: "/citas", texto: "Citas" },
    { href: "/alimentos", texto: "Alimentos" },
  ],
  nutricionista: [
    { href: "/dashboard", texto: "Inicio" },
    { href: "/pacientes", texto: "Pacientes" },
    { href: "/citas", texto: "Citas" },
    { href: "/planes", texto: "Planes" },
    { href: "/alimentos", texto: "Alimentos" },
  ],
  admin: [
    { href: "/dashboard", texto: "Inicio" },
    { href: "/pacientes", texto: "Pacientes" },
    { href: "/citas", texto: "Citas" },
    { href: "/planes", texto: "Planes" },
    { href: "/alimentos", texto: "Alimentos" },
    { href: "/admin/usuarios", texto: "Usuarios" },
  ],
};

export default function Layout({ titulo, roles, children }: { titulo: string; roles?: Rol[]; children: ReactNode }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace("/login");
    else if (roles && !roles.includes(user.rol)) router.replace("/dashboard");
  }, [loading, user, roles, router]);

  if (loading || !user || (roles && !roles.includes(user.rol))) return <Cargando />;

  return (
    <>
      <Head>
        <title>{`${titulo} · SANL`}</title>
      </Head>
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link href="/dashboard" className="text-lg font-bold text-emerald-700 dark:text-emerald-400">
            🥗 SANL
          </Link>
          <nav className="flex flex-1 flex-wrap gap-1" aria-label="Principal">
            {MENU[user.rol].map((m) => {
              const activo = router.pathname === m.href || (m.href !== "/dashboard" && router.pathname.startsWith(m.href));
              return (
                <Link
                  key={m.href}
                  href={m.href}
                  aria-current={activo ? "page" : undefined}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium ${activo ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"}`}
                >
                  {m.texto}
                </Link>
              );
            })}
          </nav>
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden text-slate-600 sm:inline dark:text-slate-400">
              {user.nombre} · <span className="capitalize">{user.rol}</span>
            </span>
            <button onClick={logout} className="rounded-md px-2 py-1 font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">
              Salir
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6">
        <h1 className="text-2xl font-bold tracking-tight">{titulo}</h1>
        {children}
      </main>
    </>
  );
}
