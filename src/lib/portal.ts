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

export interface EmpresaPortal {
  id: string;
  empresa: string | null;
  categoria: string | null;
}

// Empresas patrocinadoras de la edición activa en las que este email es
// contacto 1 o contacto 2. Solo nombre y categoría: nada de facturación ni
// datos internos de la ficha.
export async function empresasDelEmail(
  supabase: SupabaseClient,
  edicionId: string,
  email: string
): Promise<EmpresaPortal[]> {
  const patron = patronEmailExacto(email);
  const [c1, c2] = await Promise.all(
    ["contacto1_email", "contacto2_email"].map((campo) =>
      supabase
        .from("patrocinadores")
        .select("id, empresa_entidad, categoria")
        .eq("edicion_id", edicionId)
        .ilike(campo, patron)
    )
  );
  const porId = new Map<string, EmpresaPortal>();
  for (const fila of [...(c1.data ?? []), ...(c2.data ?? [])]) {
    porId.set(fila.id, { id: fila.id, empresa: fila.empresa_entidad, categoria: fila.categoria });
  }
  return [...porId.values()];
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

// Columnas que necesita construirDatosEntrada, y ninguna más: el documento
// de identidad (y el resto de datos internos de la fila) no se leen nunca
// desde el portal.
export const COLUMNAS_ENTRADA: Record<Tabla, string> = {
  congreso: "id, nombre, tipo_acceso, empresa_entidad, categoria_patrocinio, edicion_id, qr_codigo, recibo_url, referencia_pago_online",
  gala: "id, nombre_asistente, menu, empresa_entidad, categoria_patrocinio, edicion_id, qr_codigo, recibo_url, referencia_pago_online",
  excursion: "id, nombre_asistente, tipo_entrada, empresa_entidad, categoria_patrocinio, edicion_id, qr_codigo, recibo_url, referencia_pago_online",
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
}

// Documentos de la edición activa que le corresponden a este email:
// "todos_asistentes" si tiene alguna entrada, "todos_patrocinadores" si es
// contacto de alguna empresa, los de "patrocinador" de SUS empresas y los de
// "asistente" dirigidos a su email.
export async function documentosVisibles(
  supabase: SupabaseClient,
  edicionId: string,
  email: string
): Promise<DocumentoPortal[]> {
  const [conEntradas, empresas] = await Promise.all([
    tieneEntradas(supabase, edicionId, email),
    empresasDelEmail(supabase, edicionId, email),
  ]);
  // Los documentos para una persona concreta (p. ej. su factura), por su
  // email. Va entre comillas dobles para que ningún carácter del email
  // cambie el sentido del filtro.
  const emailFiltro = `"${email.replace(/["\\]/g, (c) => `\\${c}`)}"`;
  const filtros: string[] = [`and(destino.eq.asistente,email_destinatario.eq.${emailFiltro})`];
  if (conEntradas) filtros.push("destino.eq.todos_asistentes");
  if (empresas.length > 0) {
    filtros.push("destino.eq.todos_patrocinadores");
    // Ids que vienen de la base de datos (uuid), no del navegador.
    filtros.push(`and(destino.eq.patrocinador,patrocinador_id.in.(${empresas.map((e) => e.id).join(",")}))`);
  }

  const { data, error } = await supabase
    .from("documentos")
    .select("id, titulo, descripcion, nombre_archivo, ruta_archivo")
    .eq("edicion_id", edicionId)
    .or(filtros.join(","))
    .order("creado", { ascending: false });
  if (error) throw new Error(`documentosVisibles: ${error.message}`);
  return data ?? [];
}
