"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { cabeceraAutorizacion, descargarConSesion, llamarApiGet, llamarApiJson } from "@/lib/apiCliente";

// Imágenes del certificado de asistencia (firma y cabecera opcional) y el
// botón "Ver certificado de ejemplo". Los textos van en el formulario de la
// edición (sección "Certificado de asistencia").

type TipoImagen = "firma" | "imagen";

const INFO: Record<TipoImagen, { titulo: string; ayuda: string }> = {
  firma: {
    titulo: "Imagen de la firma",
    ayuda: "PNG, idealmente con fondo transparente. Sin firma, el certificado sale solo con el nombre y el cargo.",
  },
  imagen: {
    titulo: "Imagen de cabecera (opcional)",
    ayuda: "Sale arriba a la derecha (otros años, la mascota). PNG o JPG. Sin imagen, ese hueco queda vacío.",
  },
};

function BloqueImagen({ edicionId, tipo }: { edicionId: string; tipo: TipoImagen }) {
  const [url, setUrl] = useState<string | null | undefined>(undefined);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const cargar = () =>
    llamarApiGet(`/api/ediciones/certificado/imagen?edicion_id=${encodeURIComponent(edicionId)}&tipo=${tipo}`)
      .then((d) => setUrl(d.url))
      .catch((e) => setError(e instanceof Error ? e.message : "Error inesperado."));

  useEffect(() => {
    llamarApiGet(`/api/ediciones/certificado/imagen?edicion_id=${encodeURIComponent(edicionId)}&tipo=${tipo}`)
      .then((d) => setUrl(d.url))
      .catch((e) => setError(e instanceof Error ? e.message : "Error inesperado."));
  }, [edicionId, tipo]);

  async function subir(archivo: File) {
    setError(null);
    setOcupado(true);
    try {
      const { ruta, token, tipo: tipoMime } = await llamarApiJson("/api/ediciones/certificado/imagen", {
        edicion_id: edicionId,
        tipo,
        nombre: archivo.name,
        tamano: archivo.size,
      });
      // Con el tipo decidido por el servidor (Supabase usa el del Blob).
      const { error: e } = await supabase.storage
        .from("certificados")
        .uploadToSignedUrl(ruta, token, new Blob([archivo], { type: tipoMime }));
      if (e) throw new Error("No se pudo subir la imagen: " + e.message);
      const res = await fetch("/api/ediciones/certificado/imagen", {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...(await cabeceraAutorizacion()) },
        body: JSON.stringify({ edicion_id: edicionId, tipo, ruta }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "No se pudo guardar la imagen.");
      await cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado.");
    }
    if (inputRef.current) inputRef.current.value = "";
    setOcupado(false);
  }

  async function quitar() {
    if (!window.confirm(`¿Quitar la ${INFO[tipo].titulo.toLowerCase()}?`)) return;
    setError(null);
    setOcupado(true);
    const res = await fetch(`/api/ediciones/certificado/imagen?edicion_id=${encodeURIComponent(edicionId)}&tipo=${tipo}`, {
      method: "DELETE",
      headers: await cabeceraAutorizacion(),
    });
    if (!res.ok) setError((await res.json().catch(() => ({}))).error || "No se pudo quitar.");
    else setUrl(null);
    setOcupado(false);
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium">{INFO[tipo].titulo}</p>
      <div className="flex h-28 w-48 items-center justify-center rounded border border-[var(--borde)] bg-[#fbf8f0] p-2">
        {url === undefined ? (
          <span className="text-xs text-zinc-400">Cargando…</span>
        ) : url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={INFO[tipo].titulo} className="max-h-full max-w-full object-contain" />
        ) : (
          <span className="text-xs text-zinc-400">Sin imagen</span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <label className="cursor-pointer font-medium text-[var(--balvert-azul-oscuro)] hover:underline">
          {ocupado ? "Guardando…" : url ? "Cambiar" : "Subir imagen"}
          <input
            ref={inputRef}
            type="file"
            accept=".png,.jpg,.jpeg"
            className="hidden"
            disabled={ocupado}
            onChange={(e) => e.target.files?.[0] && subir(e.target.files[0])}
          />
        </label>
        {url && !ocupado && (
          <button type="button" onClick={quitar} className="font-medium text-red-600 hover:underline">
            Quitar
          </button>
        )}
      </div>
      <p className="max-w-xs text-xs italic text-zinc-400">{INFO[tipo].ayuda}</p>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

export default function CertificadoEdicion({ edicionId }: { edicionId: string }) {
  const [generando, setGenerando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function verEjemplo() {
    setError(null);
    setGenerando(true);
    const fallo = await descargarConSesion(
      `/api/ediciones/certificado/ejemplo?edicion_id=${encodeURIComponent(edicionId)}`,
      "certificado-ejemplo.pdf"
    );
    if (fallo) setError(fallo);
    setGenerando(false);
  }

  return (
    <section className="rounded-lg border border-[var(--borde)] bg-white p-4">
      <h3 className="seccion-titulo">Certificado de asistencia — imágenes y ejemplo</h3>
      <p className="mb-4 text-xs text-zinc-500">
        Los asistentes del Congreso lo descargan en su área de cliente cuando se hace su check-in. Los textos se editan
        arriba, en &quot;Certificado de asistencia&quot; (guarda los cambios antes de ver el ejemplo). Las imágenes se
        guardan al momento.
      </p>
      <div className="mb-5 flex flex-wrap gap-8">
        <BloqueImagen edicionId={edicionId} tipo="firma" />
        <BloqueImagen edicionId={edicionId} tipo="imagen" />
      </div>
      <button
        type="button"
        onClick={verEjemplo}
        disabled={generando}
        className="rounded-md px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        style={{ background: "var(--balvert-azul-oscuro)" }}
      >
        {generando ? "Generando…" : "Ver certificado de ejemplo"}
      </button>
      <p className="mt-1 text-xs text-zinc-500">Descarga un PDF con un asistente ficticio para revisar el diseño.</p>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </section>
  );
}
