"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { seccionesCongreso } from "@/lib/congresoFields";
import InscripcionForm from "@/components/InscripcionForm";
import EntradaQR from "@/components/EntradaQR";
import type { AsistenteCongreso } from "@/types/database";

export default function EditarAsistenteCongresoPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [asistente, setAsistente] = useState<AsistenteCongreso | null>(null);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function cargar() {
      const { data, error } = await supabase
        .from("asistentes_congreso")
        .select("*")
        .eq("id", id)
        .single();
      if (error) {
        setError(error.message);
      } else {
        setAsistente(data);
      }
      setCargando(false);
    }
    cargar();
  }, [id]);

  async function guardar(datos: Record<string, string | number | null>) {
    setGuardando(true);
    const { error } = await supabase.from("asistentes_congreso").update(datos).eq("id", id);
    setGuardando(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push("/congreso");
  }

  async function eliminar() {
    const ok = window.confirm(
      `¿Eliminar a "${asistente?.nombre ?? "este asistente"}"? Esta acción no se puede deshacer.`
    );
    if (!ok) return;
    const { error } = await supabase.from("asistentes_congreso").delete().eq("id", id);
    if (error) {
      setError(error.message);
      return;
    }
    router.push("/congreso");
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between">
        <div>
          <Link
            href="/congreso"
            className="text-sm text-[var(--balvert-azul-oscuro)] hover:underline"
          >
            ← Volver al listado
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-[var(--balvert-marron)]">
            {asistente?.nombre || "Editar asistente"}
          </h1>
        </div>
        {asistente && (
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

      {!cargando && asistente && (
        <>
          <EntradaQR
            tabla="congreso"
            registroId={asistente.id}
            qrCodigo={asistente.qr_codigo}
            nombre={asistente.nombre}
            email={asistente.email}
            entradaEnviada={asistente.entrada_enviada}
            onActualizado={(datos) =>
              setAsistente((prev) => (prev ? { ...prev, ...datos } : prev))
            }
          />
          <InscripcionForm
            secciones={seccionesCongreso}
            valoresPrevios={asistente as unknown as Record<string, string | number | null>}
            guardando={guardando}
            onGuardar={guardar}
            textoBoton="Guardar cambios"
          />
        </>
      )}
    </div>
  );
}
