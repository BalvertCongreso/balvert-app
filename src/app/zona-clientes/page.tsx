"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { cabeceraAutorizacion, llamarApiGet, llamarApiJson } from "@/lib/apiCliente";
import EntradaQR from "@/components/EntradaQR";
import CertificadoAsistente from "@/components/CertificadoAsistente";
import {
  BUCKET_DOCUMENTOS,
  MAX_DESCRIPCION,
  MAX_TITULO,
  TAMANO_MAXIMO_DOCUMENTO,
  TIPOS_DOCUMENTO_PERMITIDOS,
} from "@/lib/documentos";
import type { Cliente, DetalleCliente } from "@/lib/zonaClientes";

// Zona de clientes: todas las personas con entradas de la edición activa,
// agrupadas por email. Al pulsar una se abre su espacio en esta misma
// pantalla (el email no va en la dirección).

const EVENTO = { congreso: "Congreso", gala: "Cena de gala", excursion: "Excursión" } as const;
const RUTA = { congreso: "/congreso", gala: "/gala", excursion: "/excursion" } as const;

const fecha = (iso: string) =>
  new Date(iso).toLocaleString("es-ES", { timeZone: "Europe/Madrid", dateStyle: "short", timeStyle: "short" });
const euros = (n: number) => n.toLocaleString("es-ES", { style: "currency", currency: "EUR" });

function estadoEntrada(e: { qrCodigo: string | null; entradaEnviada: string | null }) {
  if (!e.qrCodigo) return { texto: "sin generar", clase: "text-zinc-500" };
  return e.entradaEnviada === "Sí" ? { texto: "enviada", clase: "text-green-700" } : { texto: "no enviada", clase: "text-red-700" };
}

export default function ZonaClientesPage() {
  const [clientes, setClientes] = useState<Cliente[] | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [abierto, setAbierto] = useState<string | null>(null);

  async function buscar(q: string) {
    setError(null);
    try {
      const d = await llamarApiGet(`/api/zona-clientes?q=${encodeURIComponent(q)}`);
      setClientes(d.clientes);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado.");
    }
  }

  useEffect(() => {
    // Búsqueda al escribir, con una pequeña espera para no pedir en cada tecla.
    const t = setTimeout(() => buscar(busqueda), 300);
    return () => clearTimeout(t);
  }, [busqueda]);

  if (abierto) {
    return <EspacioCliente email={abierto} onVolver={() => { setAbierto(null); buscar(busqueda); }} />;
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--balvert-marron)]">Zona de clientes</h1>
        <p className="text-sm text-zinc-600">
          Personas con entradas de la edición activa (Congreso, Cena de gala y Excursión), agrupadas por email. Pulsa una
          para abrir su espacio.
        </p>
      </div>
      <input
        type="search"
        className="campo-input max-w-md"
        placeholder="Buscar por nombre, email o documento…"
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
      />
      {error && <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {!clientes && !error && <p className="text-sm text-zinc-500">Cargando…</p>}
      {clientes && clientes.length === 0 && (
        <p className="rounded-md border border-[var(--borde)] bg-white p-6 text-sm text-zinc-500">Nadie coincide con la búsqueda.</p>
      )}
      {clientes && clientes.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-[var(--borde)] bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 text-xs uppercase text-zinc-500">
              <tr>
                <th className="px-4 py-3">Nombre(s)</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Entradas</th>
                <th className="px-4 py-3">Compras</th>
                <th className="px-4 py-3">Factura</th>
                <th className="px-4 py-3">Certificado</th>
                <th className="px-4 py-3">Último acceso</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--borde)]">
              {clientes.map((c) => (
                <tr key={c.email} className="cursor-pointer align-top hover:bg-zinc-50" onClick={() => setAbierto(c.email)}>
                  <td className="px-4 py-3 font-semibold text-[var(--balvert-azul-oscuro)]">{c.nombres.join(", ") || "—"}</td>
                  <td className="px-4 py-3 break-all">{c.email}</td>
                  <td className="px-4 py-3 text-xs">
                    {c.entradas.map((e) => {
                      const est = estadoEntrada(e);
                      return (
                        <p key={e.id}>
                          {EVENTO[e.tabla]} · <span className={est.clase}>{est.texto}</span>
                        </p>
                      );
                    })}
                  </td>
                  <td className="px-4 py-3">{c.compras || "—"}</td>
                  <td className="px-4 py-3">{c.facturaPedida ? "Pedida" : "—"}</td>
                  <td className="px-4 py-3">{c.certificado ? "Disponible" : "—"}</td>
                  <td className="px-4 py-3 text-xs">{c.ultimoAcceso ? fecha(c.ultimoAcceso) : "Nunca"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function EspacioCliente({ email, onVolver }: { email: string; onVolver: () => void }) {
  const [cliente, setCliente] = useState<DetalleCliente | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    llamarApiJson("/api/zona-clientes", { email })
      .then((d) => setCliente(d.cliente))
      .catch((e) => setError(e instanceof Error ? e.message : "Error inesperado."));
  }, [email, version]);

  const recargar = () => setVersion((v) => v + 1);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <button type="button" onClick={onVolver} className="text-sm text-[var(--balvert-azul-oscuro)] hover:underline">
          ← Zona de clientes
        </button>
        <h1 className="mt-2 text-2xl font-bold text-[var(--balvert-marron)]">{cliente?.nombres.join(", ") || email}</h1>
        <p className="text-sm text-zinc-600">
          {email}
          {cliente && ` · Último acceso a su zona: ${cliente.ultimoAcceso ? fecha(cliente.ultimoAcceso) : "nunca"}`}
        </p>
      </div>
      {error && <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {!cliente && !error && <p className="text-sm text-zinc-500">Cargando…</p>}

      {cliente && (
        <>
          <section className="flex flex-col gap-4">
            <h2 className="seccion-titulo">Entradas y datos personales</h2>
            {cliente.entradas.map((e) => (
              <div key={e.id} className="flex flex-col gap-3 rounded-lg border border-[var(--borde)] bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-2 text-sm">
                  <div>
                    <p className="font-semibold">
                      {EVENTO[e.tabla]} — {e.nombre ?? "sin nombre"}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {[e.tipo, e.menu && `Menú: ${e.menu}`, e.telefono && `Tel.: ${e.telefono}`, e.checkIn && "Check-in hecho"]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <Link href={`${RUTA[e.tabla]}/${e.id}`} className="font-medium text-[var(--balvert-azul-oscuro)] hover:underline">
                    Abrir su ficha
                  </Link>
                </div>
                <EntradaQR
                  tabla={e.tabla}
                  registroId={e.id}
                  qrCodigo={e.qrCodigo}
                  nombre={e.nombre}
                  email={e.email}
                  entradaEnviada={e.entradaEnviada}
                  onActualizado={recargar}
                />
                {e.tabla === "congreso" && e.checkIn && <CertificadoAsistente asistenteId={e.id} />}
              </div>
            ))}
          </section>

          <section className="rounded-lg border border-[var(--borde)] bg-white p-4">
            <h2 className="seccion-titulo">Compras y facturas</h2>
            {cliente.comprasDetalle.length === 0 ? (
              <p className="text-sm text-zinc-500">No tiene compras online (entradas dadas de alta a mano o invitaciones).</p>
            ) : (
              <ul className="flex flex-col divide-y divide-[var(--borde)] text-sm">
                {cliente.comprasDetalle.map((c) => {
                  const factura = cliente.facturas.find((f) => f.referencia === c.referencia);
                  return (
                    <li key={c.referencia} className="py-2">
                      <p>
                        {c.fecha ? fecha(c.fecha) : "Compra"} · {c.entradas} entrada{c.entradas === 1 ? "" : "s"}
                        {c.importe !== null && ` · ${euros(c.importe)}`}
                        {c.reciboUrl && (
                          <a href={c.reciboUrl} target="_blank" rel="noopener noreferrer" className="ml-2 text-[var(--balvert-azul-oscuro)] underline">
                            Recibo
                          </a>
                        )}
                      </p>
                      {factura ? (
                        <p className="text-xs text-zinc-600">
                          Factura pedida el {fecha(factura.creado)}: {Object.values(factura.datos).filter(Boolean).join(" · ")}
                        </p>
                      ) : (
                        <p className="text-xs text-zinc-500">Sin factura pedida.</p>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <DocumentosPersonales email={email} documentos={cliente.documentos} onCambio={recargar} />
        </>
      )}
    </div>
  );
}

function DocumentosPersonales({
  email,
  documentos,
  onCambio,
}: {
  email: string;
  documentos: DetalleCliente["documentos"];
  onCambio: () => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [archivo, setArchivo] = useState<File | null>(null);
  const [avisar, setAvisar] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);

  async function subir(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMensaje(null);
    if (!archivo) return setError("Elige el archivo.");
    if (!TIPOS_DOCUMENTO_PERMITIDOS[archivo.type]) return setError("Solo se pueden subir PDF o imágenes (PNG, JPG, WEBP).");
    if (archivo.size > TAMANO_MAXIMO_DOCUMENTO) return setError("El archivo pesa demasiado (máximo 20 MB).");
    setGuardando(true);
    try {
      const { ruta, token } = await llamarApiJson("/api/documentos/subida", { nombre: archivo.name, tipo: archivo.type, tamano: archivo.size });
      const { error: fallo } = await supabase.storage
        .from(BUCKET_DOCUMENTOS)
        .uploadToSignedUrl(ruta, token, new Blob([archivo], { type: archivo.type }));
      if (fallo) throw new Error("No se pudo subir el archivo: " + fallo.message);
      const r = await llamarApiJson("/api/documentos", {
        titulo,
        descripcion,
        destino: "asistente",
        email_destinatario: email,
        avisar,
        ruta_archivo: ruta,
      });
      setMensaje(r.aviso === "enviado" ? `Subido. Le hemos avisado por email a ${email}.` : r.aviso ?? "Subido.");
      setTitulo("");
      setDescripcion("");
      setArchivo(null);
      setAbierto(false);
      onCambio();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado.");
    }
    setGuardando(false);
  }

  async function borrar(id: string, tituloDoc: string) {
    if (!window.confirm(`¿Borrar "${tituloDoc}"? Dejará de verlo en su zona. No se puede deshacer.`)) return;
    const res = await fetch(`/api/documentos?id=${encodeURIComponent(id)}`, { method: "DELETE", headers: await cabeceraAutorizacion() });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return alert(data.error || "No se pudo borrar.");
    onCambio();
  }

  async function ver(id: string) {
    const ventana = window.open("", "_blank");
    try {
      const { url } = await llamarApiGet(`/api/documentos/ver?id=${encodeURIComponent(id)}`);
      if (ventana) ventana.location.href = url;
      else window.location.href = url;
    } catch (e) {
      ventana?.close();
      alert(e instanceof Error ? e.message : "No se pudo abrir el documento.");
    }
  }

  return (
    <section className="rounded-lg border border-[var(--borde)] bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="seccion-titulo">Sus documentos personales</h2>
        {!abierto && (
          <button
            type="button"
            onClick={() => setAbierto(true)}
            className="rounded-md px-4 py-2 text-sm font-semibold text-white"
            style={{ background: "var(--balvert-azul-oscuro)" }}
          >
            Subir documento
          </button>
        )}
      </div>
      <p className="mb-3 text-xs text-zinc-500">Lo que subas aquí lo ve solo esta persona en su zona personal.</p>
      {mensaje && <p className="mb-3 text-sm text-green-700">{mensaje}</p>}
      {abierto && (
        <form onSubmit={subir} className="mb-4 grid gap-3 rounded-md border border-[var(--borde)] bg-zinc-50 p-3">
          <div>
            <label className="campo-label" htmlFor="docp-archivo">Archivo *</label>
            <input
              id="docp-archivo"
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/png,image/jpeg,image/webp"
              className="campo-input"
              onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
            />
            <p className="mt-1 text-xs text-zinc-500">PDF o imagen (PNG, JPG, WEBP), máximo 20 MB.</p>
          </div>
          <div>
            <label className="campo-label" htmlFor="docp-titulo">Título *</label>
            <input id="docp-titulo" required maxLength={MAX_TITULO} className="campo-input" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
          </div>
          <div>
            <label className="campo-label" htmlFor="docp-desc">Descripción</label>
            <textarea id="docp-desc" rows={2} maxLength={MAX_DESCRIPCION} className="campo-input" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={avisar} onChange={(e) => setAvisar(e.target.checked)} />
            Avisarle por email de que ya lo tiene
          </label>
          {error && <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={guardando}
              className="rounded-md px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              style={{ background: "var(--balvert-azul-oscuro)" }}
            >
              {guardando ? "Subiendo…" : "Subir"}
            </button>
            <button type="button" onClick={() => setAbierto(false)} className="rounded-md border border-[var(--borde)] px-4 py-2 text-sm">
              Cancelar
            </button>
          </div>
        </form>
      )}
      {documentos.length === 0 ? (
        <p className="text-sm text-zinc-500">No tiene documentos personales.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-[var(--borde)] text-sm">
          {documentos.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <div>
                <p className="font-medium">{d.titulo}</p>
                <p className="text-xs text-zinc-500">
                  {d.nombre_archivo} · {fecha(d.creado)}
                </p>
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => ver(d.id)} className="text-[var(--balvert-azul-oscuro)] underline">
                  Ver
                </button>
                <button type="button" onClick={() => borrar(d.id, d.titulo)} className="text-red-600 underline">
                  Borrar
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
