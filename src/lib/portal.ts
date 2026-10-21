import { createHash, randomBytes } from "crypto";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { crearClienteServicio } from "@/lib/supabaseServidor";
import { NOMBRE_TABLA_SQL, type Tabla } from "@/lib/entradaDatos";
import { ORIGEN_PUBLICO } from "@/lib/dominio";

// Portal de clientes (asistentes y patrocinadores). NO usa Supabase Auth: las
// políticas RLS del resto de tablas dejan hacer todo a cualquier sesión de
// Supabase, y Providers.tsx muestra el panel interno a cualquier sesión. Aquí
// la sesión es una cookie propia (httpOnly) con un token aleatorio cuyo hash
// se guarda en portal_sesiones, y todas las lecturas van por /api/portal/*
// con la clave de servicio, filtrando SIEMPRE por el email verificado de la
// sesión — nunca por un identificador que mande el navegador.

export const COOKIE_PORTAL = "balvert_portal";
export const DURACION_ENLACE_MS = 15 * 60 * 1000;
export const DURACION_SESION_MS = 7 * 24 * 60 * 60 * 1000;
export const MAX_ENLACES_POR_HORA = 3;


// Dominio de los enlaces de los emails (portal, entradas, avisos de
// documentos): siempre app.balvert.es, venga la petición de donde venga
// (balvert-2027-app.vercel.app, el webhook de Stripe…). Nunca se usa un
// dominio que mande la petición: la cabecera Origin o el Host los puede
// inventar cualquiera, y un enlace legítimo de secretaria@balvert.es que
// apuntara a otro dominio le regalaría el token a quien lo controle. La única
// excepción es el ordenador de desarrollo (localhost), para poder probar los
// enlaces en local.
const HOSTS_DESARROLLO = new Set(["localhost", "127.0.0.1"]);

export function origenDeConfianza(req: Request): string {
  try {
    const url = new URL(req.url);
    if (HOSTS_DESARROLLO.has(url.hostname)) return url.origin;
  } catch {}
  return ORIGEN_PUBLICO;
}

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function generarToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function normalizarEmail(valor: unknown): string {
  return typeof valor === "string" ? valor.trim().toLowerCase() : "";
}

// Para .ilike(): sin comodines, "a_b@x.com" casaría también con "axb@x.com".
// ilike en vez de eq porque las altas manuales del panel pueden tener
// mayúsculas en el email.
export function patronEmailExacto(email: string): string {
  return email.replace(/[\\%_]/g, (c) => `\\${c}`);
}

export const CAMPO_EMAIL: Record<Tabla, string> = {
  congreso: "email",
  gala: "email_asistente",
  excursion: "email_asistente",
};

export async function idEdicionActiva(supabase: SupabaseClient): Promise<string | null> {
  const { data } = await supabase.from("ediciones").select("id").eq("activa", true).limit(1).maybeSingle();
  return data?.id ?? null;
}

// Cabecera de las dos zonas del portal: lugar, días y fecha de inicio (para
// la cuenta atrás) del congreso de la edición.
export interface CongresoPortal {
  lugar: string | null;
  dias: string | null;
  fechaInicio: string | null;
}

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

// «16 y 17 de marzo de 2027», «16 al 18 de marzo de 2027», «30 de marzo al
// 1 de abril de 2027». Fechas "AAAA-MM-DD".
function textoDias(inicio: string | null, fin: string | null): string | null {
  if (!inicio) return null;
  const [a1, m1, d1] = inicio.slice(0, 10).split("-").map(Number);
  if (!fin || fin.slice(0, 10) <= inicio.slice(0, 10)) return `${d1} de ${MESES[m1 - 1]} de ${a1}`;
  const [a2, m2, d2] = fin.slice(0, 10).split("-").map(Number);
  if (a1 === a2 && m1 === m2) return `${d1} ${d2 - d1 === 1 ? "y" : "al"} ${d2} de ${MESES[m1 - 1]} de ${a1}`;
  if (a1 === a2) return `${d1} de ${MESES[m1 - 1]} al ${d2} de ${MESES[m2 - 1]} de ${a1}`;
  return `${d1} de ${MESES[m1 - 1]} de ${a1} al ${d2} de ${MESES[m2 - 1]} de ${a2}`;
}

export async function edicionPortal(
  supabase: SupabaseClient,
  edicionId: string | null
): Promise<{ nombre: string | null; congreso: CongresoPortal }> {
  const vacio = { nombre: null, congreso: { lugar: null, dias: null, fechaInicio: null } };
  if (!edicionId) return vacio;
  const { data } = await supabase
    .from("ediciones")
    .select("nombre, fecha_inicio, fecha_fin, lugar_congreso, certificado_dias")
    .eq("id", edicionId)
    .maybeSingle();
  if (!data) return vacio;
  return {
    nombre: data.nombre ?? null,
    congreso: {
      lugar: data.lugar_congreso?.trim() || null,
      dias: data.certificado_dias?.trim() || textoDias(data.fecha_inicio, data.fecha_fin),
      fechaInicio: data.fecha_inicio ?? null,
    },
  };
}

// ¿Tiene este email alguna entrada (con QR o sin él) en la edición activa?
export async function tieneEntradas(supabase: SupabaseClient, edicionId: string, email: string): Promise<boolean> {
  const patron = patronEmailExacto(email);
  const resultados = await Promise.all(
    (["congreso", "gala", "excursion"] as Tabla[]).map((tabla) =>
      supabase
        .from(NOMBRE_TABLA_SQL[tabla])
        .select("id", { count: "exact", head: true })
        .eq("edicion_id", edicionId)
        .ilike(CAMPO_EMAIL[tabla], patron)
    )
  );
  return resultados.some((r) => (r.count ?? 0) > 0);
}

export interface SesionPortal {
  email: string;
}

// Lee la cookie y la valida contra portal_sesiones. Devuelve null si no hay
// cookie, no existe o ha caducado.
export async function sesionPortal(): Promise<SesionPortal | null> {
  const token = (await cookies()).get(COOKIE_PORTAL)?.value;
  if (!token) return null;
  const supabase = crearClienteServicio();
  const { data } = await supabase
    .from("portal_sesiones")
    .select("email, expira_en")
    .eq("token_hash", hashToken(token))
    .maybeSingle();
  if (!data || new Date(data.expira_en).getTime() <= Date.now()) return null;
  return { email: data.email };
}

// Columnas que necesita construirDatosEntrada y «Editar mis datos» (teléfono,
// alergias, check-in), y ninguna más: el documento de identidad (y el resto
// de datos internos de la fila) no se leen nunca desde el portal.
export const COLUMNAS_ENTRADA: Record<Tabla, string> = {
  congreso: "id, nombre, telefono, tipo_acceso, empresa_entidad, categoria_patrocinio, edicion_id, qr_codigo, recibo_url, referencia_pago_online, check_in_hecho",
  gala: "id, nombre_asistente, menu, alergias_intolerancias, empresa_entidad, categoria_patrocinio, edicion_id, qr_codigo, recibo_url, referencia_pago_online, check_in_hecho",
  excursion: "id, nombre_asistente, tipo_entrada, empresa_entidad, categoria_patrocinio, edicion_id, qr_codigo, recibo_url, referencia_pago_online, check_in_hecho",
};

// Consulta base de las entradas de un email en la edición activa. Quien la
// use puede añadir más filtros (p. ej. .eq("id", ...)), pero el del email
// verificado siempre va incluido.
export function consultaEntradas(supabase: SupabaseClient, tabla: Tabla, edicionId: string, email: string) {
  return supabase
    .from(NOMBRE_TABLA_SQL[tabla])
    .select(COLUMNAS_ENTRADA[tabla])
    .eq("edicion_id", edicionId)
    .ilike(CAMPO_EMAIL[tabla], patronEmailExacto(email));
}

export interface DocumentoPortal {
  id: string;
  titulo: string;
  descripcion: string | null;
  nombre_archivo: string;
  ruta_archivo: string;
  destino: string;
  creado: string;
}

// Documentos de la edición activa que le corresponden a este email (zona
// personal): "todos_asistentes" si tiene alguna entrada y los de "asistente"
// dirigidos a su email. Los de empresa van por la zona de empresa
// (documentosEmpresa), con su propia sesión: ser contacto de una empresa ya
// no da acceso a nada de ella desde aquí.
export async function documentosVisibles(
  supabase: SupabaseClient,
  edicionId: string,
  email: string
): Promise<DocumentoPortal[]> {
  const conEntradas = await tieneEntradas(supabase, edicionId, email);
  // Los documentos para una persona concreta (p. ej. su factura), por su
  // email. Va entre comillas dobles para que ningún carácter del email
  // cambie el sentido del filtro.
  const emailFiltro = `"${email.replace(/["\\]/g, (c) => `\\${c}`)}"`;
  const filtros: string[] = [`and(destino.eq.asistente,email_destinatario.eq.${emailFiltro})`];
  if (conEntradas) filtros.push("destino.eq.todos_asistentes");
  return consultarDocumentos(supabase, edicionId, filtros);
}

// Documentos de la zona de empresa: los de "todos_patrocinadores" y los de
// "patrocinador" de ESTA empresa (la de la sesión de empresa).
export async function documentosEmpresa(
  supabase: SupabaseClient,
  edicionId: string,
  patrocinadorId: string
): Promise<DocumentoPortal[]> {
  // Id que viene de la sesión (base de datos), no del navegador.
  return consultarDocumentos(supabase, edicionId, [
    "destino.eq.todos_patrocinadores",
    `and(destino.eq.patrocinador,patrocinador_id.eq.${patrocinadorId})`,
  ]);
}

async function consultarDocumentos(supabase: SupabaseClient, edicionId: string, filtros: string[]) {
  const { data, error } = await supabase
    .from("documentos")
    .select("id, titulo, descripcion, nombre_archivo, ruta_archivo, destino, creado")
    .eq("edicion_id", edicionId)
    .or(filtros.join(","))
    .order("creado", { ascending: false });
  if (error) throw new Error(`documentos del portal: ${error.message}`);
  return (data ?? []) as DocumentoPortal[];
}
