"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { obtenerTodasLasFilas } from "@/lib/paginarTodo";
import { obtenerNombresPatrocinadores } from "@/lib/nombresPatrocinadores";
import { textoLegible } from "@/lib/exportarListado";
import type { CampoTipo, SeccionDef } from "@/lib/patrocinadorFields";

// Historial que guardan los triggers de 023_historial_cambios.sql. Solo se
// lee: la base de datos no deja escribir ni borrar en él desde la app.

interface Entrada {
  id: string;
  accion: "creado" | "modificado" | "borrado";
  cambios: Record<string, { antes: unknown; despues: unknown }>;
  autor: string;
  fecha: string;
}

interface Props {
  tabla: "patrocinadores" | "proveedores" | "asistentes_congreso" | "gala" | "excursion";
  registroId: string;
  secciones: SeccionDef[];
}

// Columnas que no están en los formularios.
const ETIQUETAS_EXTRA: Record<string, string> = {
  empresa_entidad: "Patrocinador vinculado",
  check_in_hecho: "Check-in hecho",
  check_in_fecha: "Fecha y hora del check-in",
  recibo_url: "Recibo de pago (enlace)",
};
// Internos: no se enseñan (qr_codigo ni siquiera se guarda).
const OCULTOS = new Set(["id", "edicion_id", "qr_codigo"]);
const LARGO_MAXIMO = 120;

function formatearFecha(iso: string) {
  return new Date(iso).toLocaleString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function Valor({ texto }: { texto: string | null }) {
  const [entero, setEntero] = useState(false);
  if (texto === null) return <span className="italic text-zinc-400">(vacío)</span>;
  if (texto.length <= LARGO_MAXIMO || entero) {
    return <span className="whitespace-pre-wrap break-words">{texto}</span>;
  }
  return (
    <span className="break-words">
      {texto.slice(0, LARGO_MAXIMO)}…{" "}
      <button
        type="button"
        onClick={() => setEntero(true)}
        className="text-xs font-medium text-[var(--balvert-azul-oscuro)] hover:underline"
      >
        ver entero
      </button>
    </span>
  );
}

const NOMBRE_ACCION: Record<Entrada["accion"], string> = {
  creado: "Creado",
  modificado: "Modificado",
  borrado: "Borrado",
};

export default function HistorialCambios({ tabla, registroId, secciones }: Props) {
  const [entradas, setEntradas] = useState<Entrada[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nombresPatro, setNombresPatro] = useState<Record<string, string>>({});
  const [abierto, setAbierto] = useState(false);

  const campos: Record<string, { label: string; tipo?: CampoTipo }> = {};
  for (const s of secciones) for (const c of s.campos) campos[c.key] = { label: c.label, tipo: c.tipo };
  for (const [key, label] of Object.entries(ETIQUETAS_EXTRA)) campos[key] ??= { label };

  useEffect(() => {
    if (!abierto || entradas) return;
    (async () => {
      try {
        const [filas, nombres] = await Promise.all([
          obtenerTodasLasFilas<Entrada>((desde, hasta) =>
            supabase
              .from("historial_cambios")
              .select("id, accion, cambios, autor, fecha")
              .eq("tabla", tabla)
              .eq("registro_id", registroId)
              .order("fecha", { ascending: false })
              .order("id", { ascending: true })
              .range(desde, hasta)
          ),
          tabla === "patrocinadores" ? Promise.resolve({}) : obtenerNombresPatrocinadores(),
        ]);
        setNombresPatro(nombres);
        setEntradas(filas);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error inesperado.");
      }
    })();
  }, [abierto, entradas, tabla, registroId]);

  function texto(campo: string, valor: unknown): string | null {
    // En asistentes es el id del patrocinador vinculado; en patrocinadores
    // es el propio nombre de la empresa.
    if (campo === "empresa_entidad" && tabla !== "patrocinadores" && typeof valor === "string") {
      return nombresPatro[valor] ?? "(patrocinador borrado)";
    }
    return textoLegible(valor, campos[campo]?.tipo);
  }

  // Orden de los campos: el del formulario; los demás, al final.
  const orden = Object.keys(campos);
  function camposOrdenados(cambios: Entrada["cambios"]) {
    return Object.keys(cambios)
      .filter((k) => !OCULTOS.has(k))
      .sort((a, b) => {
        const ia = orden.indexOf(a);
        const ib = orden.indexOf(b);
        return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib);
      });
  }

  return (
    <section className="rounded-lg border border-[var(--borde)] bg-white">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <h3 className="text-sm font-bold uppercase tracking-wide text-[var(--balvert-marron)]">Historial</h3>
        <span className="text-sm text-zinc-500">{abierto ? "Ocultar ▲" : "Ver ▼"}</span>
      </button>

      {abierto && (
        <div className="border-t border-[var(--borde)] px-4 py-4">
          {error && <p className="text-sm text-red-700">No se pudo cargar el historial: {error}</p>}
          {!error && !entradas && <p className="text-sm text-zinc-500">Cargando…</p>}
          {entradas && entradas.length === 0 && (
            <p className="text-sm text-zinc-500">
              Todavía no hay cambios registrados (el historial empezó el 10/10/2026).
            </p>
          )}
          {entradas && entradas.length > 0 && (
            <ol className="flex flex-col gap-4">
              {entradas.map((e) => {
                const claves = camposOrdenados(e.cambios);
                const lista = (
                  <ul className="mt-2 flex flex-col gap-1 text-sm">
                    {claves.map((k) => (
                      <li key={k} className="grid gap-1 sm:grid-cols-[minmax(10rem,14rem)_1fr]">
                        <span className="font-medium text-zinc-700">{campos[k]?.label ?? k}</span>
                        <span className="text-zinc-800">
                          {e.accion === "modificado" ? (
                            <>
                              <Valor texto={texto(k, e.cambios[k].antes)} />
                              <span className="mx-2 text-zinc-400">→</span>
                              <Valor texto={texto(k, e.cambios[k].despues)} />
                            </>
                          ) : (
                            <Valor
                              texto={texto(k, e.accion === "creado" ? e.cambios[k].despues : e.cambios[k].antes)}
                            />
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                );
                return (
                  <li key={e.id} className="border-l-2 border-[var(--borde)] pl-3">
                    <p className="text-sm">
                      <span className="font-semibold text-[var(--balvert-azul-oscuro)]">
                        {NOMBRE_ACCION[e.accion]}
                      </span>{" "}
                      <span className="text-zinc-500">
                        · {formatearFecha(e.fecha)} · {e.autor}
                      </span>
                    </p>
                    {e.accion === "modificado" ? (
                      lista
                    ) : claves.length > 0 ? (
                      <details className="mt-1">
                        <summary className="cursor-pointer text-xs text-zinc-500">
                          {e.accion === "creado" ? "Ver datos con los que se creó" : "Ver datos que tenía"}
                        </summary>
                        {lista}
                      </details>
                    ) : null}
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      )}
    </section>
  );
}
