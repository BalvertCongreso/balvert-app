"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { obtenerEdicionActiva } from "@/lib/edicionActiva";
import type { Edicion, Patrocinador } from "@/types/database";

export default function PatrocinadoresPage() {
  const [patrocinadores, setPatrocinadores] = useState<Patrocinador[]>([]);
  const [edicion, setEdicion] = useState<Edicion | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function cargar() {
    setCargando(true);
    const edicionActiva = await obtenerEdicionActiva();
    setEdicion(edicionActiva);

    let query = supabase
      .from("patrocinadores")
      .select("*")
      .order("empresa_entidad", { ascending: true });

    if (edicionActiva) {
      query = query.eq("edicion_id", edicionActiva.id);
    }

    const { data, error } = await query;

    if (error) {
      setError(error.message);
    } else {
      setError(null);
      setPatrocinadores(data ?? []);
    }
    setCargando(false);
  }

  useEffect(() => {
    cargar();
  }, []);

  async function eliminar(id: string, nombre: string | null) {
    const ok = window.confirm(
      `¿Eliminar a "${nombre ?? "este patrocinador"}"? Esta acción no se puede deshacer.`
    );
    if (!ok) return;

    const { error } = await supabase.from("patrocinadores").delete().eq("id", id);
    if (error) {
      alert("No se pudo eliminar: " + error.message);
      return;
    }
    setPatrocinadores((prev) => prev.filter((p) => p.id !== id));
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--balvert-marron)]">
            Patrocinadores
          </h1>
          <p className="text-sm text-zinc-600">
            {cargando ? "Cargando…" : `${patrocinadores.length} patrocinador(es)`}
            {edicion?.nombre && (
              <span className="ml-2 rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-500">
                Edición: {edicion.nombre}
              </span>
            )}
          </p>
        </div>
        <Link
          href="/patrocinadores/nuevo"
          className="rounded-md px-4 py-2 text-sm font-semibold text-white"
          style={{ background: "var(--balvert-azul-oscuro)" }}
        >
          + Añadir patrocinador
        </Link>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          No se pudieron cargar los patrocinadores: {error}
          <br />
          Comprueba que las claves de Supabase están configuradas en{" "}
          <code>.env.local</code> y que ejecutaste <code>supabase/schema.sql</code>.
        </div>
      )}

      {!error && (
        <div className="overflow-x-auto rounded-lg border border-[var(--borde)] bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 text-xs uppercase text-zinc-500">
              <tr>
                <th className="px-4 py-3">Categoría</th>
                <th className="px-4 py-3">Empresa / entidad</th>
                <th className="px-4 py-3">Contacto principal</th>
                <th className="px-4 py-3">Mostrador</th>
                <th className="px-4 py-3">Pago recibido</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {patrocinadores.map((p) => (
                <tr key={p.id} className="border-t border-[var(--borde)]">
                  <td className="px-4 py-3">{p.categoria ?? "—"}</td>
                  <td className="px-4 py-3 font-medium">
                    {p.empresa_entidad ?? "(sin nombre)"}
                  </td>
                  <td className="px-4 py-3">
                    {p.contacto1_nombre ?? "—"}
                    {p.contacto1_email && (
                      <span className="block text-xs text-zinc-500">
                        {p.contacto1_email}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">{p.tiene_stand ?? "—"}</td>
                  <td className="px-4 py-3">{p.pago_recibido ?? "—"}</td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/patrocinadores/${p.id}`}
                      className="mr-3 font-medium text-[var(--balvert-azul-oscuro)] hover:underline"
                    >
                      Editar
                    </Link>
                    <button
                      onClick={() => eliminar(p.id, p.empresa_entidad)}
                      className="font-medium text-red-600 hover:underline"
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
              {!cargando && patrocinadores.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-zinc-500">
                    Todavía no hay patrocinadores. Añade el primero con el botón de
                    arriba.
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
