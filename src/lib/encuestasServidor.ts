import { createHmac, randomUUID } from "crypto";
import { Resend } from "resend";
import type { SupabaseClient } from "@supabase/supabase-js";
import { obtenerTodasLasFilas } from "@/lib/paginarTodo";
import { hashToken, normalizarEmail, EMAIL_REGEX } from "@/lib/portal";
import { ORIGEN_PUBLICO } from "@/lib/dominio";
import { ENCUESTA_INICIAL, PUBLICOS, type Encuesta, type Pregunta, type Publico } from "@/lib/encuestas";

// Parte de servidor de los cuestionarios: enlaces, destinatarios y envío de
// emails con el límite diario de Resend.

// ---------- Enlaces ----------

// El enlace de cada persona se calcula a partir del id de su envío con una
// clave secreta del servidor (HMAC), y en la base de datos solo se guarda su
// hash, como en el portal. Así el recordatorio puede llevar el MISMO enlace
// que el primer email sin haber guardado nunca el enlace en claro.
export function tokenDeEnvio(envioId: string): string {
  const clave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!clave) throw new Error("Falta SUPABASE_SERVICE_ROLE_KEY en el servidor.");
  return createHmac("sha256", clave).update(`balvert-encuesta:${envioId}`).digest("base64url");
}

export function enlaceEncuesta(envioId: string): string {
  return `${ORIGEN_PUBLICO}/encuesta/${tokenDeEnvio(envioId)}`;
}

// Fecha de hoy en Madrid (aaaa-mm-dd): lo único que se guarda de cuándo se
// contestó.
export function hoyMadrid(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" }).format(new Date());
}

// ---------- Cuestionarios de la edición ----------

// Los dos cuestionarios de la edición; la primera vez se crean con las
// preguntas de partida.
export async function encuestasDeEdicion(supabase: SupabaseClient, edicionId: string): Promise<Encuesta[]> {
  const columnas = "id, edicion_id, publico, titulo, introduccion, enviada_en, recordatorio_pedido_en, cerrada";
  const { data, error } = await supabase.from("encuestas").select(columnas).eq("edicion_id", edicionId);
  if (error) throw new Error(error.message);
  const existentes = (data ?? []) as Encuesta[];

  for (const publico of PUBLICOS) {
    if (existentes.some((e) => e.publico === publico)) continue;
    const inicial = ENCUESTA_INICIAL[publico];
    const { data: creada, error: errorCrear } = await supabase
      .from("encuestas")
      .upsert(
        { edicion_id: edicionId, publico, titulo: inicial.titulo, introduccion: inicial.introduccion },
        { onConflict: "edicion_id,publico", ignoreDuplicates: true }
      )
      .select(columnas);
    if (errorCrear) throw new Error(errorCrear.message);
    // Vacío = otra petición la acaba de crear a la vez: se lee abajo.
    if (creada && creada.length > 0) {
      const { error: errorPreguntas } = await supabase.rpc("guardar_preguntas_encuesta", {
        p_encuesta_id: creada[0].id,
        p_preguntas: inicial.preguntas,
      });
      if (errorPreguntas) throw new Error(errorPreguntas.message);
    }
  }

  if (existentes.length === PUBLICOS.length) return existentes;
  const { data: todas, error: errorLeer } = await supabase.from("encuestas").select(columnas).eq("edicion_id", edicionId);
  if (errorLeer) throw new Error(errorLeer.message);
  return (todas ?? []) as Encuesta[];
}

// ---------- Destinatarios ----------

// Emails únicos (en minúsculas) a los que va el cuestionario:
// asistentes del Congreso con check-in hecho, o contacto 1 y 2 de los
// patrocinadores de la edición.
export async function destinatarios(supabase: SupabaseClient, edicionId: string, publico: Publico): Promise<string[]> {
  const emails = new Set<string>();
  const anadir = (valor: unknown) => {
    const email = normalizarEmail(valor);
    if (EMAIL_REGEX.test(email)) emails.add(email);
  };
  if (publico === "asistentes") {
    const filas = await obtenerTodasLasFilas<{ email: string | null }>((desde, hasta) =>
      supabase
        .from("asistentes_congreso")
        .select("email")
        .eq("edicion_id", edicionId)
        .eq("check_in_hecho", "Sí")
        .order("id")
        .range(desde, hasta)
    );
    filas.forEach((f) => anadir(f.email));
  } else {
    const filas = await obtenerTodasLasFilas<{ contacto1_email: string | null; contacto2_email: string | null }>(
      (desde, hasta) =>
        supabase
          .from("patrocinadores")
          .select("contacto1_email, contacto2_email")
          .eq("edicion_id", edicionId)
          .order("id")
          .range(desde, hasta)
    );
    filas.forEach((f) => {
      anadir(f.contacto1_email);
      anadir(f.contacto2_email);
    });
  }
  return [...emails].sort();
}

export interface EnvioFila {
  id: string;
  email: string;
  enviado_en: string | null;
  recordatorio_en: string | null;
  respondido_en: string | null;
}

export async function enviosDeEncuesta(supabase: SupabaseClient, encuestaId: string): Promise<EnvioFila[]> {
  return obtenerTodasLasFilas<EnvioFila>((desde, hasta) =>
    supabase
      .from("encuesta_envios")
      .select("id, email, enviado_en, recordatorio_en, respondido_en")
      .eq("encuesta_id", encuestaId)
      .order("id")
      .range(desde, hasta)
  );
}

// Crea los envíos (aún sin mandar) para los destinatarios que no lo tengan.
// Devuelve cuántos se han añadido.
export async function crearEnviosNuevos(supabase: SupabaseClient, encuesta: Encuesta): Promise<number> {
  const [todos, existentes] = await Promise.all([
    destinatarios(supabase, encuesta.edicion_id, encuesta.publico),
    enviosDeEncuesta(supabase, encuesta.id),
  ]);
  const ya = new Set(existentes.map((e) => e.email));
  const nuevos = todos.filter((email) => !ya.has(email));
  for (let i = 0; i < nuevos.length; i += 500) {
    const filas = nuevos.slice(i, i + 500).map((email) => {
      const id = randomUUID();
      return { id, encuesta_id: encuesta.id, email, token_hash: hashToken(tokenDeEnvio(id)) };
    });
    const { error } = await supabase
      .from("encuesta_envios")
      .upsert(filas, { onConflict: "encuesta_id,email", ignoreDuplicates: true });
    if (error) throw new Error(error.message);
  }
  return nuevos.length;
}

// ---------- Envío de emails ----------

// El plan gratuito de Resend permite 100 emails al día en total (también los
// enlaces del portal, las entradas, los avisos de documentos…). Los
// cuestionarios usan como mucho 80 al día para dejar sitio al resto; lo que
// no cabe sale solo los días siguientes con el cron diario
// (/api/encuestas/pendientes). Resend cuenta el día en hora UTC.
export const LIMITE_DIARIO_ENCUESTAS = 80;

function inicioDiaUtc(): string {
  const ahora = new Date();
  return new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), ahora.getUTCDate())).toISOString();
}

export async function emailsEncuestaHoy(supabase: SupabaseClient): Promise<number> {
  const desde = inicioDiaUtc();
  const [a, b] = await Promise.all([
    supabase.from("encuesta_envios").select("id", { count: "exact", head: true }).gte("enviado_en", desde),
    supabase.from("encuesta_envios").select("id", { count: "exact", head: true }).gte("recordatorio_en", desde),
  ]);
  if (a.error || b.error) throw new Error((a.error ?? b.error)!.message);
  return (a.count ?? 0) + (b.count ?? 0);
}

function escaparHtml(texto: string) {
  return texto.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function emailEncuesta(encuesta: Encuesta, envioId: string, recordatorio: boolean) {
  const enlace = enlaceEncuesta(envioId);
  const titulo = escaparHtml(encuesta.titulo);
  const saludo =
    encuesta.publico === "asistentes"
      ? "Gracias por asistir al Congreso BALVERT 2027. Nos encantaría conocer tu opinión: son solo un par de minutos."
      : "Gracias por patrocinar el Congreso BALVERT 2027. Nos encantaría conocer vuestra opinión: son solo un par de minutos.";
  const textoRecordatorio = recordatorio
    ? "<p>Te escribimos de nuevo por si no viste nuestro email: todavía puedes contestar el cuestionario.</p>"
    : "";
  const certificado =
    encuesta.publico === "asistentes"
      ? `<p style="font-size: 14px;">Recuerda que puedes descargar tu certificado de asistencia en tu área de clientes: <a href="${ORIGEN_PUBLICO}/portal" style="color: #2f7ea8;">${ORIGEN_PUBLICO}/portal</a></p>`
      : "";
  return {
    from: "BALVERT 2027 <secretaria@balvert.es>",
    subject: `${recordatorio ? "Recordatorio: " : ""}${encuesta.titulo}`,
    html: `
  <div style="font-family: -apple-system, Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; color: #1f2937;">
    <h1 style="color: #8B6914; font-size: 20px; margin-bottom: 4px;">BALVERT 2027</h1>
    <p style="color: #5BB8E8; font-weight: 600; margin-top: 0;">${titulo}</p>
    <p>Hola,</p>
    ${textoRecordatorio}
    <p>${saludo}</p>
    <div style="text-align: center; margin: 28px 0;">
      <a href="${enlace}" style="background: #2f7ea8; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; display: inline-block;">Responder el cuestionario</a>
    </div>
    <p style="font-size: 13px; color: #6b7280;">Tus respuestas son anónimas. El enlace es personal y solo sirve para contestar una vez.</p>
    ${certificado}
  </div>`,
  };
}

interface Pendiente {
  encuesta: Encuesta;
  id: string;
  email: string;
  recordatorio: boolean;
  recordatorioAnterior: string | null;
}

export interface ResultadoEnvio {
  enviados: number;
  // Quedan por salir (otro día, por el límite diario).
  pendientes: number;
  error?: string;
}

// Manda los emails que estén pendientes en cualquier cuestionario abierto
// (primero los primeros envíos, luego los recordatorios), hasta el límite de
// hoy. Lo usan los botones del panel y el cron diario.
export async function procesarEnviosPendientes(supabase: SupabaseClient): Promise<ResultadoEnvio> {
  if (!process.env.RESEND_API_KEY) return { enviados: 0, pendientes: 0, error: "Falta RESEND_API_KEY en el servidor." };

  const { data: abiertas, error } = await supabase
    .from("encuestas")
    .select("id, edicion_id, publico, titulo, introduccion, enviada_en, recordatorio_pedido_en, cerrada")
    .eq("cerrada", false)
    .not("enviada_en", "is", null);
  if (error) return { enviados: 0, pendientes: 0, error: error.message };

  const pendientes: Pendiente[] = [];
  for (const encuesta of (abiertas ?? []) as Encuesta[]) {
    const iniciales = await obtenerTodasLasFilas<{ id: string; email: string }>((desde, hasta) =>
      supabase
        .from("encuesta_envios")
        .select("id, email")
        .eq("encuesta_id", encuesta.id)
        .is("enviado_en", null)
        .order("id")
        .range(desde, hasta)
    );
    iniciales.forEach((e) => pendientes.push({ encuesta, ...e, recordatorio: false, recordatorioAnterior: null }));
  }
  for (const encuesta of (abiertas ?? []) as Encuesta[]) {
    const pedido = encuesta.recordatorio_pedido_en;
    if (!pedido) continue;
    const filas = await obtenerTodasLasFilas<{ id: string; email: string; recordatorio_en: string | null }>((desde, hasta) =>
      supabase
        .from("encuesta_envios")
        .select("id, email, recordatorio_en")
        .eq("encuesta_id", encuesta.id)
        .lt("enviado_en", pedido)
        .is("respondido_en", null)
        .or(`recordatorio_en.is.null,recordatorio_en.lt."${pedido}"`)
        .order("id")
        .range(desde, hasta)
    );
    filas.forEach((e) =>
      pendientes.push({ encuesta, id: e.id, email: e.email, recordatorio: true, recordatorioAnterior: e.recordatorio_en })
    );
  }
  if (pendientes.length === 0) return { enviados: 0, pendientes: 0 };

  let hoy: number;
  try {
    hoy = await emailsEncuestaHoy(supabase);
  } catch (e) {
    return { enviados: 0, pendientes: pendientes.length, error: e instanceof Error ? e.message : String(e) };
  }
  const cupo = Math.max(0, LIMITE_DIARIO_ENCUESTAS - hoy);
  const lote = pendientes.slice(0, Math.min(cupo, 100));
  if (lote.length === 0) return { enviados: 0, pendientes: pendientes.length };

  // Se marcan antes de mandar (solo los que sigan pendientes): si el botón y
  // el cron coinciden, cada email sale una sola vez.
  const ahora = new Date().toISOString();
  const marcados = await marcar(supabase, lote, ahora);
  if (marcados.length === 0) return { enviados: 0, pendientes: pendientes.length };

  const resend = new Resend(process.env.RESEND_API_KEY);
  let fallo: string | null = null;
  try {
    const { error: errorResend } = await resend.batch.send(
      marcados.map((p) => ({ ...emailEncuesta(p.encuesta, p.id, p.recordatorio), to: p.email }))
    );
    if (errorResend) {
      fallo =
        errorResend.name === "daily_quota_exceeded" || errorResend.name === "rate_limit_exceeded"
          ? "Resend ha llegado a su límite de emails por hoy: lo pendiente saldrá en los próximos días."
          : errorResend.message;
    }
  } catch (e) {
    fallo = e instanceof Error ? e.message : "Error desconocido enviando los emails.";
  }
  if (fallo) {
    console.error("encuestas: el envío falló", fallo);
    await desmarcar(supabase, marcados);
    return { enviados: 0, pendientes: pendientes.length, error: fallo };
  }
  return { enviados: marcados.length, pendientes: pendientes.length - marcados.length };
}

async function marcar(supabase: SupabaseClient, lote: Pendiente[], ahora: string): Promise<Pendiente[]> {
  const iniciales = lote.filter((p) => !p.recordatorio);
  const recordatorios = lote.filter((p) => p.recordatorio);
  const marcados: Pendiente[] = [];
  if (iniciales.length > 0) {
    const { data } = await supabase
      .from("encuesta_envios")
      .update({ enviado_en: ahora })
      .in("id", iniciales.map((p) => p.id))
      .is("enviado_en", null)
      .select("id");
    const ok = new Set((data ?? []).map((f) => f.id));
    marcados.push(...iniciales.filter((p) => ok.has(p.id)));
  }
  // Recordatorios agrupados por cuestionario (cada uno con su fecha de petición).
  const porEncuesta = new Map<string, Pendiente[]>();
  recordatorios.forEach((p) => porEncuesta.set(p.encuesta.id, [...(porEncuesta.get(p.encuesta.id) ?? []), p]));
  for (const grupo of porEncuesta.values()) {
    const pedido = grupo[0].encuesta.recordatorio_pedido_en!;
    const { data } = await supabase
      .from("encuesta_envios")
      .update({ recordatorio_en: ahora })
      .in("id", grupo.map((p) => p.id))
      .is("respondido_en", null)
      .or(`recordatorio_en.is.null,recordatorio_en.lt."${pedido}"`)
      .select("id");
    const ok = new Set((data ?? []).map((f) => f.id));
    marcados.push(...grupo.filter((p) => ok.has(p.id)));
  }
  return marcados;
}

async function desmarcar(supabase: SupabaseClient, marcados: Pendiente[]) {
  const iniciales = marcados.filter((p) => !p.recordatorio).map((p) => p.id);
  if (iniciales.length > 0) {
    await supabase.from("encuesta_envios").update({ enviado_en: null }).in("id", iniciales);
  }
  // Cada recordatorio vuelve a su valor anterior (vacío o el de un
  // recordatorio de antes).
  const porAnterior = new Map<string | null, string[]>();
  marcados
    .filter((p) => p.recordatorio)
    .forEach((p) => porAnterior.set(p.recordatorioAnterior, [...(porAnterior.get(p.recordatorioAnterior) ?? []), p.id]));
  for (const [anterior, ids] of porAnterior) {
    await supabase.from("encuesta_envios").update({ recordatorio_en: anterior }).in("id", ids);
  }
}

// ---------- Página pública ----------

export type PreguntaPublica = { id: string; texto: string; tipo: Pregunta["tipo"]; opciones: string[] | null; obligatoria: boolean };

export type EncuestaPorToken =
  | { estado: "invalido" }
  | { estado: "respondida" | "cerrada"; titulo: string }
  | {
      estado: "abierta";
      envioId: string;
      encuestaId: string;
      titulo: string;
      introduccion: string | null;
      preguntas: PreguntaPublica[];
    };

// Lo que corresponde a un enlace /encuesta/<token>. Nunca devuelve el email.
export async function encuestaPorToken(supabase: SupabaseClient, token: string): Promise<EncuestaPorToken> {
  if (!token || token.length > 100 || !/^[A-Za-z0-9_-]+$/.test(token)) return { estado: "invalido" };
  const { data: envio } = await supabase
    .from("encuesta_envios")
    .select("id, encuesta_id, respondido_en")
    .eq("token_hash", hashToken(token))
    .maybeSingle();
  if (!envio) return { estado: "invalido" };
  const { data: encuesta } = await supabase
    .from("encuestas")
    .select("id, titulo, introduccion, cerrada")
    .eq("id", envio.encuesta_id)
    .maybeSingle();
  if (!encuesta) return { estado: "invalido" };
  if (envio.respondido_en) return { estado: "respondida", titulo: encuesta.titulo };
  if (encuesta.cerrada) return { estado: "cerrada", titulo: encuesta.titulo };
  const { data: preguntas, error } = await supabase
    .from("encuesta_preguntas")
    .select("id, texto, tipo, opciones, obligatoria")
    .eq("encuesta_id", encuesta.id)
    .order("orden");
  if (error) throw new Error(error.message);
  return {
    estado: "abierta",
    envioId: envio.id,
    encuestaId: encuesta.id,
    titulo: encuesta.titulo,
    introduccion: encuesta.introduccion,
    preguntas: (preguntas ?? []) as PreguntaPublica[],
  };
}
