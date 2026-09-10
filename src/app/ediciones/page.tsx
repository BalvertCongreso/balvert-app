"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import type { Edicion } from "@/types/database";

export default function EdicionesPage() {
  const [ediciones, setEdiciones] = useState<Edicion[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [marcando, setMarcando] = useState<string | null>(null);

  async function cargar() {
    setCargando(true);
    const { data, error } = await supabase
      .from("ediciones")
      .select("*")
      .order("anio", { ascending: false });

    if (error) {
      setError(error.message);
    } else {
      setError(null);
      setEdiciones(data ?? []);
    }
    setCargando(false);
  }

  useEffect(() => {
    cargar();
  }, []);

  async function marcarActiva(id: string) {
    setMarcando(id);
    // Sin transacciones desde el cliente: primero desmarcamos todas, luego
    // marcamos la elegida, para que nunca haya dos ediciones activas a la vez.
    const { error: errorDesmarcar } = await supabase
      .from("ediciones")
      .update({ activa: false })
      .neq("id", id);
    const { error: errorMarcar } = await supabase
      .from("ediciones")
      .update({ activa: true })
      .eq("id", id);

    if (errorDesmarcar || errorMarcar) {
      alert("No se pudo cambiar la edición activa: " + (errorDesmarcar || errorMarcar)?.message);
    } else {
      setEdiciones((prev) => prev.map((e) => ({ ...e, activa: e.id === id })));
    }
    setMarcando(null);
  }

  async function eliminar(id: string, nombre: string | null) {
    const ok = window.confirm(
      `¿Eliminar la edición "${nombre ?? "esta edición"}"? Esta acción no se puede deshacer.`
    );
    if (!ok) return;

    const { error } = await supabase.from("ediciones").delete().eq("id", id);
    if (error) {
      alert("No se pudo eliminar: " + error.message);
      return;
    }
    setEdiciones((prev) => prev.filter((e) => e.id !== id));
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--balvert-marron)]">Ediciones</h1>
          <p className="text-sm text-zinc-600">
            {cargando ? "Cargando…" : `${ediciones.length} edición(es)`}
          </p>
        </div>
        <Link
          href="/ediciones/nuevo"
          className="rounded-md px-4 py-2 text-sm font-semibold text-white"
          style={{ background: "var(--balvert-azul-oscuro)" }}
        >
          + Añadir edición
        </Link>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          No se pudieron cargar las ediciones: {error}
          <br />
          Comprueba que has ejecutado la migración{" "}
          <code>supabase/migrations/006_lugar_hora_ediciones.sql</code>.
        </div>
      )}

      {!error && (
        <div className="overflow-x-auto rounded-lg border border-[var(--borde)] bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 text-xs uppercase text-zinc-500">
              <tr>
                <th className="px-4 py-3">Nombre</th>
                <th className="px-4 py-3">Año</th>
                <th className="px-4 py-3">Ciudad</th>
                <th className="px-4 py-3">Activa</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {ediciones.map((e) => (
                <tr key={e.id} className="border-t border-[var(--borde)]">
                  <td className="px-4 py-3 font-medium">{e.nombre ?? "(sin nombre)"}</td>
                  <td className="px-4 py-3">{e.anio ?? "—"}</td>
                  <td className="px-4 py-3">{e.ciudad ?? "—"}</td>
                  <td className="px-4 py-3">
                    {e.activa ? (
                      <span
                        className="rounded-full px-2 py-0.5 text-xs font-semibold text-white"
                        style={{ background: "var(--balvert-azul-oscuro)" }}
                      >
                        Activa
                      </span>
                    ) : (
                      <button
                        onClick={() => marcarActiva(e.id)}
                        disabled={marcando === e.id}
                        className="text-xs font-medium text-[var(--balvert-azul-oscuro)] hover:underline disabled:opacity-60"
                      >
                        {marcando === e.id ? "Marcando…" : "Marcar como activa"}
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/ediciones/${e.id}`}
                      className="mr-3 font-medium text-[var(--balvert-azul-oscuro)] hover:underline"
                    >
                      Editar
                    </Link>
                    <button
                      onClick={() => eliminar(e.id, e.nombre)}
                      className="font-medium text-red-600 hover:underline"
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
              {!cargando && ediciones.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-zinc-500">
                    Todavía no hay ediciones. Añade la primera con el botón de arriba.
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
