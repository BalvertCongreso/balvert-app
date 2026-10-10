"use client";

import { useState } from "react";
import { descargarConSesion } from "@/lib/apiCliente";

// Botón "Descargar certificado" en la ficha de un asistente del Congreso con
// el check-in hecho (por si lo pide por otra vía: el asistente lo tiene en
// su área de cliente). No envía nada por email.
export default function CertificadoAsistente({ asistenteId }: { asistenteId: string }) {
  const [generando, setGenerando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function descargar() {
    setError(null);
    setGenerando(true);
    const fallo = await descargarConSesion(
      `/api/congreso/certificado?id=${encodeURIComponent(asistenteId)}`,
      "certificado-asistencia.pdf"
    );
    if (fallo) setError(fallo);
    setGenerando(false);
  }

  return (
    <section className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--borde)] bg-white p-4">
      <div>
        <h3 className="text-sm font-semibold">Certificado de asistencia</h3>
        <p className="text-xs text-zinc-500">
          Check-in hecho: el asistente ya lo puede descargar en su área de cliente. Aquí lo descargas tú, sin enviarle
          nada.
        </p>
        {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
      </div>
      <button
        type="button"
        onClick={descargar}
        disabled={generando}
        className="rounded-md px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        style={{ background: "var(--balvert-azul-oscuro)" }}
      >
        {generando ? "Generando…" : "Descargar certificado"}
      </button>
    </section>
  );
}
