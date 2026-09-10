"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { construirHtmlNewsletter } from "@/lib/newsletterHtml";
import { obtenerTodasLasFilas } from "@/lib/paginarTodo";
import { llamarApiJson, llamarApiGet } from "@/lib/apiCliente";
import EditorNewsletter from "@/components/EditorNewsletter";

interface Remitente {
  id: number;
  name: string | null;
  email: string;
}

interface ContactoEnvio {
  email: string;
  nombre: string | null;
}

const TAMANO_LOTE = 100;

function htmlEstaVacio(html: string): boolean {
  return html.replace(/<[^>]*>/g, "").trim().length === 0;
}

export default function NewsletterPage() {
  const [asunto, setAsunto] = useState("");
  const [contenido, setContenido] = useState("");
  const [origenes, setOrigenes] = useState<string[]>([]);
  const [origenFiltro, setOrigenFiltro] = useState("");
  const [totalDestinatarios, setTotalDestinatarios] = useState<number | null>(null);

  const [remitentes, setRemitentes] = useState<Remitente[]>([]);
  const [remitenteId, setRemitenteId] = useState<number | null>(null);
  const [errorRemitentes, setErrorRemitentes] = useState<string | null>(null);

  const [emailPrueba, setEmailPrueba] = useState("");
  const [confirmacion, setConfirmacion] = useState("");

  const [estado, setEstado] = useState<
    "idle" | "prueba" | "sincronizando" | "enviando" | "hecho" | "error"
  >("idle");
  const [progreso, setProgreso] = useState<{ actual: number; total: number } | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    obtenerTodasLasFilas<{ origen_lista: string }>((desde, hasta) =>
      supabase
        .from("contactos_newsletter")
        .select("origen_lista")
        .not("origen_lista", "is", null)
        .order("id", { ascending: true })
        .range(desde, hasta)
    ).then((filas) => {
      const unicos = Array.from(new Set(filas.map((r) => r.origen_lista).filter(Boolean))).sort();
      setOrigenes(unicos);
    });

    llamarApiGet("/api/newsletter/remitentes")
      .then((data: { remitentes: Remitente[] }) => {
        setRemitentes(data.remitentes);
        if (data.remitentes.length === 1) setRemitenteId(data.remitentes[0].id);
      })
      .catch((e) => setErrorRemitentes(e instanceof Error ? e.message : "Error"));
  }, []);

  useEffect(() => {
    let query = supabase
      .from("contactos_newsletter")
      .select("id", { count: "exact", head: true });
    if (origenFiltro) query = query.eq("origen_lista", origenFiltro);
    query.then(({ count }) => setTotalDestinatarios(count ?? 0));
  }, [origenFiltro]);

  async function obtenerContactosFiltrados(): Promise<ContactoEnvio[]> {
    const filas = await obtenerTodasLasFilas<{
      email: string | null;
      nombre: string | null;
      apellidos: string | null;
    }>((desde, hasta) => {
      let query = supabase
        .from("contactos_newsletter")
        .select("email, nombre, apellidos")
        .order("id", { ascending: true })
        .range(desde, hasta);
      if (origenFiltro) query = query.eq("origen_lista", origenFiltro);
      return query;
    });
    return filas
      .filter((c) => c.email)
      .map((c) => ({
        email: c.email as string,
        nombre: [c.nombre, c.apellidos].filter(Boolean).join(" ") || null,
      }));
  }

  function validarAntesDeEnviar(): string | null {
    if (!asunto.trim()) return "Falta el asunto.";
    if (htmlEstaVacio(contenido)) return "Falta el contenido.";
    if (!remitenteId) return "Elige un remitente.";
    return null;
  }

  async function enviarPrueba() {
    const validacion = validarAntesDeEnviar();
    if (validacion) {
      setError(validacion);
      return;
    }
    if (!emailPrueba.trim()) {
      setError("Escribe el email al que quieres mandar la prueba.");
      return;
    }
    setError(null);
    setMensaje(null);
    setEstado("prueba");
    try {
      const html = construirHtmlNewsletter(asunto, contenido);
      const { groupId } = await llamarApiJson("/api/newsletter/grupo", {
        nombre: `BALVERT prueba ${new Date().toISOString()}`,
      });
      const { campaignId } = await llamarApiJson("/api/newsletter/campana", {
        senderId: remitenteId,
        subject: asunto,
        html,
        groupId,
      });
      await llamarApiJson(`/api/newsletter/campana/${campaignId}/prueba`, {
        emails: [emailPrueba.trim()],
      });
      setEstado("hecho");
      setMensaje(`Prueba enviada a ${emailPrueba.trim()}.`);
    } catch (e) {
      setEstado("error");
      setError(e instanceof Error ? e.message : "No se pudo enviar la prueba.");
    }
  }

  async function enviarATodos() {
    const validacion = validarAntesDeEnviar();
    if (validacion) {
      setError(validacion);
      return;
    }
    if (confirmacion !== "ENVIAR") {
      setError('Escribe "ENVIAR" en el cuadro de confirmación para continuar.');
      return;
    }
    const ok = window.confirm(
      `Vas a enviar esta newsletter a ${totalDestinatarios ?? "?"} contacto(s) reales${
        origenFiltro ? ` (origen: ${origenFiltro})` : ""
      }. Esta acción no se puede deshacer. ¿Confirmas?`
    );
    if (!ok) return;

    setError(null);
    setMensaje(null);
    try {
      const contactos = await obtenerContactosFiltrados();
      const html = construirHtmlNewsletter(asunto, contenido);

      const { groupId } = await llamarApiJson("/api/newsletter/grupo", {
        nombre: `BALVERT newsletter ${new Date().toISOString()} — ${asunto.slice(0, 40)}`,
      });

      setEstado("sincronizando");
      setProgreso({ actual: 0, total: contactos.length });
      for (let i = 0; i < contactos.length; i += TAMANO_LOTE) {
        const lote = contactos.slice(i, i + TAMANO_LOTE);
        await llamarApiJson("/api/newsletter/sincronizar-lote", { groupId, contactos: lote });
        setProgreso({ actual: Math.min(i + TAMANO_LOTE, contactos.length), total: contactos.length });
      }

      setEstado("enviando");
      const { campaignId } = await llamarApiJson("/api/newsletter/campana", {
        senderId: remitenteId,
        subject: asunto,
        html,
        groupId,
      });
      await llamarApiJson(`/api/newsletter/campana/${campaignId}/enviar`, {});

      setEstado("hecho");
      setMensaje(`Newsletter enviada a ${contactos.length} contacto(s).`);
      setConfirmacion("");
    } catch (e) {
      setEstado("error");
      setError(e instanceof Error ? e.message : "No se pudo enviar la newsletter.");
    }
  }

  const enviando = estado === "prueba" || estado === "sincronizando" || estado === "enviando";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--balvert-marron)]">Newsletter</h1>
        <p className="text-sm text-zinc-600">
          Redacta y envía un boletín a tu lista de contactos, usando Mailrelay por detrás.
        </p>
      </div>

      {errorRemitentes && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          No se pudo cargar el remitente de Mailrelay: {errorRemitentes}
          <br />
          Comprueba que <code>MAILRELAY_API_URL</code> y <code>MAILRELAY_API_KEY</code> están
          configurados, y que existe al menos un remitente verificado en tu cuenta de Mailrelay.
        </div>
      )}
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}
      {mensaje && (
        <div className="rounded-md border border-green-200 bg-green-50 p-4 text-sm text-green-700">
          {mensaje}
        </div>
      )}

      <section className="flex flex-col gap-4 rounded-lg border border-[var(--borde)] bg-white p-6">
        <h3 className="seccion-titulo">Contenido</h3>
        <div>
          <label className="campo-label">Asunto</label>
          <input
            className="campo-input"
            value={asunto}
            onChange={(e) => setAsunto(e.target.value)}
            disabled={enviando}
          />
        </div>
        <div>
          <label className="campo-label">Contenido</label>
          <EditorNewsletter value={contenido} onChange={setContenido} />
          <p className="mt-1 text-xs text-zinc-400">
            Las fuentes solo se ven bien si son &quot;de siempre&quot; (Arial, Georgia, Verdana…): los
            programas de correo no cargan fuentes modernas de internet.
          </p>
        </div>
      </section>

      <section className="flex flex-col gap-4 rounded-lg border border-[var(--borde)] bg-white p-6">
        <h3 className="seccion-titulo">Destinatarios y remitente</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="campo-label">Lista (origen)</label>
            <select
              className="campo-input"
              value={origenFiltro}
              onChange={(e) => setOrigenFiltro(e.target.value)}
              disabled={enviando}
            >
              <option value="">Todos los contactos</option>
              {origenes.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-zinc-400">
              {totalDestinatarios === null ? "Calculando…" : `${totalDestinatarios} destinatario(s)`}
            </p>
          </div>
          <div>
            <label className="campo-label">Remitente</label>
            <select
              className="campo-input"
              value={remitenteId ?? ""}
              onChange={(e) => setRemitenteId(Number(e.target.value) || null)}
              disabled={enviando || remitentes.length === 0}
            >
              <option value="">Elige un remitente…</option>
              {remitentes.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name ? `${r.name} <${r.email}>` : r.email}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-4 rounded-lg border border-[var(--borde)] bg-white p-6">
        <h3 className="seccion-titulo">Enviar una prueba</h3>
        <p className="text-sm text-zinc-600">
          Antes de mandarla a todos, envíate una prueba a tu propio email para ver cómo queda.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="campo-label">Email de prueba</label>
            <input
              className="campo-input"
              type="email"
              value={emailPrueba}
              onChange={(e) => setEmailPrueba(e.target.value)}
              disabled={enviando}
            />
          </div>
          <button
            type="button"
            onClick={enviarPrueba}
            disabled={enviando}
            className="rounded-md px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            style={{ background: "var(--balvert-azul-oscuro)" }}
          >
            {estado === "prueba" ? "Enviando…" : "Enviar prueba"}
          </button>
        </div>
      </section>

      <section className="flex flex-col gap-4 rounded-lg border border-red-200 bg-red-50/40 p-6">
        <h3 className="seccion-titulo" style={{ borderColor: "#ef4444" }}>
          Enviar a todos
        </h3>
        <p className="text-sm text-zinc-600">
          Esto envía la newsletter de verdad a{" "}
          <strong>{totalDestinatarios ?? "…"} contacto(s) reales</strong>. No se puede deshacer.
          Escribe <strong>ENVIAR</strong> para desbloquear el botón.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="campo-label">Confirmación</label>
            <input
              className="campo-input"
              value={confirmacion}
              onChange={(e) => setConfirmacion(e.target.value)}
              disabled={enviando}
              placeholder="ENVIAR"
            />
          </div>
          <button
            type="button"
            onClick={enviarATodos}
            disabled={enviando || confirmacion !== "ENVIAR"}
            className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
          >
            {estado === "sincronizando" || estado === "enviando" ? "Enviando…" : "Enviar a todos"}
          </button>
        </div>
        {progreso && estado === "sincronizando" && (
          <p className="text-xs text-zinc-500">
            Sincronizando contactos: {progreso.actual} / {progreso.total}
          </p>
        )}
      </section>
    </div>
  );
}
