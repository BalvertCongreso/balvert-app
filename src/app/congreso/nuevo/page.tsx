"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { obtenerEdicionActiva } from "@/lib/edicionActiva";
import { seccionesCongreso } from "@/lib/congresoFields";
import InscripcionForm from "@/components/InscripcionForm";
import type { Edicion } from "@/types/database";

export default function NuevoAsistenteCongresoPage() {
  const router = useRouter();
  const [edicion, setEdicion] = useState<Edicion | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    obtenerEdicionActiva().then(setEdicion);
  }, []);

  async function guardar(datos: Record<string, string | number | null>) {
    setGuardando(true);
    const { error } = await supabase
      .from("asistentes_congreso")
      .insert({ ...datos, edicion_id: edicion?.id ?? null });
    setGuardando(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push("/congreso");
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/congreso"
          className="text-sm text-[var(--balvert-azul-oscuro)] hover:underline"
        >
          ← Volver al listado
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-[var(--balvert-marron)]">
          Nuevo asistente al congreso
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

      <InscripcionForm
        secciones={seccionesCongreso}
        guardando={guardando}
        onGuardar={guardar}
        textoBoton="Crear asistente"
      />
    </div>
  );
}
