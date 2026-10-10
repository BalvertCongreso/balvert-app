// Material de los patrocinadores desde el portal (/api/portal/materiales/*):
// subir logos, ponencias, rollups y vinilados, pedir que les fabriquemos
// rollups/vinilado y rellenar los datos del ponente. Mismas reglas que el
// resto del portal (ver src/lib/portal.ts): la empresa se comprueba SIEMPRE
// con empresasDelEmail y el email de la sesión; el id que manda el navegador
// solo sirve para elegir entre SUS empresas.
import { Resend } from "resend";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ORIGEN_PUBLICO } from "@/lib/dominio";
import { empresasDelEmail, idEdicionActiva } from "@/lib/portal";

// Columnas de la ficha que el portal lee (y ninguna más: nada de
// facturación, contactos ni observaciones internas).
export const COLUMNAS_FICHA_PORTAL =
  "id, empresa_entidad, categoria, tiene_stand, tiene_ponencia, ponente_nombre, ponente_cargo, ponencia_titulo, ponencia_duracion_min, rollups_solicitados, rollup_por_nuestra_cuenta, vinilado_por_nuestra_cuenta, beneficios_incluidos, beneficios_excluidos, logo_recibido, ponencia_recibida, fecha_limite_materiales";

export interface FichaPortal {
  id: string;
  empresa_entidad: string | null;
  categoria: string | null;
  tiene_stand: string | null;
  tiene_ponencia: string | null;
  ponente_nombre: string | null;
  ponente_cargo: string | null;
  ponencia_titulo: string | null;
  ponencia_duracion_min: number | null;
  rollups_solicitados: number | null;
  rollup_por_nuestra_cuenta: string | null;
  vinilado_por_nuestra_cuenta: string | null;
  beneficios_incluidos: string | null;
  beneficios_excluidos: string | null;
  logo_recibido: string | null;
  ponencia_recibida: string | null;
  fecha_limite_materiales: string | null;
}

export const COLUMNAS_EDICION_MATERIAL =
  "id, precio_rollup, precio_vinilado, texto_material_patrocinadores, incluye_diamante, incluye_oro, incluye_plata";

export interface EdicionMaterial {
  id: string;
  precio_rollup: number | null;
  precio_vinilado: number | null;
  texto_material_patrocinadores: string | null;
  incluye_diamante: string | null;
  incluye_oro: string | null;
  incluye_plata: string | null;
}

// Un precio vacío o 0 = esa opción no se ofrece.
export function precioOfrecido(precio: unknown): number | null {
  const n = typeof precio === "string" ? Number(precio) : precio;
  return typeof n === "number" && Number.isFinite(n) && n > 0 ? n : null;
}

export const MAX_ROLLUPS = 99;

export async function edicionMaterial(supabase: SupabaseClient): Promise<EdicionMaterial | null> {
  const edicionId = await idEdicionActiva(supabase);
  if (!edicionId) return null;
  const { data } = await supabase.from("ediciones").select(COLUMNAS_EDICION_MATERIAL).eq("id", edicionId).maybeSingle();
  return (data as EdicionMaterial | null) ?? null;
}

// La ficha de una de las empresas de este email en la edición activa, o null
// si ese id no es de una de sus empresas (no se distingue "no existe" de "no
// es tuya").
export async function fichaDeMiEmpresa(
  supabase: SupabaseClient,
  edicionId: string,
  email: string,
  patrocinadorId: unknown
): Promise<FichaPortal | null> {
  if (typeof patrocinadorId !== "string" || !patrocinadorId) return null;
  const empresas = await empresasDelEmail(supabase, edicionId, email);
  if (!empresas.some((e) => e.id === patrocinadorId)) return null;
  const { data } = await supabase
    .from("patrocinadores")
    .select(COLUMNAS_FICHA_PORTAL)
    .eq("id", patrocinadorId)
    .eq("edicion_id", edicionId)
    .maybeSingle();
  return (data as FichaPortal | null) ?? null;
}

export function autorPortal(email: string) {
  return `Portal: ${email}`;
}

// ---- Límites por persona y hora (anti-abuso) ----

export const LIMITE_SUBIDAS_POR_HORA = 20;
export const LIMITE_CAMBIOS_POR_HORA = 30;

export async function accionesUltimaHora(supabase: SupabaseClient, email: string, acciones: string[]) {
  const haceUnaHora = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count, error } = await supabase
    .from("portal_acciones")
    .select("id", { count: "exact", head: true })
    .eq("email", email)
    .in("accion", acciones)
    .gte("creado", haceUnaHora);
  // Si no se puede contar, mejor no dejar pasar.
  return error ? Number.POSITIVE_INFINITY : count ?? 0;
}

export async function registrarAccion(supabase: SupabaseClient, email: string, accion: string, detalle?: string) {
  // Limpieza oportunista: lo de hace más de un día ya no cuenta para nada.
  const haceUnDia = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  await supabase.from("portal_acciones").delete().lt("creado", haceUnDia);
  const { error } = await supabase.from("portal_acciones").insert({ email, accion, detalle: detalle ?? null });
  if (error) throw new Error(error.message);
}

export const MENSAJE_LIMITE =
  "Has hecho muchos cambios en poco tiempo. Espera un rato o escribe a secretaria@balvert.es.";

// ---- Aviso a la secretaría: tarea + email ----

function escaparHtml(texto: string) {
  return texto.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function nombreEmpresa(ficha: { empresa_entidad: string | null }) {
  return ficha.empresa_entidad?.trim() || "Empresa sin nombre";
}

// Crea la tarea para Ariadna. Lanza si falla (sin tarea nadie se enteraría).
export async function crearTareaRevision(
  supabase: SupabaseClient,
  edicionId: string,
  patrocinadorId: string,
  titulo: string,
  notas: string
) {
  const { error } = await supabase.from("tareas").insert({
    edicion_id: edicionId,
    responsable: "🟣 Ariadna",
    tarea: titulo,
    entidad_relacionada: patrocinadorId,
    fase: "General",
    prioridad: "🟡 Media",
    estado: "⏳ Pendiente",
    notas,
  });
  if (error) throw new Error(error.message);
}

// Email a secretaria@balvert.es con enlace a la ficha interna. Nunca lleva el
// archivo. Si falla solo se registra en el log: la tarea ya está creada.
export async function avisarSecretaria(asunto: string, lineas: string[], patrocinadorId: string) {
  if (!process.env.RESEND_API_KEY) {
    console.error("portal/materiales: falta RESEND_API_KEY, no se envía el aviso");
    return;
  }
  const enlace = `${ORIGEN_PUBLICO}/patrocinadores/${encodeURIComponent(patrocinadorId)}`;
  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { error } = await resend.emails.send({
      from: "BALVERT 2027 <secretaria@balvert.es>",
      to: "secretaria@balvert.es",
      subject: asunto,
      html: `
  <div style="font-family: -apple-system, Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; color: #1f2937;">
    <h1 style="color: #8B6914; font-size: 20px; margin-bottom: 4px;">BALVERT 2027</h1>
    <p style="color: #5BB8E8; font-weight: 600; margin-top: 0;">Área de clientes — material de patrocinadores</p>
    <p><strong>${escaparHtml(asunto)}</strong></p>
    <p style="white-space: pre-line;">${escaparHtml(lineas.join("\n"))}</p>
    <p style="font-size: 13px; color: #6b7280;">Tienes una tarea en Tareas para revisarlo.</p>
    <div style="text-align: center; margin: 28px 0;">
      <a href="${enlace}" style="background: #2f7ea8; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; display: inline-block;">Abrir la ficha</a>
    </div>
  </div>`,
    });
    if (error) console.error("portal/materiales: fallo enviando el aviso", error.message);
  } catch (e) {
    console.error("portal/materiales: fallo enviando el aviso", e instanceof Error ? e.message : e);
  }
}

export const euros = (n: number) =>
  n.toLocaleString("es-ES", { style: "currency", currency: "EUR", minimumFractionDigits: 0, maximumFractionDigits: 2 });
