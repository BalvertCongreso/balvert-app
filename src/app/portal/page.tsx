"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import PortalMarco from "@/components/PortalMarco";

// Entrada al portal: dos accesos distintos. Patrocinadores, con el usuario y
// la contraseña de la empresa (zona de empresa, /portal/empresa). Asistentes,
// con un enlace al email (zona personal, /portal/inicio); la respuesta es
// siempre la misma, exista o no el email.
type Opcion = "patrocinador" | "asistente";

export default function PortalPage() {
  const [opcion, setOpcion] = useState<Opcion | null>(null);
  return (
    <PortalMarco subtitulo="Área de clientes">
      <h1 className="mb-1 text-lg font-semibold text-zinc-800">Accede a tu área</h1>
      <p className="mb-5 text-sm text-zinc-600">Elige cómo quieres entrar.</p>
      <div className="mb-6 grid gap-3 sm:grid-cols-2">
        {(
          [
            ["patrocinador", "Soy patrocinador", "Usuario y contraseña de tu empresa"],
            ["asistente", "Soy asistente", "Te enviamos un enlace a tu email"],
          ] as const
        ).map(([id, titulo, ayuda]) => (
          <button
            key={id}
            type="button"
            onClick={() => setOpcion(id)}
            aria-pressed={opcion === id}
            className={`min-h-11 rounded-md border p-3 text-left text-sm ${
              opcion === id
                ? "border-[var(--balvert-azul-oscuro)] bg-sky-50"
                : "border-[var(--borde)] hover:bg-zinc-50"
            }`}
          >
            <span className="block font-semibold text-zinc-800">{titulo}</span>
            <span className="text-zinc-600">{ayuda}</span>
          </button>
        ))}
      </div>
      {opcion === "patrocinador" && <EntrarEmpresa />}
      {opcion === "asistente" && <PedirEnlace />}
    </PortalMarco>
  );
}

function EntrarEmpresa() {
  const router = useRouter();
  const [usuario, setUsuario] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [entrando, setEntrando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setEntrando(true);
    setError(null);
    try {
      const res = await fetch("/api/portal/empresa/entrar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuario, contrasena }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "No se pudo entrar.");
      router.replace("/portal/empresa");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado.");
      setEntrando(false);
    }
  }

  return (
    <form onSubmit={entrar} className="flex flex-col gap-4">
      <div>
        <label className="campo-label" htmlFor="usuario">
          Usuario
        </label>
        <input
          id="usuario"
          required
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={60}
          className="campo-input"
          value={usuario}
          onChange={(e) => setUsuario(e.target.value)}
        />
      </div>
      <div>
        <label className="campo-label" htmlFor="contrasena">
          Contraseña
        </label>
        <input
          id="contrasena"
          type="password"
          required
          autoComplete="current-password"
          maxLength={200}
          className="campo-input"
          value={contrasena}
          onChange={(e) => setContrasena(e.target.value)}
        />
      </div>
      {error && <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      <button
        type="submit"
        disabled={entrando}
        className="rounded-md bg-[var(--balvert-azul-oscuro)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
      >
        {entrando ? "Entrando…" : "Entrar"}
      </button>
      <p className="text-xs text-zinc-500">
        ¿No tienes el usuario o la contraseña? Escríbenos a secretaria@balvert.es.
      </p>
    </form>
  );
}

function PedirEnlace() {
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
    <>
      <p className="mb-4 text-sm text-zinc-600">
        Escribe el email con el que tienes tu entrada y te mandaremos un enlace para entrar, sin contraseña.
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
    </>
  );
}
