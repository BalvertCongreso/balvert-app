"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { obtenerTodasLasFilas } from "@/lib/paginarTodo";
import type { ContactoNewsletter } from "@/types/database";

export default function ContactosPage() {
  const [contactos, setContactos] = useState<ContactoNewsletter[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [filtroOrigen, setFiltroOrigen] = useState("");

  async function cargar() {
    setCargando(true);
    try {
      const datos = await obtenerTodasLasFilas<ContactoNewsletter>((desde, hasta) =>
        supabase
          .from("contactos_newsletter")
          .select("*")
          .order("apellidos", { ascending: true, nullsFirst: false })
          .order("id", { ascending: true })
          .range(desde, hasta)
      );
      setError(null);
      setContactos(datos);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado.");
    }
    setCargando(false);
  }

  useEffect(() => {
    cargar();
  }, []);

  async function eliminar(id: string, nombre: string | null) {
    const ok = window.confirm(
      `¿Eliminar a "${nombre ?? "este contacto"}"? Esta acción no se puede deshacer.`
    );
    if (!ok) return;

    const { error } = await supabase.from("contactos_newsletter").delete().eq("id", id);
    if (error) {
      alert("No se pudo eliminar: " + error.message);
      return;
    }
    setContactos((prev) => prev.filter((c) => c.id !== id));
  }

  const origenesDisponibles = Array.from(
    new Set(contactos.map((c) => c.origen_lista).filter((o): o is string => Boolean(o)))
  ).sort();

  const textoBusqueda = busqueda.trim().toLowerCase();
  const filtrados = contactos.filter((c) => {
    if (filtroOrigen && c.origen_lista !== filtroOrigen) return false;
    if (!textoBusqueda) return true;
    const texto = `${c.nombre ?? ""} ${c.apellidos ?? ""} ${c.email ?? ""}`.toLowerCase();
    return texto.includes(textoBusqueda);
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--balvert-marron)]">Contactos</h1>
          <p className="text-sm text-zinc-600">
            {cargando
              ? "Cargando…"
              : filtrados.length === contactos.length
              ? `${contactos.length} contacto(s)`
              : `${filtrados.length} de ${contactos.length} contacto(s)`}
          </p>
        </div>
        <Link
          href="/contactos/nuevo"
          className="rounded-md px-4 py-2 text-sm font-semibold text-white"
          style={{ background: "var(--balvert-azul-oscuro)" }}
        >
          + Añadir contacto
        </Link>
      </div>

      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          className="campo-input max-w-sm"
          placeholder="Buscar por nombre, apellidos o email…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
        <select
          className="campo-input max-w-xs"
          value={filtroOrigen}
          onChange={(e) => setFiltroOrigen(e.target.value)}
        >
          <option value="">Todos los orígenes</option>
          {origenesDisponibles.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          No se pudieron cargar los contactos: {error}
          <br />
          Comprueba que has ejecutado la migración{" "}
          <code>supabase/migrations/011_contactos_newsletter.sql</code>.
        </div>
      )}

      {!error && (
        <div className="overflow-x-auto rounded-lg border border-[var(--borde)] bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 text-xs uppercase text-zinc-500">
              <tr>
                <th className="px-4 py-3">Nombre</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Teléfono</th>
                <th className="px-4 py-3">Origen</th>
                <th className="px-4 py-3">Empresa</th>
                <th className="px-4 py-3">Entidad pública</th>
                <th className="px-4 py-3">Colegiado</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((c) => (
                <tr key={c.id} className="border-t border-[var(--borde)]">
                  <td className="px-4 py-3 font-medium">
                    {[c.nombre, c.apellidos].filter(Boolean).join(" ") || "(sin nombre)"}
                  </td>
                  <td className="px-4 py-3">{c.email ?? "—"}</td>
                  <td className="px-4 py-3">{c.telefono ?? "—"}</td>
                  <td className="px-4 py-3">{c.origen_lista ?? "—"}</td>
                  <td className="px-4 py-3">{c.empresa || "—"}</td>
                  <td className="px-4 py-3">{c.entidad_publica || "—"}</td>
                  <td className="px-4 py-3">{c.colegiado_profesional ? "✅" : "—"}</td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/contactos/${c.id}`}
                      className="mr-3 font-medium text-[var(--balvert-azul-oscuro)] hover:underline"
                    >
                      Editar
                    </Link>
                    <button
                      onClick={() => eliminar(c.id, c.nombre)}
                      className="font-medium text-red-600 hover:underline"
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
              {!cargando && filtrados.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-zinc-500">
                    {contactos.length === 0
                      ? "Todavía no hay contactos. Añade el primero con el botón de arriba, o importa la lista desde el Excel."
                      : "Sin resultados para esa búsqueda."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
