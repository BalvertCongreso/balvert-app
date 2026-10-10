"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { cabeceraAutorizacion, llamarApiGet, llamarApiJson } from "@/lib/apiCliente";
import {
  BUCKET_ARCHIVOS_PATROCINADOR,
  MAX_TITULO_ARCHIVO,
  NOMBRE_TIPO_ARCHIVO,
  TAMANO_MAXIMO_ARCHIVO,
  TIPOS_ARCHIVO,
  TIPO_POR_EXTENSION,
  extensionDe,
  type TipoArchivo,
} from "@/lib/patrocinadorArchivos";

// Archivos internos del patrocinador (logo, contrato firmado…). Privados:
// solo el panel interno; nunca en el portal ni en las descargas Excel/CSV.

interface Archivo {
  id: string;
  tipo: TipoArchivo;
  titulo: string | null;
  nombre_archivo: string;
  autor: string | null;
  creado: string;
  // Solo PNG/JPG/WEBP. SVG, AI y EPS nunca se muestran: solo se descargan.
  miniatura: string | null;
}

const ACEPTADOS = Object.keys(TIPO_POR_EXTENSION).map((e) => `.${e}`).join(",");

function formatearFecha(iso: string) {
  return new Date(iso).toLocaleString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ArchivosPatrocinador({ patrocinadorId }: { patrocinadorId: string }) {
  const [archivos, setArchivos] = useState<Archivo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tipo, setTipo] = useState<TipoArchivo>("logo");
  const [titulo, setTitulo] = useState("");
  const [archivo, setArchivo] = useState<File | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function cargar() {
    try {
      const data = await llamarApiGet(`/api/patrocinadores/archivos?patrocinador_id=${encodeURIComponent(patrocinadorId)}`);
      setArchivos(data.archivos);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado.");
    }
  }

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patrocinadorId]);

  async function subir(e: React.FormEvent) {
    e.preventDefault();
    if (!archivo) return;
    setError(null);
    if (!TIPO_POR_EXTENSION[extensionDe(archivo.name)]) {
      setError("Solo se pueden subir PDF, PNG, JPG, WEBP, SVG, AI o EPS.");
      return;
    }
    if (archivo.size > TAMANO_MAXIMO_ARCHIVO) {
      setError("El archivo pesa demasiado (máximo 50 MB).");
      return;
    }
    setSubiendo(true);
    try {
      const { ruta, token, tipo: tipoMime } = await llamarApiJson("/api/patrocinadores/archivos/subida", {
        patrocinador_id: patrocinadorId,
        nombre: archivo.name,
        tamano: archivo.size,
      });
      const { error: errorSubida } = await supabase.storage
        .from(BUCKET_ARCHIVOS_PATROCINADOR)
        .uploadToSignedUrl(ruta, token, archivo, { contentType: tipoMime });
      if (errorSubida) throw new Error("No se pudo subir el archivo: " + errorSubida.message);
      await llamarApiJson("/api/patrocinadores/archivos", {
        patrocinador_id: patrocinadorId,
        ruta_archivo: ruta,
        tipo,
        titulo,
      });
      setTitulo("");
      setArchivo(null);
      if (inputRef.current) inputRef.current.value = "";
      await cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado.");
    }
    setSubiendo(false);
  }

  async function descargar(id: string) {
    setError(null);
    try {
      const { url } = await llamarApiGet(`/api/patrocinadores/archivos/descargar?id=${encodeURIComponent(id)}`);
      // La URL lleva "descarga" (attachment): el navegador la guarda, no la abre.
      window.location.assign(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado.");
    }
  }

  async function borrar(a: Archivo) {
    const ok = window.confirm(
      `¿Borrar "${a.titulo || a.nombre_archivo}"? Se borrará el archivo y no se puede deshacer.`
    );
    if (!ok) return;
    setError(null);
    const res = await fetch(`/api/patrocinadores/archivos?id=${encodeURIComponent(a.id)}`, {
      method: "DELETE",
      headers: await cabeceraAutorizacion(),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "No se pudo borrar.");
      return;
    }
    setArchivos((prev) => prev?.filter((x) => x.id !== a.id) ?? null);
  }

  return (
    <section className="rounded-lg border border-[var(--borde)] bg-white p-4">
      <h3 className="seccion-titulo">Archivos</h3>
      <p className="mb-4 text-xs text-zinc-500">
        Logo, contrato firmado y otros archivos. Solo los ves en este panel: no aparecen en el
        área de clientes.
      </p>

      <form onSubmit={subir} className="mb-5 grid gap-3 sm:grid-cols-[10rem_1fr]">
        <label className="campo-label sm:pt-2" htmlFor="archivo-tipo">
          Tipo
        </label>
        <select
          id="archivo-tipo"
          className="campo-input max-w-xs"
          value={tipo}
          onChange={(e) => setTipo(e.target.value as TipoArchivo)}
        >
          {TIPOS_ARCHIVO.map((t) => (
            <option key={t} value={t}>
              {NOMBRE_TIPO_ARCHIVO[t]}
            </option>
          ))}
        </select>
        <label className="campo-label sm:pt-2" htmlFor="archivo-titulo">
          Título (opcional)
        </label>
        <input
          id="archivo-titulo"
          type="text"
          className="campo-input"
          maxLength={MAX_TITULO_ARCHIVO}
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          placeholder="p. ej. Logo en vectorial, Contrato firmado 2027…"
        />
        <label className="campo-label sm:pt-2" htmlFor="archivo-fichero">
          Archivo
        </label>
        <div>
          <input
            id="archivo-fichero"
            ref={inputRef}
            type="file"
            accept={ACEPTADOS}
            onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
            className="text-sm"
          />
          <p className="mt-1 text-xs text-zinc-500">PDF, PNG, JPG, WEBP, SVG, AI o EPS. Máximo 50 MB.</p>
        </div>
        <div className="sm:col-start-2">
          <button
            type="submit"
            disabled={!archivo || subiendo}
            className="rounded-md px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            style={{ background: "var(--balvert-azul-oscuro)" }}
          >
            {subiendo ? "Subiendo…" : "Subir archivo"}
          </button>
        </div>
      </form>

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      {!archivos && !error && <p className="text-sm text-zinc-500">Cargando…</p>}
      {archivos && archivos.length === 0 && (
        <p className="text-sm text-zinc-500">Todavía no hay archivos.</p>
      )}
      {archivos && archivos.length > 0 && (
        <ul className="flex flex-col divide-y divide-[var(--borde)]">
          {archivos.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center gap-3 py-3">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded border border-[var(--borde)] bg-zinc-50 text-[10px] font-semibold uppercase text-zinc-500">
                {a.miniatura ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.miniatura} alt="" className="h-full w-full object-contain" />
                ) : (
                  extensionDe(a.nombre_archivo)
                )}
              </div>
              <div className="min-w-0 flex-1 text-sm">
                <p className="font-medium">
                  <span className="mr-2 rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">
                    {NOMBRE_TIPO_ARCHIVO[a.tipo]}
                  </span>
                  {a.titulo || a.nombre_archivo}
                </p>
                <p className="truncate text-xs text-zinc-500">
                  {a.titulo ? `${a.nombre_archivo} · ` : ""}
                  {formatearFecha(a.creado)}
                  {a.autor ? ` · ${a.autor}` : ""}
                </p>
              </div>
              <div className="flex gap-3 text-sm">
                <button
                  type="button"
                  onClick={() => descargar(a.id)}
                  className="font-medium text-[var(--balvert-azul-oscuro)] hover:underline"
                >
                  Descargar
                </button>
                <button
                  type="button"
                  onClick={() => borrar(a)}
                  className="font-medium text-red-600 hover:underline"
                >
                  Borrar
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
