"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { obtenerEdicionActiva } from "@/lib/edicionActiva";
import type { Edicion, Patrocinador } from "@/types/database";

const ORDEN_CATEGORIA: Record<string, number> = {
  "💎 DIAMANTE": 0,
  "⭐ ORO": 1,
  "🥈 PLATA": 2,
  "🏛 INSTITUCIONAL": 3,
  Personalizado: 4,
};

export default function ProgramaPage() {
  const [ponencias, setPonencias] = useState<Patrocinador[]>([]);
  const [edicion, setEdicion] = useState<Edicion | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function cargar() {
      setCargando(true);
      const edicionActiva = await obtenerEdicionActiva();
      setEdicion(edicionActiva);

      let query = supabase.from("patrocinadores").select("*").eq("tiene_ponencia", "Sí");
      if (edicionActiva) {
        query = query.eq("edicion_id", edicionActiva.id);
      }

      const { data, error } = await query;
      if (error) {
        setError(error.message);
      } else {
        setError(null);
        const ordenadas = (data ?? []).sort((a, b) => {
          const ca = ORDEN_CATEGORIA[a.categoria ?? ""] ?? 99;
          const cb = ORDEN_CATEGORIA[b.categoria ?? ""] ?? 99;
          if (ca !== cb) return ca - cb;
          return (a.ponencia_titulo ?? "").localeCompare(b.ponencia_titulo ?? "");
        });
        setPonencias(ordenadas);
      }
      setCargando(false);
    }
    cargar();
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--balvert-marron)]">
          Programa del Congreso
        </h1>
        <p className="text-sm text-zinc-600">
          {cargando ? "Cargando…" : `${ponencias.length} ponencia(s)`}
          {edicion?.nombre && (
            <span className="ml-2 rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-500">
              Edición: {edicion.nombre}
            </span>
          )}
        </p>
        <p className="mt-1 text-xs text-zinc-400">
          Ponencias marcadas en la ficha de cada patrocinador. Todavía no hay horario con
          hora fija por ponencia, solo duración — se ordenan por categoría de patrocinio.
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          No se pudo cargar el programa: {error}
        </div>
      )}

      {!error && (
        <div className="flex flex-col gap-4">
          {ponencias.map((p) => (
            <div key={p.id} className="rounded-lg border border-[var(--borde)] bg-white p-5">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="font-semibold text-[var(--balvert-azul-oscuro)]">
                  {p.ponencia_titulo || "(sin título todavía)"}
                </h2>
                {p.categoria && (
                  <span className="text-xs font-medium text-zinc-500">{p.categoria}</span>
                )}
              </div>
              <p className="text-sm text-zinc-700">
                {p.ponente_nombre || "(ponente por confirmar)"}
                {p.ponente_cargo && <span className="text-zinc-500"> — {p.ponente_cargo}</span>}
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                {p.empresa_entidad}
                {p.ponencia_duracion_min ? ` · ${p.ponencia_duracion_min} min` : ""}
              </p>
            </div>
          ))}
          {!cargando && ponencias.length === 0 && (
            <p className="text-sm text-zinc-500">
              Todavía no hay ninguna ponencia marcada. Se añaden desde la ficha de cada
              patrocinador (sección Ponencia, ¿Tiene ponencia? = Sí).
            </p>
          )}
        </div>
      )}
    </div>
  );
}
