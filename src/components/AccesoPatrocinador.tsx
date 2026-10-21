"use client";

import { useEffect, useState } from "react";
import { llamarApiGet, llamarApiJson } from "@/lib/apiCliente";
import { ORIGEN_PUBLICO } from "@/lib/dominio";

// Acceso de la empresa a su zona del portal (usuario y contraseña de la
// empresa, compartidos por su gente). La contraseña solo se ve una vez, en la
// ventana que sale al crearla o al generar una nueva.

interface Acceso {
  usuario: string;
  creado: string;
  actualizado: string;
  ultimo_acceso: string | null;
}

const fecha = (iso: string) =>
  new Date(iso).toLocaleString("es-ES", { timeZone: "Europe/Madrid", dateStyle: "short", timeStyle: "short" });

export function VentanaCredenciales({
  credenciales,
  onCerrar,
}: {
  credenciales: { usuario: string; contrasena: string };
  onCerrar: () => void;
}) {
  const [copiado, setCopiado] = useState(false);
  const texto = `Acceso a la zona de patrocinadores de BALVERT 2027\nEntra en: ${ORIGEN_PUBLICO}/portal (opción «Soy patrocinador»)\nUsuario: ${credenciales.usuario}\nContraseña: ${credenciales.contrasena}`;

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
    } catch {
      setCopiado(false);
    }
  }

  function cerrar() {
    if (!copiado && !window.confirm("¿Has guardado o enviado la contraseña? Después no se podrá volver a ver.")) return;
    onCerrar();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl">
        <h2 className="mb-2 text-lg font-semibold text-[var(--balvert-marron)]">Acceso de la empresa</h2>
        <p className="mb-4 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          Guárdalos o envíalos ahora: la contraseña no se volverá a mostrar.
        </p>
        <dl className="mb-4 grid grid-cols-[6rem_1fr] gap-2 text-sm">
          <dt className="text-zinc-500">Usuario</dt>
          <dd className="break-all font-mono font-semibold">{credenciales.usuario}</dd>
          <dt className="text-zinc-500">Contraseña</dt>
          <dd className="break-all font-mono font-semibold">{credenciales.contrasena}</dd>
          <dt className="text-zinc-500">Dónde</dt>
          <dd className="break-all">{ORIGEN_PUBLICO}/portal → «Soy patrocinador»</dd>
        </dl>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={copiar}
            className="rounded-md px-4 py-2 text-sm font-semibold text-white"
            style={{ background: "var(--balvert-azul-oscuro)" }}
          >
            {copiado ? "Copiado ✓" : "Copiar"}
          </button>
          <button type="button" onClick={cerrar} className="rounded-md border border-[var(--borde)] px-4 py-2 text-sm">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AccesoPatrocinador({ patrocinadorId }: { patrocinadorId: string }) {
  const [acceso, setAcceso] = useState<Acceso | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [trabajando, setTrabajando] = useState(false);
  const [credenciales, setCredenciales] = useState<{ usuario: string; contrasena: string } | null>(null);

  async function cargar() {
    try {
      const data = await llamarApiGet(`/api/patrocinadores/acceso?patrocinador_id=${encodeURIComponent(patrocinadorId)}`);
      setAcceso(data.acceso);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado.");
    }
  }

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patrocinadorId]);

  async function generar(modo: "crear" | "nueva") {
    if (
      modo === "nueva" &&
      !window.confirm("¿Generar una contraseña nueva? La actual dejará de valer y se cerrarán las sesiones abiertas de la empresa.")
    ) {
      return;
    }
    setError(null);
    setTrabajando(true);
    try {
      setCredenciales(await llamarApiJson("/api/patrocinadores/acceso", { patrocinador_id: patrocinadorId, modo }));
      await cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado.");
    }
    setTrabajando(false);
  }

  return (
    <section className="rounded-lg border border-[var(--borde)] bg-white p-4">
      <h3 className="seccion-titulo">Acceso a su zona</h3>
      <p className="mb-3 text-xs text-zinc-500">
        Usuario y contraseña de la empresa para su zona de patrocinador en {ORIGEN_PUBLICO}/portal. Los comparten las
        personas de la empresa y pueden cambiar la contraseña desde su zona.
      </p>
      {error && <div className="mb-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {acceso === undefined && !error && <p className="text-sm text-zinc-500">Cargando…</p>}
      {acceso === null && (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-zinc-600">Esta empresa todavía no tiene acceso.</p>
          <button
            type="button"
            onClick={() => generar("crear")}
            disabled={trabajando}
            className="rounded-md px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            style={{ background: "var(--balvert-azul-oscuro)" }}
          >
            {trabajando ? "Creando…" : "Crear acceso"}
          </button>
        </div>
      )}
      {acceso && (
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <div>
            <p>
              Usuario: <span className="font-mono font-semibold">{acceso.usuario}</span>
            </p>
            <p className="text-xs text-zinc-500">
              Contraseña cambiada por última vez: {fecha(acceso.actualizado)} · Último acceso:{" "}
              {acceso.ultimo_acceso ? fecha(acceso.ultimo_acceso) : "nunca"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => generar("nueva")}
            disabled={trabajando}
            className="rounded-md border border-[var(--borde)] px-4 py-2 text-sm font-medium text-[var(--balvert-azul-oscuro)] hover:bg-zinc-50 disabled:opacity-60"
          >
            {trabajando ? "Generando…" : "Generar contraseña nueva"}
          </button>
        </div>
      )}
      {credenciales && <VentanaCredenciales credenciales={credenciales} onCerrar={() => setCredenciales(null)} />}
    </section>
  );
}
