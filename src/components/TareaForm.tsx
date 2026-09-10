"use client";

import { useState } from "react";
import { seccionesTarea } from "@/lib/tareaFields";
import BuscadorPatrocinador from "@/components/BuscadorPatrocinador";
import type { TareaInput } from "@/types/database";

function valoresIniciales(): Record<string, string> {
  const valores: Record<string, string> = {};
  for (const seccion of seccionesTarea) {
    for (const campo of seccion.campos) {
      valores[campo.key] = "";
    }
  }
  return valores;
}

interface Props {
  valoresPrevios?: Record<string, string | number | null>;
  guardando: boolean;
  onGuardar: (datos: TareaInput) => void;
  textoBoton: string;
}

export default function TareaForm({
  valoresPrevios,
  guardando,
  onGuardar,
  textoBoton,
}: Props) {
  const [valores, setValores] = useState<Record<string, string>>(() => {
    const base = valoresIniciales();
    if (valoresPrevios) {
      for (const key of Object.keys(base)) {
        const v = valoresPrevios[key];
        base[key] = v === null || v === undefined ? "" : String(v);
      }
    }
    return base;
  });

  const [entidadId, setEntidadId] = useState<string | null>(
    (valoresPrevios?.entidad_relacionada as string | null | undefined) ?? null
  );

  function actualizar(key: string, value: string) {
    setValores((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const datos: Record<string, string | number | null> = {};
    for (const [key, value] of Object.entries(valores)) {
      datos[key] = value === "" ? null : value;
    }
    datos.entidad_relacionada = entidadId;
    onGuardar(datos as unknown as TareaInput);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-10">
      <section>
        <h3 className="seccion-titulo">Entidad relacionada</h3>
        <BuscadorPatrocinador valorId={entidadId} onSeleccionar={(p) => setEntidadId(p?.id ?? null)} />
      </section>

      {seccionesTarea.map((seccion) => (
        <section key={seccion.titulo}>
          <h3 className="seccion-titulo">{seccion.titulo}</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            {seccion.campos.map((campo) => (
              <div
                key={campo.key}
                className={campo.tipo === "texto-largo" ? "sm:col-span-2" : ""}
              >
                <label className="campo-label" htmlFor={campo.key}>
                  {campo.label}
                </label>
                {campo.tipo === "select" ? (
                  <select
                    id={campo.key}
                    className="campo-input"
                    value={valores[campo.key]}
                    onChange={(e) => actualizar(campo.key, e.target.value)}
                  >
                    <option value=""></option>
                    {campo.opciones?.map((op) => (
                      <option key={op} value={op}>
                        {op}
                      </option>
                    ))}
                  </select>
                ) : campo.tipo === "texto-largo" ? (
                  <textarea
                    id={campo.key}
                    className="campo-input"
                    rows={3}
                    value={valores[campo.key]}
                    onChange={(e) => actualizar(campo.key, e.target.value)}
                  />
                ) : (
                  <input
                    id={campo.key}
                    className="campo-input"
                    type={campo.tipo === "fecha" ? "date" : "text"}
                    value={valores[campo.key]}
                    onChange={(e) => actualizar(campo.key, e.target.value)}
                  />
                )}
                {campo.nota && (
                  <p className="mt-1 text-xs italic text-zinc-400">{campo.nota}</p>
                )}
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
