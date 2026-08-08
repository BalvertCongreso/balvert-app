"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useCurrentUser } from "@/context/CurrentUserContext";

interface NotaBase {
  id: string;
  contenido: string | null;
  fecha_creacion: string;
  fecha_actualizacion: string;
  [key: string]: unknown;
}

interface Props {
  tabla: "notas_compartidas" | "notas_privadas";
  campoAutor: "autor" | "usuario";
  filtrarPorUsuarioActual: boolean;
  titulo: string;
  descripcion: string;
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

export default function NotasBoard({
  tabla,
  campoAutor,
  filtrarPorUsuarioActual,
  titulo,
  descripcion,
}: Props) {
  const { usuario } = useCurrentUser();
  const [notas, setNotas] = useState<NotaBase[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nuevoContenido, setNuevoContenido] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [textoEdicion, setTextoEdicion] = useState("");

  async function cargar() {
    setCargando(true);
    let query = supabase
      .from(tabla)
      .select("*")
      .order("fecha_creacion", { ascending: false });

    if (filtrarPorUsuarioActual && usuario) {
      query = query.eq(campoAutor, usuario);
    }

    const { data, error } = await query;
    if (error) {
      setError(error.message);
    } else {
      setError(null);
      setNotas((data as NotaBase[]) ?? []);
    }
    setCargando(false);
  }

  useEffect(() => {
    if (filtrarPorUsuarioActual && !usuario) {
      setNotas([]);
      setCargando(false);
      return;
    }
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario]);

  async function crearNota(e: React.FormEvent) {
    e.preventDefault();
    if (!usuario || !nuevoContenido.trim()) return;
    setEnviando(true);
    const ahora = new Date().toISOString();
    const { error } = await supabase.from(tabla).insert({
      [campoAutor]: usuario,
      contenido: nuevoContenido.trim(),
      fecha_creacion: ahora,
      fecha_actualizacion: ahora,
    });
    setEnviando(false);
    if (error) {
      setError(error.message);
      return;
    }
    setNuevoContenido("");
    cargar();
  }

  async function guardarEdicion(id: string) {
    const { error } = await supabase
      .from(tabla)
      .update({ contenido: textoEdicion, fecha_actualizacion: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      setError(error.message);
      return;
    }
    setEditandoId(null);
    cargar();
  }

  async function eliminarNota(id: string) {
    const ok = window.confirm("¿Eliminar esta nota? No se puede deshacer.");
    if (!ok) return;
    const { error } = await supabase.from(tabla).delete().eq("id", id);
    if (error) {
      setError(error.message);
      return;
    }
    setNotas((prev) => prev.filter((n) => n.id !== id));
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--balvert-marron)]">{titulo}</h1>
        <p className="text-sm text-zinc-600">{descripcion}</p>
      </div>

      {!usuario && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Elige quién eres arriba a la derecha ("Ariadna" o "Ariosto") para poder ver y
          escribir notas.
        </div>
      )}

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {usuario && (
        <form onSubmit={crearNota} className="rounded-lg border border-[var(--borde)] bg-white p-4">
          <label className="campo-label" htmlFor="nueva-nota">
            Escribe como {usuario}
          </label>
          <textarea
            id="nueva-nota"
            className="campo-input"
            rows={3}
            value={nuevoContenido}
            onChange={(e) => setNuevoContenido(e.target.value)}
            placeholder="Escribe una nota…"
          />
          <div className="mt-3 flex justify-end">
            <button
              type="submit"
              disabled={enviando || !nuevoContenido.trim()}
              className="rounded-md px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              style={{ background: "var(--balvert-azul-oscuro)" }}
            >
              {enviando ? "Publicando…" : "Publicar nota"}
            </button>
          </div>
        </form>
      )}

      {cargando ? (
        <p className="text-sm text-zinc-500">Cargando…</p>
      ) : (
        <div className="flex flex-col gap-3">
          {notas.length === 0 && usuario && (
            <p className="text-sm text-zinc-500">Todavía no hay notas.</p>
          )}
          {notas.map((nota) => (
            <div key={nota.id} className="rounded-lg border border-[var(--borde)] bg-white p-4">
              <div className="mb-2 flex items-center justify-between text-xs text-zinc-500">
                <span className="font-semibold text-[var(--balvert-azul-oscuro)]">
                  {String(nota[campoAutor] ?? "")}
                </span>
                <span>{formatearFecha(nota.fecha_actualizacion)}</span>
              </div>

              {editandoId === nota.id ? (
                <div className="flex flex-col gap-2">
                  <textarea
                    className="campo-input"
                    rows={3}
                    value={textoEdicion}
                    onChange={(e) => setTextoEdicion(e.target.value)}
                  />
                  <div className="flex gap-3 text-sm">
                    <button
                      onClick={() => guardarEdicion(nota.id)}
                      className="font-medium text-[var(--balvert-azul-oscuro)] hover:underline"
                    >
                      Guardar
                    </button>
                    <button
                      onClick={() => setEditandoId(null)}
                      className="font-medium text-zinc-500 hover:underline"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="whitespace-pre-wrap text-sm text-zinc-800">
                    {nota.contenido}
                  </p>
                  <div className="mt-3 flex gap-3 text-xs">
                    <button
                      onClick={() => {
                        setEditandoId(nota.id);
                        setTextoEdicion(nota.contenido ?? "");
                      }}
                      className="font-medium text-[var(--balvert-azul-oscuro)] hover:underline"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => eliminarNota(nota.id)}
                      className="font-medium text-red-600 hover:underline"
                    >
                      Eliminar
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
