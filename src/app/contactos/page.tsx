"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { obtenerTodasLasFilas } from "@/lib/paginarTodo";
import { seccionesContacto } from "@/lib/contactoFields";
import { columnasDesdeSecciones, coincideBusqueda, textoRecuento } from "@/lib/exportarListado";
import { llamarApiJson } from "@/lib/apiCliente";
import { textoResumen, type ResumenExclusiones } from "@/lib/exclusiones";
import HerramientasListado from "@/components/HerramientasListado";
import type { ContactoNewsletter, MotivoExclusion } from "@/types/database";

const CAMPOS_BUSQUEDA: (keyof ContactoNewsletter)[] = [
  "nombre",
  "apellidos",
  "email",
  "telefono",
  "origen_lista",
  "empresa",
  "entidad_publica",
  "nombre_colegio",
  "nacionalidad",
];

const COLUMNAS = columnasDesdeSecciones<ContactoNewsletter>(seccionesContacto, [
  { key: "fecha_alta", label: "Fecha de alta" },
  { key: "estado", label: "Estado de envíos" },
  { key: "motivo_exclusion", label: "Motivo de exclusión" },
  { key: "fecha_exclusion", label: "Fecha de exclusión" },
  { key: "rebotes_temporales", label: "Rebotes temporales", tipo: "numero" },
  { key: "fecha_ultimo_rebote_temporal", label: "Último rebote temporal" },
]);

const MOTIVOS: MotivoExclusion[] = ["Rebote", "Baja", "Manual"];
const TAMANO_TROZO = 200;

type FiltroEstado = "Activo" | "Excluido" | "";

function trozos<T>(lista: T[]): T[][] {
  const resultado: T[][] = [];
  for (let i = 0; i < lista.length; i += TAMANO_TROZO) resultado.push(lista.slice(i, i + TAMANO_TROZO));
  return resultado;
}

export default function ContactosPage() {
  const [contactos, setContactos] = useState<ContactoNewsletter[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [filtroOrigen, setFiltroOrigen] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>("");
  const [filtroMotivo, setFiltroMotivo] = useState<MotivoExclusion | "">("");
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());
  const [trabajando, setTrabajando] = useState<string | null>(null);

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
      setSeleccion((prev) => new Set(datos.filter((c) => prev.has(c.id)).map((c) => c.id)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado.");
    }
    setCargando(false);
  }

  useEffect(() => {
    cargar();
  }, []);

  async function eliminar(id: string, nombre: string | null, excluido: boolean) {
    const ok = window.confirm(
      `¿Eliminar a "${nombre ?? "este contacto"}"? Esta acción no se puede deshacer.` +
        (excluido
          ? "\n\nOjo: está excluido de envíos. Si lo eliminas, la app deja de saber que no debe recibir boletines y podría volver a entrar. Es mejor dejarlo como excluido."
          : "")
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

  const filtrados = contactos.filter((c) => {
    if (filtroOrigen && c.origen_lista !== filtroOrigen) return false;
    if (filtroEstado && c.estado !== filtroEstado) return false;
    if (filtroMotivo && c.motivo_exclusion !== filtroMotivo) return false;
    return coincideBusqueda(c, CAMPOS_BUSQUEDA, busqueda);
  });

  const totalExcluidos = contactos.filter((c) => c.estado === "Excluido").length;
  const seleccionados = contactos.filter((c) => seleccion.has(c.id));
  const seleccionadosActivos = seleccionados.filter((c) => c.estado === "Activo");
  const seleccionadosExcluidos = seleccionados.filter((c) => c.estado === "Excluido");
  const todosFiltradosMarcados = filtrados.length > 0 && filtrados.every((c) => seleccion.has(c.id));

  function alternar(id: string) {
    setSeleccion((prev) => {
      const nueva = new Set(prev);
      if (nueva.has(id)) nueva.delete(id);
      else nueva.add(id);
      return nueva;
    });
  }

  function alternarTodosFiltrados() {
    setSeleccion((prev) => {
      const nueva = new Set(prev);
      if (todosFiltradosMarcados) filtrados.forEach((c) => nueva.delete(c.id));
      else filtrados.forEach((c) => nueva.add(c.id));
      return nueva;
    });
  }

  async function enBloque(
    etiqueta: string,
    ids: string[],
    operacion: (trozo: string[]) => PromiseLike<{ error: { message: string } | null }>
  ) {
    setTrabajando(etiqueta);
    setAviso(null);
    let hechos = 0;
    try {
      for (const trozo of trozos(ids)) {
        const { error } = await operacion(trozo);
        if (error) throw new Error(error.message);
        hechos += trozo.length;
      }
      setAviso(`${etiqueta}: ${hechos} contacto(s).`);
      setSeleccion(new Set());
    } catch (e) {
      alert(
        `${etiqueta}: se hizo con ${hechos} de ${ids.length} y falló el resto. ${
          e instanceof Error ? e.message : ""
        }`
      );
    }
    setTrabajando(null);
    await cargar();
  }

  async function excluirSeleccionados() {
    const ids = seleccionadosActivos.map((c) => c.id);
    if (ids.length === 0) return;
    const yaExcluidos = seleccionadosExcluidos.length;
    const ok = window.confirm(
      `¿Excluir de envíos a ${ids.length} contacto(s)? Quedarán en Contactos con motivo «Manual» y no recibirán ningún boletín.${
        yaExcluidos ? ` (${yaExcluidos} de la selección ya estaban excluidos y no cambian.)` : ""
      }`
    );
    if (!ok) return;
    const ahora = new Date().toISOString();
    await enBloque("Excluidos de envíos", ids, (trozo) =>
      supabase
        .from("contactos_newsletter")
        .update({ estado: "Excluido", motivo_exclusion: "Manual", fecha_exclusion: ahora })
        .in("id", trozo)
        .eq("estado", "Activo")
    );
  }

  async function reactivarSeleccionados() {
    const ids = seleccionadosExcluidos.map((c) => c.id);
    if (ids.length === 0) return;
    const porRebote = seleccionadosExcluidos.filter((c) => c.motivo_exclusion !== "Manual").length;
    const ok = window.confirm(
      `¿Volver a activar a ${ids.length} contacto(s)? Volverán a recibir boletines.` +
        (porRebote
          ? `\n\nSi se excluyeron por rebote o baja, volver a enviarles puede perjudicar la entrega de los boletines (${porRebote} de estos ${ids.length} se excluyeron así).`
          : "")
    );
    if (!ok) return;
    await enBloque("Activados de nuevo", ids, (trozo) =>
      supabase
        .from("contactos_newsletter")
        .update({ estado: "Activo", motivo_exclusion: null, fecha_exclusion: null })
        .in("id", trozo)
        .eq("estado", "Excluido")
    );
  }

  async function eliminarSeleccionados() {
    const ids = seleccionados.map((c) => c.id);
    if (ids.length === 0) return;
    const excluidos = seleccionadosExcluidos.length;
    const primera = window.confirm(
      `¿Eliminar definitivamente ${ids.length} contacto(s)? Se borran de Contactos con su histórico de boletines. No se puede deshacer.` +
        (excluidos
          ? `\n\nOjo: ${excluidos} están excluidos de envíos. Si los eliminas, la app deja de saber que no deben recibir boletines y podrían volver a entrar (por ejemplo, desde Captación). Para que no reciban nada es mejor dejarlos como excluidos.`
          : "")
    );
    if (!primera) return;
    const segunda = window.prompt(`Para confirmar, escribe ELIMINAR (se borrarán ${ids.length} contacto(s)).`);
    if (segunda?.trim() !== "ELIMINAR") return;
    await enBloque("Eliminados", ids, (trozo) =>
      supabase.from("contactos_newsletter").delete().in("id", trozo)
    );
  }

  async function actualizarDesdeMailrelay() {
    const ok = window.confirm(
      "La app consultará en Mailrelay los rebotes y bajas de todos los boletines enviados y los aplicará a Contactos: rebote → Excluido (Rebote), baja → Excluido (Baja), rebote temporal → solo se anota. Nunca reactiva a nadie. ¿Continuar?"
    );
    if (!ok) return;
    setTrabajando("Consultando Mailrelay…");
    setAviso(null);
    try {
      const r: ResumenExclusiones & { campanas: number; boletinesNuevos: number } = await llamarApiJson(
        "/api/contactos/actualizar-mailrelay",
        {}
      );
      setAviso(
        `Mailrelay (${r.campanas} boletín(es) revisados${
          r.boletinesNuevos ? `, ${r.boletinesNuevos} registrado(s) por primera vez` : ""
        }): ${textoResumen(r)}`
      );
    } catch (e) {
      alert("No se pudo actualizar desde Mailrelay: " + (e instanceof Error ? e.message : String(e)));
    }
    setTrabajando(null);
    await cargar();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[var(--balvert-marron)]">Contactos</h1>
          <p className="text-sm text-zinc-600">
            {textoRecuento(cargando, filtrados.length, contactos.length, "contacto(s)")}
            {!cargando && ` · ${contactos.length - totalExcluidos} activos · ${totalExcluidos} excluidos de envíos`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={actualizarDesdeMailrelay}
            disabled={Boolean(trabajando)}
            className="rounded-md border border-[var(--borde)] bg-white px-4 py-2 text-sm font-semibold text-[var(--balvert-azul-oscuro)] hover:bg-zinc-50 disabled:opacity-50"
          >
            Actualizar rebotes y bajas desde Mailrelay
          </button>
          <Link
            href="/contactos/importar"
            className="rounded-md border border-[var(--borde)] bg-white px-4 py-2 text-sm font-semibold text-[var(--balvert-azul-oscuro)] hover:bg-zinc-50"
          >
            Importar contactos
          </Link>
          <Link
            href="/contactos/importar-exclusiones"
            className="rounded-md border border-[var(--borde)] bg-white px-4 py-2 text-sm font-semibold text-[var(--balvert-azul-oscuro)] hover:bg-zinc-50"
          >
            Importar exclusiones
          </Link>
          <Link
            href="/contactos/nuevo"
            className="rounded-md px-4 py-2 text-sm font-semibold text-white"
            style={{ background: "var(--balvert-azul-oscuro)" }}
          >
            + Añadir contacto
          </Link>
        </div>
      </div>

      <HerramientasListado
        busqueda={busqueda}
        onBusqueda={setBusqueda}
        placeholder="Buscar por nombre, email, teléfono, empresa…"
        descarga={{
          filas: filtrados,
          columnas: COLUMNAS,
          pantalla: "Contactos",
          edicion: filtroOrigen || null,
        }}
      >
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
        <select
          className="campo-input max-w-[11rem]"
          value={filtroEstado}
          onChange={(e) => {
            const valor = e.target.value as FiltroEstado;
            setFiltroEstado(valor);
            if (valor === "Activo") setFiltroMotivo("");
          }}
        >
          <option value="">Activos y excluidos</option>
          <option value="Activo">Solo activos</option>
          <option value="Excluido">Solo excluidos</option>
        </select>
        <select
          className="campo-input max-w-[11rem]"
          value={filtroMotivo}
          onChange={(e) => {
            const valor = e.target.value as MotivoExclusion | "";
            setFiltroMotivo(valor);
            if (valor) setFiltroEstado("Excluido");
          }}
        >
          <option value="">Cualquier motivo</option>
          {MOTIVOS.map((m) => (
            <option key={m} value={m}>
              Motivo: {m}
            </option>
          ))}
        </select>
      </HerramientasListado>

      {aviso && (
        <div className="rounded-md border border-green-200 bg-green-50 p-4 text-sm text-green-700">{aviso}</div>
      )}

      {seleccion.size > 0 && (
        <div className="sticky top-0 z-10 flex flex-wrap items-center gap-3 rounded-lg border border-[var(--borde)] bg-amber-50 p-3 text-sm">
          <span className="font-semibold">
            {seleccion.size} seleccionado(s)
            {seleccionadosExcluidos.length > 0 && ` (${seleccionadosExcluidos.length} excluidos)`}
          </span>
          <button
            type="button"
            onClick={excluirSeleccionados}
            disabled={Boolean(trabajando) || seleccionadosActivos.length === 0}
            className="rounded-md border border-amber-300 bg-white px-3 py-1.5 font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-50"
          >
            Excluir de envíos ({seleccionadosActivos.length})
          </button>
          <button
            type="button"
            onClick={reactivarSeleccionados}
            disabled={Boolean(trabajando) || seleccionadosExcluidos.length === 0}
            className="rounded-md border border-[var(--borde)] bg-white px-3 py-1.5 font-semibold text-[var(--balvert-azul-oscuro)] hover:bg-zinc-50 disabled:opacity-50"
          >
            Volver a activar ({seleccionadosExcluidos.length})
          </button>
          <button
            type="button"
            onClick={eliminarSeleccionados}
            disabled={Boolean(trabajando)}
            className="rounded-md border border-red-200 bg-white px-3 py-1.5 font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            Eliminar ({seleccion.size})
          </button>
          <button
            type="button"
            onClick={() => setSeleccion(new Set())}
            className="ml-auto text-zinc-600 hover:underline"
          >
            Quitar selección
          </button>
          {trabajando && <span className="w-full text-zinc-600">{trabajando}</span>}
        </div>
      )}
      {seleccion.size === 0 && trabajando && <p className="text-sm text-zinc-600">{trabajando}</p>}

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          No se pudieron cargar los contactos: {error}
          <br />
          Comprueba que has ejecutado la migración{" "}
          <code>supabase/migrations/034_contactos_exclusiones_boletines.sql</code>.
        </div>
      )}

      {!error && (
        <div className="overflow-x-auto rounded-lg border border-[var(--borde)] bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 text-xs uppercase text-zinc-500">
              <tr>
                <th className="px-4 py-3">
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={todosFiltradosMarcados}
                    onChange={alternarTodosFiltrados}
                    disabled={filtrados.length === 0}
                    title="Seleccionar todos los de esta búsqueda o filtro"
                    aria-label="Seleccionar todos los de esta búsqueda o filtro"
                  />
                </th>
                <th className="px-4 py-3">Nombre</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Envíos</th>
                <th className="px-4 py-3">Teléfono</th>
                <th className="px-4 py-3">Origen</th>
                <th className="px-4 py-3">Empresa</th>
                <th className="px-4 py-3">Entidad pública</th>
                <th className="px-4 py-3">Colegiado</th>
                <th className="px-4 py-3">Nacionalidad</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtrados.length > 0 && (
                <tr className="border-t border-[var(--borde)] bg-zinc-50/60">
                  <td colSpan={11} className="px-4 py-2 text-xs text-zinc-600">
                    <button
                      type="button"
                      onClick={alternarTodosFiltrados}
                      className="font-semibold text-[var(--balvert-azul-oscuro)] hover:underline"
                    >
                      {todosFiltradosMarcados
                        ? `Quitar los ${filtrados.length} de esta búsqueda o filtro`
                        : `Seleccionar todos los de esta búsqueda o filtro (${filtrados.length})`}
                    </button>
                  </td>
                </tr>
              )}
              {filtrados.map((c) => (
                <tr
                  key={c.id}
                  className={`border-t border-[var(--borde)] ${seleccion.has(c.id) ? "bg-amber-50/60" : ""}`}
                >
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={seleccion.has(c.id)}
                      onChange={() => alternar(c.id)}
                      aria-label={`Seleccionar ${c.email ?? c.nombre ?? "contacto"}`}
                    />
                  </td>
                  <td className="px-4 py-3 font-medium">
                    {[c.nombre, c.apellidos].filter(Boolean).join(" ") || "(sin nombre)"}
                  </td>
                  <td className="px-4 py-3">{c.email ?? "—"}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {c.estado === "Excluido" ? (
                      <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700">
                        Excluido · {c.motivo_exclusion}
                      </span>
                    ) : (
                      <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-semibold text-green-700">
                        Activo
                      </span>
                    )}
                    {c.rebotes_temporales > 0 && (
                      <span className="ml-1 text-xs text-amber-700" title="Rebotes temporales">
                        ⚠ {c.rebotes_temporales}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">{c.telefono ?? "—"}</td>
                  <td className="px-4 py-3">{c.origen_lista ?? "—"}</td>
                  <td className="px-4 py-3">{c.empresa || "—"}</td>
                  <td className="px-4 py-3">{c.entidad_publica || "—"}</td>
                  <td className="px-4 py-3">{c.colegiado_profesional ? "✅" : "—"}</td>
                  <td className="px-4 py-3">{c.nacionalidad || "—"}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <Link
                      href={`/contactos/${c.id}`}
                      className="mr-3 font-medium text-[var(--balvert-azul-oscuro)] hover:underline"
                    >
                      Editar
                    </Link>
                    <button
                      onClick={() => eliminar(c.id, c.nombre, c.estado === "Excluido")}
                      className="font-medium text-red-600 hover:underline"
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
              {!cargando && filtrados.length === 0 && (
                <tr>
                  <td colSpan={11} className="px-4 py-8 text-center text-zinc-500">
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
