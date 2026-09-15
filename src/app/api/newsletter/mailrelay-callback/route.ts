import { NextResponse } from "next/server";
import { obtenerCampanaEnviada } from "@/lib/mailrelay";
import { enviarAvisoNewsletter } from "@/lib/newsletterAvisoEmail";

// Mailrelay llama aquí (POST, sin sesión de la app — es un servidor externo)
// cuando termina de procesar un envío programado de newsletter. Documentación:
// https://apidocs.mailrelay.com/tag/campaigns/POST/campaigns/%7Bid%7D/send_all
//
// El payload que manda solo trae {"type":"sent_campaign_finished","id":N}
// (N = id del "sent campaign", no el de la campaña original) — no dice si el
// envío fue bien o mal. Por eso consultamos GET /sent_campaigns/{id} para
// saber el estado real (status, contadores de entregados/rebotados) antes de
// avisar a Ariadna.
export async function POST(req: Request) {
  const secreto = process.env.MAILRELAY_CALLBACK_SECRET;
  const secretoRecibido = new URL(req.url).searchParams.get("secret");
  if (!secreto || secretoRecibido !== secreto) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const sentCampaignId = body?.id;
  if (typeof sentCampaignId !== "number") {
    return NextResponse.json({ error: "Payload inválido." }, { status: 400 });
  }

  try {
    const campana = await obtenerCampanaEnviada(sentCampaignId);
    const exito = campana.status === "finished";
    await enviarAvisoNewsletter({
      asunto: campana.subject || "Newsletter BALVERT",
      totalContactos: campana.processed_emails_count,
      programado: true,
      exito,
      detalle: exito
        ? `Enviados: ${campana.sent_emails_count ?? "?"} · Entregados: ${campana.delivered_emails_count ?? "?"} · Rebotados: ${campana.bounced_emails_count ?? 0}.`
        : `Estado en Mailrelay: "${campana.status ?? "desconocido"}".`,
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
