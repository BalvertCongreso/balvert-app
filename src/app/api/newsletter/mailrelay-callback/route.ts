import { NextResponse } from "next/server";
import { obtenerCampanaEnviada } from "@/lib/mailrelay";
import { enviarAvisoNewsletter } from "@/lib/newsletterAvisoEmail";
import { crearClienteServicio } from "@/lib/supabaseServidor";
import { actualizarDesdeMailrelay } from "@/lib/mailrelayResultados";
import { textoResumen } from "@/lib/exclusiones";

// Mailrelay llama aquí (POST, sin sesión de la app — es un servidor externo)
// cuando termina de procesar un envío de newsletter (programado o inmediato,
// este con ?inmediato=1). Documentación:
// https://apidocs.mailrelay.com/tag/campaigns/POST/campaigns/%7Bid%7D/send_all
//
// El payload que manda solo trae {"type":"sent_campaign_finished","id":N}
// (N = id del "sent campaign", no el de la campaña original) — no dice si el
// envío fue bien o mal. Por eso consultamos GET /sent_campaigns/{id} para
// saber el estado real (status, contadores de entregados/rebotados) antes de
// avisar a Ariadna.
//
// Además recoge los rebotes y bajas de ese envío y los aplica a Contactos
// (con la clave de servicio: aquí no hay sesión). Los rebotes que lleguen más
// tarde se recogen con el botón «Actualizar rebotes y bajas desde Mailrelay».
export async function POST(req: Request) {
  const secreto = process.env.MAILRELAY_CALLBACK_SECRET;
  const parametros = new URL(req.url).searchParams;
  const secretoRecibido = parametros.get("secret");
  const inmediato = parametros.get("inmediato") === "1";
  if (!secreto || secretoRecibido !== secreto) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const sentCampaignId = body?.id;
  if (typeof sentCampaignId !== "number") {
    return NextResponse.json({ error: "Payload inválido." }, { status: 400 });
  }

  let resumenContactos: string;
  try {
    const resumen = await actualizarDesdeMailrelay(crearClienteServicio(), { sentCampaignIds: [sentCampaignId] });
    resumenContactos = `Contactos: ${textoResumen(resumen)}`;
  } catch (e) {
    resumenContactos = `No se pudieron recoger los rebotes y bajas en Contactos (${
      e instanceof Error ? e.message : "error desconocido"
    }). Usa el botón «Actualizar rebotes y bajas desde Mailrelay» en Contactos.`;
  }

  // En los envíos inmediatos el aviso por email ya salió al enviar.
  if (inmediato) return NextResponse.json({ ok: true });

  try {
    const campana = await obtenerCampanaEnviada(sentCampaignId);
    const exito = campana.status === "finished";
    await enviarAvisoNewsletter({
      asunto: campana.subject || "Newsletter BALVERT",
      totalContactos: campana.processed_emails_count,
      programado: true,
      exito,
      detalle: exito
        ? `Enviados: ${campana.sent_emails_count ?? "?"} · Entregados: ${campana.delivered_emails_count ?? "?"} · Rebotados: ${campana.bounced_emails_count ?? 0}. ${resumenContactos}`
        : `Estado en Mailrelay: "${campana.status ?? "desconocido"}". ${resumenContactos}`,
    });
  } catch (e) {
    // Aunque no podamos confirmar el resultado exacto, avisamos igual de que
    // el envío programado ya se procesó — mejor eso que quedarse callado.
    await enviarAvisoNewsletter({
      asunto: "Newsletter BALVERT (programada)",
      programado: true,
      exito: false,
      detalle: `Mailrelay avisó de que terminó de procesar el envío programado, pero no se pudo comprobar el resultado: ${
        e instanceof Error ? e.message : "error desconocido"
      }.`,
    });
  }

  return NextResponse.json({ ok: true });
}
