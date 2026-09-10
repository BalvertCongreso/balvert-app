"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { obtenerEdicionActiva } from "@/lib/edicionActiva";
import type { Edicion, Gala } from "@/types/database";

export default function GalaPage() {
  const [asistentes, setAsistentes] = useState<Gala[]>([]);
  const [edicion, setEdicion] = useState<Edicion | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function cargar() {
    setCargando(true);
    const edicionActiva = await obtenerEdicionActiva();
    setEdicion(edicionActiva);

    let query = supabase.from("gala").select("*").order("nombre_asistente", { ascending: true });
    if (edicionActiva) {
      query = query.eq("edicion_id", edicionActiva.id);
    }

    const { data, error } = await query;
    if (error) {
      setError(error.message);
    } else {
      setError(null);
      setAsistentes(data ?? []);
    }
    setCargando(false);
  }

  useEffect(() => {
    cargar();
  }, []);

  async function eliminar(id: string, nombre: string | null) {
    const ok = window.confirm(
      `¿Eliminar a "${nombre ?? "este asistente"}"? Esta acción no se puede deshacer.`
    );
    if (!ok) return;

    const { error } = await supabase.from("gala").delete().eq("id", id);
    if (error) {
      alert("No se pudo eliminar: " + error.message);
      return;
    }
    setAsistentes((prev) => prev.filter((a) => a.id !== id));
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--balvert-marron)]">Gala</h1>
          <p className="text-sm text-zinc-600">
            {cargando ? "Cargando…" : `${asistentes.length} asistente(s)`}
            {edicion?.nombre && (
              <span className="ml-2 rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-500">
                Edición: {edicion.nombre}
              </span>
            )}
          </p>
        </div>
        <Link
          href="/gala/nuevo"
          className="rounded-md px-4 py-2 text-sm font-semibold text-white"
          style={{ background: "var(--balvert-azul-oscuro)" }}
        >
          + Añadir asistente
        </Link>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          No se pudieron cargar los asistentes: {error}
        </div>
      )}

      {!error && (
        <div className="overflow-x-auto rounded-lg border border-[var(--borde)] bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 text-xs uppercase text-zinc-500">
              <tr>
                <th className="px-4 py-3">Nombre</th>
                <th className="px-4 py-3">Tipo de entrada</th>
                <th className="px-4 py-3">Menú</th>
                <th className="px-4 py-3">Confirmado</th>
                <th className="px-4 py-3">Entrada enviada</th>
                <th className="px-4 py-3">Check-in</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {asistentes.map((a) => (
                <tr key={a.id} className="border-t border-[var(--borde)]">
                  <td className="px-4 py-3 font-medium">
                    {a.nombre_asistente ?? "(sin nombre)"}
                    {a.email_asistente && (
                      <span className="block text-xs text-zinc-500">{a.email_asistente}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">{a.tipo_entrada ?? "—"}</td>
                  <td className="px-4 py-3">{a.menu ?? "—"}</td>
                  <td className="px-4 py-3">{a.confirmado ?? "—"}</td>
                  <td className="px-4 py-3">{a.entrada_enviada ?? "—"}</td>
                  <td className="px-4 py-3">{a.check_in_hecho === "Sí" ? "✅ Sí" : "—"}</td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/gala/${a.id}`}
                      className="mr-3 font-medium text-[var(--balvert-azul-oscuro)] hover:underline"
                    >
                      Editar
                    </Link>
                    <button
                      onClick={() => eliminar(a.id, a.nombre_asistente)}
                      className="font-medium text-red-600 hover:underline"
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
              {!cargando && asistentes.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-zinc-500">
                    Todavía no hay asistentes a la gala. Añade el primero con el
                    botón de arriba.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
