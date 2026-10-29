"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import ContactoForm from "@/components/ContactoForm";
import type { Boletin, ContactoBoletin, ContactoNewsletter, ContactoNewsletterInput } from "@/types/database";

type FilaHistorico = ContactoBoletin & { boletines: Pick<Boletin, "asunto" | "fecha_envio" | "enviado_desde"> | null };

function fechaCorta(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-ES", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Madrid" });
}

const COLOR_RESULTADO: Record<string, string> = {
  Enviado: "bg-green-50 text-green-700",
  "Rebote temporal": "bg-amber-50 text-amber-700",
  Rebote: "bg-red-50 text-red-700",
  Baja: "bg-red-50 text-red-700",
};

export default function EditarContactoPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [contacto, setContacto] = useState<ContactoNewsletter | null>(null);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [historico, setHistorico] = useState<FilaHistorico[]>([]);
  const [cambiandoEstado, setCambiandoEstado] = useState(false);

  useEffect(() => {
    async function cargar() {
      const [{ data, error }, { data: filas, error: errorHistorico }] = await Promise.all([
        supabase.from("contactos_newsletter").select("*").eq("id", id).single(),
        supabase
          .from("contacto_boletines")
          .select("*, boletines(asunto, fecha_envio, enviado_desde)")
          .eq("contacto_id", id)
          .order("fecha", { ascending: false }),
      ]);
      if (error) {
        setError(error.message);
      } else {
        setContacto(data);
      }
      if (!errorHistorico) setHistorico((filas ?? []) as FilaHistorico[]);
      setCargando(false);
    }
    cargar();
  }, [id]);

  async function cambiarEstado(excluir: boolean) {
    if (!contacto) return;
    const ok = window.confirm(
      excluir
        ? "¿Excluir de envíos a este contacto? Seguirá en Contactos (motivo «Manual») pero no recibirá ningún boletín."
        : `¿Volver a activar a este contacto? Volverá a recibir boletines.${
            contacto.motivo_exclusion === "Rebote" || contacto.motivo_exclusion === "Baja"
              ? `\n\nSe excluyó por ${contacto.motivo_exclusion.toLowerCase()}. Si se excluyeron por rebote o baja, volver a enviarles puede perjudicar la entrega de los boletines.`
              : ""
          }`
    );
    if (!ok) return;
    setCambiandoEstado(true);
    const cambios = excluir
      ? { estado: "Excluido", motivo_exclusion: "Manual", fecha_exclusion: new Date().toISOString() }
      : { estado: "Activo", motivo_exclusion: null, fecha_exclusion: null };
    const { data, error } = await supabase
      .from("contactos_newsletter")
      .update(cambios)
      .eq("id", id)
      .select("*")
      .single();
    setCambiandoEstado(false);
    if (error) setError(error.message);
    else setContacto(data);
  }

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
      `¿Eliminar a "${nombre || "este contacto"}"? Esta acción no se puede deshacer.` +
        (contacto?.estado === "Excluido"
          ? "\n\nOjo: está excluido de envíos. Si lo eliminas, la app deja de saber que no debe recibir boletines y podría volver a entrar. Es mejor dejarlo como excluido."
          : "")
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
        <section className="flex flex-col gap-4 rounded-lg border border-[var(--borde)] bg-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex flex-col gap-1 text-sm">
              <h3 className="seccion-titulo">Envíos de boletines</h3>
              {contacto.estado === "Excluido" ? (
                <p>
                  <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700">
                    Excluido de envíos
                  </span>{" "}
                  Motivo: <strong>{contacto.motivo_exclusion}</strong> · desde el {fechaCorta(contacto.fecha_exclusion)}. No
                  recibe ningún boletín.
                </p>
              ) : (
                <p>
                  <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-semibold text-green-700">Activo</span>{" "}
                  Recibe los boletines.
                </p>
              )}
              <p className="text-zinc-600">
                Rebotes temporales: <strong>{contacto.rebotes_temporales}</strong>
                {contacto.fecha_ultimo_rebote_temporal &&
                  ` · el último, el ${fechaCorta(contacto.fecha_ultimo_rebote_temporal)}`}
              </p>
            </div>
            {contacto.estado === "Excluido" ? (
              <button
                type="button"
                onClick={() => cambiarEstado(false)}
                disabled={cambiandoEstado}
                className="rounded-md border border-[var(--borde)] px-4 py-2 text-sm font-semibold text-[var(--balvert-azul-oscuro)] hover:bg-zinc-50 disabled:opacity-50"
              >
                Volver a activar
              </button>
            ) : (
              <button
                type="button"
                onClick={() => cambiarEstado(true)}
                disabled={cambiandoEstado}
                className="rounded-md border border-amber-300 px-4 py-2 text-sm font-semibold text-amber-800 hover:bg-amber-50 disabled:opacity-50"
              >
                Excluir de envíos
              </button>
            )}
          </div>

          <div>
            <h4 className="mb-2 text-sm font-semibold text-zinc-700">Histórico de boletines</h4>
            {historico.length === 0 ? (
              <p className="text-sm text-zinc-500">Todavía no consta ningún boletín enviado a este contacto.</p>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase text-zinc-500">
                  <tr>
                    <th className="py-2 pr-4">Boletín</th>
                    <th className="py-2 pr-4">Fecha</th>
                    <th className="py-2">Resultado</th>
                  </tr>
                </thead>
                <tbody>
                  {historico.map((h) => (
                    <tr key={h.id} className="border-t border-[var(--borde)]">
                      <td className="py-2 pr-4">
                        {h.boletines?.asunto || "(sin asunto)"}
                        {h.boletines?.enviado_desde === "Mailrelay" && (
                          <span className="ml-1 text-xs text-zinc-400">(desde el panel de Mailrelay)</span>
                        )}
                      </td>
                      <td className="py-2 pr-4 whitespace-nowrap">{fechaCorta(h.fecha)}</td>
                      <td className="py-2">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${COLOR_RESULTADO[h.resultado] ?? ""}`}>
                          {h.resultado}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      )}

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
