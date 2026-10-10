// Búsqueda y descarga (Excel/CSV) de los listados internos. Todo se genera en
// el navegador con la sesión de quien descarga: no hay ninguna ruta de
// servidor ni se guarda el archivo en ningún sitio.
import type { CampoTipo, SeccionDef } from "./patrocinadorFields";

// ---------- Búsqueda ----------

// Sin distinguir mayúsculas ni tildes ("Garcia" encuentra "García").
export function normalizarTexto(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export type CampoBusqueda<T> = keyof T | ((fila: T) => string | null | undefined);

export function coincideBusqueda<T>(fila: T, campos: CampoBusqueda<T>[], busqueda: string): boolean {
  const buscado = normalizarTexto(busqueda.trim());
  if (!buscado) return true;
  const texto = campos
    .map((c) => (typeof c === "function" ? c(fila) : fila[c]))
    .filter((v) => v !== null && v !== undefined && v !== "")
    .map((v) => String(v))
    .join(" ");
  return normalizarTexto(texto).includes(buscado);
}

// "12 asistente(s)" o "3 de 12 asistente(s)".
export function textoRecuento(cargando: boolean, visibles: number, total: number, unidad: string): string {
  if (cargando) return "Cargando…";
  return visibles === total ? `${total} ${unidad}` : `${visibles} de ${total} ${unidad}`;
}

// ---------- Columnas ----------

export interface ColumnaExport<T> {
  key: string;
  label: string;
  tipo?: CampoTipo;
  // Para columnas calculadas o que hay que traducir (p. ej. un id de
  // patrocinador que se exporta como su nombre).
  valor?: (fila: T) => unknown;
  // Al construir desde las secciones: colocarla justo después de esta clave.
  despuesDe?: string;
}

// Columnas internas que nunca se descargan: identificadores técnicos y el
// código del QR de la entrada (quien lo tenga puede entrar con él).
const SIEMPRE_EXCLUIDAS = new Set(["id", "edicion_id", "qr_codigo"]);

// Columnas en el orden de los formularios (*Fields.ts), con sus etiquetas, más
// las que la pantalla añada (las que tienen `despuesDe` se intercalan).
export function columnasDesdeSecciones<T>(
  secciones: SeccionDef[],
  extras: ColumnaExport<T>[] = []
): ColumnaExport<T>[] {
  const resultado: ColumnaExport<T>[] = secciones.flatMap((s) =>
    s.campos.map((c) => ({ key: c.key, label: c.label, tipo: c.tipo }))
  );
  for (const extra of extras) {
    const pos = extra.despuesDe ? resultado.findIndex((c) => c.key === extra.despuesDe) : -1;
    if (pos >= 0) resultado.splice(pos + 1, 0, extra);
    else resultado.push(extra);
  }
  return resultado;
}

function etiquetaDesdeClave(key: string): string {
  const texto = key.replace(/_/g, " ");
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

// Garantiza "todas las columnas de la tabla": cualquier campo que tengan las
// filas y no esté en la lista se añade al final con una etiqueta legible.
function completarColumnas<T>(
  columnas: ColumnaExport<T>[],
  filas: T[],
  excluir: string[]
): ColumnaExport<T>[] {
  const conocidas = new Set([...columnas.map((c) => c.key), ...excluir, ...SIEMPRE_EXCLUIDAS]);
  const resultado = columnas.filter((c) => !SIEMPRE_EXCLUIDAS.has(c.key) && !excluir.includes(c.key));
  for (const fila of filas) {
    for (const key of Object.keys(fila as object)) {
      if (conocidas.has(key)) continue;
      conocidas.add(key);
      resultado.push({ key, label: etiquetaDesdeClave(key) });
    }
  }
  return resultado;
}

// ---------- Valores ----------

type Celda =
  | { tipo: "vacio" }
  | { tipo: "texto"; texto: string }
  | { tipo: "numero"; numero: number }
  // `fecha` lleva los componentes de la fecha/hora de Madrid en UTC, que es
  // como Excel guarda las fechas (sin zona horaria).
  | { tipo: "fecha" | "fecha-hora"; fecha: Date };

const RE_FECHA = /^(\d{4})-(\d{2})-(\d{2})$/;
const RE_FECHA_HORA = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(Z|[+-]\d{2}(?::?\d{2})?)?$/;

const formatoMadrid = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Madrid",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function aCelda(valor: unknown, tipo?: CampoTipo): Celda {
  if (valor === null || valor === undefined || valor === "") return { tipo: "vacio" };
  if (typeof valor === "boolean") return { tipo: "texto", texto: valor ? "Sí" : "No" };
  if (typeof valor === "number") return Number.isFinite(valor) ? { tipo: "numero", numero: valor } : { tipo: "vacio" };
  if (typeof valor !== "string") return { tipo: "texto", texto: JSON.stringify(valor) };

  if (tipo === "numero" && valor.trim() !== "" && !Number.isNaN(Number(valor))) {
    return { tipo: "numero", numero: Number(valor) };
  }
  const f = RE_FECHA.exec(valor);
  if (f) return { tipo: "fecha", fecha: new Date(Date.UTC(+f[1], +f[2] - 1, +f[3])) };
  const fh = RE_FECHA_HORA.exec(valor);
  if (fh) {
    if (!fh[7]) {
      // Sin zona horaria (columnas `timestamp`): ya es la hora tal cual se escribió.
      return { tipo: "fecha-hora", fecha: new Date(Date.UTC(+fh[1], +fh[2] - 1, +fh[3], +fh[4], +fh[5])) };
    }
    const instante = new Date(valor);
    if (!Number.isNaN(instante.getTime())) {
      const p = Object.fromEntries(formatoMadrid.formatToParts(instante).map((x) => [x.type, x.value]));
      return {
        tipo: "fecha-hora",
        fecha: new Date(Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute)),
      };
    }
  }
  return { tipo: "texto", texto: valor };
}

// Protección contra inyección de fórmulas: un texto que empieza por = + - @,
// tabulador o retorno de carro se antepone con ' para que la hoja de cálculo
// no lo ejecute como fórmula.
const RE_PELIGROSO = /^[=+\-@\t\r]/;
// Teléfonos e importes escritos como texto ("+34 600 123 456"): en el .xlsx
// van como celda de texto y sin letras no pueden formar una fórmula dañina,
// así que no se les pone la comilla (se vería en la celda).
const RE_SOLO_NUMEROS = /^[+-]?[\d\s().-]+$/;

function protegerTexto(texto: string, formato: "csv" | "xlsx"): string {
  if (!RE_PELIGROSO.test(texto)) return texto;
  if (formato === "xlsx" && RE_SOLO_NUMEROS.test(texto)) return texto;
  return "'" + texto;
}

function dos(n: number): string {
  return String(n).padStart(2, "0");
}

function fechaATexto(fecha: Date, conHora: boolean): string {
  const base = `${dos(fecha.getUTCDate())}/${dos(fecha.getUTCMonth() + 1)}/${fecha.getUTCFullYear()}`;
  return conHora ? `${base} ${dos(fecha.getUTCHours())}:${dos(fecha.getUTCMinutes())}` : base;
}

function valorDeColumna<T>(fila: T, col: ColumnaExport<T>): Celda {
  const bruto = col.valor ? col.valor(fila) : (fila as Record<string, unknown>)[col.key];
  return aCelda(bruto, col.tipo);
}

// ---------- Nombre de archivo ----------

function aSlug(texto: string): string {
  return normalizarTexto(texto)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function nombreArchivo(pantalla: string, edicion: string | null | undefined, extension: "xlsx" | "csv"): string {
  const hoy = new Date();
  const fecha = `${hoy.getFullYear()}-${dos(hoy.getMonth() + 1)}-${dos(hoy.getDate())}`;
  const partes = ["balvert", aSlug(pantalla), edicion ? aSlug(edicion) : "", fecha].filter(Boolean);
  return `${partes.join("-")}.${extension}`;
}

function descargarBlob(blob: Blob, nombre: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ---------- Generación ----------

export interface OpcionesDescarga<T> {
  filas: T[];
  columnas: ColumnaExport<T>[];
  pantalla: string;
  edicion?: string | null;
  // Columnas de la tabla que no deben salir (además de id, edicion_id, qr_codigo).
  excluir?: string[];
}

function campoCsv(texto: string): string {
  return /[";\r\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

export function generarCsv<T>({ filas, columnas, excluir = [] }: OpcionesDescarga<T>): string {
  const cols = completarColumnas(columnas, filas, excluir);
  const lineas = [cols.map((c) => campoCsv(protegerTexto(c.label, "csv"))).join(";")];
  for (const fila of filas) {
    lineas.push(
      cols
        .map((col) => {
          const celda = valorDeColumna(fila, col);
          switch (celda.tipo) {
            case "vacio":
              return "";
            case "numero":
              // Coma decimal: así Excel en español lo reconoce como número.
              return String(celda.numero).replace(".", ",");
            case "fecha":
            case "fecha-hora":
              return fechaATexto(celda.fecha, celda.tipo === "fecha-hora");
            case "texto":
              return campoCsv(protegerTexto(celda.texto, "csv"));
          }
        })
        .join(";")
    );
  }
  // BOM + separador ";" + saltos de línea Windows: lo que espera Excel en español.
  return "﻿" + lineas.join("\r\n") + "\r\n";
}

export function descargarCsv<T>(opciones: OpcionesDescarga<T>) {
  const contenido = generarCsv(opciones);
  descargarBlob(
    new Blob([contenido], { type: "text/csv;charset=utf-8" }),
    nombreArchivo(opciones.pantalla, opciones.edicion, "csv")
  );
}

export async function descargarExcel<T>(opciones: OpcionesDescarga<T>) {
  // Se carga solo al pulsar "Excel", para no engordar las pantallas.
  const { default: writeXlsxFile } = await import("write-excel-file/browser");
  const { filas, excluir = [] } = opciones;
  const cols = completarColumnas(opciones.columnas, filas, excluir);

  const cabecera = cols.map((c) => ({ value: protegerTexto(c.label, "xlsx"), fontWeight: "bold" as const }));
  const anchos = cols.map((c) => Math.min(Math.max(c.label.length, 8), 40));

  const datos = filas.map((fila) =>
    cols.map((col, i) => {
      const celda = valorDeColumna(fila, col);
      switch (celda.tipo) {
        case "vacio":
          return null;
        case "numero":
          anchos[i] = Math.min(Math.max(anchos[i], String(celda.numero).length + 2), 40);
          return { value: celda.numero, type: Number };
        case "fecha":
          anchos[i] = Math.max(anchos[i], 11);
          return { value: celda.fecha, type: Date, format: "dd/mm/yyyy" };
        case "fecha-hora":
          anchos[i] = Math.max(anchos[i], 17);
          return { value: celda.fecha, type: Date, format: "dd/mm/yyyy hh:mm" };
        case "texto": {
          const texto = protegerTexto(celda.texto, "xlsx");
          anchos[i] = Math.min(Math.max(anchos[i], texto.length + 1), 40);
          return { value: texto, type: String };
        }
      }
    })
  );

  const blob = await writeXlsxFile([cabecera, ...datos], {
    sheet: opciones.pantalla.slice(0, 31),
    stickyRowsCount: 1,
    columns: anchos.map((width) => ({ width })),
  }).toBlob();
  descargarBlob(blob, nombreArchivo(opciones.pantalla, opciones.edicion, "xlsx"));
}
