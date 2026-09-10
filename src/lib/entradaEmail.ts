import { Resend } from "resend";
import { construirImagenEntrada, type DatosEntrada } from "@/lib/entradaImagen";

function construirEmailHtml(nombre: string | null, evento: string) {
  return `
  <div style="font-family: -apple-system, Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; color: #1f2937;">
    <h1 style="color: #8B6914; font-size: 20px; margin-bottom: 4px;">BALVERT 2027</h1>
    <p style="color: #5BB8E8; font-weight: 600; margin-top: 0;">Tu entrada — ${evento}</p>
    <p>Hola${nombre ? ` ${nombre}` : ""},</p>
    <p>Aquí tienes tu entrada para el ${evento.toLowerCase()} de BALVERT 2027. Preséntala (en el móvil o impresa) en el acceso; se validará escaneando el código.</p>
    <div style="text-align: center; margin: 24px 0;">
      <img src="cid:entrada-balvert" alt="Tu entrada BALVERT 2027" width="350" style="border: 1px solid #e5e7eb; border-radius: 12px;" />
    </div>
    <p style="font-size: 13px; color: #6b7280;">Si tienes cualquier duda, responde a este email.</p>
  </div>
  `;
}

interface ResultadoEnvio {
  enviado: boolean;
  error?: string;
}

// Compone la imagen de la entrada y la manda por Resend. Usado tanto por el
// alta manual (personal, con sesión) como por el formulario público de
// autorregistro — una sola implementación para no tener dos entradas que
// puedan desincronizarse.
export async function enviarEmailConEntrada(
  email: string,
  tabla: string,
  qrCodigo: string,
  datos: DatosEntrada
): Promise<ResultadoEnvio> {
  if (!process.env.RESEND_API_KEY) {
    return { enviado: false, error: "Falta RESEND_API_KEY en el servidor (.env.local)." };
  }

  try {
    const imagenEntrada = await construirImagenEntrada(datos);
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { error: errorEnvio } = await resend.emails.send({
      from: "BALVERT 2027 <entradas@app.atrapaesared.es>",
      to: email,
      subject: `Tu entrada — ${datos.evento} BALVERT 2027`,
      html: construirEmailHtml(datos.nombreAsistente, datos.evento),
      attachments: [
        {
          filename: `entrada-${tabla}-${qrCodigo}.png`,
          content: imagenEntrada,
          contentId: "entrada-balvert",
        },
      ],
    });

    if (errorEnvio) {
      return { enviado: false, error: `El QR se generó pero el email falló: ${errorEnvio.message}` };
    }
    return { enviado: true };
  } catch (e) {
    const mensaje = e instanceof Error ? e.message : "Error desconocido enviando el email.";
    return { enviado: false, error: `El QR se generó pero el email falló: ${mensaje}` };
  }
}
