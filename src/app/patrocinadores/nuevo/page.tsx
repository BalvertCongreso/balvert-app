"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { obtenerEdicionActiva } from "@/lib/edicionActiva";
import PatrocinadorForm from "@/components/PatrocinadorForm";
import InvitadosPatrocinador, { type InvitadoPendiente } from "@/components/InvitadosPatrocinador";
import { llamarApiJson } from "@/lib/apiCliente";
import type { Edicion, PatrocinadorInput } from "@/types/database";

export default function NuevoPatrocinadorPage() {
  const router = useRouter();
  const [edicion, setEdicion] = useState<Edicion | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invitados, setInvitados] = useState<InvitadoPendiente[]>([]);
  const [categoria, setCategoria] = useState<string | null>(null);
  const [numIncluidas, setNumIncluidas] = useState<number | null>(null);

  useEffect(() => {
    obtenerEdicionActiva().then(setEdicion);
  }, []);

  async function guardar(datos: PatrocinadorInput) {
    setGuardando(true);
    const { data: creado, error } = await supabase
      .from("patrocinadores")
      .insert({ ...datos, edicion_id: edicion?.id ?? null })
      .select("id")
      .single();
    if (error || !creado) {
      setGuardando(false);
      setError(error?.message ?? "No se pudo crear.");
      return;
    }
    if (invitados.length === 0) {
      router.push("/patrocinadores");
      return;
    }
    // Los invitados apuntados se guardan (y se les manda la entrada) ahora que
    // ya hay ficha. Después se abre la ficha para ver cómo ha ido cada uno.
    for (const inv of invitados) {
      try {
        await llamarApiJson("/api/patrocinadores/invitados", { patrocinador_id: creado.id, ...inv });
      } catch {
        // El que falle no aparecerá en la lista de la ficha: se vuelve a añadir allí.
      }
    }
    router.push(`/patrocinadores/${creado.id}`);
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

      <InvitadosPatrocinador
        pendientes={invitados}
        onPendientes={setInvitados}
        categoria={categoria}
        numIncluidas={numIncluidas}
      />

      <PatrocinadorForm
        onValoresCambio={(v) => {
          setCategoria(v.categoria || null);
          setNumIncluidas(v.num_invitaciones_incluidas ? Number(v.num_invitaciones_incluidas) : null);
        }}
        historialEmail={edicion ? { tabla: "patrocinadores", edicionId: edicion.id, registroId: null } : undefined}
        guardando={guardando}
        onGuardar={guardar}
        textoBoton="Crear patrocinador"
      />
    </div>
  );
}
