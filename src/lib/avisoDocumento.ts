import { Resend } from "resend";

function escaparHtml(texto: string) {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Aviso por email de que hay un documento nuevo para una persona en su área
// de cliente (p. ej. su factura). El email no lleva el archivo ni un enlace
// directo a él: lleva al portal, donde entra con su email como siempre.
export async function enviarAvisoDocumento(email: string, titulo: string, origen: string): Promise<string | null> {
  if (!process.env.RESEND_API_KEY) return "Falta RESEND_API_KEY en el servidor.";
  const tituloHtml = escaparHtml(titulo);
  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { error } = await resend.emails.send({
      from: "BALVERT 2027 <secretaria@balvert.es>",
      to: email,
      subject: `Ya tienes disponible: ${titulo} — BALVERT 2027`,
      html: `
  <div style="font-family: -apple-system, Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; color: #1f2937;">
    <h1 style="color: #8B6914; font-size: 20px; margin-bottom: 4px;">BALVERT 2027</h1>
    <p style="color: #5BB8E8; font-weight: 600; margin-top: 0;">Documento disponible</p>
    <p>Hola,</p>
    <p>Ya tienes disponible en tu área de cliente: <strong>${tituloHtml}</strong>.</p>
    <div style="text-align: center; margin: 28px 0;">
      <a href="${origen}/portal" style="background: #2f7ea8; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; display: inline-block;">Ir a mi área</a>
    </div>
    <p style="font-size: 13px; color: #6b7280;">Entra con este mismo email (${escaparHtml(email)}): te enviaremos un enlace de acceso, sin contraseña. Si tienes cualquier duda, responde a este email.</p>
  </div>`,
    });
    return error ? error.message : null;
  } catch (e) {
    return e instanceof Error ? e.message : "Error desconocido enviando el email.";
  }
}
