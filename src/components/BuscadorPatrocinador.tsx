"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

interface PatrocinadorResumen {
  id: string;
  empresa_entidad: string | null;
  categoria: string | null;
}

interface Props {
  valorId: string | null;
  onSeleccionar: (patrocinador: PatrocinadorResumen | null) => void;
}

export default function BuscadorPatrocinador({ valorId, onSeleccionar }: Props) {
  const [seleccionado, setSeleccionado] = useState<PatrocinadorResumen | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [resultados, setResultados] = useState<PatrocinadorResumen[]>([]);
  const [buscando, setBuscando] = useState(false);

  // Al cargar (p.ej. editando una ficha existente), recupera el nombre del
  // patrocinador ya vinculado a partir de su id.
  useEffect(() => {
    if (!valorId) {
      setSeleccionado(null);
      return;
    }
    if (seleccionado?.id === valorId) return;

    supabase
      .from("patrocinadores")
      .select("id, empresa_entidad, categoria")
      .eq("id", valorId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setSeleccionado(data);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valorId]);

  useEffect(() => {
    if (!busqueda.trim()) {
      setResultados([]);
      return;
    }
    let cancelado = false;
    setBuscando(true);
    supabase
      .from("patrocinadores")
      .select("id, empresa_entidad, categoria")
      .ilike("empresa_entidad", `%${busqueda.trim()}%`)
      .limit(8)
      .then(({ data }) => {
        if (!cancelado) {
          setResultados(data ?? []);
          setBuscando(false);
        }
      });
    return () => {
      cancelado = true;
    };
  }, [busqueda]);

  function elegir(patrocinador: PatrocinadorResumen) {
    setSeleccionado(patrocinador);
    setBusqueda("");
    setResultados([]);
    onSeleccionar(patrocinador);
  }

  function quitar() {
    setSeleccionado(null);
    onSeleccionar(null);
  }

  return (
    <div>
      <label className="campo-label">Vincular a un patrocinador (opcional)</label>

      {seleccionado ? (
        <div className="flex items-center justify-between rounded-md border border-[var(--borde)] bg-zinc-50 px-3 py-2">
          <div>
            <span className="text-sm font-medium">{seleccionado.empresa_entidad}</span>
            {seleccionado.categoria && (
              <span className="ml-2 text-xs text-zinc-500">{seleccionado.categoria}</span>
            )}
          </div>
          <button
            type="button"
            onClick={quitar}
            className="text-xs font-medium text-red-600 hover:underline"
          >
            Quitar vínculo (es independiente)
          </button>
        </div>
      ) : (
        <div className="relative">
          <input
            type="text"
            className="campo-input"
            placeholder="Busca por nombre de empresa… déjalo vacío si es independiente"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
          {busqueda.trim() && (
            <div className="absolute z-10 mt-1 w-full rounded-md border border-[var(--borde)] bg-white shadow-md">
              {buscando && (
                <p className="px-3 py-2 text-xs text-zinc-400">Buscando…</p>
              )}
              {!buscando && resultados.length === 0 && (
                <p className="px-3 py-2 text-xs text-zinc-400">
                  Sin resultados. Se guardará como independiente si no eliges ninguno.
                </p>
              )}
              {resultados.map((p) => (
                <button
                  type="button"
                  key={p.id}
                  onClick={() => elegir(p)}
                  className="block w-full px-3 py-2 text-left text-sm hover:bg-zinc-50"
                >
                  {p.empresa_entidad}
                  {p.categoria && (
                    <span className="ml-2 text-xs text-zinc-500">{p.categoria}</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
