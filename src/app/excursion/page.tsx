"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { obtenerEdicionActiva } from "@/lib/edicionActiva";
import { obtenerTodasLasFilas } from "@/lib/paginarTodo";
import { seccionesExcursion } from "@/lib/excursionFields";
import { obtenerNombresPatrocinadores } from "@/lib/nombresPatrocinadores";
import {
  columnasDesdeSecciones,
  coincideBusqueda,
  textoRecuento,
  type CampoBusqueda,
  type ColumnaExport,
} from "@/lib/exportarListado";
import HerramientasListado from "@/components/HerramientasListado";
import type { Edicion, Excursion } from "@/types/database";

// El patrocinador vinculado se guarda como id: se busca y se descarga por su nombre.
function camposBusqueda(nombresPatro: Record<string, string>): CampoBusqueda<Excursion>[] {
  return [
    "nombre_asistente",
    "documento_identidad",
    "email_asistente",
    "cargo",
    "categoria_patrocinio",
    "tipo_entrada",
    "confirmado",
    (a) => (a.empresa_entidad ? nombresPatro[a.empresa_entidad] : null),
  ];
}

function columnas(nombresPatro: Record<string, string>): ColumnaExport<Excursion>[] {
  return columnasDesdeSecciones<Excursion>(seccionesExcursion, [
    {
      key: "empresa_entidad",
      label: "Patrocinador vinculado",
      despuesDe: "cargo",
      valor: (a) => (a.empresa_entidad ? nombresPatro[a.empresa_entidad] ?? "(patrocinador borrado)" : null),
    },
    { key: "check_in_hecho", label: "Check-in hecho" },
    { key: "check_in_fecha", label: "Fecha y hora del check-in" },
  ]);
}

export default function ExcursionPage() {
  const [asistentes, setAsistentes] = useState<Excursion[]>([]);
  const [edicion, setEdicion] = useState<Edicion | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [nombresPatro, setNombresPatro] = useState<Record<string, string>>({});

  async function cargar() {
    setCargando(true);
    const edicionActiva = await obtenerEdicionActiva();
    setEdicion(edicionActiva);

    try {
      const datos = await obtenerTodasLasFilas<Excursion>((desde, hasta) => {
        let query = supabase
          .from("excursion")
          .select("*")
          .order("nombre_asistente", { ascending: true })
          .order("id", { ascending: true });
        if (edicionActiva) {
          query = query.eq("edicion_id", edicionActiva.id);
        }
        return query.range(desde, hasta);
      });
      setNombresPatro(await obtenerNombresPatrocinadores());
      setError(null);
      setAsistentes(datos);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado.");
    }
    setCargando(false);
  }

  useEffect(() => {
    cargar();
  }, []);

  async function eliminar(id: string, nombre: string | null) {
    const ok = window.confirm(
      `¿Eliminar a "${nombre ?? "este asistente"}"? Esta acción no se puede deshacer.`
    );
    if (!ok) return;

    const { error } = await supabase.from("excursion").delete().eq("id", id);
    if (error) {
      alert("No se pudo eliminar: " + error.message);
      return;
    }
    setAsistentes((prev) => prev.filter((a) => a.id !== id));
  }

  const filtrados = asistentes.filter((a) => coincideBusqueda(a, camposBusqueda(nombresPatro), busqueda));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--balvert-marron)]">Excursión</h1>
          <p className="text-sm text-zinc-600">
            {textoRecuento(cargando, filtrados.length, asistentes.length, "asistente(s)")}
            {edicion?.nombre && (
              <span className="ml-2 rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-500">
                Edición: {edicion.nombre}
              </span>
            )}
          </p>
        </div>
        <Link
          href="/excursion/nuevo"
          className="rounded-md px-4 py-2 text-sm font-semibold text-white"
          style={{ background: "var(--balvert-azul-oscuro)" }}
        >
          + Añadir asistente
        </Link>
      </div>

      <HerramientasListado
        busqueda={busqueda}
        onBusqueda={setBusqueda}
        placeholder="Buscar por nombre, documento, email, empresa, estado…"
        descarga={{
          filas: filtrados,
          columnas: columnas(nombresPatro),
          pantalla: "Excursión",
          edicion: edicion?.nombre,
        }}
      />

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          No se pudieron cargar los asistentes: {error}
        </div>
      )}

      {!error && (
        <div className="overflow-x-auto rounded-lg border border-[var(--borde)] bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 text-xs uppercase text-zinc-500">
              <tr>
                <th className="px-4 py-3">Nombre</th>
                <th className="px-4 py-3">Tipo de entrada</th>
                <th className="px-4 py-3">Confirmado</th>
                <th className="px-4 py-3">Precio</th>
                <th className="px-4 py-3">Entrada enviada</th>
                <th className="px-4 py-3">Check-in</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((a) => (
                <tr key={a.id} className="border-t border-[var(--borde)]">
                  <td className="px-4 py-3 font-medium">
                    {a.nombre_asistente ?? "(sin nombre)"}
                    {a.email_asistente && (
                      <span className="block text-xs text-zinc-500">{a.email_asistente}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">{a.tipo_entrada ?? "—"}</td>
                  <td className="px-4 py-3">{a.confirmado ?? "—"}</td>
                  <td className="px-4 py-3">{a.precio != null ? `${a.precio} €` : "—"}</td>
                  <td className="px-4 py-3">{a.entrada_enviada ?? "—"}</td>
                  <td className="px-4 py-3">{a.check_in_hecho === "Sí" ? "✅ Sí" : "—"}</td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/excursion/${a.id}`}
                      className="mr-3 font-medium text-[var(--balvert-azul-oscuro)] hover:underline"
                    >
                      Editar
                    </Link>
                    <button
                      onClick={() => eliminar(a.id, a.nombre_asistente)}
                      className="font-medium text-red-600 hover:underline"
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
              {!cargando && filtrados.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-zinc-500">
                    {asistentes.length === 0
                      ? "Todavía no hay asistentes a la excursión. Añade el primero con el botón de arriba."
                      : "Sin resultados para esa búsqueda."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
