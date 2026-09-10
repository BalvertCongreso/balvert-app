"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import ProspectoForm from "@/components/ProspectoForm";
import ProspectoContactos from "@/components/ProspectoContactos";
import type { ProspectoPatrocinio, ProspectoPatrocinioInput } from "@/types/database";

export default function EditarProspectoPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [prospecto, setProspecto] = useState<ProspectoPatrocinio | null>(null);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function cargar() {
      const { data, error } = await supabase
        .from("prospectos_patrocinio")
        .select("*")
        .eq("id", id)
        .single();
      if (error) {
        setError(error.message);
      } else {
        setProspecto(data);
      }
      setCargando(false);
    }
    cargar();
  }, [id]);

  async function guardar(datos: ProspectoPatrocinioInput) {
    setGuardando(true);
    const { error } = await supabase.from("prospectos_patrocinio").update(datos).eq("id", id);
    setGuardando(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push("/captacion");
  }

  async function eliminar() {
    const ok = window.confirm(
      `¿Eliminar el prospecto "${prospecto?.empresa_entidad ?? "este prospecto"}"? Esta acción no se puede deshacer.`
    );
    if (!ok) return;
    const { error } = await supabase.from("prospectos_patrocinio").delete().eq("id", id);
    if (error) {
      setError(error.message);
      return;
    }
    router.push("/captacion");
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between">
        <div>
          <Link
            href="/captacion"
            className="text-sm text-[var(--balvert-azul-oscuro)] hover:underline"
          >
            ← Volver al listado
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-[var(--balvert-marron)]">
            {prospecto?.empresa_entidad || "Editar prospecto"}
          </h1>
        </div>
        {prospecto && (
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

      {!cargando && prospecto && (
        <ProspectoForm
          valoresPrevios={prospecto as unknown as Record<string, string | number | null>}
          guardando={guardando}
          onGuardar={guardar}
          textoBoton="Guardar cambios"
        />
      )}

      {!cargando && prospecto && <ProspectoContactos prospectoId={prospecto.id} />}
    </div>
  );
}
