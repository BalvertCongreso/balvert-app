"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { obtenerEdicionActiva } from "@/lib/edicionActiva";
import TareaForm from "@/components/TareaForm";
import type { Edicion, TareaInput } from "@/types/database";

export default function NuevaTareaPage() {
  const router = useRouter();
  const [edicion, setEdicion] = useState<Edicion | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    obtenerEdicionActiva().then(setEdicion);
  }, []);

  async function guardar(datos: TareaInput) {
    setGuardando(true);
    const { error } = await supabase
      .from("tareas")
      .insert({ ...datos, edicion_id: edicion?.id ?? null });
    setGuardando(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push("/tareas");
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/tareas"
          className="text-sm text-[var(--balvert-azul-oscuro)] hover:underline"
        >
          ← Volver al listado
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-[var(--balvert-marron)]">
          Nueva tarea
        </h1>
        {edicion?.nombre && (
          <p className="mt-1 text-xs text-zinc-400">
            Se guardará en la edición activa: {edicion.nombre}
          </p>
        )}
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          No se pudo guardar: {error}
        </div>
      )}

      <TareaForm guardando={guardando} onGuardar={guardar} textoBoton="Crear tarea" />
    </div>
  );
}
