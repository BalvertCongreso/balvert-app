"use client";

import { useEffect, useState } from "react";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Tipo = "congreso" | "gala" | "excursion";

const SECCIONES: { tipo: Tipo; titulo: string }[] = [
  { tipo: "congreso", titulo: "Congreso" },
  { tipo: "gala", titulo: "Gala" },
  { tipo: "excursion", titulo: "Excursión" },
];

const euros = (n: number) => n.toLocaleString("es-ES", { style: "currency", currency: "EUR" });

interface Precios {
  edicionNombre: string | null;
  precioCongreso: number | null;
  precioGala: number | null;
  precioExcursion: number | null;
}

const CAMPO_PRECIO: Record<Tipo, "precioCongreso" | "precioGala" | "precioExcursion"> = {
  congreso: "precioCongreso",
  gala: "precioGala",
  excursion: "precioExcursion",
};

function SeccionTipo({
  titulo,
  precio,
  nombres,
  onCambiar,
}: {
  titulo: string;
  precio: number | null;
  nombres: string[];
  onCambiar: (nombres: string[]) => void;
}) {
  if (precio === null || precio <= 0) {
    return (
      <div className="rounded-md border border-[var(--borde)] bg-zinc-50 p-4">
        <p className="text-sm font-semibold text-zinc-500">{titulo}</p>
        <p className="mt-1 text-sm text-zinc-400">Aún no disponible.</p>
      </div>
    );
  }

  function actualizarNombre(i: number, valor: string) {
    const copia = [...nombres];
    copia[i] = valor;
    onCambiar(copia);
  }

  function quitar(i: number) {
    onCambiar(nombres.filter((_, idx) => idx !== i));
  }

  return (
    <div className="rounded-md border border-[var(--borde)] bg-white p-4">
      <div className="flex items-baseline justify-between">
        <p className="text-sm font-semibold text-zinc-800">{titulo}</p>
        <p className="text-sm text-zinc-500">{euros(precio)} / persona</p>
      </div>

      <div className="mt-3 flex flex-col gap-2">
        {nombres.map((nombre, i) => (
          <div key={i} className="flex gap-2">
            <input
              type="text"
              className="campo-input flex-1"
              placeholder="Nombre completo"
              value={nombre}
              onChange={(e) => actualizarNombre(i, e.target.value)}
            />
            <button
              type="button"
              onClick={() => quitar(i)}
              className="rounded-md border border-[var(--borde)] px-3 text-sm text-zinc-500 hover:bg-zinc-50"
              aria-label="Quitar"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => onCambiar([...nombres, ""])}
        className="mt-3 text-sm font-medium text-[var(--balvert-azul-oscuro)] hover:underline"
      >
        + Añadir persona
      </button>
    </div>
  );
}

export default function EntradasPage() {
  const [precios, setPrecios] = useState<Precios | null>(null);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [telefono, setTelefono] = useState("");
  const [cargo, setCargo] = useState("");
  const [nombresPorTipo, setNombresPorTipo] = useState<Record<Tipo, string[]>>({
    congreso: [],
    gala: [],
    excursion: [],
  });

  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function cargar() {
      try {
        const res = await fetch("/api/entradas/precios");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "No se pudieron cargar los precios.");
        setPrecios(data);
      } catch (e) {
        setErrorCarga(e instanceof Error ? e.message : "Error inesperado.");
      }
    }
    cargar();
  }, []);

  const gruposActivos = SECCIONES.map((s) => ({
    tipo: s.tipo,
    nombres: nombresPorTipo[s.tipo].map((n) => n.trim()).filter((n) => n.length > 0),
  })).filter((g) => g.nombres.length > 0);

  const total =
    precios &&
    gruposActivos.reduce((suma, g) => {
      const precio = precios[CAMPO_PRECIO[g.tipo]] ?? 0;
      return suma + precio * g.nombres.length;
    }, 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!EMAIL_REGEX.test(email.trim())) {
      setError("Escribe un email con formato válido.");
      return;
    }
    if (gruposActivos.length === 0) {
      setError("Añade al menos el nombre de un asistente en algún tipo de entrada.");
      return;
    }

    setEnviando(true);
    try {
      const grupos: Partial<Record<Tipo, string[]>> = {};
      for (const g of gruposActivos) grupos[g.tipo] = g.nombres;

      const res = await fetch("/api/stripe/crear-sesion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          comprador_email: email.trim(),
          comprador_telefono: telefono.trim(),
          comprador_cargo: cargo.trim(),
          grupos,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo iniciar el pago.");
      window.location.href = data.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado.");
      setEnviando(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl">
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
              BALVERT {precios?.edicionNombre ? `— ${precios.edicionNombre}` : "2027"}
            </p>
            <p className="text-xs leading-tight text-zinc-500">Compra de entradas</p>
          </div>
        </div>

        <h1 className="mb-1 text-lg font-semibold text-zinc-800">Congreso, Gala y Excursión</h1>
        <p className="mb-6 text-sm text-zinc-600">
          Compra entradas para uno o varios de los eventos en un solo pago. Recibirás todas las
          entradas con código QR por email.
        </p>

        {errorCarga && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {errorCarga}
          </div>
        )}

        {!errorCarga && (
          <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            <div className="grid gap-4 sm:grid-cols-3">
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
                  Empresa
                </label>
                <input
                  id="cargo"
                  type="text"
                  className="campo-input"
                  placeholder="Opcional"
                  value={cargo}
                  onChange={(e) => setCargo(e.target.value)}
                />
              </div>
            </div>

            <div className="flex flex-col gap-3">
              {precios === null
                ? SECCIONES.map((s) => (
                    <div key={s.tipo} className="rounded-md border border-[var(--borde)] bg-zinc-50 p-4">
                      <p className="text-sm text-zinc-400">Cargando…</p>
                    </div>
                  ))
                : SECCIONES.map((s) => (
                    <SeccionTipo
                      key={s.tipo}
                      titulo={s.titulo}
                      precio={precios[CAMPO_PRECIO[s.tipo]]}
                      nombres={nombresPorTipo[s.tipo]}
                      onCambiar={(nombres) => setNombresPorTipo((prev) => ({ ...prev, [s.tipo]: nombres }))}
                    />
                  ))}
            </div>

            {total !== null && total !== undefined && total > 0 && (
              <div className="flex items-baseline justify-between border-t border-[var(--borde)] pt-4">
                <p className="text-sm font-semibold text-zinc-700">Total a pagar</p>
                <p className="text-lg font-bold text-[var(--balvert-marron)]">{euros(total)}</p>
              </div>
            )}

            {error && (
              <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
            )}

            <button
              type="submit"
              disabled={enviando || precios === null}
              className="rounded-md px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              style={{ background: "var(--balvert-azul-oscuro)" }}
            >
              {enviando ? "Redirigiendo al pago…" : "Ir al pago"}
            </button>
          </form>
        )}

        <p className="mt-6 text-xs leading-relaxed text-zinc-400">
          <strong>Privacidad:</strong> los datos de este formulario (email, teléfono, empresa y
          nombres de los asistentes) se usan únicamente para gestionar tu compra y el envío de
          las entradas de BALVERT 2027. Responsable del tratamiento: Garimper 22, organizadora
          del congreso. No se comparten con terceros ajenos a la organización del evento.
        </p>
      </div>
    </div>
  );
}
