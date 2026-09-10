"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import ProveedorForm from "@/components/ProveedorForm";
import type { Proveedor, ProveedorInput } from "@/types/database";

export default function EditarProveedorPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [proveedor, setProveedor] = useState<Proveedor | null>(null);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function cargar() {
      const { data, error } = await supabase
        .from("proveedores")
        .select("*")
        .eq("id", id)
        .single();
      if (error) {
        setError(error.message);
      } else {
        setProveedor(data);
      }
      setCargando(false);
    }
    cargar();
  }, [id]);

  async function guardar(datos: ProveedorInput) {
    setGuardando(true);
    const { error } = await supabase.from("proveedores").update(datos).eq("id", id);
    setGuardando(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push("/proveedores");
  }

  async function eliminar() {
    const ok = window.confirm(
      `¿Eliminar a "${proveedor?.nombre_proveedor ?? "este proveedor"}"? Esta acción no se puede deshacer.`
    );
    if (!ok) return;
    const { error } = await supabase.from("proveedores").delete().eq("id", id);
    if (error) {
      setError(error.message);
      return;
    }
    router.push("/proveedores");
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between">
        <div>
          <Link
            href="/proveedores"
            className="text-sm text-[var(--balvert-azul-oscuro)] hover:underline"
          >
            ← Volver al listado
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-[var(--balvert-marron)]">
            {proveedor?.nombre_proveedor || "Editar proveedor"}
          </h1>
        </div>
        {proveedor && (
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

      {!cargando && proveedor && (
        <ProveedorForm
          valoresPrevios={proveedor as unknown as Record<string, string | number | null>}
          guardando={guardando}
          onGuardar={guardar}
          textoBoton="Guardar cambios"
        />
      )}
    </div>
  );
}
