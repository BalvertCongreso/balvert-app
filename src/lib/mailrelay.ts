// Cliente mínimo para la API de CAMPAÑAS de Mailrelay (no la "transactional",
// esa tiene coste — ver PROJECT_BRIEF.md, sección Mailrelay). Solo se usa en
// código de servidor: la clave de API nunca debe llegar al navegador.
// Documentación: https://apidocs.mailrelay.com/

interface MailrelayError {
  status: number;
  body: unknown;
}

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

async function llamar<T>(
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
  const cuerpo = texto ? JSON.parse(texto) : null;

  if (!res.ok) {
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

export interface Remitente {
  id: number;
  name: string | null;
  email: string;
}

export async function listarRemitentes(): Promise<Remitente[]> {
  const data = await llamar<{ data?: Remitente[] } | Remitente[]>("/senders");
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

export async function enviarCampanaATodos(campaignId: number): Promise<void> {
  await llamar(`/campaigns/${campaignId}/send_all`, { method: "POST" });
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
