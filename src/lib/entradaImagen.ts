import { readFileSync } from "fs";
import path from "path";
import { Resvg } from "@resvg/resvg-js";
import QRCode from "qrcode";

const AZUL = "#5BB8E8";
const MARRON = "#8B6914";

const logoBase64 = readFileSync(
  path.join(process.cwd(), "public", "logo-balvert.png")
).toString("base64");

// resvg carga estas fuentes directamente (motor de fuentes propio, en Rust),
// sin pasar por @font-face/CSS ni por las fuentes que tenga instaladas el
// sistema (loadSystemFonts: false) — a diferencia de sharp/librsvg, que no
// soporta de forma fiable fuentes incrustadas por @font-face.
//
// Nota: la API de @resvg/resvg-js@2.6.2 (versión estable) solo admite
// `fontFiles` (rutas en disco), no `fontBuffers` en memoria — esa opción
// solo existe en versiones "alpha" (2.7.0-alpha.x), que no conviene usar en
// producción.
const fontRegularPath = path.join(process.cwd(), "src", "lib", "fonts", "Inter-Regular.ttf");
const fontSemiBoldPath = path.join(process.cwd(), "src", "lib", "fonts", "Inter-SemiBold.ttf");
const fontBoldPath = path.join(process.cwd(), "src", "lib", "fonts", "Inter-Bold.ttf");
// Llamadas literales (no en bucle) para que el rastreador de archivos de
// Next.js (el que decide qué se empaqueta en la función serverless de
// Vercel) identifique exactamente estos tres .ttf como dependencias, igual
// que ya hace con el logo — un bucle sobre un array no lo reconoce y hace
// que caiga en su red de seguridad de incluir el proyecto entero.
readFileSync(fontRegularPath);
readFileSync(fontSemiBoldPath);
readFileSync(fontBoldPath);
const fontFiles = [fontRegularPath, fontSemiBoldPath, fontBoldPath];
const FONT_FAMILY = "Inter";

export interface DatosEntrada {
  qrPayload: string;
  nombreAsistente: string | null;
  evento: "Congreso" | "Gala" | "Excursión";
  edicionNombre: string | null;
  empresa: string | null;
  categoriaPatrocinio: string | null;
  detalleLabel: string | null;
  detalleValor: string | null;
  lugar: string;
  fechaHora: string;
}

// Recorta textos largos para que no se salgan de la tarjeta (no hay ajuste
// de línea automático en el SVG que generamos).
function recortar(texto: string, maxLen: number) {
  return texto.length > maxLen ? texto.slice(0, maxLen - 1) + "…" : texto;
}

function escaparXml(texto: string) {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function construirImagenEntrada(datos: DatosEntrada): Promise<Buffer> {
  const anchoTarjeta = 700;
  const altoTarjeta = 980;
  const qrBuffer = await QRCode.toBuffer(datos.qrPayload, { width: 340, margin: 1 });
  const qrBase64 = qrBuffer.toString("base64");

  const nombre = escaparXml(recortar(datos.nombreAsistente ?? "Asistente BALVERT", 34));
  const eventoEdicion = escaparXml(
    recortar(`${datos.evento} — ${datos.edicionNombre ?? "BALVERT"}`, 40)
  );

  let yCursor = 320;
  const bloques: string[] = [];

  const lugarTexto = escaparXml(recortar(`Lugar: ${datos.lugar}`, 44));
  bloques.push(
    `<text x="${anchoTarjeta / 2}" y="${yCursor}" text-anchor="middle" font-family="${FONT_FAMILY}, sans-serif" font-size="20" fill="#4b5563">${lugarTexto}</text>`
  );
  yCursor += 32;

  const fechaHoraTexto = escaparXml(recortar(`Fecha y hora: ${datos.fechaHora}`, 44));
  bloques.push(
    `<text x="${anchoTarjeta / 2}" y="${yCursor}" text-anchor="middle" font-family="${FONT_FAMILY}, sans-serif" font-size="20" fill="#4b5563">${fechaHoraTexto}</text>`
  );
  yCursor += 40;

  if (datos.empresa) {
    const empresaTexto = escaparXml(
      recortar(
        datos.categoriaPatrocinio
          ? `${datos.empresa} · ${datos.categoriaPatrocinio}`
          : datos.empresa,
        44
      )
    );
    bloques.push(
      `<text x="${anchoTarjeta / 2}" y="${yCursor}" text-anchor="middle" font-family="${FONT_FAMILY}, sans-serif" font-size="22" fill="#374151">${empresaTexto}</text>`
    );
    yCursor += 40;
  }

  if (datos.detalleLabel && datos.detalleValor) {
    const detalleTexto = escaparXml(
      recortar(`${datos.detalleLabel}: ${datos.detalleValor}`, 44)
    );
    bloques.push(
      `<text x="${anchoTarjeta / 2}" y="${yCursor}" text-anchor="middle" font-family="${FONT_FAMILY}, sans-serif" font-size="22" fill="#374151">${detalleTexto}</text>`
    );
    yCursor += 40;
  }

  const qrY = yCursor + 20;

  const svg = `
    <svg width="${anchoTarjeta}" height="${altoTarjeta}" viewBox="0 0 ${anchoTarjeta} ${altoTarjeta}" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width="${anchoTarjeta}" height="${altoTarjeta}" rx="24" fill="#ffffff" stroke="#e5e7eb" stroke-width="2" />
      <rect x="0" y="0" width="${anchoTarjeta}" height="10" fill="${AZUL}" />
      <image x="${anchoTarjeta / 2 - 110}" y="50" width="220" height="120" href="data:image/png;base64,${logoBase64}" preserveAspectRatio="xMidYMid meet" />
      <text x="${anchoTarjeta / 2}" y="220" text-anchor="middle" font-family="${FONT_FAMILY}, sans-serif" font-size="30" font-weight="bold" fill="${MARRON}">${eventoEdicion}</text>
      <text x="${anchoTarjeta / 2}" y="270" text-anchor="middle" font-family="${FONT_FAMILY}, sans-serif" font-size="26" fill="${AZUL}" font-weight="600">${nombre}</text>
      ${bloques.join("\n")}
      <image x="${anchoTarjeta / 2 - 170}" y="${qrY}" width="340" height="340" href="data:image/png;base64,${qrBase64}" />
      <text x="24" y="${altoTarjeta - 24}" font-family="${FONT_FAMILY}, sans-serif" font-size="13" fill="#9ca3af">Desarrollado por AtrapaEsaRed</text>
    </svg>
  `;

  const resvg = new Resvg(svg, {
    font: {
      fontFiles,
      loadSystemFonts: false,
      defaultFontFamily: FONT_FAMILY,
    },
    background: "white",
  });
  return resvg.render().asPng();
}
