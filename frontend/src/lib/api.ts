import { useCallback, useEffect, useState } from "react";

const TOKEN_KEY = "sanl_token";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export const token = {
  get: () => (typeof window === "undefined" ? null : window.localStorage.getItem(TOKEN_KEY)),
  set: (t: string) => window.localStorage.setItem(TOKEN_KEY, t),
  clear: () => window.localStorage.removeItem(TOKEN_KEY),
};

type Params = Record<string, string | number | boolean | undefined | null>;

function url(path: string, params?: Params) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params ?? {})) if (v !== undefined && v !== null && v !== "") q.set(k, String(v));
  const s = q.toString();
  return `/api${path}${s ? (path.includes("?") ? "&" : "?") + s : ""}`;
}

function mensaje(detail: unknown): string {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail))
    return detail.map((d) => (typeof d?.msg === "string" ? `${(d.loc ?? []).slice(1).join(".")}: ${d.msg}` : "Dato inválido")).join(" · ");
  return "Ocurrió un error inesperado";
}

async function request(path: string, opts: { method?: string; body?: unknown; params?: Params } = {}): Promise<Response> {
  const t = token.get();
  let res: Response;
  try {
    res = await fetch(url(path, opts.params), {
      method: opts.method ?? (opts.body ? "POST" : "GET"),
      headers: { ...(opts.body ? { "Content-Type": "application/json" } : {}), ...(t ? { Authorization: `Bearer ${t}` } : {}) },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
  } catch {
    throw new ApiError("No se pudo conectar con el servidor", 0);
  }
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    if (res.status === 401 && t && !path.startsWith("/auth/")) {
      token.clear();
      if (typeof window !== "undefined") window.location.assign("/login");
    }
    throw new ApiError(mensaje(body?.detail), res.status);
  }
  return res;
}

export async function api<T = unknown>(path: string, opts: { method?: string; body?: unknown; params?: Params } = {}): Promise<T> {
  const res = await request(path, opts);
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

export async function descargar(path: string, nombre: string) {
  const blob = await (await request(path)).blob();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = nombre;
  a.click();
  URL.revokeObjectURL(a.href);
}

/** GET reactivo. `path = null` lo deja inactivo. Cambiar `path` (o llamar `reload`) vuelve a consultar. */
export function useFetch<T>(path: string | null) {
  const [state, setState] = useState<{ path: string | null; data?: T; error?: string }>({ path: null });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!path) return;
    let vivo = true;
    api<T>(path).then(
      (data) => vivo && setState({ path, data }),
      (e: Error) => vivo && setState({ path, error: e.message }),
    );
    return () => {
      vivo = false;
    };
  }, [path, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  const actual = state.path === path;
  return { data: actual ? state.data : undefined, error: actual ? state.error : undefined, loading: path !== null && !actual, reload };
}
