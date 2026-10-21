import { NextResponse } from "next/server";
import { crearClienteServidor, usuarioDesdeCabecera } from "@/lib/supabaseServidor";
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

export const runtime = "nodejs";

// Invitados de un patrocinador desde su ficha en el panel. Con el cliente de
// la propia sesión (no la clave de servicio): RLS deja hacer todo con login, y
// así el historial de Congreso/Gala/Excursión sale con el nombre de quien lo
// hizo. Desde aquí se puede pasar de lo incluido (la pantalla avisa antes).

const sinSesion = () =>
  NextResponse.json({ error: "Sesión no encontrada. Vuelve a iniciar sesión." }, { status: 401 });

function respuestaError(e: unknown) {
  if (e instanceof ErrorInvitados) return NextResponse.json({ error: e.message }, { status: e.estado });
  const mensaje = e instanceof Error ? e.message : "Error inesperado.";
  return NextResponse.json({ error: mensaje }, { status: 500 });
}

async function preparar(req: Request, patrocinadorId: string | null) {
  const auth = req.headers.get("authorization");
  if (!(await usuarioDesdeCabecera(auth))) return { respuesta: sinSesion() };
  if (!patrocinadorId) return { respuesta: NextResponse.json({ error: "Falta el patrocinador." }, { status: 400 }) };
  const supabase = crearClienteServidor(auth);
  const patrocinador = await leerPatrocinador(supabase, patrocinadorId);
  if (!patrocinador) return { respuesta: NextResponse.json({ error: "No se encontró el patrocinador." }, { status: 404 }) };
  return { supabase, patrocinador };
}

export async function GET(req: Request) {
  const p = await preparar(req, new URL(req.url).searchParams.get("patrocinador_id"));
  if (p.respuesta) return p.respuesta;
  try {
    return NextResponse.json(await listarInvitados(p.supabase, p.patrocinador));
  } catch (e) {
    return respuestaError(e);
  }
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const p = await preparar(req, typeof body?.patrocinador_id === "string" ? body.patrocinador_id : null);
  if (p.respuesta) return p.respuesta;
  const datos = validarNuevoInvitado(body);
  if (typeof datos === "string") return NextResponse.json({ error: datos }, { status: 400 });
  try {
    const resultado = await anadirInvitado(p.supabase, p.patrocinador, datos, {
      enviar: body?.enviar !== false,
      limitar: false,
    });
    return NextResponse.json(resultado);
  } catch (e) {
    return respuestaError(e);
  }
}

export async function DELETE(req: Request) {
  const params = new URL(req.url).searchParams;
  const p = await preparar(req, params.get("patrocinador_id"));
  if (p.respuesta) return p.respuesta;
  const clave = params.get("clave");
  if (!clave) return NextResponse.json({ error: "Falta el invitado." }, { status: 400 });
  try {
    await quitarInvitado(p.supabase, p.patrocinador, clave);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return respuestaError(e);
  }
}

// Cena de gala / excursión de un invitado ya asignado (Diamante):
// { patrocinador_id, clave, accion: "anadir" | "quitar", evento, menu?, alergias? }.
// Desde el panel se puede pasar de lo incluido (la pantalla avisa antes).
export async function PATCH(req: Request) {
  const body = await req.json().catch(() => null);
  const p = await preparar(req, typeof body?.patrocinador_id === "string" ? body.patrocinador_id : null);
  if (p.respuesta) return p.respuesta;
  const clave = typeof body?.clave === "string" ? body.clave : "";
  if (!clave) return NextResponse.json({ error: "Falta el invitado." }, { status: 400 });
  const quitar = body?.accion === "quitar";
  // Para quitar basta con el evento; para añadir la cena hace falta el menú.
  const extra = quitar ? (esEventoExtra(body?.evento) ? { evento: body.evento, gala: null } : "Elige cena de gala o excursión.") : validarEventoExtra(body);
  if (typeof extra === "string") return NextResponse.json({ error: extra }, { status: 400 });
  try {
    if (quitar) {
      await quitarEventoInvitado(p.supabase, p.patrocinador, clave, extra.evento);
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json(await anadirEventoInvitado(p.supabase, p.patrocinador, clave, extra, { limitar: false }));
  } catch (e) {
    return respuestaError(e);
  }
}
