"use client";

import { useState } from "react";
import { seccionesEdicion } from "@/lib/edicionFields";
import type { EdicionInput } from "@/types/database";

const camposNumericos = new Set(["anio", "precio_congreso", "precio_gala", "precio_excursion"]);
const camposBooleanos = new Set(["activa"]);

function valorParaInput(valor: string | number | boolean | null | undefined, esFechaHora: boolean): string {
  if (valor === null || valor === undefined) return "";
  const texto = String(valor);
  return esFechaHora ? texto.slice(0, 16) : texto;
}

function valoresIniciales(): Record<string, string> {
  const valores: Record<string, string> = {};
  for (const seccion of seccionesEdicion) {
    for (const campo of seccion.campos) {
      valores[campo.key] = campo.tipo === "booleano" ? "false" : "";
    }
  }
  return valores;
}

interface Props {
  valoresPrevios?: Record<string, string | number | boolean | null>;
  guardando: boolean;
  onGuardar: (datos: EdicionInput) => void;
  textoBoton: string;
}

export default function EdicionForm({
  valoresPrevios,
  guardando,
  onGuardar,
  textoBoton,
}: Props) {
  const [valores, setValores] = useState<Record<string, string>>(() => {
    const base = valoresIniciales();
    if (valoresPrevios) {
      for (const seccion of seccionesEdicion) {
        for (const campo of seccion.campos) {
          const v = valoresPrevios[campo.key];
          if (campo.tipo === "booleano") {
            base[campo.key] = v ? "true" : "false";
          } else {
            base[campo.key] = valorParaInput(v, campo.tipo === "fecha-hora");
          }
        }
      }
    }
    return base;
  });

  function actualizar(key: string, value: string) {
    setValores((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const datos: Record<string, string | number | boolean | null> = {};
    for (const [key, value] of Object.entries(valores)) {
      if (camposBooleanos.has(key)) {
        datos[key] = value === "true";
      } else if (value === "") {
        datos[key] = null;
      } else if (camposNumericos.has(key)) {
        datos[key] = Number(value);
      } else {
        datos[key] = value;
      }
    }
    onGuardar(datos as unknown as EdicionInput);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-10">
      {seccionesEdicion.map((seccion) => (
        <section key={seccion.titulo}>
          <h3 className="seccion-titulo">{seccion.titulo}</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            {seccion.campos.map((campo) => (
              <div key={campo.key} className={campo.tipo === "booleano" ? "sm:col-span-2" : ""}>
                {campo.tipo === "booleano" ? (
                  <label className="flex items-center gap-2 text-sm font-medium">
                    <input
                      type="checkbox"
                      checked={valores[campo.key] === "true"}
                      onChange={(e) => actualizar(campo.key, e.target.checked ? "true" : "false")}
                    />
                    {campo.label}
                  </label>
                ) : (
                  <>
                    <label className="campo-label" htmlFor={campo.key}>
                      {campo.label}
                    </label>
                    <input
                      id={campo.key}
                      className="campo-input"
                      type={
                        campo.tipo === "numero"
                          ? "number"
                          : campo.tipo === "fecha"
                          ? "date"
                          : campo.tipo === "fecha-hora"
                          ? "datetime-local"
                          : "text"
                      }
                      value={valores[campo.key]}
                      onChange={(e) => actualizar(campo.key, e.target.value)}
                    />
                  </>
                )}
                {campo.nota && <p className="mt-1 text-xs italic text-zinc-400">{campo.nota}</p>}
              </div>
            ))}
          </div>
        </section>
      ))}

      <div className="sticky bottom-0 flex justify-end gap-3 border-t border-[var(--borde)] bg-white/95 py-4">
        <button
          type="submit"
          disabled={guardando}
          className="rounded-md px-5 py-2 text-sm font-semibold text-white disabled:opacity-60"
          style={{ background: "var(--balvert-azul-oscuro)" }}
        >
          {guardando ? "Guardando…" : textoBoton}
        </button>
      </div>
    </form>
  );
}
