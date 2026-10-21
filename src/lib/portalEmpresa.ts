// Zona de empresa del portal: acceso con usuario y contraseña de la empresa
// (ver 030_acceso_patrocinadores.sql). Independiente de la sesión de
// asistente (src/lib/portal.ts, enlace por email): otra cookie, otra tabla.
// NO usa Supabase Auth. La empresa la decide SIEMPRE la sesión, nunca un id
// que mande el navegador. La contraseña en claro no se guarda ni se registra
// en ningún sitio: solo su hash (scrypt con sal) en patrocinador_accesos.
import { randomBytes, randomInt, scrypt as scryptCb, timingSafeEqual, type ScryptOptions } from "crypto";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { crearClienteServicio } from "@/lib/supabaseServidor";
import { generarToken, hashToken } from "@/lib/portal";

export const COOKIE_EMPRESA = "balvert_empresa";
export const DURACION_SESION_EMPRESA_MS = 7 * 24 * 60 * 60 * 1000;
// «Ver como la empresa» desde el panel: sesión corta.
export const DURACION_SESION_ORGANIZACION_MS = 2 * 60 * 60 * 1000;
export const MIN_CONTRASENA = 10;
export const MAX_CONTRASENA = 200;

// ---- Hash de contraseñas (scrypt de Node, lento y con sal) ----

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const LONGITUD_CLAVE = 64;

function scrypt(contrasena: string, sal: Buffer, opciones: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scryptCb(contrasena.normalize("NFC"), sal, LONGITUD_CLAVE, opciones, (err, clave) => (err ? reject(err) : resolve(clave)))
  );
}

export async function hashContrasena(contrasena: string): Promise<string> {
  const sal = randomBytes(16);
  const clave = await scrypt(contrasena, sal, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P });
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${sal.toString("base64")}$${clave.toString("base64")}`;
}

// Hash con el que se compara cuando el usuario no existe: así tarda lo mismo
// que con un usuario real y el tiempo de respuesta no delata nada.
let hashDeRelleno: Promise<string> | null = null;

export async function comprobarContrasena(contrasena: string, hash: string | null): Promise<boolean> {
  hashDeRelleno ??= hashContrasena(randomBytes(12).toString("hex"));
  const guardado = hash ?? (await hashDeRelleno);
  const partes = guardado.split("$");
  if (partes.length !== 6 || partes[0] !== "scrypt") return false;
  const [, n, r, p, salB64, claveB64] = partes;
  const esperada = Buffer.from(claveB64, "base64");
  const calculada = await scrypt(contrasena, Buffer.from(salB64, "base64"), { N: Number(n), r: Number(r), p: Number(p) });
  const iguales = esperada.length === calculada.length && timingSafeEqual(esperada, calculada);
  return iguales && hash !== null;
}

// ---- Usuario y contraseña generados ----

// Palabras cortas y fáciles de dictar, sin tildes ni eñes.
const PALABRAS = (
  "agua alba alto ancla arco arena aroma astro aula avena azul bahia balsa bambu banco barco barro bosque brisa " +
  "buho cable cacao calma campo canal cardo carta casco cebra cedro cielo cima cisne clave cobre cofre colina coral " +
  "corcho cosmos costa cubo cuarzo delta dique duna eco eje enebro faro fibra flor foca fresa fruta gaita galeon " +
  "gamba girasol globo gota grano grillo guinda haba halcon hiedra hielo higo hoja horno huerto iris isla jade " +
  "jarra jazmin junco kiwi lago lana laurel lava lazo lente lima lince lirio llama lobo loma luna lupa madera " +
  "malva mango manta mapa marea mazo menta mesa miel mimbre mirlo molino monte mora musgo nardo nave nido niebla " +
  "nogal nube nuez ola olivo onda oro oso pala palma panal papel pardo pera perla piedra pino pista plata playa " +
  "pluma polen poza prado puente pulpo quilla radar rama rana rayo red remo rio roble roca rosa rubi ruta sabana " +
  "salvia sauce senda seta silla sol sonda surco tabla tallo teja telar tigre tinta tomillo torre trigo trueno " +
  "tulipan turquesa uva valle vela verde vereda viento vino violeta yate yedra yunque zafiro zarza zorro"
).split(" ");

const capitalizar = (p: string) => p[0].toUpperCase() + p.slice(1);

// 4 palabras + 2 números, p. ej. "Faro-Nube-Trigo-Cedro-47" (unos 38 bits, y
// con el bloqueo tras varios fallos no se puede adivinar probando).
export function generarContrasena(): string {
  const palabras = Array.from({ length: 4 }, () => capitalizar(PALABRAS[randomInt(PALABRAS.length)]));
  return `${palabras.join("-")}-${String(randomInt(10, 100))}`;
}

// A partir del nombre de la empresa: minúsculas, sin tildes, solo letras y
// números. Si ya existe, con sufijo (rollgum, rollgum2…).
export async function generarUsuario(supabase: SupabaseClient, empresa: string | null): Promise<string> {
  let base = (empresa ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 30);
  if (base.length < 3) base = `patrocinador${base}`;
  const { data } = await supabase.from("patrocinador_accesos").select("usuario").like("usuario", `${base}%`);
  const usados = new Set((data ?? []).map((f) => f.usuario as string));
  if (!usados.has(base)) return base;
  for (let i = 2; ; i++) if (!usados.has(`${base}${i}`)) return `${base}${i}`;
}

export function normalizarUsuario(valor: unknown): string {
  return typeof valor === "string" ? valor.trim().toLowerCase().slice(0, 60) : "";
}

// ---- Intentos fallidos ----

export const VENTANA_FALLOS_MS = 15 * 60 * 1000;
export const MAX_FALLOS_USUARIO = 5;
export const MAX_FALLOS_IP = 20;
export const MENSAJE_BLOQUEO =
  "Demasiados intentos fallidos. Espera 15 minutos y vuelve a intentarlo, o escribe a secretaria@balvert.es.";

export function ipDe(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "desconocida";
}

async function fallosRecientes(supabase: SupabaseClient, clave: string) {
  const desde = new Date(Date.now() - VENTANA_FALLOS_MS).toISOString();
  const { count, error } = await supabase
    .from("patrocinador_login_fallos")
    .select("id", { count: "exact", head: true })
    .eq("clave", clave)
    .gte("creado", desde);
  // Si no se puede contar, mejor no dejar pasar.
  return error ? Number.POSITIVE_INFINITY : count ?? 0;
}

export async function estaBloqueado(supabase: SupabaseClient, usuario: string, ip: string) {
  const [porUsuario, porIp] = await Promise.all([
    fallosRecientes(supabase, `usuario:${usuario}`),
    fallosRecientes(supabase, `ip:${ip}`),
  ]);
  return porUsuario >= MAX_FALLOS_USUARIO || porIp >= MAX_FALLOS_IP;
}

export async function registrarFallo(supabase: SupabaseClient, usuario: string, ip: string) {
  // Limpieza oportunista: lo de hace más de un día ya no cuenta.
  await supabase
    .from("patrocinador_login_fallos")
    .delete()
    .lt("creado", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
  await supabase.from("patrocinador_login_fallos").insert([{ clave: `usuario:${usuario}` }, { clave: `ip:${ip}` }]);
}

// ---- Sesión ----

// organizador: «Ver como la empresa» desde el panel (nombre de quien la abre).
// Esa sesión dura 2 horas, no cuenta como acceso de la empresa y sus cambios
// van a nombre de esa persona (ver autorEmpresa).
export async function crearSesionEmpresa(supabase: SupabaseClient, patrocinadorId: string, organizador?: string) {
  const token = generarToken();
  const expira = new Date(Date.now() + (organizador ? DURACION_SESION_ORGANIZACION_MS : DURACION_SESION_EMPRESA_MS));
  const { error } = await supabase.from("patrocinador_sesiones").insert({
    patrocinador_id: patrocinadorId,
    token_hash: hashToken(token),
    expira_en: expira.toISOString(),
    modo_organizacion: Boolean(organizador),
    organizador: organizador ?? null,
  });
  if (error) throw new Error(error.message);
  (await cookies()).set(COOKIE_EMPRESA, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    expires: expira,
  });
}

export interface SesionEmpresa {
  sesionId: string;
  patrocinadorId: string;
  usuario: string;
  // «Ver como la empresa» desde el panel.
  modoOrganizacion: boolean;
  organizador: string | null;
}

// Lee la cookie y la valida contra patrocinador_sesiones (y que la empresa
// siga teniendo acceso). null si no hay sesión o ha caducado.
export async function sesionEmpresa(): Promise<SesionEmpresa | null> {
  const token = (await cookies()).get(COOKIE_EMPRESA)?.value;
  if (!token || token.length > 200) return null;
  const supabase = crearClienteServicio();
  const { data } = await supabase
    .from("patrocinador_sesiones")
    .select("id, patrocinador_id, expira_en, modo_organizacion, organizador")
    .eq("token_hash", hashToken(token))
    .maybeSingle();
  if (!data || new Date(data.expira_en).getTime() <= Date.now()) return null;
  const { data: acceso } = await supabase
    .from("patrocinador_accesos")
    .select("usuario")
    .eq("patrocinador_id", data.patrocinador_id)
    .maybeSingle();
  // La organización puede ver la zona aunque la empresa aún no tenga acceso.
  if (!acceso && !data.modo_organizacion) return null;
  return {
    sesionId: data.id,
    patrocinadorId: data.patrocinador_id,
    usuario: acceso?.usuario ?? "(sin acceso)",
    modoOrganizacion: Boolean(data.modo_organizacion),
    organizador: data.organizador ?? null,
  };
}

// Autor en el historial y en los avisos a secretaría. Desde «Ver como la
// empresa», a nombre de quien lo hace en la organización.
export function autorEmpresa(sesion: SesionEmpresa) {
  return sesion.modoOrganizacion ? `Organización: ${sesion.organizador ?? "panel"}` : `Portal: ${sesion.usuario}`;
}

// Clave para los límites por hora de portal_acciones (columna "email"). La
// organización no gasta el límite de la empresa.
export function claveAcciones(sesion: SesionEmpresa) {
  return sesion.modoOrganizacion ? `organizacion:${sesion.organizador ?? "panel"}` : `empresa:${sesion.usuario}`;
}

// Los cambios hechos por la organización («Ver como la empresa») no avisan a
// secretaría ni le crean tareas: los ha hecho ella misma.
export function avisaASecretaria(sesion: SesionEmpresa) {
  return !sesion.modoOrganizacion;
}

// ---- Crear acceso / contraseña nueva (desde el panel) ----

// Crea el acceso de la empresa (si no lo tiene) o le pone una contraseña
// nueva (y cierra todas sus sesiones). Devuelve la contraseña en claro UNA
// sola vez, para enseñársela a quien la ha pedido.
export async function crearOCambiarAcceso(
  supabase: SupabaseClient,
  patrocinadorId: string,
  modo: "crear" | "nueva"
): Promise<{ usuario: string; contrasena: string }> {
  const { data: ficha } = await supabase
    .from("patrocinadores")
    .select("id, empresa_entidad")
    .eq("id", patrocinadorId)
    .maybeSingle();
  if (!ficha) throw new ErrorAcceso("No se encontró el patrocinador.", 404);
  const { data: existente } = await supabase
    .from("patrocinador_accesos")
    .select("id, usuario")
    .eq("patrocinador_id", patrocinadorId)
    .maybeSingle();

  const contrasena = generarContrasena();
  const hash = await hashContrasena(contrasena);

  if (modo === "crear") {
    if (existente) throw new ErrorAcceso("Esta empresa ya tiene acceso. Usa «Generar contraseña nueva».");
    // Dos intentos por si otro alta se lleva el mismo usuario a la vez.
    for (let intento = 0; intento < 2; intento++) {
      const usuario = await generarUsuario(supabase, ficha.empresa_entidad);
      const { error } = await supabase
        .from("patrocinador_accesos")
        .insert({ patrocinador_id: patrocinadorId, usuario, hash_contrasena: hash });
      if (!error) return { usuario, contrasena };
      if (error.code !== "23505") throw new Error("No se pudo crear el acceso: " + error.message);
    }
    throw new Error("No se pudo crear el acceso. Inténtalo de nuevo.");
  }

  if (!existente) throw new ErrorAcceso("Esta empresa todavía no tiene acceso. Usa «Crear acceso».");
  const { error } = await supabase
    .from("patrocinador_accesos")
    .update({ hash_contrasena: hash, actualizado: new Date().toISOString() })
    .eq("id", existente.id);
  if (error) throw new Error("No se pudo cambiar la contraseña: " + error.message);
  await supabase.from("patrocinador_sesiones").delete().eq("patrocinador_id", patrocinadorId);
  return { usuario: existente.usuario, contrasena };
}

export class ErrorAcceso extends Error {
  constructor(mensaje: string, public estado = 400) {
    super(mensaje);
  }
}
