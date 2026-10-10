"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { descargarCsv, descargarExcel, type OpcionesDescarga } from "@/lib/exportarListado";

interface Props<T> {
  busqueda: string;
  onBusqueda: (texto: string) => void;
  placeholder: string;
  // Lo que se descarga: las filas que se están viendo (con filtros y búsqueda).
  descarga: OpcionesDescarga<T>;
  // Filtros propios de la pantalla (origen, estado…), junto al buscador.
  children?: ReactNode;
}

export default function HerramientasListado<T>({
  busqueda,
  onBusqueda,
  placeholder,
  descarga,
  children,
}: Props<T>) {
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [generando, setGenerando] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuAbierto) return;
    function cerrar(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuAbierto(false);
    }
    document.addEventListener("mousedown", cerrar);
    return () => document.removeEventListener("mousedown", cerrar);
  }, [menuAbierto]);

  async function descargar(formato: "xlsx" | "csv") {
    setMenuAbierto(false);
    setGenerando(true);
    try {
      if (formato === "xlsx") await descargarExcel(descarga);
      else descargarCsv(descarga);
    } catch (e) {
      alert("No se pudo generar el archivo: " + (e instanceof Error ? e.message : String(e)));
    }
    setGenerando(false);
  }

  const sinFilas = descarga.filas.length === 0;

  return (
    <div className="flex flex-wrap items-center gap-3">
      <input
        type="search"
        className="campo-input max-w-sm"
        placeholder={placeholder}
        value={busqueda}
        onChange={(e) => onBusqueda(e.target.value)}
      />
      {children}
      <div ref={menuRef} className="relative ml-auto">
        <button
          type="button"
          onClick={() => setMenuAbierto((v) => !v)}
          disabled={sinFilas || generando}
          title={sinFilas ? "No hay filas que descargar" : "Descarga las filas que se ven ahora"}
          className="rounded-md border border-[var(--borde)] bg-white px-4 py-2 text-sm font-semibold text-[var(--balvert-azul-oscuro)] hover:bg-zinc-50 disabled:opacity-50"
        >
          {generando ? "Generando…" : `⬇ Descargar (${descarga.filas.length})`}
        </button>
        {menuAbierto && (
          <div className="absolute right-0 z-10 mt-1 w-48 overflow-hidden rounded-md border border-[var(--borde)] bg-white text-sm shadow-lg">
            <button
              type="button"
              onClick={() => descargar("xlsx")}
              className="block w-full px-4 py-2 text-left hover:bg-zinc-50"
            >
              Excel (.xlsx)
            </button>
            <button
              type="button"
              onClick={() => descargar("csv")}
              className="block w-full px-4 py-2 text-left hover:bg-zinc-50"
            >
              CSV (.csv)
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
