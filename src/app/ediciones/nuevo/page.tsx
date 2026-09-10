"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import EdicionForm from "@/components/EdicionForm";
import type { EdicionInput } from "@/types/database";

export default function NuevaEdicionPage() {
  const router = useRouter();
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar(datos: EdicionInput) {
    setGuardando(true);

    // Si se marca esta edición como activa desde el alta, desmarcamos las
    // demás primero para que nunca haya dos activas a la vez.
    if (datos.activa) {
      await supabase.from("ediciones").update({ activa: false }).neq("id", "00000000-0000-0000-0000-000000000000");
    }

    const { error } = await supabase.from("ediciones").insert(datos);
    setGuardando(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push("/ediciones");
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/ediciones"
          className="text-sm text-[var(--balvert-azul-oscuro)] hover:underline"
        >
          ← Volver al listado
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-[var(--balvert-marron)]">Nueva edición</h1>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          No se pudo guardar: {error}
        </div>
      )}

      <EdicionForm guardando={guardando} onGuardar={guardar} textoBoton="Crear edición" />
    </div>
  );
}
