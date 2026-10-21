import { NextResponse } from "next/server";
import { crearClienteServicio } from "@/lib/supabaseServidor";
import { idEdicionActiva } from "@/lib/portal";
import { autorEmpresa, claveAcciones, sesionEmpresa, type SesionEmpresa } from "@/lib/portalEmpresa";
import {
  ErrorInvitados,
  anadirEventoInvitado,
  anadirInvitado,
  esEventoExtra,
  leerPatrocinador,
  listarInvitados,
  quitarEventoInvitado,
  quitarInvitado,
  validarEventoExtra,
  validarNuevoInvitado,
} from "@/lib/invitadosServidor";
import { LIMITE_CAMBIOS_POR_HORA, MENSAJE_LIMITE, accionesUltimaHora, registrarAccion } from "@/lib/portalMateriales";

export const runtime = "nodejs";

// Pestaña «Invitaciones» de la zona de empresa: sus invitados (la empresa de
// la sesión, nunca la que mande el navegador). Puede añadir hasta lo incluido
// en su patrocinio (también la cena y la excursión en Diamante) y quitar a
// quien no haya hecho el check-in. La entrada se genera y se envía sola. Sin
// avisos ni tareas: queda en el historial con autor "Portal: <usuario>".

async function preparar() {
  const sesion = await sesionEmpresa();
  if (!sesion) return { respuesta: NextResponse.json({ error: "Tu sesión ha caducado. Vuelve a entrar." }, { status: 401 }) };
  const supabase = crearClienteServicio();
  const [patrocinador, edicionId] = await Promise.all([
    leerPatrocinador(supabase, sesion.patrocinadorId),
    idEdicionActiva(supabase),
  ]);
  if (!patrocinador || patrocinador.edicion_id !== edicionId) {
    return { respuesta: NextResponse.json({ error: "Tu patrocinio no está en la edición actual." }, { status: 404 }) };
  }
  return { sesion, supabase, patrocinador };
}

function respuestaError(e: unknown) {
  if (e instanceof ErrorInvitados) return NextResponse.json({ error: e.message }, { status: e.estado });
  console.error("portal/empresa/invitados:", e instanceof Error ? e.message : e);
  return NextResponse.json({ error: "No se pudo guardar. Inténtalo de nuevo." }, { status: 500 });
}

async function limiteAlcanzado(supabase: ReturnType<typeof crearClienteServicio>, sesion: SesionEmpresa) {
  return (await accionesUltimaHora(supabase, claveAcciones(sesion), ["invitado"])) >= LIMITE_CAMBIOS_POR_HORA;
}

export async function GET() {
  const p = await preparar();
  if (p.respuesta) return p.respuesta;
  try {
    return NextResponse.json(await listarInvitados(p.supabase, p.patrocinador), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return respuestaError(e);
  }
}

export async function POST(req: Request) {
  const p = await preparar();
  if (p.respuesta) return p.respuesta;
  const body = await req.json().catch(() => null);
  const datos = validarNuevoInvitado(body);
  if (typeof datos === "string") return NextResponse.json({ error: datos }, { status: 400 });
  if (await limiteAlcanzado(p.supabase, p.sesion)) return NextResponse.json({ error: MENSAJE_LIMITE }, { status: 429 });
  try {
    const resultado = await anadirInvitado(p.supabase, p.patrocinador, datos, {
      enviar: true,
      limitar: true,
      autor: autorEmpresa(p.sesion),
    });
    await registrarAccion(p.supabase, claveAcciones(p.sesion), "invitado", "alta").catch(() => null);
    return NextResponse.json(resultado);
  } catch (e) {
    return respuestaError(e);
  }
}

export async function DELETE(req: Request) {
  const p = await preparar();
  if (p.respuesta) return p.respuesta;
  const clave = new URL(req.url).searchParams.get("clave");
  if (!clave) return NextResponse.json({ error: "Falta el invitado." }, { status: 400 });
  if (await limiteAlcanzado(p.supabase, p.sesion)) return NextResponse.json({ error: MENSAJE_LIMITE }, { status: 429 });
  try {
    await quitarInvitado(p.supabase, p.patrocinador, clave, autorEmpresa(p.sesion));
    await registrarAccion(p.supabase, claveAcciones(p.sesion), "invitado", "baja").catch(() => null);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return respuestaError(e);
  }
}

// Cena de gala / excursión de un invitado ya asignado (Diamante), solo hasta
// lo incluido: { clave, accion: "anadir" | "quitar", evento, menu?, alergias? }.
export async function PATCH(req: Request) {
  const p = await preparar();
  if (p.respuesta) return p.respuesta;
  const body = await req.json().catch(() => null);
  const clave = typeof body?.clave === "string" ? body.clave : "";
  if (!clave) return NextResponse.json({ error: "Falta el invitado." }, { status: 400 });
  const quitar = body?.accion === "quitar";
  // Para quitar basta con el evento; para añadir la cena hace falta el menú.
  const extra = quitar ? (esEventoExtra(body?.evento) ? { evento: body.evento, gala: null } : "Elige cena de gala o excursión.") : validarEventoExtra(body);
  if (typeof extra === "string") return NextResponse.json({ error: extra }, { status: 400 });
  if (await limiteAlcanzado(p.supabase, p.sesion)) return NextResponse.json({ error: MENSAJE_LIMITE }, { status: 429 });
  const autor = autorEmpresa(p.sesion);
  try {
    if (quitar) {
      await quitarEventoInvitado(p.supabase, p.patrocinador, clave, extra.evento, autor);
      await registrarAccion(p.supabase, claveAcciones(p.sesion), "invitado", `quitar_${extra.evento}`).catch(() => null);
      return NextResponse.json({ ok: true });
    }
    const resultado = await anadirEventoInvitado(p.supabase, p.patrocinador, clave, extra, { limitar: true, autor });
    await registrarAccion(p.supabase, claveAcciones(p.sesion), "invitado", `anadir_${extra.evento}`).catch(() => null);
    return NextResponse.json(resultado);
  } catch (e) {
    return respuestaError(e);
  }
}
