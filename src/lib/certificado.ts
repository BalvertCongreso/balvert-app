import { readFileSync } from "fs";
import path from "path";
import { PDFDocument, rgb, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import type { SupabaseClient } from "@supabase/supabase-js";

// Certificado de asistencia del Congreso (Fase 9), en PDF. No se guarda en
// ningún sitio: se genera al momento desde la fila del asistente y los datos
// de la edición. pdf-lib es JavaScript puro (sin binarios nativos), y las
// fuentes Inter van incrustadas enteras (son pequeñas), así que el PDF se ve
// igual en cualquier ordenador, con tildes y eñes.

// Lecturas literales, una por archivo: así el rastreador de Next.js mete
// exactamente estos archivos en la función de Vercel (ver la imagen de la
// entrada, src/lib/entradaImagen.ts, y el bug de fuentes del brief).
const fuenteRegular = readFileSync(path.join(process.cwd(), "src", "lib", "fonts", "Inter-Regular.ttf"));
const fuenteSemiBold = readFileSync(path.join(process.cwd(), "src", "lib", "fonts", "Inter-SemiBold.ttf"));
const fuenteBold = readFileSync(path.join(process.cwd(), "src", "lib", "fonts", "Inter-Bold.ttf"));
const logoPng = readFileSync(path.join(process.cwd(), "public", "logo-balvert.png"));

export const BUCKET_CERTIFICADOS = "certificados";

const AZUL = rgb(0x5b / 255, 0xb8 / 255, 0xe8 / 255);
const AZUL_OSCURO = rgb(0x2f / 255, 0x7e / 255, 0xa8 / 255);
const MARRON = rgb(0x8b / 255, 0x69 / 255, 0x14 / 255);
const CREMA = rgb(0xfb / 255, 0xf8 / 255, 0xf0 / 255);
const TEXTO = rgb(0.2, 0.2, 0.22);
const GRIS = rgb(0.4, 0.4, 0.43);

export interface ImagenCertificado {
  bytes: Uint8Array;
  tipo: "png" | "jpg";
}

export interface EdicionCertificado {
  edicionNombre: string | null;
  titulo: string;
  lugar: string;
  dias: string;
  cabeceraLinea1: string;
  cabeceraLinea2: string;
  firmante: string;
  cargo: string;
  firma: ImagenCertificado | null;
  imagen: ImagenCertificado | null;
}

export interface DatosCertificado {
  nombre: string;
  documento: string | null;
}

// Columnas de ediciones que usa el certificado.
const COLUMNAS_EDICION =
  "nombre, certificado_titulo, certificado_lugar, certificado_dias, certificado_cabecera_linea1, certificado_cabecera_linea2, certificado_firmante, certificado_cargo, certificado_firma_ruta, certificado_imagen_ruta";

function tipoImagen(ruta: string): "png" | "jpg" | null {
  const ext = ruta.split(".").pop()?.toLowerCase();
  if (ext === "png") return "png";
  if (ext === "jpg" || ext === "jpeg") return "jpg";
  return null;
}

async function descargarImagen(supabase: SupabaseClient, ruta: string | null): Promise<ImagenCertificado | null> {
  if (!ruta) return null;
  const tipo = tipoImagen(ruta);
  if (!tipo) return null;
  const { data, error } = await supabase.storage.from(BUCKET_CERTIFICADOS).download(ruta);
  if (error || !data) {
    console.error("certificado: no se pudo leer la imagen", ruta, error?.message);
    return null;
  }
  return { bytes: new Uint8Array(await data.arrayBuffer()), tipo };
}

// Textos e imágenes de la edición. Con la clave de servicio: el bucket es
// privado y sin políticas.
export async function cargarEdicionCertificado(
  supabase: SupabaseClient,
  edicionId: string
): Promise<EdicionCertificado | null> {
  const { data: e } = await supabase.from("ediciones").select(COLUMNAS_EDICION).eq("id", edicionId).maybeSingle();
  if (!e) return null;
  const [firma, imagen] = await Promise.all([
    descargarImagen(supabase, e.certificado_firma_ruta),
    descargarImagen(supabase, e.certificado_imagen_ruta),
  ]);
  return {
    edicionNombre: e.nombre,
    titulo: e.certificado_titulo?.trim() || "Congreso Internacional de Balsas y Vertederos",
    lugar: e.certificado_lugar?.trim() || "",
    dias: e.certificado_dias?.trim() || "",
    cabeceraLinea1: e.certificado_cabecera_linea1?.trim() || "",
    cabeceraLinea2: e.certificado_cabecera_linea2?.trim() || "",
    firmante: e.certificado_firmante?.trim() || "",
    cargo: e.certificado_cargo?.trim() || "",
    firma,
    imagen,
  };
}

function aSlug(texto: string) {
  return (
    texto
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "asistente"
  );
}

// certificado-asistencia-balvert-2027-<nombre>.pdf
export function nombreArchivoCertificado(edicionNombre: string | null, nombre: string) {
  return `certificado-asistencia-${aSlug(edicionNombre || "balvert")}-${aSlug(nombre)}.pdf`;
}

// Tamaño de letra (empezando en `tamano`) con el que el texto cabe en `ancho`.
function tamanoQueCabe(texto: string, fuente: PDFFont, tamano: number, ancho: number, minimo = 8) {
  let t = tamano;
  while (t > minimo && fuente.widthOfTextAtSize(texto, t) > ancho) t -= 0.5;
  return t;
}

function partirEnLineas(texto: string, fuente: PDFFont, tamano: number, ancho: number) {
  const lineas: string[] = [];
  let actual = "";
  for (const palabra of texto.split(/\s+/).filter(Boolean)) {
    const prueba = actual ? `${actual} ${palabra}` : palabra;
    if (actual && fuente.widthOfTextAtSize(prueba, tamano) > ancho) {
      lineas.push(actual);
      actual = palabra;
    } else {
      actual = prueba;
    }
  }
  if (actual) lineas.push(actual);
  return lineas;
}

function centrado(pagina: PDFPage, texto: string, fuente: PDFFont, tamano: number, cx: number, y: number, color = TEXTO) {
  pagina.drawText(texto, { x: cx - fuente.widthOfTextAtSize(texto, tamano) / 2, y, size: tamano, font: fuente, color });
}

// Escala una imagen para que quepa en una caja sin deformarla.
function encajar(img: PDFImage, anchoMax: number, altoMax: number) {
  const escala = Math.min(anchoMax / img.width, altoMax / img.height);
  return { width: img.width * escala, height: img.height * escala };
}

async function incrustar(pdf: PDFDocument, imagen: ImagenCertificado | null): Promise<PDFImage | null> {
  if (!imagen) return null;
  try {
    return imagen.tipo === "png" ? await pdf.embedPng(imagen.bytes) : await pdf.embedJpg(imagen.bytes);
  } catch (e) {
    // Una imagen dañada no debe impedir el certificado: se omite.
    console.error("certificado: imagen no válida", e instanceof Error ? e.message : e);
    return null;
  }
}

export async function construirCertificado(datos: DatosCertificado, ed: EdicionCertificado): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  pdf.setTitle(`Certificado de asistencia — ${datos.nombre}`);
  pdf.setAuthor("Comité Organizador BALVERT");
  pdf.setCreator("BALVERT");
  const regular = await pdf.embedFont(fuenteRegular);
  const semi = await pdf.embedFont(fuenteSemiBold);
  const bold = await pdf.embedFont(fuenteBold);
  const logo = await pdf.embedPng(logoPng);
  const firma = await incrustar(pdf, ed.firma);
  const imagen = await incrustar(pdf, ed.imagen);

  // A4 horizontal.
  const W = 841.89;
  const H = 595.28;
  const pagina = pdf.addPage([W, H]);
  const cx = W / 2;

  // Fondo crema y marco azul claro.
  pagina.drawRectangle({ x: 0, y: 0, width: W, height: H, color: CREMA });
  const margen = 18;
  pagina.drawRectangle({
    x: margen,
    y: margen,
    width: W - 2 * margen,
    height: H - 2 * margen,
    borderColor: AZUL,
    borderWidth: 8,
  });

  // ---- Cabecera: franja superior separada por el marco ----
  const yLinea = H - 128;
  pagina.drawLine({ start: { x: margen, y: yLinea }, end: { x: W - margen, y: yLinea }, thickness: 5, color: AZUL });
  const yc = (H - margen - 4 + yLinea) / 2; // centro vertical de la franja
  const altoFranja = H - margen - 4 - yLinea - 16;

  const tamLogo = encajar(logo, 120, altoFranja);
  const xLogo = margen + 22;
  pagina.drawImage(logo, { x: xLogo, y: yc - tamLogo.height / 2, ...tamLogo });

  let bordeDerecho = W - margen - 22;
  if (imagen) {
    const tam = encajar(imagen, 110, altoFranja);
    pagina.drawImage(imagen, { x: bordeDerecho - tam.width, y: yc - tam.height / 2, ...tam });
    bordeDerecho -= tam.width + 16;
  }

  // Fechas y lugar, a la derecha, alineados a la derecha.
  const lineasDerecha = [ed.cabeceraLinea1, ed.cabeceraLinea2].filter(Boolean);
  let anchoDerecha = 0;
  if (lineasDerecha.length > 0) {
    const tam = Math.min(...lineasDerecha.map((l) => tamanoQueCabe(l, bold, 15, 190)));
    anchoDerecha = Math.max(...lineasDerecha.map((l) => bold.widthOfTextAtSize(l, tam)));
    lineasDerecha.forEach((l, i) => {
      const y = lineasDerecha.length === 1 ? yc - tam / 3 : yc + 3 - i * (tam + 6);
      pagina.drawText(l, { x: bordeDerecho - bold.widthOfTextAtSize(l, tam), y, size: tam, font: bold, color: AZUL_OSCURO });
    });
  }

  // Título en el centro de lo que queda libre: "IV CONGRESO INTERNACIONAL DE"
  // y "BALSAS Y VERTEDEROS" (BALSAS en azul, VERTEDEROS en marrón).
  const izquierda = xLogo + tamLogo.width + 18;
  const derecha = bordeDerecho - anchoDerecha - 18;
  const cxTitulo = (izquierda + derecha) / 2;
  const anchoTitulo = derecha - izquierda;
  const m = /^(.*?)\s*balsas\s+y\s+vertederos\s*$/i.exec(ed.titulo);
  if (m) {
    const linea1 = m[1].toUpperCase();
    const parteAzul = "BALSAS Y ";
    const parteMarron = "VERTEDEROS";
    const t2 = tamanoQueCabe(parteAzul + parteMarron, bold, 24, anchoTitulo);
    const t1 = Math.min(tamanoQueCabe(linea1, semi, 15, anchoTitulo), t2);
    centrado(pagina, linea1, semi, t1, cxTitulo, yc + 6, AZUL_OSCURO);
    const anchoTotal = bold.widthOfTextAtSize(parteAzul + parteMarron, t2);
    const x0 = cxTitulo - anchoTotal / 2;
    const yL2 = yc - t2 - 2;
    pagina.drawText(parteAzul, { x: x0, y: yL2, size: t2, font: bold, color: AZUL });
    pagina.drawText(parteMarron, { x: x0 + bold.widthOfTextAtSize(parteAzul, t2), y: yL2, size: t2, font: bold, color: MARRON });
  } else {
    const lineas = partirEnLineas(ed.titulo.toUpperCase(), bold, 16, anchoTitulo).slice(0, 2);
    lineas.forEach((l, i) => centrado(pagina, l, bold, tamanoQueCabe(l, bold, 16, anchoTitulo), cxTitulo, yc + 4 - i * 22, AZUL_OSCURO));
  }

  // ---- Cuerpo ----
  const anchoCuerpo = W - 2 * margen - 140;
  let y = yLinea - 95;
  centrado(pagina, "CERTIFICADO DE ASISTENCIA", bold, tamanoQueCabe("CERTIFICADO DE ASISTENCIA", bold, 36, anchoCuerpo), cx, y, AZUL_OSCURO);
  y -= 44;
  centrado(pagina, "El Comité Organizador certifica que", regular, 15, cx, y);
  y -= 46;
  const nombre = datos.nombre.toUpperCase();
  centrado(pagina, nombre, bold, tamanoQueCabe(nombre, bold, 30, anchoCuerpo, 14), cx, y, MARRON);
  y -= 26;
  if (datos.documento) {
    centrado(pagina, `con documento de identidad ${datos.documento}`, regular, 13, cx, y, GRIS);
    y -= 32;
  } else {
    y -= 8;
  }
  const frase =
    `ha asistido al ${ed.titulo}` +
    (ed.lugar ? ` que ha tenido lugar en ${ed.lugar}` : "") +
    (ed.dias ? `, los días ${ed.dias}` : "") +
    ".";
  for (const linea of partirEnLineas(frase, regular, 15, 600)) {
    centrado(pagina, linea, regular, 15, cx, y);
    y -= 22;
  }

  // ---- Pie: firma, nombre y cargo ----
  const yCargo = margen + 30;
  const yFirmante = yCargo + 15;
  if (firma) {
    const tam = encajar(firma, 190, Math.max(30, Math.min(70, y - yFirmante - 24)));
    pagina.drawImage(firma, { x: cx - tam.width / 2, y: yFirmante + 14, ...tam });
  }
  if (ed.firmante) centrado(pagina, ed.firmante.toUpperCase(), semi, 11, cx, yFirmante, TEXTO);
  if (ed.cargo) centrado(pagina, ed.cargo.toUpperCase(), regular, 9, cx, yCargo, GRIS);

  return pdf.save();
}

// Respuesta HTTP con el PDF, siempre como descarga y sin caché.
export function respuestaPdf(bytes: Uint8Array, nombreArchivo: string) {
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${nombreArchivo}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
