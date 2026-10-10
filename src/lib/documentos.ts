// Documentos que se comparten en el portal de clientes (ver
// 021_documentos_recibo_factura.sql). Compartido entre la pantalla interna
// /documentos, sus rutas /api/documentos/* y el portal.

export const BUCKET_DOCUMENTOS = "documentos";

// Mismos límites que tiene el bucket en Supabase (que los aplica por su
// cuenta); aquí se comprueban antes para dar un mensaje claro.
export const TAMANO_MAXIMO_DOCUMENTO = 20 * 1024 * 1024;
export const TIPOS_DOCUMENTO_PERMITIDOS: Record<string, string> = {
  "application/pdf": "pdf",
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

export const DESTINOS = ["todos_asistentes", "todos_patrocinadores", "patrocinador"] as const;
export type Destino = (typeof DESTINOS)[number];

export const NOMBRE_DESTINO: Record<Destino, string> = {
  todos_asistentes: "Todos los asistentes",
  todos_patrocinadores: "Todos los patrocinadores",
  patrocinador: "Una empresa patrocinadora",
};

export function esDestino(valor: unknown): valor is Destino {
  return typeof valor === "string" && (DESTINOS as readonly string[]).includes(valor);
}

export const MAX_TITULO = 150;
export const MAX_DESCRIPCION = 1000;

// Nombre de archivo seguro para guardarlo y para la descarga: sin tildes,
// sin rutas ni caracteres raros, con la extensión que corresponde al tipo
// real (no la que traiga el nombre original).
export function sanearNombreArchivo(nombre: string, tipo: string): string {
  const extension = TIPOS_DOCUMENTO_PERMITIDOS[tipo] ?? "bin";
  const base = nombre
    .replace(/\.[^.]*$/, "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9-_ ]+/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 80);
  return `${base || "documento"}.${extension}`;
}
