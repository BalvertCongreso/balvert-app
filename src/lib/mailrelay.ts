// Cliente mínimo para la API de CAMPAÑAS de Mailrelay (no la "transactional",
// esa tiene coste — ver PROJECT_BRIEF.md, sección Mailrelay). Solo se usa en
// código de servidor: la clave de API nunca debe llegar al navegador.
// Documentación: https://apidocs.mailrelay.com/

interface MailrelayError {
  status: number;
  body: unknown;
  reintentable?: boolean;
}

const MENSAJE_LIMITE_PETICIONES =
  "Mailrelay no responde ahora mismo (parece un límite temporal de peticiones o una caída puntual de su API). Espera unos minutos e inténtalo de nuevo.";

function config() {
  const baseUrl = process.env.MAILRELAY_API_URL;
  const apiKey = process.env.MAILRELAY_API_KEY;
  if (!baseUrl || !apiKey) {
    throw new Error(
      "Falta MAILRELAY_API_URL o MAILRELAY_API_KEY en el servidor (.env.local)."
    );
  }
  return { baseUrl: baseUrl.replace(/\/$/, ""), apiKey };
}

function esperar(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function llamarUnaVez<T>(
  path: string,
  options: { method?: string; body?: unknown } = {}
): Promise<T> {
  const { baseUrl, apiKey } = config();
  const res = await fetch(`${baseUrl}${path}`, {
    method: options.method ?? "GET",
    headers: {
      "X-AUTH-TOKEN": apiKey,
      "Content-Type": "application/json",
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const texto = await res.text();
  let cuerpo: unknown = null;
  let esJson = true;
  if (texto) {
    try {
      cuerpo = JSON.parse(texto);
    } catch {
      // Mailrelay a veces responde con texto plano ("Retry later") en vez de
      // JSON cuando está saturado — no dejar que eso reviente como un error
      // de sintaxis sin explicar qué significa.
      esJson = false;
      cuerpo = texto;
    }
  }

  if (!res.ok) {
    if (res.status === 429 || res.status === 503 || !esJson) {
      const error: MailrelayError = { status: res.status, body: cuerpo, reintentable: true };
      throw Object.assign(new Error(MENSAJE_LIMITE_PETICIONES), error);
    }
    const detalle =
      cuerpo && typeof cuerpo === "object"
        ? JSON.stringify(cuerpo)
        : String(cuerpo ?? "");
    const error: MailrelayError = { status: res.status, body: cuerpo };
    throw Object.assign(
      new Error(`Mailrelay respondió ${res.status}: ${detalle}`),
      error
    );
  }
  return cuerpo as T;
}

// Reintenta con una pequeña pausa creciente solo cuando el fallo parece un
// límite temporal de peticiones de Mailrelay (ver `reintentable` más arriba).
// Otros errores (datos inválidos, auth, etc.) fallan a la primera: reintentarlos
// no arreglaría nada.
async function llamar<T>(
  path: string,
  options: { method?: string; body?: unknown; reintentos?: number } = {}
): Promise<T> {
  const intentosTotales = (options.reintentos ?? 0) + 1;
  for (let intento = 1; intento <= intentosTotales; intento++) {
    try {
      return await llamarUnaVez<T>(path, options);
    } catch (e) {
      const reintentable = (e as MailrelayError)?.reintentable === true;
      if (!reintentable || intento === intentosTotales) throw e;
      await esperar(1000 * intento);
    }
  }
  throw new Error("No se pudo completar la petición a Mailrelay.");
}

export interface Remitente {
  id: number;
  name: string | null;
  email: string;
}

export async function listarRemitentes(): Promise<Remitente[]> {
  const data = await llamar<{ data?: Remitente[] } | Remitente[]>("/senders", {
    reintentos: 2,
  });
  return Array.isArray(data) ? data : data.data ?? [];
}

export async function crearGrupo(nombre: string): Promise<number> {
  const data = await llamar<{ id: number }>("/groups", {
    method: "POST",
    body: { name: nombre },
  });
  return data.id;
}

export async function sincronizarSuscriptor(params: {
  email: string;
  nombre: string | null;
  groupId: number;
}): Promise<void> {
  await llamar("/subscribers/sync", {
    method: "POST",
    body: {
      email: params.email,
      name: params.nombre || undefined,
      status: "active",
      group_ids: [params.groupId],
      replace_groups: false,
      restore_if_deleted: true,
    },
    reintentos: 2,
  });
}

export async function crearCampana(params: {
  senderId: number;
  subject: string;
  html: string;
  groupId: number;
}): Promise<number> {
  const data = await llamar<{ id: number }>("/campaigns", {
    method: "POST",
    body: {
      sender_id: params.senderId,
      subject: params.subject,
      html: params.html,
      target: "groups",
      group_ids: [params.groupId],
      track_opens: true,
      track_clicks: true,
      use_premailer: true,
    },
  });
  return data.id;
}

export interface CampanaEnviada {
  id: number;
  subject?: string;
  // "pending" | "processing" | "finished" | "paused" | "cancelled" | "inactive"
  status?: string;
  sent_emails_count?: number;
  processed_emails_count?: number;
  delivered_emails_count?: number;
  bounced_emails_count?: number;
  soft_bounced_emails_count?: number;
}

export async function enviarCampanaATodos(
  campaignId: number,
  opciones: { scheduledAtUtc?: string; callbackUrl?: string } = {}
): Promise<CampanaEnviada> {
  const body: { scheduled_at?: string; callback_url?: string } = {};
  if (opciones.scheduledAtUtc) body.scheduled_at = opciones.scheduledAtUtc;
  if (opciones.callbackUrl) body.callback_url = opciones.callbackUrl;
  return await llamar<CampanaEnviada>(`/campaigns/${campaignId}/send_all`, {
    method: "POST",
    body: Object.keys(body).length > 0 ? body : undefined,
  });
}

// Tras un envío programado, Mailrelay avisa a nuestro callback_url con
// {"type":"sent_campaign_finished","id":<sentCampaignId>} — sin decir si fue
// bien o mal. Hay que consultar esto para saber el estado real y los números
// de entrega antes de avisar a Ariadna.
export async function obtenerCampanaEnviada(sentCampaignId: number): Promise<CampanaEnviada> {
  return await llamar<CampanaEnviada>(`/sent_campaigns/${sentCampaignId}`, {
    reintentos: 2,
  });
}

export async function enviarCampanaDePrueba(
  campaignId: number,
  emails: string[]
): Promise<void> {
  await llamar(`/campaigns/${campaignId}/send_test`, {
    method: "POST",
    body: { test_emails: emails.join(",") },
  });
}
