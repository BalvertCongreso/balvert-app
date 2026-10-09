"use client";

import { useEffect, useState } from "react";
import { nombreTieneApellidos, validarDocumento } from "@/lib/documentoIdentidad";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Tipo = "congreso" | "gala" | "excursion";

const SECCIONES: { tipo: Tipo; titulo: string }[] = [
  { tipo: "congreso", titulo: "Congreso" },
  { tipo: "gala", titulo: "Cena de gala" },
  { tipo: "excursion", titulo: "Excursión" },
];

const euros = (n: number) => n.toLocaleString("es-ES", { style: "currency", currency: "EUR" });

const MENUS = ["Carne", "Pescado", "Vegetariano", "Vegano"] as const;

// Mismos topes que comprueba /api/stripe/crear-sesion.
const MAX_NOMBRE = 150;
const MAX_ALERGIAS = 500;
const MAX_COLEGIO = 150;
const MAX_NUMERO_COLEGIADO = 50;

interface Precios {
  edicionNombre: string | null;
  precioCongreso: number | null;
  precioGala: number | null;
  precioExcursion: number | null;
  precioCongresoColegiado: number | null;
}

interface Persona {
  nombre: string;
  documento: string;
  // Gala
  menu: string;
  alergias: string;
  // Congreso
  colegiado: boolean;
  colegio: string;
  numeroColegiado: string;
}

const personaVacia = (): Persona => ({
  nombre: "",
  documento: "",
  menu: "",
  alergias: "",
  colegiado: false,
  colegio: "",
  numeroColegiado: "",
});

const CAMPO_PRECIO: Record<Tipo, "precioCongreso" | "precioGala" | "precioExcursion"> = {
  congreso: "precioCongreso",
  gala: "precioGala",
  excursion: "precioExcursion",
};

const hayPrecio = (p: number | null | undefined): p is number => p !== null && p !== undefined && p > 0;

function SeccionTipo({
  tipo,
  titulo,
  precio,
  precioColegiado,
  personas,
  onCambiar,
}: {
  tipo: Tipo;
  titulo: string;
  precio: number | null;
  // Solo Congreso; null = no se ofrece la casilla "Soy colegiado".
  precioColegiado: number | null;
  personas: Persona[];
  onCambiar: (personas: Persona[]) => void;
}) {
  if (!hayPrecio(precio)) {
    return (
      <div className="rounded-md border border-[var(--borde)] bg-zinc-50 p-4">
        <p className="text-sm font-semibold text-zinc-500">{titulo}</p>
        <p className="mt-1 text-sm text-zinc-400">Aún no disponible.</p>
      </div>
    );
  }

  function actualizar(i: number, cambios: Partial<Persona>) {
    onCambiar(personas.map((p, idx) => (idx === i ? { ...p, ...cambios } : p)));
  }

  function quitar(i: number) {
    onCambiar(personas.filter((_, idx) => idx !== i));
  }

  return (
    <div className="rounded-md border border-[var(--borde)] bg-white p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <p className="text-sm font-semibold text-zinc-800">{titulo}</p>
        <p className="text-sm text-zinc-500">
          {euros(precio)} / persona
          {precioColegiado !== null && ` · ${euros(precioColegiado)} colegiados`}
        </p>
      </div>

      <div className="mt-3 flex flex-col gap-3">
        {personas.map((persona, i) => (
          <div
            key={i}
            className={`flex flex-col gap-2 ${tipo !== "excursion" ? "rounded-md border border-[var(--borde)] p-3" : ""}`}
          >
            <div className="flex gap-2">
              <input
                type="text"
                className="campo-input flex-1"
                placeholder="Nombre y apellidos *"
                maxLength={MAX_NOMBRE}
                value={persona.nombre}
                onChange={(e) => actualizar(i, { nombre: e.target.value })}
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

            <input
              type="text"
              className="campo-input"
              placeholder="Documento de identidad (DNI, NIE o pasaporte) *"
              aria-label="Documento de identidad (DNI, NIE o pasaporte)"
              autoComplete="off"
              maxLength={30}
              value={persona.documento}
              onChange={(e) => actualizar(i, { documento: e.target.value })}
            />

            {tipo === "gala" && (
              <div className="grid gap-2 sm:grid-cols-[12rem_1fr]">
                <select
                  className="campo-input"
                  aria-label="Menú"
                  value={persona.menu}
                  onChange={(e) => actualizar(i, { menu: e.target.value })}
                >
                  <option value="">Menú *</option>
                  {MENUS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  className="campo-input"
                  placeholder="Alergias o intolerancias (opcional)"
                  maxLength={MAX_ALERGIAS}
                  value={persona.alergias}
                  onChange={(e) => actualizar(i, { alergias: e.target.value })}
                />
              </div>
            )}

            {tipo === "congreso" && precioColegiado !== null && (
              <>
                <label className="flex items-center gap-2 text-sm text-zinc-700">
                  <input
                    type="checkbox"
                    checked={persona.colegiado}
                    onChange={(e) => actualizar(i, { colegiado: e.target.checked })}
                  />
                  Soy colegiado ({euros(precioColegiado)})
                </label>
                {persona.colegiado && (
                  <div className="grid gap-2 sm:grid-cols-2">
                    <input
                      type="text"
                      className="campo-input"
                      placeholder="Colegio *"
                      maxLength={MAX_COLEGIO}
                      value={persona.colegio}
                      onChange={(e) => actualizar(i, { colegio: e.target.value })}
                    />
                    <input
                      type="text"
                      className="campo-input"
                      placeholder="Número de colegiado *"
                      maxLength={MAX_NUMERO_COLEGIADO}
                      value={persona.numeroColegiado}
                      onChange={(e) => actualizar(i, { numeroColegiado: e.target.value })}
                    />
                  </div>
                )}
              </>
            )}
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => onCambiar([...personas, personaVacia()])}
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
  const [personasPorTipo, setPersonasPorTipo] = useState<Record<Tipo, Persona[]>>({
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

  const precioColegiado = hayPrecio(precios?.precioCongresoColegiado) ? precios!.precioCongresoColegiado : null;

  // Personas con nombre (las filas vacías no cuentan). Si la edición no tiene
  // precio de colegiado, la casilla se ignora aunque se hubiera marcado.
  const gruposActivos = SECCIONES.map((s) => ({
    tipo: s.tipo,
    personas: personasPorTipo[s.tipo]
      .map((p) => ({ ...p, nombre: p.nombre.trim(), colegiado: s.tipo === "congreso" && precioColegiado !== null && p.colegiado }))
      .filter((p) => p.nombre.length > 0),
  })).filter((g) => g.personas.length > 0);

  const total =
    precios &&
    gruposActivos.reduce((suma, g) => {
      const precio = precios[CAMPO_PRECIO[g.tipo]] ?? 0;
      return suma + g.personas.reduce((s, p) => s + (p.colegiado ? precioColegiado ?? 0 : precio), 0);
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
    for (const g of gruposActivos) {
      for (const p of g.personas) {
        const seccion = SECCIONES.find((s) => s.tipo === g.tipo)!.titulo;
        if (!nombreTieneApellidos(p.nombre)) {
          setError(`Escribe nombre y apellidos de "${p.nombre}" en ${seccion}.`);
          return;
        }
        if (!p.documento.trim()) {
          setError(`Indica el documento de identidad de ${p.nombre} (${seccion}).`);
          return;
        }
        if (!validarDocumento(p.documento)) {
          setError(
            `El documento de identidad de ${p.nombre} (${seccion}) no es válido. Revisa el DNI/NIE (la letra debe ser la correcta) o el pasaporte.`
          );
          return;
        }
        if (g.tipo === "gala" && !p.menu) {
          setError(`Elige el menú de ${p.nombre} para la Cena de gala.`);
          return;
        }
        if (g.tipo === "congreso" && p.colegiado && (!p.colegio.trim() || !p.numeroColegiado.trim())) {
          setError(`Indica el colegio y el número de colegiado de ${p.nombre}.`);
          return;
        }
      }
    }

    setEnviando(true);
    try {
      // Solo se mandan los datos de cada persona; el precio lo calcula
      // siempre el servidor.
      const grupos: Partial<Record<Tipo, Record<string, unknown>[]>> = {};
      for (const g of gruposActivos) {
        grupos[g.tipo] = g.personas.map((p) =>
          g.tipo === "congreso"
            ? {
                nombre: p.nombre,
                documento_identidad: p.documento,
                colegiado_profesional: p.colegiado,
                nombre_colegio: p.colegiado ? p.colegio.trim() : null,
                numero_colegiado: p.colegiado ? p.numeroColegiado.trim() : null,
              }
            : g.tipo === "gala"
            ? { nombre: p.nombre, documento_identidad: p.documento, menu: p.menu, alergias_intolerancias: p.alergias.trim() }
            : { nombre: p.nombre, documento_identidad: p.documento }
        );
      }

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

        <h1 className="mb-1 text-lg font-semibold text-zinc-800">Congreso, Cena de gala y Excursión</h1>
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
                      tipo={s.tipo}
                      titulo={s.titulo}
                      precio={precios[CAMPO_PRECIO[s.tipo]]}
                      precioColegiado={s.tipo === "congreso" ? precioColegiado : null}
                      personas={personasPorTipo[s.tipo]}
                      onCambiar={(personas) => setPersonasPorTipo((prev) => ({ ...prev, [s.tipo]: personas }))}
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
          <strong>Privacidad:</strong> los datos de este formulario (email, teléfono, empresa,
          nombres y apellidos de los asistentes, menú, alergias o intolerancias y datos de
          colegiado) se usan únicamente para gestionar tu compra y el envío de las entradas de
          BALVERT 2027. El documento de identidad (DNI, NIE o pasaporte) de cada asistente se
          recoge para identificarle en el acceso, emitir el justificante o certificado de
          asistencia y para la facturación. Responsable del tratamiento: Garimper 22,
          organizadora del congreso. No se comparten con terceros ajenos a la organización del
          evento.
        </p>
      </div>
    </div>
  );
}
