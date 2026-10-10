// Archivos internos de cada patrocinador (logo, contrato…). Ver
// 024_patrocinador_archivos.sql. Compartido entre la ficha del patrocinador
// y las rutas /api/patrocinadores/*. Nunca se usa desde el portal.
import type { SupabaseClient } from "@supabase/supabase-js";

export const BUCKET_ARCHIVOS_PATROCINADOR = "patrocinadores-archivos";

// Mismos límites que el bucket en Supabase (que los aplica por su cuenta).
export const TAMANO_MAXIMO_ARCHIVO = 50 * 1024 * 1024;

// El tipo se decide por la extensión: los navegadores suelen mandar AI/EPS
// sin tipo, y así el tipo con el que se guarda no lo elige quien sube.
export const TIPO_POR_EXTENSION: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  svg: "image/svg+xml",
  ai: "application/postscript",
  eps: "application/postscript",
};

// Solo estos se enseñan como miniatura. SVG, AI y EPS nunca se muestran en la
// página (un SVG puede llevar código): solo se descargan.
export const EXTENSIONES_CON_MINIATURA = new Set(["png", "jpg", "jpeg", "webp"]);

export const TIPOS_ARCHIVO = ["logo", "contrato", "otro"] as const;
export type TipoArchivo = (typeof TIPOS_ARCHIVO)[number];
export const NOMBRE_TIPO_ARCHIVO: Record<TipoArchivo, string> = {
  logo: "Logo",
  contrato: "Contrato",
  otro: "Otro",
};
export function esTipoArchivo(valor: unknown): valor is TipoArchivo {
  return typeof valor === "string" && (TIPOS_ARCHIVO as readonly string[]).includes(valor);
}

export const MAX_TITULO_ARCHIVO = 150;

export function extensionDe(nombre: string): string {
  const m = /\.([a-zA-Z0-9]+)$/.exec(nombre);
  return m ? m[1].toLowerCase() : "";
}

// Nombre seguro para guardar y descargar: sin tildes, rutas ni caracteres
// raros, con la extensión en minúsculas.
export function sanearNombre(nombre: string): string {
  const extension = extensionDe(nombre);
  const base = nombre
    .replace(/\.[^.]*$/, "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9-_ ]+/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 80);
  return `${base || "archivo"}.${extension}`;
}

// Borra del bucket todo lo que haya bajo la carpeta del patrocinador
// (<patrocinador_id>/<uuid>/<nombre>), esté o no registrado en la tabla:
// así tampoco quedan restos de subidas que no llegaron a guardarse.
export async function borrarCarpetaPatrocinador(supabase: SupabaseClient, patrocinadorId: string) {
  const bucket = supabase.storage.from(BUCKET_ARCHIVOS_PATROCINADOR);
  const rutas: string[] = [];
  const { data: subcarpetas } = await bucket.list(patrocinadorId, { limit: 1000 });
  for (const sub of subcarpetas ?? []) {
    const { data: archivos } = await bucket.list(`${patrocinadorId}/${sub.name}`, { limit: 1000 });
    for (const a of archivos ?? []) rutas.push(`${patrocinadorId}/${sub.name}/${a.name}`);
  }
  if (rutas.length > 0) await bucket.remove(rutas);
  return rutas.length;
}

// "Ariadna"/"Ariosto" a partir del email de la sesión (como AuthContext.tsx).
export function nombreAutor(email: string | undefined): string | null {
  const e = email?.toLowerCase();
  if (!e) return null;
  if (e === process.env.NEXT_PUBLIC_EMAIL_ARIADNA?.toLowerCase()) return "Ariadna";
  if (e === process.env.NEXT_PUBLIC_EMAIL_ARIOSTO?.toLowerCase()) return "Ariosto";
  return e;
}
