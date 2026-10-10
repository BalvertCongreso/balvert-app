import { NextResponse } from "next/server";
import { crearClienteServicio } from "@/lib/supabaseServidor";
import { validarRespuestas } from "@/lib/encuestas";
import { encuestaPorToken, hoyMadrid } from "@/lib/encuestasServidor";

export const runtime = "nodejs";

// Respuesta pública a un cuestionario (/encuesta/<token>), sin sesión: el
// enlace personal es lo que autoriza, y solo sirve una vez.
//
// ANONIMATO: primero se marca el envío como contestado (solo el día) y,
// en una operación aparte, se guarda la respuesta sin ningún dato que la una
// al envío (ni id, ni token, ni email, ni hora). No se escribe nada en los
// registros del servidor que permita relacionarlas.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const token = typeof body?.token === "string" ? body.token : "";
  const supabase = crearClienteServicio();

  const encuesta = await encuestaPorToken(supabase, token).catch(() => null);
  if (!encuesta) return NextResponse.json({ error: "No se pudo enviar. Inténtalo de nuevo." }, { status: 500 });
  if (encuesta.estado === "invalido") {
    return NextResponse.json({ error: "Este enlace no es válido." }, { status: 404 });
  }
  if (encuesta.estado === "respondida") {
    return NextResponse.json({ error: "Este cuestionario ya se ha contestado con este enlace. ¡Gracias!" }, { status: 409 });
  }
  if (encuesta.estado !== "abierta") {
    return NextResponse.json({ error: "Este cuestionario ya está cerrado y no admite más respuestas." }, { status: 409 });
  }

  const { errores, limpias } = validarRespuestas(encuesta.preguntas, body?.respuestas);
  if (Object.keys(errores).length > 0) {
    return NextResponse.json({ error: "Revisa las preguntas marcadas.", errores }, { status: 400 });
  }

  const fecha = hoyMadrid();
  // Marcar el envío solo si sigue sin contestar: si llegan dos envíos a la
  // vez con el mismo enlace, solo uno lo consigue.
  const { data: marcado, error: errorMarcar } = await supabase
    .from("encuesta_envios")
    .update({ respondido_en: fecha })
    .eq("id", encuesta.envioId)
    .is("respondido_en", null)
    .select("id");
  if (errorMarcar) return NextResponse.json({ error: "No se pudo enviar. Inténtalo de nuevo." }, { status: 500 });
  if (!marcado || marcado.length === 0) {
    return NextResponse.json({ error: "Este cuestionario ya se ha contestado con este enlace. ¡Gracias!" }, { status: 409 });
  }

  const { error } = await supabase
    .from("encuesta_respuestas")
    .insert({ encuesta_id: encuesta.encuestaId, respuestas: limpias, fecha });
  if (error) {
    // Que pueda volver a intentarlo.
    await supabase.from("encuesta_envios").update({ respondido_en: null }).eq("id", encuesta.envioId);
    return NextResponse.json({ error: "No se pudo enviar. Inténtalo de nuevo." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
