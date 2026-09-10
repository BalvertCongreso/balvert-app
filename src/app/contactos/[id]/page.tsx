"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import ContactoForm from "@/components/ContactoForm";
import type { ContactoNewsletter, ContactoNewsletterInput } from "@/types/database";

export default function EditarContactoPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [contacto, setContacto] = useState<ContactoNewsletter | null>(null);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function cargar() {
      const { data, error } = await supabase
        .from("contactos_newsletter")
        .select("*")
        .eq("id", id)
        .single();
      if (error) {
        setError(error.message);
      } else {
        setContacto(data);
      }
      setCargando(false);
    }
    cargar();
  }, [id]);

  async function guardar(datos: ContactoNewsletterInput) {
    setGuardando(true);
    const { error } = await supabase.from("contactos_newsletter").update(datos).eq("id", id);
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

  async function eliminar() {
    const nombre = [contacto?.nombre, contacto?.apellidos].filter(Boolean).join(" ");
    const ok = window.confirm(
      `¿Eliminar a "${nombre || "este contacto"}"? Esta acción no se puede deshacer.`
    );
    if (!ok) return;
    const { error } = await supabase.from("contactos_newsletter").delete().eq("id", id);
    if (error) {
      setError(error.message);
      return;
    }
    router.push("/contactos");
  }

  const nombreCompleto = [contacto?.nombre, contacto?.apellidos].filter(Boolean).join(" ");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between">
        <div>
          <Link
            href="/contactos"
            className="text-sm text-[var(--balvert-azul-oscuro)] hover:underline"
          >
            ← Volver al listado
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-[var(--balvert-marron)]">
            {nombreCompleto || "Editar contacto"}
          </h1>
        </div>
        {contacto && (
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

      {!cargando && contacto && (
        <ContactoForm
          valoresPrevios={contacto as unknown as Record<string, string | number | null>}
          guardando={guardando}
          onGuardar={guardar}
          textoBoton="Guardar cambios"
        />
      )}
    </div>
  );
}
