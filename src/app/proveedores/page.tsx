"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { obtenerEdicionActiva } from "@/lib/edicionActiva";
import { obtenerTodasLasFilas } from "@/lib/paginarTodo";
import { seccionesProveedor } from "@/lib/proveedorFields";
import { columnasDesdeSecciones, coincideBusqueda, textoRecuento } from "@/lib/exportarListado";
import HerramientasListado from "@/components/HerramientasListado";
import type { Edicion, Proveedor } from "@/types/database";

const CAMPOS_BUSQUEDA: (keyof Proveedor)[] = [
  "nombre_proveedor",
  "servicio_prestado",
  "persona_contacto",
  "email_contacto",
  "telefono_contacto",
  "evento_vinculado",
  "numero_factura",
];

const COLUMNAS = columnasDesdeSecciones<Proveedor>(seccionesProveedor);

export default function ProveedoresPage() {
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [edicion, setEdicion] = useState<Edicion | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");

  async function cargar() {
    setCargando(true);
    const edicionActiva = await obtenerEdicionActiva();
    setEdicion(edicionActiva);

    try {
      const datos = await obtenerTodasLasFilas<Proveedor>((desde, hasta) => {
        let query = supabase
          .from("proveedores")
          .select("*")
          .order("nombre_proveedor", { ascending: true })
          .order("id", { ascending: true });
        if (edicionActiva) {
          query = query.eq("edicion_id", edicionActiva.id);
        }
        return query.range(desde, hasta);
      });
      setError(null);
      setProveedores(datos);
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
      `¿Eliminar a "${nombre ?? "este proveedor"}"? Esta acción no se puede deshacer.`
    );
    if (!ok) return;

    const { error } = await supabase.from("proveedores").delete().eq("id", id);
    if (error) {
      alert("No se pudo eliminar: " + error.message);
      return;
    }
    setProveedores((prev) => prev.filter((p) => p.id !== id));
  }

  const filtrados = proveedores.filter((a) => coincideBusqueda(a, CAMPOS_BUSQUEDA, busqueda));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--balvert-marron)]">
            Proveedores
          </h1>
          <p className="text-sm text-zinc-600">
            {textoRecuento(cargando, filtrados.length, proveedores.length, "proveedor(es)")}
            {edicion?.nombre && (
              <span className="ml-2 rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-500">
                Edición: {edicion.nombre}
              </span>
            )}
          </p>
        </div>
        <Link
          href="/proveedores/nuevo"
          className="rounded-md px-4 py-2 text-sm font-semibold text-white"
          style={{ background: "var(--balvert-azul-oscuro)" }}
        >
          + Añadir proveedor
        </Link>
      </div>

      <HerramientasListado
        busqueda={busqueda}
        onBusqueda={setBusqueda}
        placeholder="Buscar por proveedor, servicio, contacto, email, teléfono…"
        descarga={{
          filas: filtrados,
          columnas: COLUMNAS,
          pantalla: "Proveedores",
          edicion: edicion?.nombre,
        }}
      />

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          No se pudieron cargar los proveedores: {error}
          <br />
          Comprueba que has ejecutado la migración{" "}
          <code>supabase/migrations/003_proveedores.sql</code>.
        </div>
      )}

      {!error && (
        <div className="overflow-x-auto rounded-lg border border-[var(--borde)] bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 text-xs uppercase text-zinc-500">
              <tr>
                <th className="px-4 py-3">Proveedor</th>
                <th className="px-4 py-3">Servicio</th>
                <th className="px-4 py-3">Evento vinculado</th>
                <th className="px-4 py-3">Coste acordado</th>
                <th className="px-4 py-3">Factura pagada</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((p) => (
                <tr key={p.id} className="border-t border-[var(--borde)]">
                  <td className="px-4 py-3 font-medium">
                    {p.nombre_proveedor ?? "(sin nombre)"}
                    {p.persona_contacto && (
                      <span className="block text-xs text-zinc-500">
                        {p.persona_contacto}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">{p.servicio_prestado ?? "—"}</td>
                  <td className="px-4 py-3">{p.evento_vinculado ?? "—"}</td>
                  <td className="px-4 py-3">
                    {p.coste_acordado != null ? `${p.coste_acordado} €` : "—"}
                  </td>
                  <td className="px-4 py-3">{p.factura_pagada ?? "—"}</td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/proveedores/${p.id}`}
                      className="mr-3 font-medium text-[var(--balvert-azul-oscuro)] hover:underline"
                    >
                      Editar
                    </Link>
                    <button
                      onClick={() => eliminar(p.id, p.nombre_proveedor)}
                      className="font-medium text-red-600 hover:underline"
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
              {!cargando && filtrados.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-zinc-500">
                    {proveedores.length === 0
                      ? "Todavía no hay proveedores. Añade el primero con el botón de arriba."
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
