// «Actualizar rebotes y bajas desde Mailrelay»: consulta cada campaña enviada
// (también las mandadas desde el panel de Mailrelay) y aplica a Contactos sus
// rebotes, rebotes temporales y bajas, con el histórico de cada boletín.
// Solo servidor (usa la clave de la API de Mailrelay). Se ejecuta con el
// botón de Contactos y al terminar un envío (callback de Mailrelay); no hay
// cron (el plan de Vercel ya usa los dos que permite).
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  listarBajasCampana,
  listarCampanasEnviadas,
  listarEmailsEnviados,
  obtenerCampanaEnviada,
  type CampanaEnviada,
} from "@/lib/mailrelay";
import {
  aplicarSucesos,
  cargarContactosPorEmail,
  normalizarEmail,
  resumenVacio,
  sumarResumenes,
  type ResumenExclusiones,
  type SucesoEmail,
} from "@/lib/exclusiones";
import type { Boletin } from "@/types/database";

// Margen para reconocer como el mismo boletín uno enviado desde la app y la
// campaña de Mailrelay (mismo asunto, fecha parecida). Mailrelay no devuelve
// en la campaña enviada el id de la campaña de la que sale.
const MARGEN_MISMO_BOLETIN_MS = 2 * 24 * 60 * 60 * 1000;

function fechaCampana(c: CampanaEnviada): string {
  return c.scheduled_at || c.created_at || new Date().toISOString();
}

async function boletinDeCampana(
  db: SupabaseClient,
  campana: CampanaEnviada,
  simular: boolean
): Promise<{ boletin: Boletin | null; nuevo: boolean }> {
  const { data: enlazado, error } = await db
    .from("boletines")
    .select("*")
    .eq("mailrelay_sent_campaign_id", campana.id)
    .maybeSingle<Boletin>();
  if (error) throw new Error("No se pudieron leer los boletines: " + error.message);
  if (enlazado) return { boletin: enlazado, nuevo: false };

  const fecha = new Date(fechaCampana(campana)).getTime();
  const { data: candidatos } = await db
    .from("boletines")
    .select("*")
    .is("mailrelay_sent_campaign_id", null)
    .eq("enviado_desde", "App")
    .eq("asunto", campana.subject ?? "")
    .returns<Boletin[]>();
  const delApp = (candidatos ?? [])
    .map((b) => ({ b, distancia: Math.abs(new Date(b.fecha_envio).getTime() - fecha) }))
    .filter((x) => x.distancia <= MARGEN_MISMO_BOLETIN_MS)
    .sort((x, y) => x.distancia - y.distancia)[0]?.b;

  if (delApp) {
    if (!simular) {
      await db.from("boletines").update({ mailrelay_sent_campaign_id: campana.id }).eq("id", delApp.id);
    }
    return { boletin: { ...delApp, mailrelay_sent_campaign_id: campana.id }, nuevo: false };
  }

  if (simular) return { boletin: null, nuevo: true };

  const { data: creado, error: errorCrear } = await db
    .from("boletines")
    .insert({
      mailrelay_sent_campaign_id: campana.id,
      asunto: campana.subject ?? null,
      fecha_envio: fechaCampana(campana),
      origen_lista: "Desconocido (enviado desde Mailrelay)",
      destinatarios: campana.sent_emails_count ?? 0,
      enviado_desde: "Mailrelay",
    })
    .select("*")
    .single<Boletin>();
  if (errorCrear) throw new Error("No se pudo registrar el boletín: " + errorCrear.message);
  return { boletin: creado, nuevo: true };
}

export interface ResumenMailrelay extends ResumenExclusiones {
  campanas: number;
  boletinesNuevos: number;
}

export async function actualizarDesdeMailrelay(
  db: SupabaseClient,
  opciones: { sentCampaignIds?: number[]; simular?: boolean } = {}
): Promise<ResumenMailrelay> {
  const simular = Boolean(opciones.simular);
  const campanas = opciones.sentCampaignIds
    ? await Promise.all(opciones.sentCampaignIds.map((id) => obtenerCampanaEnviada(id)))
    : await listarCampanasEnviadas();

  const contactos = await cargarContactosPorEmail(db);
  let total = resumenVacio();
  let procesadas = 0;
  let boletinesNuevos = 0;

  for (const campana of campanas) {
    if (!campana.sent_emails_count) continue;
    const [emails, bajas] = await Promise.all([
      listarEmailsEnviados(campana.id),
      listarBajasCampana(campana.id),
    ]);

    const sucesos: SucesoEmail[] = emails.map((e): SucesoEmail => {
      if (e.status === "soft_bounced" || (e.soft_bounced_at && !e.bounced_at)) {
        return { email: e.email, tipo: "rebote_temporal", fecha: e.soft_bounced_at ?? null };
      }
      if (e.status === "bounced" || e.bounced_at) return { email: e.email, tipo: "excluir", motivo: "Rebote" };
      return { email: e.email, tipo: "recibido" };
    });
    for (const b of bajas) sucesos.push({ email: b.email, tipo: "excluir", motivo: "Baja" });

    const { boletin, nuevo } = await boletinDeCampana(db, campana, simular);
    if (nuevo) boletinesNuevos++;
    const resumen = await aplicarSucesos(db, sucesos, {
      simular,
      contactos,
      boletin: boletin ? { id: boletin.id, fecha: boletin.fecha_envio } : undefined,
    });
    // Lo que se acaba de excluir cuenta como ya excluido en la campaña
    // siguiente (también al simular, para no contarlo dos veces). El mapa es
    // una copia local: no se guarda nada por esto.
    for (const s of sucesos) {
      const c = s.tipo === "excluir" ? contactos.get(normalizarEmail(s.email)) : undefined;
      if (c) c.estado = "Excluido";
    }
    total = sumarResumenes(total, resumen);
    procesadas++;
  }

  return { ...total, campanas: procesadas, boletinesNuevos };
}
