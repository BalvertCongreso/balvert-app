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

function construirEmailHtmlMultiple(entradas: EntradaParaEmail[]) {
  const bloques = entradas
    .map(
      (e, i) => `
    <div style="text-align: center; margin: 24px 0;">
      <p style="font-weight: 600; color: #5BB8E8; margin-bottom: 8px;">
        ${e.datos.evento}${e.datos.nombreAsistente ? ` — ${e.datos.nombreAsistente}` : ""}
      </p>
      <img src="cid:entrada-${i}" alt="Entrada BALVERT 2027" width="350" style="border: 1px solid #e5e7eb; border-radius: 12px;" />
    </div>`
    )
    .join("\n");

  return `
  <div style="font-family: -apple-system, Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; color: #1f2937;">
    <h1 style="color: #8B6914; font-size: 20px; margin-bottom: 4px;">BALVERT 2027</h1>
    <p style="color: #5BB8E8; font-weight: 600; margin-top: 0;">Tus entradas</p>
    <p>Hola,</p>
    <p>Aquí tienes ${entradas.length === 1 ? "tu entrada" : "tus entradas"} para BALVERT 2027. Presenta cada una (en el móvil o impresa) en el acceso correspondiente; se validará escaneando el código.</p>
    ${bloques}
    <p style="font-size: 13px; color: #6b7280;">Si tienes cualquier duda, responde a este email.</p>
  </div>
  `;
}

interface ResultadoEnvio {
  enviado: boolean;
  error?: string;
}

export interface EntradaParaEmail {
  tabla: string;
  qrCodigo: string;
  datos: DatosEntrada;
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
      from: "BALVERT 2027 <secretaria@balvert.es>",
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

// Compra combinada (Fase 7c): una misma compra por Stripe puede generar
// varias entradas a la vez (de un tipo o de varios: Congreso, Gala,
// Excursión). Se manda UN solo email al comprador con todas las imágenes
// adjuntas, en vez de un email por entrada.
export async function enviarEmailConVariasEntradas(email: string, entradas: EntradaParaEmail[]): Promise<ResultadoEnvio> {
  if (!process.env.RESEND_API_KEY) {
    return { enviado: false, error: "Falta RESEND_API_KEY en el servidor (.env.local)." };
  }
  if (entradas.length === 0) {
    return { enviado: false, error: "No hay entradas que enviar." };
  }

  try {
    const imagenes = await Promise.all(entradas.map((e) => construirImagenEntrada(e.datos)));
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { error: errorEnvio } = await resend.emails.send({
      from: "BALVERT 2027 <secretaria@balvert.es>",
      to: email,
      subject: entradas.length === 1 ? `Tu entrada — ${entradas[0].datos.evento} BALVERT 2027` : "Tus entradas — BALVERT 2027",
      html: construirEmailHtmlMultiple(entradas),
      attachments: entradas.map((e, i) => ({
        filename: `entrada-${e.tabla}-${e.qrCodigo}.png`,
        content: imagenes[i],
        contentId: `entrada-${i}`,
      })),
    });

    if (errorEnvio) {
      return { enviado: false, error: `Las entradas se generaron pero el email falló: ${errorEnvio.message}` };
    }
    return { enviado: true };
  } catch (e) {
    const mensaje = e instanceof Error ? e.message : "Error desconocido enviando el email.";
    return { enviado: false, error: `Las entradas se generaron pero el email falló: ${mensaje}` };
  }
}
