// Archivos de cada patrocinador (logo, contrato, ponencia…). Ver
// 024_patrocinador_archivos.sql y 025_materiales_patrocinadores_portal.sql.
// Compartido entre la ficha del patrocinador (/api/patrocinadores/*) y el
// área de la empresa en el portal (/api/portal/materiales/*). Desde el
// portal, la empresa solo ve lo que ella subió (origen "patrocinador") y lo
// que el equipo marcó como visible (visible_empresa).
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
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ppt: "application/vnd.ms-powerpoint",
  key: "application/vnd.apple.keynote",
};

export const FORMATOS_PERMITIDOS = "PDF, PNG, JPG, WEBP, SVG, AI, EPS, PPTX, PPT o KEY";
export const MENSAJE_DEMASIADO_GRANDE =
  "Archivo demasiado grande (máximo 50 MB): envíalo por WeTransfer a secretaria@balvert.es.";

// Solo estos se enseñan como miniatura. SVG, AI y EPS nunca se muestran en la
// página (un SVG puede llevar código): solo se descargan.
export const EXTENSIONES_CON_MINIATURA = new Set(["png", "jpg", "jpeg", "webp"]);

export const TIPOS_ARCHIVO = ["logo", "ponencia", "rollup", "vinilado", "contrato", "otro"] as const;
export type TipoArchivo = (typeof TIPOS_ARCHIVO)[number];
export const NOMBRE_TIPO_ARCHIVO: Record<TipoArchivo, string> = {
  logo: "Logo",
  ponencia: "Ponencia",
  rollup: "Rollup",
  vinilado: "Vinilado",
  contrato: "Contrato",
  otro: "Otro",
};
export function esTipoArchivo(valor: unknown): valor is TipoArchivo {
  return typeof valor === "string" && (TIPOS_ARCHIVO as readonly string[]).includes(valor);
}

// Lo que puede subir una empresa desde su área.
export const TIPOS_ARCHIVO_PORTAL = ["logo", "ponencia", "rollup", "vinilado"] as const;
export type TipoArchivoPortal = (typeof TIPOS_ARCHIVO_PORTAL)[number];
export function esTipoArchivoPortal(valor: unknown): valor is TipoArchivoPortal {
  return typeof valor === "string" && (TIPOS_ARCHIVO_PORTAL as readonly string[]).includes(valor);
}

export const MAX_COMENTARIO_ARCHIVO = 1000;

// Casilla de la ficha que marca cada tipo de archivo. Rollup y vinilado no
// marcan nada: esas casillas las cambia el pedido de producción del portal
// (o el equipo en la ficha), no subir un archivo.
export const CASILLA_POR_TIPO: Partial<Record<TipoArchivo, "logo_recibido" | "ponencia_recibida">> = {
  logo: "logo_recibido",
  ponencia: "ponencia_recibida",
};

// Cambia campos de la ficha dejando el autor en el historial (ver la función
// actualizar_patrocinador_como de la migración 025, que solo deja tocar los
// campos del portal y las casillas de logo/ponencia).
export async function actualizarFichaComo(
  supabase: SupabaseClient,
  patrocinadorId: string,
  autor: string,
  campos: Record<string, string | number | null>
) {
  const { error } = await supabase.rpc("actualizar_patrocinador_como", {
    p_id: patrocinadorId,
    p_autor: autor,
    p_campos: campos,
  });
  if (error) throw new Error(error.message);
}

// Tras borrar un archivo: si era el último logo (o la última ponencia) de la
// empresa, su casilla vuelve a "No". Si queda otro, no se toca. Devuelve los
// campos cambiados (para refrescar la ficha abierta).
export async function desmarcarCasillaSiNoQuedan(
  supabase: SupabaseClient,
  patrocinadorId: string,
  tipo: TipoArchivo,
  autor: string
): Promise<Record<string, string>> {
  const casilla = CASILLA_POR_TIPO[tipo];
  if (!casilla) return {};
  const { count, error } = await supabase
    .from("patrocinador_archivos")
    .select("id", { count: "exact", head: true })
    .eq("patrocinador_id", patrocinadorId)
    .eq("tipo", tipo);
  if (error || (count ?? 0) > 0) return {};
  await actualizarFichaComo(supabase, patrocinadorId, autor, { [casilla]: "No" });
  return { [casilla]: "No" };
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
