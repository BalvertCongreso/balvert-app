import { Resend } from "resend";

interface AvisoNewsletter {
  asunto: string;
  totalContactos?: number;
  programado: boolean;
  exito: boolean;
  detalle?: string;
}

function construirHtml(datos: AvisoNewsletter): string {
  const titulo = datos.exito
    ? datos.programado
      ? "Newsletter programada — envío confirmado"
      : "Newsletter enviada"
    : "Newsletter — hubo un problema";
  const color = datos.exito ? "#15803d" : "#b91c1c";
  return `
  <div style="font-family: -apple-system, Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; color: #1f2937;">
    <h1 style="color: #8B6914; font-size: 20px; margin-bottom: 4px;">BALVERT 2027</h1>
    <p style="color: ${color}; font-weight: 600; margin-top: 0;">${titulo}</p>
    <p><strong>Asunto:</strong> ${datos.asunto}</p>
    ${datos.totalContactos !== undefined ? `<p><strong>Contactos:</strong> ${datos.totalContactos}</p>` : ""}
    ${datos.detalle ? `<p>${datos.detalle}</p>` : ""}
    <p style="font-size: 13px; color: #6b7280;">Aviso automático de la pantalla de Newsletter — no hace falta responder.</p>
  </div>
  `;
}

// Aviso por email (aparte del aviso en pantalla) de que un envío de
// newsletter a todos los contactos se completó o falló — inmediato o
// programado. Si esto falla no debe tirar abajo el envío de la newsletter en
// sí (que ya ha pasado o no por su cuenta): solo se registra en los logs.
export async function enviarAvisoNewsletter(datos: AvisoNewsletter): Promise<void> {
  const destinatario = process.env.NEXT_PUBLIC_EMAIL_ARIADNA;
  if (!process.env.RESEND_API_KEY || !destinatario) {
    console.error(
      "No se pudo avisar por email del envío de la newsletter: falta RESEND_API_KEY o NEXT_PUBLIC_EMAIL_ARIADNA."
    );
    return;
  }
  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const prefijo = datos.exito ? "✅" : "⚠️";
    const tipo = datos.exito
      ? datos.programado
        ? "Newsletter programada"
        : "Newsletter enviada"
      : "Newsletter — problema";
    await resend.emails.send({
      from: "BALVERT 2027 <secretaria@balvert.es>",
      to: destinatario,
      subject: `${prefijo} ${tipo}: ${datos.asunto}`,
      html: construirHtml(datos),
    });
  } catch (e) {
    console.error("No se pudo avisar por email del envío de la newsletter:", e);
  }
}
