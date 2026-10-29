// Lee las hojas de un Excel (.xlsx) o un CSV como filas de texto. Sin
// librerías de hojas de cálculo: un .xlsx es un zip con XML dentro (se abre
// con fflate) y aquí solo hacen falta los valores de las celdas, no formatos.
// Funciona igual en el navegador y en Node (no usa DOMParser).
import { unzipSync, strFromU8 } from "fflate";

export type Filas = string[][];

function decodificarXml(texto: string): string {
  return texto
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

// Texto de un <si> o un <is>: puede venir en varios trozos <t> (texto con formato).
function textoDeRuns(xml: string): string {
  const partes: string[] = [];
  for (const m of xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)) partes.push(decodificarXml(m[1]));
  return partes.join("");
}

// "AB12" → 27 (columna, empezando en 0).
function indiceColumna(ref: string): number {
  const letras = /^[A-Z]+/.exec(ref)?.[0] ?? "A";
  let n = 0;
  for (const l of letras) n = n * 26 + (l.charCodeAt(0) - 64);
  return n - 1;
}

// Hojas del libro en su orden, con su nombre y la ruta de su XML.
function hojasDelLibro(archivos: Record<string, Uint8Array>): { nombre: string; ruta: string }[] {
  const libro = archivos["xl/workbook.xml"] ? strFromU8(archivos["xl/workbook.xml"]) : "";
  const relaciones = archivos["xl/_rels/workbook.xml.rels"]
    ? strFromU8(archivos["xl/_rels/workbook.xml.rels"])
    : "";
  const hojas: { nombre: string; ruta: string }[] = [];
  for (const m of libro.matchAll(/<sheet\s[^>]*>/g)) {
    const nombre = decodificarXml(/\bname="([^"]*)"/.exec(m[0])?.[1] ?? "");
    const idHoja = /\br:id="([^"]+)"/.exec(m[0])?.[1];
    const rel = idHoja && new RegExp(`<Relationship\\s[^>]*Id="${idHoja}"[^>]*>`).exec(relaciones)?.[0];
    const destino = rel && /Target="([^"]+)"/.exec(rel)?.[1];
    if (!destino) continue;
    const ruta = destino.startsWith("/") ? destino.slice(1) : `xl/${destino.replace(/^\.\//, "")}`;
    if (archivos[ruta]) hojas.push({ nombre, ruta });
  }
  if (hojas.length > 0) return hojas;
  return Object.keys(archivos)
    .filter((r) => /^xl\/worksheets\/sheet\d+\.xml$/.test(r))
    .sort()
    .map((ruta) => ({ nombre: ruta.replace(/^.*\//, ""), ruta }));
}

export interface Hoja {
  nombre: string;
  filas: Filas;
}

export function leerXlsx(datos: Uint8Array): Hoja[] {
  let archivos: Record<string, Uint8Array>;
  try {
    archivos = unzipSync(datos);
  } catch {
    throw new Error("No se pudo abrir el Excel. ¿Es un .xlsx? (los .xls antiguos no valen: guárdalo como .xlsx o CSV).");
  }

  const compartidos: string[] = [];
  const xmlCompartidos = archivos["xl/sharedStrings.xml"];
  if (xmlCompartidos) {
    for (const m of strFromU8(xmlCompartidos).matchAll(/<si>([\s\S]*?)<\/si>/g)) {
      compartidos.push(textoDeRuns(m[1]));
    }
  }

  const hojas = hojasDelLibro(archivos);
  if (hojas.length === 0) throw new Error("El Excel no tiene ninguna hoja.");
  return hojas.map((h) => ({ nombre: h.nombre, filas: leerFilasHoja(strFromU8(archivos[h.ruta]), compartidos) }));
}

function leerFilasHoja(hoja: string, compartidos: string[]): Filas {
  const filas: Filas = [];
  for (const fila of hoja.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const valores: string[] = [];
    for (const celda of fila[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const atributos = celda[1];
      const contenido = celda[2] ?? "";
      const ref = /\br="([A-Z]+\d+)"/.exec(atributos)?.[1];
      const tipo = /\bt="([^"]+)"/.exec(atributos)?.[1];
      const v = /<v>([\s\S]*?)<\/v>/.exec(contenido)?.[1];
      let valor = "";
      if (tipo === "s" && v !== undefined) valor = compartidos[Number(v)] ?? "";
      else if (tipo === "inlineStr") valor = textoDeRuns(contenido);
      else if (v !== undefined) valor = decodificarXml(v);
      const indice = ref ? indiceColumna(ref) : valores.length;
      while (valores.length < indice) valores.push("");
      valores[indice] = valor;
    }
    filas.push(valores);
  }
  return filas;
}

// CSV con «,» o «;» (Excel en español guarda con «;»), comillas y saltos de
// línea dentro de las comillas.
export function leerCsv(texto: string): Filas {
  const limpio = texto.replace(/^﻿/, "");
  const primeraLinea = limpio.split(/\r?\n/, 1)[0] ?? "";
  const separador =
    (primeraLinea.match(/;/g)?.length ?? 0) > (primeraLinea.match(/,/g)?.length ?? 0) ? ";" : ",";

  const filas: Filas = [];
  let fila: string[] = [];
  let campo = "";
  let entreComillas = false;
  for (let i = 0; i < limpio.length; i++) {
    const c = limpio[i];
    if (entreComillas) {
      if (c === '"' && limpio[i + 1] === '"') {
        campo += '"';
        i++;
      } else if (c === '"') entreComillas = false;
      else campo += c;
    } else if (c === '"') entreComillas = true;
    else if (c === separador) {
      fila.push(campo);
      campo = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && limpio[i + 1] === "\n") i++;
      fila.push(campo);
      filas.push(fila);
      fila = [];
      campo = "";
    } else campo += c;
  }
  if (campo !== "" || fila.length > 0) {
    fila.push(campo);
    filas.push(fila);
  }
  return filas;
}

export async function leerArchivoHojaCalculo(archivo: File): Promise<Hoja[]> {
  const nombre = archivo.name.toLowerCase();
  if (nombre.endsWith(".xlsx")) return leerXlsx(new Uint8Array(await archivo.arrayBuffer()));
  if (nombre.endsWith(".csv") || nombre.endsWith(".txt")) {
    return [{ nombre: archivo.name, filas: leerCsv(await archivo.text()) }];
  }
  throw new Error("Sube un Excel (.xlsx) o un CSV.");
}
