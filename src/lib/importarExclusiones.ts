// «Importar exclusiones»: de un Excel/CSV ya leído (ver leerHojaCalculo.ts)
// saca los emails y, si las trae, la categoría de rebote y la columna
// «Sigue en contactos». La aplicación a Contactos la hace exclusiones.ts.
import { normalizarTexto } from "@/lib/exportarListado";
import { normalizarEmail, type SucesoEmail } from "@/lib/exclusiones";
import type { Hoja } from "@/lib/leerHojaCalculo";
import type { MotivoExclusion } from "@/types/database";

const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function cabecera(texto: string): string {
  return normalizarTexto(texto).replace(/[^a-z0-9]+/g, " ").trim();
}

// «Email», «E-mail», «Correo», «Correo electrónico», «Dirección de correo»…
// pero no «Id Mailrelay» ni «Estado en Mailrelay».
function esCabeceraEmail(texto: string): boolean {
  const c = cabecera(texto);
  return /^(e ?mail|correo|mail)( electronico)?( address)?$/.test(c) || /^direccion (de )?(e ?mail|correo)/.test(c);
}

function esCabeceraCategoria(texto: string): boolean {
  const c = cabecera(texto);
  return /categoria|tipo de rebote|bounce|^tipo$|clase de rebote/.test(c);
}

function esCabeceraSigue(texto: string): boolean {
  return /sigue en contactos/.test(cabecera(texto));
}

// Valores de categoría que indican rebote temporal.
export function esCategoriaTemporal(valor: string): boolean {
  return /soft|temporal/.test(normalizarTexto(valor));
}

function esSi(valor: string): boolean {
  return /^(si|s|yes|true|1|x)$/.test(normalizarTexto(valor.trim()));
}

export interface FilaImportada {
  email: string;
  categoria: string;
  sigueEnContactos: boolean | null;
}

export interface ArchivoAnalizado {
  hoja: string;
  columnaEmail: string;
  columnaCategoria: string | null;
  columnaSigue: string | null;
  filas: FilaImportada[];
  // Filas con algo en la columna de email que no parece un email.
  invalidas: number;
}

function contarEmails(filas: string[][]): number {
  let n = 0;
  for (const f of filas) for (const v of f) if (RE_EMAIL.test(v.trim())) n++;
  return n;
}

export function analizarArchivo(hojas: Hoja[]): ArchivoAnalizado {
  // La hoja con más emails (p. ej. un Excel con una hoja «Léeme» delante).
  const hoja = [...hojas].sort((a, b) => contarEmails(b.filas) - contarEmails(a.filas))[0];
  if (!hoja || contarEmails(hoja.filas) === 0) {
    throw new Error("No se ha encontrado ningún email en el archivo.");
  }

  // Fila de cabecera: la primera (de las 30 primeras) con una columna de
  // email reconocible; si no la hay, la fila anterior al primer email.
  let iCabecera = hoja.filas.slice(0, 30).findIndex((f) => f.some(esCabeceraEmail));
  let iEmail = iCabecera >= 0 ? hoja.filas[iCabecera].findIndex(esCabeceraEmail) : -1;
  if (iCabecera < 0) {
    const primera = hoja.filas.findIndex((f) => f.some((v) => RE_EMAIL.test(v.trim())));
    iCabecera = primera - 1;
    const filasDatos = hoja.filas.slice(primera);
    const anchura = Math.max(...filasDatos.map((f) => f.length));
    let mejor = 0;
    for (let i = 0; i < anchura; i++) {
      const n = filasDatos.filter((f) => RE_EMAIL.test((f[i] ?? "").trim())).length;
      if (n > mejor) {
        mejor = n;
        iEmail = i;
      }
    }
  }

  const cabeceras = iCabecera >= 0 ? hoja.filas[iCabecera] : [];
  const iCategoria = cabeceras.findIndex((c, i) => i !== iEmail && esCabeceraCategoria(c) && !esCabeceraSigue(c));
  const iSigue = cabeceras.findIndex((c, i) => i !== iEmail && esCabeceraSigue(c));

  const filas: FilaImportada[] = [];
  let invalidas = 0;
  for (const f of hoja.filas.slice(iCabecera + 1)) {
    const bruto = (f[iEmail] ?? "").trim();
    if (!bruto) continue;
    const email = normalizarEmail(bruto.replace(/^mailto:/i, ""));
    if (!RE_EMAIL.test(email)) {
      invalidas++;
      continue;
    }
    filas.push({
      email,
      categoria: iCategoria >= 0 ? (f[iCategoria] ?? "").trim() : "",
      sigueEnContactos: iSigue >= 0 ? esSi(f[iSigue] ?? "") : null,
    });
  }

  return {
    hoja: hoja.nombre,
    columnaEmail: cabeceras[iEmail] || `columna ${iEmail + 1}`,
    columnaCategoria: iCategoria >= 0 ? cabeceras[iCategoria] : null,
    columnaSigue: iSigue >= 0 ? cabeceras[iSigue] : null,
    filas,
    invalidas,
  };
}

// Con columna de categoría: «soft»/«temporal» → rebote temporal (solo se
// anota) y el resto → Rebote. Las filas sin categoría (o todo el archivo, si
// no trae esa columna) llevan el motivo que elija Ariadna.
export function sucesosDesdeArchivo(
  archivo: ArchivoAnalizado,
  opciones: { motivo: MotivoExclusion; soloSigueEnContactos: boolean }
): SucesoEmail[] {
  return archivo.filas
    .filter((f) => !opciones.soloSigueEnContactos || f.sigueEnContactos === true)
    .map((f): SucesoEmail => {
      if (f.categoria && esCategoriaTemporal(f.categoria)) return { email: f.email, tipo: "rebote_temporal" };
      if (f.categoria) return { email: f.email, tipo: "excluir", motivo: "Rebote" };
      return { email: f.email, tipo: "excluir", motivo: opciones.motivo };
    });
}
