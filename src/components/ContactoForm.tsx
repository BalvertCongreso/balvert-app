"use client";

import { useState } from "react";
import { seccionesContacto } from "@/lib/contactoFields";
import type { ContactoNewsletterInput } from "@/types/database";

function valoresIniciales(): Record<string, string> {
  const valores: Record<string, string> = {};
  for (const seccion of seccionesContacto) {
    for (const campo of seccion.campos) {
      valores[campo.key] = "";
    }
  }
  return valores;
}

interface Props {
  valoresPrevios?: Record<string, string | number | null>;
  guardando: boolean;
  onGuardar: (datos: ContactoNewsletterInput) => void;
  textoBoton: string;
}

export default function ContactoForm({
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

  function actualizar(key: string, value: string) {
    setValores((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const datos: Record<string, string | null> = {};
    for (const [key, value] of Object.entries(valores)) {
      datos[key] = value === "" ? null : value;
    }
    onGuardar(datos as unknown as ContactoNewsletterInput);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-10">
      {seccionesContacto.map((seccion) => (
        <section key={seccion.titulo}>
          <h3 className="seccion-titulo">{seccion.titulo}</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            {seccion.campos.map((campo) => (
              <div key={campo.key}>
                <label className="campo-label" htmlFor={campo.key}>
                  {campo.label}
                </label>
                <input
                  id={campo.key}
                  className="campo-input"
                  type={
                    campo.tipo === "email"
                      ? "email"
                      : campo.tipo === "telefono"
                      ? "tel"
                      : "text"
                  }
                  value={valores[campo.key]}
                  onChange={(e) => actualizar(campo.key, e.target.value)}
                />
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
