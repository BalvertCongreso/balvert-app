import { NextResponse } from "next/server";
import { crearClienteServicio, usuarioDesdeCabecera } from "@/lib/supabaseServidor";
import { idEdicionActiva } from "@/lib/portal";
import { MAX_INTRODUCCION, MAX_TITULO, esPublico, validarPreguntas, type Encuesta } from "@/lib/encuestas";
import {
  LIMITE_DIARIO_ENCUESTAS,
  crearEnviosNuevos,
  destinatarios,
  emailsEncuestaHoy,
  encuestasDeEdicion,
  enviosDeEncuesta,
  procesarEnviosPendientes,
  type ResultadoEnvio,
} from "@/lib/encuestasServidor";

export const runtime = "nodejs";
export const maxDuration = 60;

// Pantalla interna "Cuestionarios". Las tablas de encuestas no tienen
// políticas RLS: solo se tocan desde aquí con la clave de servicio, tras
// comprobar el login de Ariadna/Ariosto (igual que /api/documentos).

const sinSesion = () =>
  NextResponse.json({ error: "Sesión no encontrada. Vuelve a iniciar sesión." }, { status: 401 });

async function encuestaActiva(publico: unknown): Promise<Encuesta | NextResponse> {
  if (!esPublico(publico)) return NextResponse.json({ error: "Cuestionario no válido." }, { status: 400 });
  const supabase = crearClienteServicio();
  const edicionId = await idEdicionActiva(supabase);
  if (!edicionId) return NextResponse.json({ error: "No hay ninguna edición activa." }, { status: 400 });
  const encuestas = await encuestasDeEdicion(supabase, edicionId);
  const encuesta = encuestas.find((e) => e.publico === publico);
  if (!encuesta) return NextResponse.json({ error: "No se pudo preparar el cuestionario." }, { status: 500 });
  return encuesta;
}

export async function GET(req: Request) {
  if (!(await usuarioDesdeCabecera(req.headers.get("authorization")))) return sinSesion();
  try {
    const encuesta = await encuestaActiva(new URL(req.url).searchParams.get("publico"));
    if (encuesta instanceof NextResponse) return encuesta;
    const supabase = crearClienteServicio();

    const [preguntas, envios, posibles, emailsHoy, respuestas] = await Promise.all([
      supabase
        .from("encuesta_preguntas")
        .select("id, texto, tipo, opciones, obligatoria")
        .eq("encuesta_id", encuesta.id)
        .order("orden"),
      enviosDeEncuesta(supabase, encuesta.id),
      destinatarios(supabase, encuesta.edicion_id, encuesta.publico),
      emailsEncuestaHoy(supabase),
      // Ordenadas por día y luego por id (aleatorio): el orden no delata quién
      // contestó primero. Nunca se devuelve el id.
      supabase
        .from("encuesta_respuestas")
        .select("respuestas, fecha")
        .eq("encuesta_id", encuesta.id)
        .order("fecha")
        .order("id")
        .limit(5000),
    ]);
    if (preguntas.error) throw new Error(preguntas.error.message);
    if (respuestas.error) throw new Error(respuestas.error.message);

    // Solo recuentos: el panel no recibe la lista de emails.
    const yaEnviados = new Set(envios.map((e) => e.email));
    const pedido = encuesta.recordatorio_pedido_en ? Date.parse(encuesta.recordatorio_pedido_en) : null;
    const antes = (fecha: string | null, limite: number) => fecha !== null && Date.parse(fecha) < limite;
    const estado = {
      destinatarios: posibles.length,
      nuevos: posibles.filter((email) => !yaEnviados.has(email)).length,
      total_envios: envios.length,
      enviados: envios.filter((e) => e.enviado_en).length,
      por_enviar: envios.filter((e) => !e.enviado_en).length,
      respondidos: envios.filter((e) => e.respondido_en).length,
      sin_responder: envios.filter((e) => e.enviado_en && !e.respondido_en).length,
      recordatorios_por_enviar: pedido
        ? envios.filter(
            (e) =>
              antes(e.enviado_en, pedido) &&
              !e.respondido_en &&
              (!e.recordatorio_en || antes(e.recordatorio_en, pedido))
          ).length
        : 0,
      emails_hoy: emailsHoy,
      limite_diario: LIMITE_DIARIO_ENCUESTAS,
    };

    return NextResponse.json({ encuesta, preguntas: preguntas.data ?? [], estado, respuestas: respuestas.data ?? [] });
  } catch (e) {
    console.error("encuestas GET", e);
    return NextResponse.json(
      { error: "No se pudo cargar el cuestionario: " + (e instanceof Error ? e.message : String(e)) },
      { status: 500 }
    );
  }
}

function textoResultado(r: ResultadoEnvio, que: string): string {
  if (r.error) return `${r.enviados > 0 ? `Enviados ${r.enviados}. ` : ""}No se pudo enviar: ${r.error}`;
  if (r.enviados === 0 && r.pendientes === 0) return `No había ${que} pendientes de enviar.`;
  if (r.pendientes === 0) return `Enviados ${r.enviados} ${que}.`;
  return `Enviados ${r.enviados} de ${r.enviados + r.pendientes} ${que}. El resto saldrá solo en los próximos días (límite de ${LIMITE_DIARIO_ENCUESTAS} emails de cuestionarios al día).`;
}

export async function POST(req: Request) {
  if (!(await usuarioDesdeCabecera(req.headers.get("authorization")))) return sinSesion();
  const body = await req.json().catch(() => null);
  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Petición no válida." }, { status: 400 });
  }

  try {
    const encuesta = await encuestaActiva(body.publico);
    if (encuesta instanceof NextResponse) return encuesta;
    const supabase = crearClienteServicio();

    switch (body.accion) {
      case "guardar": {
        const titulo = typeof body.titulo === "string" ? body.titulo.trim() : "";
        const introduccion = typeof body.introduccion === "string" ? body.introduccion.trim() : "";
        if (!titulo || titulo.length > MAX_TITULO) {
          return NextResponse.json({ error: `Escribe un título (máximo ${MAX_TITULO} caracteres).` }, { status: 400 });
        }
        if (introduccion.length > MAX_INTRODUCCION) {
          return NextResponse.json({ error: `La introducción es demasiado larga (máximo ${MAX_INTRODUCCION}).` }, { status: 400 });
        }
        if (body.preguntas !== undefined) {
          const validadas = validarPreguntas(body.preguntas);
          if ("error" in validadas) return NextResponse.json({ error: validadas.error }, { status: 400 });
          const { data: resultado, error } = await supabase.rpc("guardar_preguntas_encuesta", {
            p_encuesta_id: encuesta.id,
            p_preguntas: validadas.preguntas,
          });
          if (error) throw new Error(error.message);
          if (resultado === "enviada") {
            return NextResponse.json(
              { error: "El cuestionario ya se ha enviado: las preguntas no se pueden cambiar. Solo el título y la introducción." },
              { status: 409 }
            );
          }
        }
        const { error } = await supabase
          .from("encuestas")
          .update({ titulo, introduccion: introduccion || null })
          .eq("id", encuesta.id);
        if (error) throw new Error(error.message);
        return NextResponse.json({ ok: true, mensaje: "Guardado." });
      }

      case "enviar": {
        if (encuesta.cerrada) {
          return NextResponse.json({ error: "El cuestionario está cerrado. Ábrelo para poder enviarlo." }, { status: 400 });
        }
        const { count } = await supabase
          .from("encuesta_preguntas")
          .select("id", { count: "exact", head: true })
          .eq("encuesta_id", encuesta.id);
        if (!count) return NextResponse.json({ error: "El cuestionario no tiene preguntas." }, { status: 400 });

        // Primero se bloquean las preguntas, después salen los emails.
        if (!encuesta.enviada_en) {
          const { error } = await supabase
            .from("encuestas")
            .update({ enviada_en: new Date().toISOString() })
            .eq("id", encuesta.id)
            .is("enviada_en", null);
          if (error) throw new Error(error.message);
        }
        const nuevos = await crearEnviosNuevos(supabase, encuesta);
        const resultado = await procesarEnviosPendientes(supabase);
        if (nuevos === 0 && resultado.enviados === 0 && !resultado.error) {
          return NextResponse.json({ ok: true, mensaje: "No hay personas nuevas a las que enviarlo." });
        }
        return NextResponse.json({ ok: true, mensaje: textoResultado(resultado, "emails") });
      }

      case "recordatorio": {
        if (!encuesta.enviada_en) return NextResponse.json({ error: "El cuestionario aún no se ha enviado." }, { status: 400 });
        if (encuesta.cerrada) return NextResponse.json({ error: "El cuestionario está cerrado." }, { status: 400 });
        const { error } = await supabase
          .from("encuestas")
          .update({ recordatorio_pedido_en: new Date().toISOString() })
          .eq("id", encuesta.id);
        if (error) throw new Error(error.message);
        const resultado = await procesarEnviosPendientes(supabase);
        return NextResponse.json({ ok: true, mensaje: textoResultado(resultado, "emails (incluidos recordatorios)") });
      }

      case "cerrar":
      case "reabrir": {
        const { error } = await supabase
          .from("encuestas")
          .update({ cerrada: body.accion === "cerrar" })
          .eq("id", encuesta.id);
        if (error) throw new Error(error.message);
        return NextResponse.json({
          ok: true,
          mensaje: body.accion === "cerrar" ? "Cuestionario cerrado: ya no acepta respuestas." : "Cuestionario abierto de nuevo.",
        });
      }

      default:
        return NextResponse.json({ error: "Acción no válida." }, { status: 400 });
    }
  } catch (e) {
    console.error("encuestas POST", e);
    return NextResponse.json({ error: "Error: " + (e instanceof Error ? e.message : String(e)) }, { status: 500 });
  }
}
