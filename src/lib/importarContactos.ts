// «Importar contactos»: reconocer las columnas de un Excel/CSV (ver
// leerHojaCalculo.ts) y decidir, fila a fila, qué se crea, qué se completa y
// qué se salta. Es código puro (sin base de datos): el navegador lo usa para
// montar las columnas y el servidor (/api/contactos/importar) para la
// previsualización y para aplicar, con el mismo criterio.
//
// Decisiones de Ariadna (29/10/2026):
// - Email que ya está: solo se completan sus campos vacíos; nunca se pisa nada
//   ni cambia su estado (un excluido sigue excluido).
// - Un origen para todo el archivo; si la fila trae su propio origen, manda.
// - Email vacío, mal escrito o repetido en el archivo: la fila se salta y se lista.
import { normalizarTexto } from "@/lib/exportarListado";
import { normalizarEmail } from "@/lib/exclusiones";
import { RE_EMAIL, cabecera, contarEmails, detectarCabecera } from "@/lib/importarExclusiones";
import { PAISES } from "@/lib/paises";
import type { Hoja } from "@/lib/leerHojaCalculo";
import type { ContactoNewsletter, MotivoExclusion } from "@/types/database";

export const MAX_FILAS = 10000;
export const MAX_BYTES = 10 * 1024 * 1024;

export type CampoImportacion =
  | "nombre"
  | "apellidos"
  | "nombre_completo"
  | "email"
  | "telefono"
  | "empresa"
  | "entidad_publica"
  | "colegiado_profesional"
  | "nombre_colegio"
  | "nacionalidad"
  | "origen_lista";

export const CAMPOS_IMPORTACION: { key: CampoImportacion; label: string }[] = [
  { key: "email", label: "Email" },
  { key: "nombre", label: "Nombre" },
  { key: "apellidos", label: "Apellidos" },
  { key: "nombre_completo", label: "Nombre completo (va a Nombre)" },
  { key: "telefono", label: "Teléfono" },
  { key: "empresa", label: "Empresa" },
  { key: "entidad_publica", label: "Entidad pública" },
  { key: "colegiado_profesional", label: "Colegiado profesional" },
  { key: "nombre_colegio", label: "Nombre del colegio" },
  { key: "nacionalidad", label: "Nacionalidad" },
  { key: "origen_lista", label: "Origen de la lista" },
];

const ETIQUETA: Record<string, string> = Object.fromEntries(CAMPOS_IMPORTACION.map((c) => [c.key, c.label]));
ETIQUETA.nombre = "Nombre";

// Cabecera (sin mayúsculas, acentos ni signos) → campo.
const SINONIMOS: [RegExp, CampoImportacion][] = [
  [/^(nombre (y|e) apellidos?|nombre completo|nombre y apellido|full name|contacto|persona de contacto)$/, "nombre_completo"],
  [/^(nombre|name|first name|nombre de pila)$/, "nombre"],
  [/^(apellidos?|surname|last name|primer apellido)$/, "apellidos"],
  [/^(tel|telf|telefono|telefonos|movil|celular|phone|mobile|telefono movil|tlf)$/, "telefono"],
  [/^(empresa|compania|company|organizacion|razon social)$/, "empresa"],
  [/^(entidad publica|entidad|administracion|organismo)$/, "entidad_publica"],
  [/^(colegiado|colegiada|colegiado profesional|colegiado a)$/, "colegiado_profesional"],
  [/^(colegio|nombre del colegio|colegio profesional)$/, "nombre_colegio"],
  [/^(nacionalidad|pais|country)$/, "nacionalidad"],
  [/^(origen|origen de la lista|lista|fuente)$/, "origen_lista"],
];

export function campoDeCabecera(texto: string): CampoImportacion | "" {
  const c = cabecera(texto);
  if (/^(e ?mail|correo|mail)( electronico)?( address)?$/.test(c) || /^direccion (de )?(e ?mail|correo)/.test(c)) return "email";
  for (const [re, campo] of SINONIMOS) if (re.test(c)) return campo;
  return "";
}

export interface ArchivoContactos {
  hoja: string;
  // Índice de la fila de cabecera en la hoja (las filas de datos van detrás).
  iCabecera: number;
  cabeceras: string[];
  // Columna → campo ("" = no importar), propuesto por la cabecera.
  columnas: (CampoImportacion | "")[];
  filas: string[][];
  // Número de cada fila en la hoja (1 = primera fila, como en Excel).
  numeros: number[];
}

// La hoja que se pida, o la que más emails tiene.
export function prepararArchivo(hojas: Hoja[], nombreHoja?: string): ArchivoContactos {
  const hoja =
    hojas.find((h) => h.nombre === nombreHoja) ??
    [...hojas].sort((a, b) => contarEmails(b.filas) - contarEmails(a.filas))[0];
  if (!hoja) throw new Error("El archivo está vacío.");
  const { iCabecera } = detectarCabecera(hoja.filas);
  const cabeceras = iCabecera >= 0 ? hoja.filas[iCabecera] : [];
  const anchura = Math.max(cabeceras.length, ...hoja.filas.slice(iCabecera + 1).map((f) => f.length), 0);
  const columnas: (CampoImportacion | "")[] = [];
  const usados = new Set<string>();
  for (let i = 0; i < anchura; i++) {
    const campo = campoDeCabecera(cabeceras[i] ?? "");
    // Si dos columnas parecen lo mismo, solo la primera; la otra se puede elegir a mano.
    columnas.push(campo && !usados.has(campo) ? campo : "");
    if (campo) usados.add(campo);
  }
  const filas: string[][] = [];
  const numeros: number[] = [];
  hoja.filas.forEach((f, i) => {
    if (i <= iCabecera || !f.some((v) => v.trim() !== "")) return;
    filas.push(f);
    numeros.push(i + 1);
  });
  return { hoja: hoja.nombre, iCabecera, cabeceras, columnas, filas, numeros };
}

// Lo que viaja al servidor: por cada fila, su número en la hoja y el texto de
// cada campo elegido. Nada más (el servidor no se fía de ningún otro dato).
export type FilaEnviada = { fila: number } & Partial<Record<CampoImportacion, string>>;

export function filasParaEnviar(archivo: ArchivoContactos, columnas: (CampoImportacion | "")[]): FilaEnviada[] {
  return archivo.filas.map((valores, i) => {
    const fila: FilaEnviada = { fila: archivo.numeros[i] };
    columnas.forEach((campo, c) => {
      if (!campo) return;
      const v = (valores[c] ?? "").trim();
      if (v && !fila[campo]) fila[campo] = v;
    });
    return fila;
  });
}

// ---------- Planificación (previsualización y aplicación) ----------

export type CamposContacto = Partial<
  Pick<
    ContactoNewsletter,
    | "nombre"
    | "apellidos"
    | "email"
    | "telefono"
    | "empresa"
    | "entidad_publica"
    | "colegiado_profesional"
    | "nombre_colegio"
    | "nacionalidad"
    | "origen_lista"
  >
>;

const CAMPOS_TEXTO = ["nombre", "apellidos", "telefono", "empresa", "entidad_publica", "nombre_colegio", "nacionalidad", "origen_lista"] as const;

const PAIS_NORMALIZADO = new Map(PAISES.map((p) => [normalizarTexto(p), p]));

function esSiColegiado(v: string): boolean {
  return /^(si|x|1|true)$/.test(normalizarTexto(v.trim()));
}

export interface FilaSaltada {
  fila: number;
  email: string;
  motivo: "Email vacío" | "Email mal escrito" | "Email repetido en el archivo";
}

export interface AvisoFila {
  fila: number;
  email: string;
  aviso: string;
}

export interface PlanImportacion {
  nuevos: { fila: number; datos: CamposContacto }[];
  completar: { fila: number; id: string; email: string; cambios: CamposContacto; campos: string[] }[];
  sinCambios: { fila: number; email: string }[];
  // Excluidos de envíos presentes en el archivo: se completan, siguen excluidos.
  excluidos: { fila: number; id: string; email: string; motivo: MotivoExclusion | null; cambios: CamposContacto; campos: string[] }[];
  saltadas: FilaSaltada[];
  avisos: AvisoFila[];
}

const MAX_LARGO = 500;

export function planificarImportacion(
  filas: FilaEnviada[],
  origenGeneral: string,
  existentes: Map<string, ContactoNewsletter>
): PlanImportacion {
  const plan: PlanImportacion = { nuevos: [], completar: [], sinCambios: [], excluidos: [], saltadas: [], avisos: [] };
  const vistos = new Set<string>();

  for (const f of filas) {
    const bruto = (f.email ?? "").trim();
    const email = normalizarEmail(bruto.replace(/^mailto:/i, ""));
    if (!email) {
      plan.saltadas.push({ fila: f.fila, email: "", motivo: "Email vacío" });
      continue;
    }
    if (!RE_EMAIL.test(email) || email.length > 254) {
      plan.saltadas.push({ fila: f.fila, email: bruto, motivo: "Email mal escrito" });
      continue;
    }
    if (vistos.has(email)) {
      plan.saltadas.push({ fila: f.fila, email, motivo: "Email repetido en el archivo" });
      continue;
    }
    vistos.add(email);

    const datos: CamposContacto = {};
    const texto = (v: string | undefined) => (v ?? "").trim().slice(0, MAX_LARGO) || null;
    datos.nombre = texto(f.nombre) ?? texto(f.nombre_completo);
    datos.apellidos = texto(f.apellidos);
    datos.telefono = texto(f.telefono);
    datos.empresa = texto(f.empresa);
    datos.entidad_publica = texto(f.entidad_publica);
    datos.nombre_colegio = texto(f.nombre_colegio);
    datos.origen_lista = texto(f.origen_lista) ?? texto(origenGeneral);
    if (f.colegiado_profesional !== undefined && f.colegiado_profesional.trim() !== "") {
      datos.colegiado_profesional = esSiColegiado(f.colegiado_profesional);
    }
    const pais = texto(f.nacionalidad);
    if (pais) {
      const reconocido = PAIS_NORMALIZADO.get(normalizarTexto(pais));
      if (reconocido) datos.nacionalidad = reconocido;
      else plan.avisos.push({ fila: f.fila, email, aviso: `País no reconocido: «${pais}» (se deja vacío)` });
    }

    const existente = existentes.get(email);
    if (!existente) {
      plan.nuevos.push({ fila: f.fila, datos: { ...limpiar(datos), email, colegiado_profesional: datos.colegiado_profesional ?? false } });
      continue;
    }

    // Solo lo que el contacto tiene vacío. Colegiado: «No» cuenta como vacío
    // y solo se completa con un «Sí».
    const cambios: CamposContacto = {};
    for (const campo of CAMPOS_TEXTO) {
      const actual = existente[campo];
      if (datos[campo] && (actual === null || actual === undefined || String(actual).trim() === "")) {
        cambios[campo] = datos[campo];
      }
    }
    if (datos.colegiado_profesional === true && !existente.colegiado_profesional) cambios.colegiado_profesional = true;
    const campos = Object.keys(cambios).map((k) => ETIQUETA[k] ?? k);

    if (existente.estado === "Excluido") {
      plan.excluidos.push({ fila: f.fila, id: existente.id, email, motivo: existente.motivo_exclusion, cambios, campos });
    } else if (campos.length > 0) {
      plan.completar.push({ fila: f.fila, id: existente.id, email, cambios, campos });
    } else {
      plan.sinCambios.push({ fila: f.fila, email });
    }
  }
  return plan;
}

function limpiar(datos: CamposContacto): CamposContacto {
  return Object.fromEntries(Object.entries(datos).filter(([, v]) => v !== null && v !== undefined)) as CamposContacto;
}

// Lo que se devuelve al navegador (sin ids ni datos que no hagan falta).
export interface ResumenImportacion {
  nuevos: { fila: number; email: string; nombre: string | null }[];
  completar: { fila: number; email: string; campos: string[] }[];
  sinCambios: { fila: number; email: string }[];
  excluidos: { fila: number; email: string; motivo: MotivoExclusion | null; campos: string[] }[];
  saltadas: FilaSaltada[];
  avisos: AvisoFila[];
}

export function resumirPlan(plan: PlanImportacion): ResumenImportacion {
  return {
    nuevos: plan.nuevos.map((n) => ({
      fila: n.fila,
      email: n.datos.email ?? "",
      nombre: [n.datos.nombre, n.datos.apellidos].filter(Boolean).join(" ") || null,
    })),
    completar: plan.completar.map(({ fila, email, campos }) => ({ fila, email, campos })),
    sinCambios: plan.sinCambios,
    excluidos: plan.excluidos.map(({ fila, email, motivo, campos }) => ({ fila, email, motivo, campos })),
    saltadas: plan.saltadas,
    avisos: plan.avisos,
  };
}
