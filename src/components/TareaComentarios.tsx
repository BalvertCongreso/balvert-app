"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/context/AuthContext";
import { marcarComentariosLeidos, obtenerUltimaLectura } from "@/lib/comentariosLeidos";
import type { TareaComentario } from "@/types/database";

interface Props {
  tareaId: string;
  onCambio?: () => void;
  onLeido?: () => void;
}

function formatearFecha(iso: string) {
  return new Date(iso).toLocaleString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function TareaComentarios({ tareaId, onCambio, onLeido }: Props) {
  const { usuario } = useAuth();
  const [comentarios, setComentarios] = useState<TareaComentario[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nuevoContenido, setNuevoContenido] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [ultimaLecturaPrevia, setUltimaLecturaPrevia] = useState<string | null>(null);

  async function cargar() {
    setCargando(true);
    const { data, error } = await supabase
      .from("tarea_comentarios")
      .select("*")
      .eq("tarea_id", tareaId)
      .order("fecha_creacion", { ascending: true });
    if (error) {
      setError(error.message);
    } else {
      setError(null);
      const lista = (data as TareaComentario[]) ?? [];
      setComentarios(lista);

      if (usuario) {
        setUltimaLecturaPrevia(obtenerUltimaLectura(usuario, tareaId));
        const ultimoComentario = lista[lista.length - 1];
        if (ultimoComentario) {
          marcarComentariosLeidos(usuario, tareaId, ultimoComentario.fecha_creacion);
          onLeido?.();
        }
      }
    }
    setCargando(false);
  }

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tareaId]);

  async function anadirComentario(e: React.FormEvent) {
    e.preventDefault();
    if (!usuario || !nuevoContenido.trim()) return;
    setEnviando(true);
    const { error } = await supabase.from("tarea_comentarios").insert({
      tarea_id: tareaId,
      autor: usuario,
      contenido: nuevoContenido.trim(),
    });
    setEnviando(false);
    if (error) {
      setError(error.message);
      return;
    }
    setNuevoContenido("");
    cargar();
    onCambio?.();
  }

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-[var(--borde)] bg-white p-4">
      <h2 className="text-lg font-semibold text-[var(--balvert-marron)]">
        Comentarios
      </h2>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {cargando ? (
        <p className="text-sm text-zinc-500">Cargando…</p>
      ) : (
        <div className="flex flex-col gap-3">
          {comentarios.length === 0 && (
            <p className="text-sm text-zinc-500">Todavía no hay comentarios.</p>
          )}
          {comentarios.map((comentario) => {
            const esNuevo =
              !!usuario &&
              comentario.autor !== usuario &&
              !!ultimaLecturaPrevia &&
              comentario.fecha_creacion > ultimaLecturaPrevia;
            return (
              <div
                key={comentario.id}
                className="rounded-md border border-[var(--borde)] bg-zinc-50 p-3"
              >
                <div className="mb-1 flex items-center justify-between text-xs text-zinc-500">
                  <span className="flex items-center gap-2">
                    <span className="font-semibold text-[var(--balvert-azul-oscuro)]">
                      {comentario.autor}
                    </span>
                    {esNuevo && (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-emerald-700">
                        🆕 Nuevo
                      </span>
                    )}
                  </span>
                  <span>{formatearFecha(comentario.fecha_creacion)}</span>
                </div>
                <p className="whitespace-pre-wrap text-sm text-zinc-800">
                  {comentario.contenido}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {usuario ? (
        <form onSubmit={anadirComentario} className="flex flex-col gap-2">
          <label className="campo-label" htmlFor="nuevo-comentario">
            Escribe como {usuario}
          </label>
          <textarea
            id="nuevo-comentario"
            className="campo-input"
            rows={3}
            value={nuevoContenido}
            onChange={(e) => setNuevoContenido(e.target.value)}
            placeholder="Escribe un comentario…"
          />
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={enviando || !nuevoContenido.trim()}
              className="rounded-md px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              style={{ background: "var(--balvert-azul-oscuro)" }}
            >
              {enviando ? "Publicando…" : "Añadir comentario"}
            </button>
          </div>
        </form>
      ) : (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Esta cuenta no está reconocida como Ariadna ni Ariosto, así que no se pueden
          escribir comentarios.
        </div>
      )}
    </div>
  );
}
