"use client";

import { Fragment, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { obtenerEdicionActiva } from "@/lib/edicionActiva";
import ProspectoContactos from "@/components/ProspectoContactos";
import type { Edicion, ProspectoPatrocinio } from "@/types/database";

interface ResumenContacto {
  numero: number;
  ultimoComentario: string | null;
}

export default function CaptacionPage() {
  const [prospectos, setProspectos] = useState<ProspectoPatrocinio[]>([]);
  const [edicion, setEdicion] = useState<Edicion | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resumenContactos, setResumenContactos] = useState<Record<string, ResumenContacto>>({});
  const [expandidaId, setExpandidaId] = useState<string | null>(null);

  async function cargarResumenContactos(ids: string[]) {
    if (ids.length === 0) {
      setResumenContactos({});
      return;
    }
    const { data, error } = await supabase
      .from("prospectos_contactos")
      .select("prospecto_id, comentario, fecha")
      .in("prospecto_id", ids)
      .order("fecha", { ascending: true });
    if (error) return;
    const resumen: Record<string, ResumenContacto> = {};
    for (const fila of data ?? []) {
      const previo = resumen[fila.prospecto_id];
      resumen[fila.prospecto_id] = {
        numero: (previo?.numero ?? 0) + 1,
        ultimoComentario: fila.comentario,
      };
    }
    setResumenContactos((prev) => ({ ...prev, ...resumen }));
  }

  async function cargar() {
    setCargando(true);
    const edicionActiva = await obtenerEdicionActiva();
    setEdicion(edicionActiva);

    let query = supabase
      .from("prospectos_patrocinio")
      .select("*")
      .order("empresa", { ascending: true, nullsFirst: false })
      .order("entidad_publica", { ascending: true, nullsFirst: false });

    if (edicionActiva) {
      query = query.eq("edicion_id", edicionActiva.id);
    }

    const { data, error } = await query;

    if (error) {
      setError(error.message);
    } else {
      setError(null);
      setProspectos(data ?? []);
      cargarResumenContactos((data ?? []).map((p) => p.id));
    }
    setCargando(false);
  }

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function eliminar(id: string, nombre: string | null) {
    const ok = window.confirm(
      `¿Eliminar el prospecto "${nombre ?? "este prospecto"}"? Esta acción no se puede deshacer.`
    );
    if (!ok) return;

    const { error } = await supabase.from("prospectos_patrocinio").delete().eq("id", id);
    if (error) {
      alert("No se pudo eliminar: " + error.message);
      return;
    }
    setProspectos((prev) => prev.filter((p) => p.id !== id));
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--balvert-marron)]">Captación</h1>
          <p className="text-sm text-zinc-600">
            {cargando ? "Cargando…" : `${prospectos.length} prospecto(s)`}
            {edicion?.nombre && (
              <span className="ml-2 rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-500">
                Edición: {edicion.nombre}
              </span>
            )}
          </p>
        </div>
        <Link
          href="/captacion/nuevo"
          className="rounded-md px-4 py-2 text-sm font-semibold text-white"
          style={{ background: "var(--balvert-azul-oscuro)" }}
        >
          + Añadir prospecto
        </Link>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          No se pudieron cargar los prospectos: {error}
        </div>
      )}

      {!error && (
        <div className="overflow-x-auto rounded-lg border border-[var(--borde)] bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 text-xs uppercase text-zinc-500">
              <tr>
                <th className="px-4 py-3">Empresa</th>
                <th className="px-4 py-3">Entidad pública</th>
                <th className="px-4 py-3">Colegiado</th>
                <th className="px-4 py-3">Responsable</th>
                <th className="px-4 py-3">Interés</th>
                <th className="px-4 py-3">Contactos</th>
                <th className="px-4 py-3">Último comentario</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {prospectos.map((p) => {
                const expandida = expandidaId === p.id;
                const resumen = resumenContactos[p.id];
                const nombre = p.empresa || p.entidad_publica;
                return (
                  <Fragment key={p.id}>
                    <tr className="border-t border-[var(--borde)]">
                      <td className="px-4 py-3 font-medium">{p.empresa || "—"}</td>
                      <td className="px-4 py-3">{p.entidad_publica || "—"}</td>
                      <td className="px-4 py-3">{p.colegiado_profesional ? "✅" : "—"}</td>
                      <td className="px-4 py-3">{p.responsable ?? "—"}</td>
                      <td className="px-4 py-3">{p.interes ?? "—"}</td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setExpandidaId(expandida ? null : p.id)}
                          className="font-medium text-[var(--balvert-azul-oscuro)] hover:underline"
                        >
                          💬 {resumen?.numero ?? 0}
                        </button>
                      </td>
                      <td className="max-w-xs truncate px-4 py-3 text-zinc-600">
                        {resumen?.ultimoComentario ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/captacion/${p.id}`}
                          className="mr-3 font-medium text-[var(--balvert-azul-oscuro)] hover:underline"
                        >
                          Editar
                        </Link>
                        <button
                          onClick={() => eliminar(p.id, nombre)}
                          className="font-medium text-red-600 hover:underline"
                        >
                          Eliminar
                        </button>
                      </td>
                    </tr>
                    {expandida && (
                      <tr className="border-t border-[var(--borde)] bg-zinc-50">
                        <td colSpan={8} className="px-4 py-4">
                          <ProspectoContactos
                            prospectoId={p.id}
                            onCambio={() => cargarResumenContactos([p.id])}
                          />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
              {!cargando && prospectos.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-zinc-500">
                    Todavía no hay prospectos. Añade el primero con el botón de arriba.
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
