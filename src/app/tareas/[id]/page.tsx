"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import TareaForm from "@/components/TareaForm";
import TareaComentarios from "@/components/TareaComentarios";
import type { Tarea, TareaInput } from "@/types/database";

export default function EditarTareaPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [tarea, setTarea] = useState<Tarea | null>(null);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function cargar() {
      const { data, error } = await supabase
        .from("tareas")
        .select("*")
        .eq("id", id)
        .single();
      if (error) {
        setError(error.message);
      } else {
        setTarea(data);
      }
      setCargando(false);
    }
    cargar();
  }, [id]);

  async function guardar(datos: TareaInput) {
    setGuardando(true);
    const { error } = await supabase.from("tareas").update(datos).eq("id", id);
    setGuardando(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push("/tareas");
  }

  async function eliminar() {
    const ok = window.confirm(
      `¿Eliminar la tarea "${tarea?.tarea ?? "esta tarea"}"? Esta acción no se puede deshacer.`
    );
    if (!ok) return;
    const { error } = await supabase.from("tareas").delete().eq("id", id);
    if (error) {
      setError(error.message);
      return;
    }
    router.push("/tareas");
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between">
        <div>
          <Link
            href="/tareas"
            className="text-sm text-[var(--balvert-azul-oscuro)] hover:underline"
          >
            ← Volver al listado
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-[var(--balvert-marron)]">
            {tarea?.tarea || "Editar tarea"}
          </h1>
        </div>
        {tarea && (
          <button
            onClick={eliminar}
            className="rounded-md border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"
          >
            Eliminar
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {cargando && <p className="text-sm text-zinc-500">Cargando…</p>}

      {!cargando && tarea && (
        <TareaForm
          valoresPrevios={tarea as unknown as Record<string, string | number | null>}
          guardando={guardando}
          onGuardar={guardar}
          textoBoton="Guardar cambios"
        />
      )}

      {!cargando && tarea && <TareaComentarios tareaId={tarea.id} />}
    </div>
  );
}
