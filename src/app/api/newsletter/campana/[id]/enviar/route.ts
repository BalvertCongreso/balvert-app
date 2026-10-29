import { NextResponse } from "next/server";
import { crearClienteServidor, usuarioDesdeCabecera } from "@/lib/supabaseServidor";
import { enviarCampanaATodos } from "@/lib/mailrelay";
import { enviarAvisoNewsletter } from "@/lib/newsletterAvisoEmail";
import { ORIGEN_PUBLICO } from "@/lib/dominio";
import { registrarBoletinEnviado } from "@/lib/boletines";

// Solo se incluye callback_url si hay un secreto configurado, para que
// Mailrelay no pueda disparar el aviso de cualquiera que adivine la ruta.
// Siempre con el dominio público, nunca con el que mande el navegador: la
// URL lleva el secreto y no debe registrarse apuntando a otro sitio. Se pide
// también en los envíos inmediatos: al terminar, el callback recoge los
// rebotes y bajas (en esos no vuelve a mandar el aviso por email).
function construirCallbackUrl(inmediato: boolean): string | undefined {
  const secreto = process.env.MAILRELAY_CALLBACK_SECRET;
  if (!secreto) return undefined;
  return `${ORIGEN_PUBLICO}/api/newsletter/mailrelay-callback?secret=${encodeURIComponent(secreto)}${
    inmediato ? "&inmediato=1" : ""
  }`;
}

// Envía la campaña a TODO el grupo (destinatarios reales). Solo debe
// dispararse desde el botón de la app, tras confirmación explícita de
// Ariadna/Ariosto en pantalla — nunca desde una prueba automatizada.
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const authHeader = req.headers.get("authorization");
  const usuario = await usuarioDesdeCabecera(authHeader);
  if (!usuario) {
    return NextResponse.json({ error: "Sesión no encontrada. Vuelve a iniciar sesión." }, { status: 401 });
  }

  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const scheduledAtUtc = typeof body.scheduledAtUtc === "string" ? body.scheduledAtUtc : undefined;
  const asunto = typeof body.asunto === "string" && body.asunto.trim() ? body.asunto : "Newsletter BALVERT";
  const totalContactos = typeof body.totalContactos === "number" ? body.totalContactos : undefined;
  const origen = typeof body.origen === "string" && body.origen.trim() ? body.origen : null;
  if (scheduledAtUtc && !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(scheduledAtUtc)) {
    return NextResponse.json(
      { error: "Formato de fecha programada inválido." },
      { status: 400 }
    );
  }

  try {
    await enviarCampanaATodos(Number(id), {
      scheduledAtUtc,
      callbackUrl: construirCallbackUrl(!scheduledAtUtc),
    });

    if (!scheduledAtUtc) {
      // Envío inmediato: el aviso por email va aquí mismo, aparte del aviso
      // en pantalla. Si es programado, el envío real ocurre más tarde y el
      // aviso llega desde el callback de Mailrelay (ver mailrelay-callback).
      await enviarAvisoNewsletter({ asunto, totalContactos, programado: false, exito: true });
    }

    // El boletín ya ha salido: si falla el registro en el histórico no se
    // deshace nada, solo se avisa en pantalla.
    let avisoHistorico: string | undefined;
    try {
      await registrarBoletinEnviado(crearClienteServidor(authHeader), {
        campaignId: Number(id),
        asunto,
        fechaEnvio: scheduledAtUtc ? new Date(scheduledAtUtc.replace(" ", "T") + "Z").toISOString() : new Date().toISOString(),
        origen,
      });
    } catch (e) {
      avisoHistorico = `Ojo: no se pudo guardar en el histórico de los contactos (${
        e instanceof Error ? e.message : "error desconocido"
      }).`;
    }

    return NextResponse.json({ ok: true, avisoHistorico });
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
