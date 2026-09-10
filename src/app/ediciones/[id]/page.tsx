"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import EdicionForm from "@/components/EdicionForm";
import type { Edicion, EdicionInput } from "@/types/database";

export default function EditarEdicionPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [edicion, setEdicion] = useState<Edicion | null>(null);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function cargar() {
      const { data, error } = await supabase
        .from("ediciones")
        .select("*")
        .eq("id", id)
        .single();
      if (error) {
        setError(error.message);
      } else {
        setEdicion(data);
      }
      setCargando(false);
    }
    cargar();
  }, [id]);

  async function guardar(datos: EdicionInput) {
    setGuardando(true);

    if (datos.activa) {
      await supabase.from("ediciones").update({ activa: false }).neq("id", id as string);
    }

    const { error } = await supabase.from("ediciones").update(datos).eq("id", id);
    setGuardando(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push("/ediciones");
  }

  async function eliminar() {
    const ok = window.confirm(
      `¿Eliminar la edición "${edicion?.nombre ?? "esta edición"}"? Esta acción no se puede deshacer.`
    );
    if (!ok) return;
    const { error } = await supabase.from("ediciones").delete().eq("id", id);
    if (error) {
      setError(error.message);
      return;
    }
    router.push("/ediciones");
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between">
        <div>
          <Link
            href="/ediciones"
            className="text-sm text-[var(--balvert-azul-oscuro)] hover:underline"
          >
            ← Volver al listado
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-[var(--balvert-marron)]">
            {edicion?.nombre || "Editar edición"}
          </h1>
        </div>
        {edicion && (
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

      {!cargando && edicion && (
        <EdicionForm
          valoresPrevios={edicion as unknown as Record<string, string | number | boolean | null>}
          guardando={guardando}
          onGuardar={guardar}
          textoBoton="Guardar cambios"
        />
      )}
    </div>
  );
}
