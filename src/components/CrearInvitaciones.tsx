"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import type { Categoria } from "@/types/database";

interface Props {
  patrocinadorId: string;
  edicionId: string | null;
  categoria: Categoria | null;
  numInvitacionesIncluidas: number | null;
}

export default function CrearInvitaciones({
  patrocinadorId,
  edicionId,
  categoria,
  numInvitacionesIncluidas,
}: Props) {
  const [cantidad, setCantidad] = useState(String(numInvitacionesIncluidas ?? ""));
  const [creando, setCreando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creadas, setCreadas] = useState<{ id: string }[] | null>(null);

  async function crear() {
    const n = Number(cantidad);
    if (!n || n < 1) {
      setError("Indica cuántas invitaciones quieres crear (al menos 1).");
      return;
    }
    setError(null);
    setCreando(true);

    const filas = Array.from({ length: n }, () => ({
      edicion_id: edicionId,
      empresa_entidad: patrocinadorId,
      categoria_patrocinio: categoria,
      tipo_acceso: "Invitado por patrocinio",
      confirmado: "Pendiente",
      nombre: null,
      email: null,
    }));

    const { data, error } = await supabase.from("asistentes_congreso").insert(filas).select("id");
    setCreando(false);
    if (error) {
      setError(error.message);
      return;
    }
    setCreadas(data ?? []);
  }

  return (
    <section>
      <h3 className="seccion-titulo">Invitaciones al Congreso</h3>
      <p className="mb-3 text-xs italic text-zinc-400">
        Crea plazas reservadas y vacías en Congreso (sin nombre todavía), para rellenarlas
        más adelante cuando se sepa quién viene.
      </p>

      {error && (
        <div className="mb-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {creadas ? (
        <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-700">
          <p className="mb-2">{creadas.length} invitación(es) creada(s).</p>
          <div className="flex flex-wrap gap-3">
            {creadas.map((c, i) => (
              <Link
                key={c.id}
                href={`/congreso/${c.id}`}
                className="font-medium text-[var(--balvert-azul-oscuro)] hover:underline"
              >
                Invitación {i + 1}
              </Link>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex items-end gap-3">
          <div>
            <label className="campo-label" htmlFor="cantidad-invitaciones">
              Cantidad
            </label>
            <input
              id="cantidad-invitaciones"
              type="number"
              min={1}
              className="campo-input !w-28"
              value={cantidad}
              onChange={(e) => setCantidad(e.target.value)}
            />
          </div>
          <button
            type="button"
            onClick={crear}
            disabled={creando}
            className="rounded-md px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            style={{ background: "var(--balvert-azul-oscuro)" }}
          >
            {creando ? "Creando…" : "Crear invitaciones"}
          </button>
        </div>
      )}
    </section>
  );
}
