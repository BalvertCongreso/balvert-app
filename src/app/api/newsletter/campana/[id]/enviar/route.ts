import { NextResponse } from "next/server";
import { usuarioDesdeCabecera } from "@/lib/supabaseServidor";
import { enviarCampanaATodos } from "@/lib/mailrelay";
import { enviarAvisoNewsletter } from "@/lib/newsletterAvisoEmail";

// Solo se incluye callback_url si hay un secreto configurado, para que
// Mailrelay no pueda disparar el aviso de cualquiera que adivine la ruta.
function construirCallbackUrl(req: Request): string | undefined {
  const secreto = process.env.MAILRELAY_CALLBACK_SECRET;
  if (!secreto) return undefined;
  const origin = req.headers.get("origin") || new URL(req.url).origin;
  return `${origin}/api/newsletter/mailrelay-callback?secret=${encodeURIComponent(secreto)}`;
}

// Envía la campaña a TODO el grupo (destinatarios reales). Solo debe
// dispararse desde el botón de la app, tras confirmación explícita de
// Ariadna/Ariosto en pantalla — nunca desde una prueba automatizada.
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const usuario = await usuarioDesdeCabecera(req.headers.get("authorization"));
  if (!usuario) {
    return NextResponse.json({ error: "Sesión no encontrada. Vuelve a iniciar sesión." }, { status: 401 });
  }

  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const scheduledAtUtc = typeof body.scheduledAtUtc === "string" ? body.scheduledAtUtc : undefined;
  const asunto = typeof body.asunto === "string" && body.asunto.trim() ? body.asunto : "Newsletter BALVERT";
  const totalContactos = typeof body.totalContactos === "number" ? body.totalContactos : undefined;
  if (scheduledAtUtc && !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(scheduledAtUtc)) {
    return NextResponse.json(
      { error: "Formato de fecha programada inválido." },
      { status: 400 }
    );
  }

  try {
    await enviarCampanaATodos(Number(id), {
      scheduledAtUtc,
      callbackUrl: scheduledAtUtc ? construirCallbackUrl(req) : undefined,
    });

    if (!scheduledAtUtc) {
      // Envío inmediato: el aviso por email va aquí mismo, aparte del aviso
      // en pantalla. Si es programado, el envío real ocurre más tarde y el
      // aviso llega desde el callback de Mailrelay (ver mailrelay-callback).
      await enviarAvisoNewsletter({ asunto, totalContactos, programado: false, exito: true });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    const mensaje = e instanceof Error ? e.message : "No se pudo enviar la campaña.";
    await enviarAvisoNewsletter({
      asunto,
      totalContactos,
      programado: Boolean(scheduledAtUtc),
      exito: false,
      detalle: mensaje,
    });
    return NextResponse.json({ error: mensaje }, { status: 502 });
  }
}
