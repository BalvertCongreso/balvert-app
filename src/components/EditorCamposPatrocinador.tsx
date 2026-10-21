"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { seccionesPatrocinador, type CampoDef } from "@/lib/patrocinadorFields";

// Unos pocos campos de la ficha de un patrocinador, editables por separado
// (espacio de cada empresa en la Zona de patrocinadores). Guarda con la sesión
// del panel, como la ficha completa: el historial sale con su nombre.

const CAMPOS = new Map<string, CampoDef>(seccionesPatrocinador.flatMap((s) => s.campos.map((c) => [c.key, c] as const)));
const NUMERICOS = new Set(["num_invitaciones_incluidas", "ponencia_duracion_min", "precio_tarifa", "precio_real_pagado", "rollups_solicitados"]);

export default function EditorCamposPatrocinador({
  patrocinadorId,
  titulo,
  claves,
  valores: iniciales,
  onGuardado,
}: {
  patrocinadorId: string;
  titulo: string;
  claves: string[];
  valores: Record<string, unknown>;
  onGuardado?: () => void;
}) {
  const [valores, setValores] = useState<Record<string, string>>(() =>
    Object.fromEntries(claves.map((k) => [k, iniciales[k] === null || iniciales[k] === undefined ? "" : String(iniciales[k])]))
  );
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(false);
    const datos: Record<string, string | number | null> = {};
    for (const k of claves) {
      const v = valores[k];
      datos[k] = v === "" ? null : NUMERICOS.has(k) ? Number(v) : v;
    }
    setGuardando(true);
    const { error: fallo } = await supabase.from("patrocinadores").update(datos).eq("id", patrocinadorId);
    setGuardando(false);
    if (fallo) return setError(fallo.message);
    setOk(true);
    onGuardado?.();
  }

  return (
    <form onSubmit={guardar} className="rounded-lg border border-[var(--borde)] bg-white p-4">
      <h3 className="seccion-titulo">{titulo}</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        {claves.map((k) => {
          const c = CAMPOS.get(k);
          if (!c) return null;
          const id = `ed-${k}`;
          return (
            <div key={k} className={c.tipo === "texto-largo" ? "sm:col-span-2" : ""}>
              <label className="campo-label" htmlFor={id}>{c.label}</label>
              {c.tipo === "select" ? (
                <select id={id} className="campo-input" value={valores[k]} onChange={(e) => setValores({ ...valores, [k]: e.target.value })}>
                  <option value=""></option>
                  {c.opciones?.map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              ) : c.tipo === "texto-largo" ? (
                <textarea id={id} rows={3} className="campo-input" value={valores[k]} onChange={(e) => setValores({ ...valores, [k]: e.target.value })} />
              ) : (
                <input
                  id={id}
                  className="campo-input"
                  type={c.tipo === "numero" ? "number" : c.tipo === "fecha" ? "date" : c.tipo === "email" ? "email" : c.tipo === "telefono" ? "tel" : "text"}
                  value={valores[k]}
                  onChange={(e) => setValores({ ...valores, [k]: e.target.value })}
                />
              )}
              {c.nota && <p className="mt-1 text-xs italic text-zinc-400">{c.nota}</p>}
            </div>
          );
        })}
      </div>
      {error && <div className="mt-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {ok && <p className="mt-3 text-sm text-green-700">Guardado.</p>}
      <button
        type="submit"
        disabled={guardando}
        className="mt-4 rounded-md px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        style={{ background: "var(--balvert-azul-oscuro)" }}
      >
        {guardando ? "Guardando…" : "Guardar"}
      </button>
    </form>
  );
}
