import { readFileSync } from "fs";
import path from "path";
import sharp from "sharp";
import QRCode from "qrcode";

const AZUL = "#5BB8E8";
const MARRON = "#8B6914";

const logoBase64 = readFileSync(
  path.join(process.cwd(), "public", "logo-balvert.png")
).toString("base64");

// Fuente incrustada en base64: en Vercel (Linux serverless) no hay fuentes
// instaladas ni fontconfig, así que sharp/librsvg no puede dibujar texto sin
// que la fuente viaje dentro del propio SVG.
const FONT_DIR = path.join(process.cwd(), "src", "lib", "fonts");
const fontRegularBase64 = readFileSync(path.join(FONT_DIR, "Inter-Regular.ttf")).toString(
  "base64"
);
const fontSemiBoldBase64 = readFileSync(path.join(FONT_DIR, "Inter-SemiBold.ttf")).toString(
  "base64"
);
const fontBoldBase64 = readFileSync(path.join(FONT_DIR, "Inter-Bold.ttf")).toString("base64");

const fontFaceStyle = `
    <defs>
      <style>
        @font-face {
          font-family: 'EntradaFont';
          font-weight: 400;
          src: url(data:font/ttf;base64,${fontRegularBase64}) format('truetype');
        }
        @font-face {
          font-family: 'EntradaFont';
          font-weight: 600;
          src: url(data:font/ttf;base64,${fontSemiBoldBase64}) format('truetype');
        }
        @font-face {
          font-family: 'EntradaFont';
          font-weight: bold;
          src: url(data:font/ttf;base64,${fontBoldBase64}) format('truetype');
        }
      </style>
    </defs>`;

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
    `<text x="${anchoTarjeta / 2}" y="${yCursor}" text-anchor="middle" font-family="EntradaFont, sans-serif" font-size="20" fill="#4b5563">${lugarTexto}</text>`
  );
  yCursor += 32;

  const fechaHoraTexto = escaparXml(recortar(`Fecha y hora: ${datos.fechaHora}`, 44));
  bloques.push(
    `<text x="${anchoTarjeta / 2}" y="${yCursor}" text-anchor="middle" font-family="EntradaFont, sans-serif" font-size="20" fill="#4b5563">${fechaHoraTexto}</text>`
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
      `<text x="${anchoTarjeta / 2}" y="${yCursor}" text-anchor="middle" font-family="EntradaFont, sans-serif" font-size="22" fill="#374151">${empresaTexto}</text>`
    );
    yCursor += 40;
  }

  if (datos.detalleLabel && datos.detalleValor) {
    const detalleTexto = escaparXml(
      recortar(`${datos.detalleLabel}: ${datos.detalleValor}`, 44)
    );
    bloques.push(
      `<text x="${anchoTarjeta / 2}" y="${yCursor}" text-anchor="middle" font-family="EntradaFont, sans-serif" font-size="22" fill="#374151">${detalleTexto}</text>`
    );
    yCursor += 40;
  }

  const qrY = yCursor + 20;

  const svg = `
    <svg width="${anchoTarjeta}" height="${altoTarjeta}" viewBox="0 0 ${anchoTarjeta} ${altoTarjeta}" xmlns="http://www.w3.org/2000/svg">${fontFaceStyle}
      <rect x="0" y="0" width="${anchoTarjeta}" height="${altoTarjeta}" rx="24" fill="#ffffff" stroke="#e5e7eb" stroke-width="2" />
      <rect x="0" y="0" width="${anchoTarjeta}" height="10" fill="${AZUL}" />
      <image x="${anchoTarjeta / 2 - 110}" y="50" width="220" height="120" href="data:image/png;base64,${logoBase64}" preserveAspectRatio="xMidYMid meet" />
      <text x="${anchoTarjeta / 2}" y="220" text-anchor="middle" font-family="EntradaFont, sans-serif" font-size="30" font-weight="bold" fill="${MARRON}">${eventoEdicion}</text>
      <text x="${anchoTarjeta / 2}" y="270" text-anchor="middle" font-family="EntradaFont, sans-serif" font-size="26" fill="${AZUL}" font-weight="600">${nombre}</text>
      ${bloques.join("\n")}
      <image x="${anchoTarjeta / 2 - 170}" y="${qrY}" width="340" height="340" href="data:image/png;base64,${qrBase64}" />
      <text x="24" y="${altoTarjeta - 24}" font-family="EntradaFont, sans-serif" font-size="13" fill="#9ca3af">Desarrollado por AtrapaEsaRed</text>
    </svg>
  `;

  return sharp(Buffer.from(svg)).png().toBuffer();
}
