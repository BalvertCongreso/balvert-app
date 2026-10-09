"use client";

import { useState } from "react";
import PortalMarco from "@/components/PortalMarco";

// Entrada al portal de clientes: se pide el email y se manda un enlace de
// acceso. La respuesta es siempre la misma, exista o no el email.
export default function PortalPage() {
  const [email, setEmail] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setError(null);
    try {
      const res = await fetch("/api/portal/solicitar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "No se pudo enviar el enlace.");
      setMensaje(data.mensaje);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <PortalMarco subtitulo="Área de clientes">
      <h1 className="mb-1 text-lg font-semibold text-zinc-800">Accede a tu área</h1>
      <p className="mb-6 text-sm text-zinc-600">
        Para asistentes y empresas patrocinadoras. Escribe tu email y te mandaremos un enlace para
        entrar, sin contraseña.
      </p>

      {mensaje ? (
        <div className="rounded-md border border-[var(--borde)] bg-zinc-50 p-4 text-sm text-zinc-700">
          <p>{mensaje}</p>
          <button
            type="button"
            className="mt-3 text-sm font-medium text-[var(--balvert-azul-oscuro)] hover:underline"
            onClick={() => setMensaje(null)}
          >
            Usar otro email
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="campo-label" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              maxLength={254}
              className="campo-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
          )}
          <button
            type="submit"
            disabled={enviando}
            className="rounded-md bg-[var(--balvert-azul-oscuro)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
          >
            {enviando ? "Enviando…" : "Enviarme el enlace"}
          </button>
        </form>
      )}
    </PortalMarco>
  );
}
