import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Alimento } from "@/lib/types";
import { inputCls } from "@/components/ui";

/** Buscador de alimentos con resultados en un <select>. */
export default function AlimentoPicker({ onChange, placeholder = "Buscar alimento…" }: { onChange: (a: Alimento | null) => void; placeholder?: string }) {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<Alimento[]>([]);

  useEffect(() => {
    let vivo = true;
    const t = setTimeout(() => {
      api<Alimento[]>("/alimentos", { params: { q, limit: 15 } }).then((r) => vivo && setItems(r)).catch(() => {});
    }, 250);
    return () => {
      vivo = false;
      clearTimeout(t);
    };
  }, [q]);

  return (
    <div className="space-y-2">
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} className={inputCls} aria-label="Buscar alimento" />
      <select className={inputCls} defaultValue="" onChange={(e) => onChange(items.find((a) => a.id === Number(e.target.value)) ?? null)} aria-label="Alimento">
        <option value="">Selecciona un alimento ({items.length})</option>
        {items.map((a) => <option key={a.id} value={a.id}>{a.nombre} — {a.kcal} kcal/100 g</option>)}
      </select>
    </div>
  );
}
