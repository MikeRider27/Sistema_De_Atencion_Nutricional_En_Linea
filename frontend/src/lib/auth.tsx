import { useRouter } from "next/router";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api, token } from "./api";
import type { Usuario } from "./types";

interface AuthState {
  user: Usuario | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  registrar: (datos: Record<string, unknown>) => Promise<void>;
  logout: () => void;
}

const Ctx = createContext<AuthState | null>(null);

interface TokenOut {
  access_token: string;
  usuario: Usuario;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Usuario | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    if (!token.get()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sin token no hay nada que consultar
      setLoading(false);
      return;
    }
    api<Usuario>("/auth/me")
      .then(setUser)
      .catch(() => token.clear())
      .finally(() => setLoading(false));
  }, []);

  const guardar = (r: TokenOut) => {
    token.set(r.access_token);
    setUser(r.usuario);
  };

  const login = useCallback(async (email: string, password: string) => {
    guardar(await api<TokenOut>("/auth/login", { body: { email, password } }));
  }, []);

  const registrar = useCallback(async (datos: Record<string, unknown>) => {
    guardar(await api<TokenOut>("/auth/registro", { body: datos }));
  }, []);

  const logout = useCallback(() => {
    token.clear();
    setUser(null);
    router.push("/login");
  }, [router]);

  return <Ctx.Provider value={{ user, loading, login, registrar, logout }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth fuera de AuthProvider");
  return c;
}
