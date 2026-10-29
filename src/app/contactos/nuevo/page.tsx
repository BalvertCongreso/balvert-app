"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { normalizarEmail } from "@/lib/exclusiones";
import ContactoForm from "@/components/ContactoForm";
import type { ContactoNewsletter, ContactoNewsletterInput } from "@/types/database";

export default function NuevoContactoPage() {
  const router = useRouter();
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [avisoExcluido, setAvisoExcluido] = useState<Pick<ContactoNewsletter, "id" | "motivo_exclusion"> | null>(null);

  async function guardar(datos: ContactoNewsletterInput) {
    setGuardando(true);
    setError(null);
    const email = normalizarEmail(datos.email);
    // Si el email ya está y está excluido de envíos, se actualizan sus datos
    // pero sigue excluido (no se crea otro ni se reactiva).
    if (email) {
      const { data: existente } = await supabase
        .from("contactos_newsletter")
        .select("id, estado, motivo_exclusion")
        .eq("email", email)
        .maybeSingle<Pick<ContactoNewsletter, "id" | "estado" | "motivo_exclusion">>();
      if (existente?.estado === "Excluido") {
        // Solo lo que se ha rellenado: un campo vacío aquí no borra el que ya tenía.
        const rellenados = Object.fromEntries(
          Object.entries(datos).filter(([, v]) => v !== null && v !== "" && v !== false)
        );
        const { error } = await supabase
          .from("contactos_newsletter")
          .update({ ...rellenados, email })
          .eq("id", existente.id);
        setGuardando(false);
        if (error) setError(error.message);
        else setAvisoExcluido({ id: existente.id, motivo_exclusion: existente.motivo_exclusion });
        return;
      }
    }
    const { error } = await supabase.from("contactos_newsletter").insert({ ...datos, email: email || null });
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

      {avisoExcluido && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Este email está excluido de envíos ({avisoExcluido.motivo_exclusion?.toLowerCase() ?? "sin motivo"}). Sus
          datos se han actualizado, pero sigue sin recibir boletines.{" "}
          <Link href={`/contactos/${avisoExcluido.id}`} className="font-semibold underline">
            Ver su ficha
          </Link>
        </div>
      )}

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          No se pudo guardar: {error}
        </div>
      )}

      {!avisoExcluido && (
        <ContactoForm guardando={guardando} onGuardar={guardar} textoBoton="Crear contacto" />
      )}
    </div>
  );
}
