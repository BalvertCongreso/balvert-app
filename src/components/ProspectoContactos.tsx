"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/context/AuthContext";
import type { ProspectoContacto } from "@/types/database";

interface Props {
  prospectoId: string;
  onCambio?: () => void;
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

export default function ProspectoContactos({ prospectoId, onCambio }: Props) {
  const { usuario } = useAuth();
  const [contactos, setContactos] = useState<ProspectoContacto[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nuevoComentario, setNuevoComentario] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function cargar() {
    setCargando(true);
    const { data, error } = await supabase
      .from("prospectos_contactos")
      .select("*")
      .eq("prospecto_id", prospectoId)
      .order("fecha", { ascending: true });
    if (error) {
      setError(error.message);
    } else {
      setError(null);
      setContactos((data as ProspectoContacto[]) ?? []);
    }
    setCargando(false);
  }

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prospectoId]);

  async function anadirContacto(e: React.FormEvent) {
    e.preventDefault();
    if (!usuario || !nuevoComentario.trim()) return;
    setEnviando(true);
    const { error } = await supabase.from("prospectos_contactos").insert({
      prospecto_id: prospectoId,
      autor: usuario,
      comentario: nuevoComentario.trim(),
    });
    setEnviando(false);
    if (error) {
      setError(error.message);
      return;
    }
    setNuevoComentario("");
    cargar();
    onCambio?.();
  }

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-[var(--borde)] bg-white p-4">
      <h2 className="text-lg font-semibold text-[var(--balvert-marron)]">
        Historial de contactos
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
          {contactos.length === 0 && (
            <p className="text-sm text-zinc-500">Todavía no hay contactos registrados.</p>
          )}
          {contactos.map((contacto) => (
            <div
              key={contacto.id}
              className="rounded-md border border-[var(--borde)] bg-zinc-50 p-3"
            >
              <div className="mb-1 flex items-center justify-between text-xs text-zinc-500">
                <span className="font-semibold text-[var(--balvert-azul-oscuro)]">
                  {contacto.autor}
                </span>
                <span>{formatearFecha(contacto.fecha)}</span>
              </div>
              <p className="whitespace-pre-wrap text-sm text-zinc-800">
                {contacto.comentario}
              </p>
            </div>
          ))}
        </div>
      )}

      {usuario ? (
        <form onSubmit={anadirContacto} className="flex flex-col gap-2">
          <label className="campo-label" htmlFor="nuevo-contacto">
            Registrar contacto como {usuario}
          </label>
          <textarea
            id="nuevo-contacto"
            className="campo-input"
            rows={3}
            value={nuevoComentario}
            onChange={(e) => setNuevoComentario(e.target.value)}
            placeholder="Qué se habló, cómo fue, próximo paso…"
          />
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={enviando || !nuevoComentario.trim()}
              className="rounded-md px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              style={{ background: "var(--balvert-azul-oscuro)" }}
            >
              {enviando ? "Guardando…" : "Añadir contacto"}
            </button>
          </div>
        </form>
      ) : (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Esta cuenta no está reconocida como Ariadna ni Ariosto, así que no se pueden
          registrar contactos.
        </div>
      )}
    </div>
  );
}
