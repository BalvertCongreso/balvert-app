"use client";

import { useState } from "react";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function InscripcionCongresoPage() {
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [telefono, setTelefono] = useState("");
  const [cargo, setCargo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<{ enviado: boolean; aviso?: string } | null>(null);

  function validar(): string | null {
    if (!nombre.trim()) return "El nombre es obligatorio.";
    if (!EMAIL_REGEX.test(email.trim())) return "Escribe un email con formato válido.";
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errorValidacion = validar();
    if (errorValidacion) {
      setError(errorValidacion);
      return;
    }
    setError(null);
    setEnviando(true);
    try {
      const res = await fetch("/api/inscripcion-congreso", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: nombre.trim(),
          email: email.trim(),
          telefono: telefono.trim(),
          cargo: cargo.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "No se pudo completar la inscripción.");
      }
      setResultado({ enviado: data.enviado, aviso: data.aviso });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado.");
    } finally {
      setEnviando(false);
    }
  }

  if (resultado) {
    return (
      <div className="mx-auto w-full max-w-md">
        <div className="rounded-lg border border-[var(--borde)] bg-white p-8 text-center shadow-sm">
          <h1 className="mb-3 text-xl font-bold text-[var(--balvert-marron)]">
            ¡Inscripción recibida!
          </h1>
          {resultado.enviado ? (
            <p className="text-sm text-zinc-600">
              Te hemos enviado tu entrada con código QR por email. Preséntala (en el móvil
              o impresa) el día del congreso.
            </p>
          ) : (
            <p className="text-sm text-zinc-600">
              Tu inscripción se ha guardado correctamente, pero no hemos podido enviarte el
              email automáticamente. Escríbenos si no recibes tu entrada en breve.
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-md">
      <div className="rounded-lg border border-[var(--borde)] bg-white p-8 shadow-sm">
        <div className="mb-6 flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-md text-sm font-bold text-white"
            style={{
              background: "linear-gradient(135deg, var(--balvert-azul), var(--balvert-marron))",
            }}
          >
            B
          </div>
          <div>
            <p className="text-sm font-bold leading-tight text-[var(--balvert-marron)]">
              BALVERT 2027
            </p>
            <p className="text-xs leading-tight text-zinc-500">Inscripción al Congreso</p>
          </div>
        </div>

        <h1 className="mb-1 text-lg font-semibold text-zinc-800">Inscripción al Congreso</h1>
        <p className="mb-6 text-sm text-zinc-600">
          Para asistentes independientes (sin patrocinador). Recibirás tu entrada con
          código QR por email.
        </p>

        {error && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="campo-label" htmlFor="nombre">
              Nombre *
            </label>
            <input
              id="nombre"
              type="text"
              required
              className="campo-input"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
            />
          </div>
          <div>
            <label className="campo-label" htmlFor="email">
              Email *
            </label>
            <input
              id="email"
              type="email"
              required
              className="campo-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="campo-label" htmlFor="telefono">
              Teléfono
            </label>
            <input
              id="telefono"
              type="tel"
              className="campo-input"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
            />
          </div>
          <div>
            <label className="campo-label" htmlFor="cargo">
              Cargo
            </label>
            <input
              id="cargo"
              type="text"
              className="campo-input"
              value={cargo}
              onChange={(e) => setCargo(e.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={enviando}
            className="mt-2 rounded-md px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            style={{ background: "var(--balvert-azul-oscuro)" }}
          >
            {enviando ? "Enviando…" : "Inscribirme"}
          </button>
        </form>

        <p className="mt-6 text-xs leading-relaxed text-zinc-400">
          <strong>Privacidad:</strong> los datos de este formulario (nombre, email,
          teléfono y cargo) se usan únicamente para gestionar tu inscripción y tu entrada
          al Congreso BALVERT 2027, incluyendo el envío de la entrada por email.
          Responsable del tratamiento: Garimper 22, organizadora del congreso. No se
          comparten con terceros ajenos a la organización del evento. Si vuelves a
          inscribirte con el mismo email, tus datos se actualizarán en vez de crear una
          inscripción duplicada.
        </p>
      </div>
    </div>
  );
}
