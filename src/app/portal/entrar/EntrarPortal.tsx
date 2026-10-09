"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import PortalMarco from "@/components/PortalMarco";

// Pantalla a la que lleva el enlace del email. El enlace NO se canjea al
// abrir la página (algunos gestores de correo abren los enlaces solos para
// revisarlos y lo gastarían): hace falta pulsar "Entrar".
export default function EntrarPortal({ token }: { token: string }) {
  const router = useRouter();
  const [entrando, setEntrando] = useState(false);
  const [error, setError] = useState<string | null>(token ? null : "Este enlace no es válido.");

  async function entrar() {
    setEntrando(true);
    setError(null);
    try {
      const res = await fetch("/api/portal/entrar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "No se pudo entrar.");
      router.replace("/portal/inicio");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado.");
      setEntrando(false);
    }
  }

  return (
    <PortalMarco subtitulo="Área de clientes">
      {error ? (
        <>
          <h1 className="mb-2 text-lg font-semibold text-zinc-800">No se ha podido entrar</h1>
          <p className="mb-6 text-sm text-zinc-600">
            {error} Los enlaces caducan a los 15 minutos y solo sirven una vez. Pide uno nuevo y te
            llegará en unos segundos.
          </p>
          <Link
            href="/portal"
            className="inline-block rounded-md bg-[var(--balvert-azul-oscuro)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
          >
            Pedir otro enlace
          </Link>
        </>
      ) : (
        <>
          <h1 className="mb-2 text-lg font-semibold text-zinc-800">Entrar en tu área</h1>
          <p className="mb-6 text-sm text-zinc-600">Pulsa el botón para acceder a tus entradas y documentos.</p>
          <button
            type="button"
            onClick={entrar}
            disabled={entrando}
            className="w-full rounded-md bg-[var(--balvert-azul-oscuro)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
          >
            {entrando ? "Entrando…" : "Entrar"}
          </button>
        </>
      )}
    </PortalMarco>
  );
}
