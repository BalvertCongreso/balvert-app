// Plantilla mínima de email: convierte el texto simple del editor en HTML con
// los colores de marca BALVERT. Los emails necesitan estilos en línea (no
// hoja de estilos aparte), por eso todo va en atributos style="".
const AZUL = "#5BB8E8";
const MARRON = "#8B6914";

function escaparHtml(texto: string) {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// El contenido ya viene como HTML generado por el editor con formato
// (src/components/EditorNewsletter.tsx) — solo lo redactan Ariadna/Ariosto
// dentro del login, así que se inserta tal cual, sin volver a escaparlo.
export function construirHtmlNewsletter(asunto: string, contenidoHtml: string): string {
  return `
<!doctype html>
<html lang="es">
  <body style="margin:0; padding:0; background:#f4f4f5; font-family:Arial, Helvetica, sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5; padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#ffffff; border-radius:8px; overflow:hidden;">
            <tr>
              <td style="background:${AZUL}; height:8px; line-height:8px; font-size:0;">&nbsp;</td>
            </tr>
            <tr>
              <td style="padding:28px 32px 8px 32px;">
                <p style="margin:0; font-size:13px; letter-spacing:0.04em; text-transform:uppercase; color:${MARRON}; font-weight:bold;">BALVERT 2027</p>
                <h1 style="margin:6px 0 20px 0; font-size:22px; color:${MARRON};">${escaparHtml(asunto)}</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 24px 32px; font-size:15px; line-height:1.6; color:#1c1c1c;">
                ${contenidoHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px; border-top:1px solid #e2e8f0; font-size:12px; color:#9ca3af;">
                Congreso BALVERT 2027 · Desarrollado por AtrapaEsaRed
                <br>
                <a href="{{unsubscribe_url}}" style="color:#9ca3af;">Darse de baja de este boletín</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
