"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import PatrocinadorForm from "@/components/PatrocinadorForm";
import type { PatrocinadorInput } from "@/types/database";

export default function NuevoPatrocinadorPage() {
  const router = useRouter();
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar(datos: PatrocinadorInput) {
    setGuardando(true);
    const { error } = await supabase.from("patrocinadores").insert(datos);
    setGuardando(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push("/patrocinadores");
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/patrocinadores"
          className="text-sm text-[var(--balvert-azul-oscuro)] hover:underline"
        >
          ← Volver al listado
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-[var(--balvert-marron)]">
          Nuevo patrocinador
        </h1>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          No se pudo guardar: {error}
        </div>
      )}

      <PatrocinadorForm guardando={guardando} onGuardar={guardar} textoBoton="Crear patrocinador" />
    </div>
  );
}
