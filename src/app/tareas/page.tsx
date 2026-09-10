"use client";

import { Fragment, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { obtenerEdicionActiva } from "@/lib/edicionActiva";
import TareaComentarios from "@/components/TareaComentarios";
import { useAuth } from "@/context/AuthContext";
import { obtenerUltimaLectura } from "@/lib/comentariosLeidos";
import type { Edicion, Tarea } from "@/types/database";

function hoyISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function TareasPage() {
  const { usuario } = useAuth();
  const [tareas, setTareas] = useState<Tarea[]>([]);
  const [edicion, setEdicion] = useState<Edicion | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [numComentarios, setNumComentarios] = useState<Record<string, number>>({});
  const [tareasConNuevo, setTareasConNuevo] = useState<Record<string, boolean>>({});
  const [expandidaId, setExpandidaId] = useState<string | null>(null);

  async function cargarNumComentarios(ids: string[]) {
    if (ids.length === 0) {
      setNumComentarios({});
      setTareasConNuevo({});
      return;
    }
    const { data, error } = await supabase
      .from("tarea_comentarios")
      .select("tarea_id, autor, fecha_creacion")
      .in("tarea_id", ids);
    if (error) return;
    const conteo: Record<string, number> = {};
    const conNuevo: Record<string, boolean> = {};
    for (const fila of data ?? []) {
      conteo[fila.tarea_id] = (conteo[fila.tarea_id] ?? 0) + 1;
      if (usuario && fila.autor !== usuario) {
        const ultimaLectura = obtenerUltimaLectura(usuario, fila.tarea_id);
        if (ultimaLectura && fila.fecha_creacion > ultimaLectura) {
          conNuevo[fila.tarea_id] = true;
        }
      }
    }
    setNumComentarios(conteo);
    setTareasConNuevo(conNuevo);
  }

  async function cargar() {
    setCargando(true);
    const edicionActiva = await obtenerEdicionActiva();
    setEdicion(edicionActiva);

    let query = supabase
      .from("tareas")
      .select("*")
      .order("fecha_limite", { ascending: true, nullsFirst: false });

    if (edicionActiva) {
      query = query.eq("edicion_id", edicionActiva.id);
    }

    const { data, error } = await query;

    if (error) {
      setError(error.message);
    } else {
      setError(null);
      setTareas(data ?? []);
      cargarNumComentarios((data ?? []).map((t) => t.id));
    }
    setCargando(false);
  }

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario]);

  async function eliminar(id: string, nombre: string | null) {
    const ok = window.confirm(
      `¿Eliminar la tarea "${nombre ?? "esta tarea"}"? Esta acción no se puede deshacer.`
    );
    if (!ok) return;

    const { error } = await supabase.from("tareas").delete().eq("id", id);
    if (error) {
      alert("No se pudo eliminar: " + error.message);
      return;
    }
    setTareas((prev) => prev.filter((t) => t.id !== id));
  }

  async function alternarCompletada(tarea: Tarea, completada: boolean) {
    const cambios = completada
      ? { estado: "✅ Completada" as const, fecha_completada: hoyISO() }
      : { estado: "⏳ Pendiente" as const, fecha_completada: null };

    setTareas((prev) =>
      prev.map((t) => (t.id === tarea.id ? { ...t, ...cambios } : t))
    );

    const { error } = await supabase.from("tareas").update(cambios).eq("id", tarea.id);
    if (error) {
      alert("No se pudo actualizar: " + error.message);
      cargar();
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--balvert-marron)]">Tareas</h1>
          <p className="text-sm text-zinc-600">
            {cargando ? "Cargando…" : `${tareas.length} tarea(s)`}
            {edicion?.nombre && (
              <span className="ml-2 rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-500">
                Edición: {edicion.nombre}
              </span>
            )}
          </p>
        </div>
        <Link
          href="/tareas/nuevo"
          className="rounded-md px-4 py-2 text-sm font-semibold text-white"
          style={{ background: "var(--balvert-azul-oscuro)" }}
        >
          + Añadir tarea
        </Link>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          No se pudieron cargar las tareas: {error}
        </div>
      )}

      {!error && (
        <div className="overflow-x-auto rounded-lg border border-[var(--borde)] bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 text-xs uppercase text-zinc-500">
              <tr>
                <th className="px-4 py-3"></th>
                <th className="px-4 py-3">Tarea</th>
                <th className="px-4 py-3">Responsable</th>
                <th className="px-4 py-3">Fase</th>
                <th className="px-4 py-3">Prioridad</th>
                <th className="px-4 py-3">Fecha límite</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Comentarios</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {tareas.map((t) => {
                const completada = t.estado === "✅ Completada";
                const expandida = expandidaId === t.id;
                return (
                  <Fragment key={t.id}>
                    <tr className="border-t border-[var(--borde)]">
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={completada}
                          onChange={(e) => alternarCompletada(t, e.target.checked)}
                          className="h-4 w-4"
                          aria-label="Marcar como completada"
                        />
                      </td>
                      <td
                        className={`px-4 py-3 font-medium ${
                          completada ? "text-zinc-400 line-through" : ""
                        }`}
                      >
                        {t.tarea ?? "(sin descripción)"}
                      </td>
                      <td className="px-4 py-3">{t.responsable ?? "—"}</td>
                      <td className="px-4 py-3">{t.fase ?? "—"}</td>
                      <td className="px-4 py-3">{t.prioridad ?? "—"}</td>
                      <td className="px-4 py-3">{t.fecha_limite ?? "—"}</td>
                      <td className="px-4 py-3">{t.estado ?? "—"}</td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setExpandidaId(expandida ? null : t.id)}
                          className="flex items-center gap-2 font-medium text-[var(--balvert-azul-oscuro)] hover:underline"
                        >
                          <span>💬 {numComentarios[t.id] ?? 0}</span>
                          {tareasConNuevo[t.id] && (
                            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-emerald-700">
                              🆕 Nuevo
                            </span>
                          )}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/tareas/${t.id}`}
                          className="mr-3 font-medium text-[var(--balvert-azul-oscuro)] hover:underline"
                        >
                          Editar
                        </Link>
                        <button
                          onClick={() => eliminar(t.id, t.tarea)}
                          className="font-medium text-red-600 hover:underline"
                        >
                          Eliminar
                        </button>
                      </td>
                    </tr>
                    {expandida && (
                      <tr className="border-t border-[var(--borde)] bg-zinc-50">
                        <td colSpan={9} className="px-4 py-4">
                          <TareaComentarios
                            tareaId={t.id}
                            onCambio={() =>
                              setNumComentarios((prev) => ({
                                ...prev,
                                [t.id]: (prev[t.id] ?? 0) + 1,
                              }))
                            }
                            onLeido={() =>
                              setTareasConNuevo((prev) => ({ ...prev, [t.id]: false }))
                            }
                          />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
              {!cargando && tareas.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-zinc-500">
                    Todavía no hay tareas. Añade la primera con el botón de arriba.
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
