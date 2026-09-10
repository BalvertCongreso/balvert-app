"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import ContactoForm from "@/components/ContactoForm";
import type { ContactoNewsletterInput } from "@/types/database";

export default function NuevoContactoPage() {
  const router = useRouter();
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar(datos: ContactoNewsletterInput) {
    setGuardando(true);
    const { error } = await supabase.from("contactos_newsletter").insert(datos);
    setGuardando(false);
    if (error) {
      setError(
        error.message.includes("duplicate")
          ? "Ya existe un contacto con ese email."
          : error.message
      );
      return;
    }
    router.push("/contactos");
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/contactos"
          className="text-sm text-[var(--balvert-azul-oscuro)] hover:underline"
        >
          ← Volver al listado
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-[var(--balvert-marron)]">
          Nuevo contacto
        </h1>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          No se pudo guardar: {error}
        </div>
      )}

      <ContactoForm guardando={guardando} onGuardar={guardar} textoBoton="Crear contacto" />
    </div>
  );
}
