import { NextResponse } from "next/server";
import { crearClienteServicio } from "@/lib/supabaseServidor";
import { sesionEmpresa } from "@/lib/portalEmpresa";
import { PONENCIA_POR_CATEGORIA } from "@/lib/datosEmpresa";
import {
  COLUMNAS_FICHA_PORTAL,
  edicionMaterial,
  medidasMostrador,
  precioOfrecido,
  type FichaPortal,
} from "@/lib/portalMateriales";

export const runtime = "nodejs";

// Texto de "Qué incluye tu patrocinio" de cada categoría (en Ediciones).
const CAMPO_INCLUYE: Record<string, "incluye_diamante" | "incluye_oro" | "incluye_plata"> = {
  "💎 DIAMANTE": "incluye_diamante",
  "⭐ ORO": "incluye_oro",
  "🥈 PLATA": "incluye_plata",
};

// Pestañas "Mi patrocinio", "Material" y documentos de la zona de empresa
// (/portal/empresa): la empresa de la sesión de empresa. No acepta parámetros.
export async function GET() {
  const sesion = await sesionEmpresa();
  if (!sesion) return NextResponse.json({ error: "Sesión no encontrada." }, { status: 401 });

  const supabase = crearClienteServicio();
  const edicion = await edicionMaterial(supabase);
  if (!edicion) return NextResponse.json({ empresas: [] });

  // Una sola empresa: la de la sesión. Se deja en lista por compatibilidad
  // con la pantalla (MaterialPatrocinador.tsx).
  const ids = [sesion.patrocinadorId];

  const [{ data: fichas, error }, { data: archivos, error: errorArchivos }] = await Promise.all([
    supabase.from("patrocinadores").select(COLUMNAS_FICHA_PORTAL).in("id", ids).eq("edicion_id", edicion.id),
    // Lo que ha subido la empresa y lo que el equipo ha marcado como visible.
    // Sin ruta_archivo: la descarga va siempre por /api/portal/materiales/descargar.
    supabase
      .from("patrocinador_archivos")
      .select("id, patrocinador_id, tipo, titulo, nombre_archivo, creado, origen, email_subida, comentario")
      .in("patrocinador_id", ids)
      .or("origen.eq.patrocinador,visible_empresa.eq.true")
      .order("creado", { ascending: false }),
  ]);
  if (error || errorArchivos) {
    console.error("portal/materiales:", error?.message ?? errorArchivos?.message);
    return NextResponse.json({ error: "No se pudo cargar el material." }, { status: 500 });
  }

  const precioRollup = precioOfrecido(edicion.precio_rollup);
  const precioVinilado = precioOfrecido(edicion.precio_vinilado);

  const empresas = ((fichas ?? []) as FichaPortal[]).map((f) => {
    const campoIncluye = f.categoria ? CAMPO_INCLUYE[f.categoria] : undefined;
    const tienePonencia = f.tiene_ponencia === "Sí";
    const tieneStand = f.tiene_stand === "Sí";
    const deEstaEmpresa = (archivos ?? []).filter((a) => a.patrocinador_id === f.id);
    return {
      id: f.id,
      empresa: f.empresa_entidad,
      categoria: f.categoria,
      // Diamante/Oro/Plata: el texto de la edición, y debajo lo particular de
      // su ficha. Institucional/Personalizado: lo de su ficha.
      incluye: campoIncluye ? edicion[campoIncluye] : f.beneficios_incluidos,
      particularesIncluidos: campoIncluye ? f.beneficios_incluidos : null,
      particularesExcluidos: f.beneficios_excluidos,
      estado: {
        logoRecibido: f.logo_recibido === "Sí",
        tienePonencia,
        ponenciaRecibida: f.ponencia_recibida === "Sí",
        fechaLimite: f.fecha_limite_materiales,
      },
      produccion: {
        precioRollup,
        precioVinilado: tieneStand ? precioVinilado : null,
        texto: edicion.texto_material_patrocinadores,
        // Solo las de su mostrador (Oro o Diamante), para «Rollups y vinilado».
        medidas: tieneStand ? medidasMostrador(edicion.texto_material_patrocinadores, f.categoria) : null,
        rollupsSolicitados: f.rollups_solicitados ?? 0,
        rollupPorNuestraCuenta: f.rollup_por_nuestra_cuenta === "Sí",
        vinilado: f.vinilado_por_nuestra_cuenta === "Sí",
      },
      // Diamante y Oro deciden ellos si hacen ponencia (y la rellenan); en las
      // demás categorías solo se rellena si la organización ha puesto Sí.
      ponencia: {
        decideEmpresa: Boolean(f.categoria && PONENCIA_POR_CATEGORIA[f.categoria]),
        respuesta: f.tiene_ponencia === "Sí" || f.tiene_ponencia === "No" ? f.tiene_ponencia : null,
        maxMinutos: f.categoria ? PONENCIA_POR_CATEGORIA[f.categoria]?.maxMinutos ?? null : null,
        explicacion: f.categoria ? PONENCIA_POR_CATEGORIA[f.categoria]?.explicacion ?? null : null,
        // Diamante/Oro: duración fija de la categoría (texto para la pantalla).
        duracionFija: f.categoria ? PONENCIA_POR_CATEGORIA[f.categoria]?.duracion ?? null : null,
      },
      ponente:
        tienePonencia || (f.categoria && PONENCIA_POR_CATEGORIA[f.categoria])
          ? {
              ponente_nombre: f.ponente_nombre,
              ponente_cargo: f.ponente_cargo,
              ponente_email: f.ponente_email,
              ponente_telefono: f.ponente_telefono,
              ponencia_titulo: f.ponencia_titulo,
              ponencia_duracion_min: f.ponencia_duracion_min,
            }
          : null,
      subidos: deEstaEmpresa
        .filter((a) => a.origen === "patrocinador")
        .map((a) => ({
          id: a.id,
          tipo: a.tipo,
          nombre: a.nombre_archivo,
          creado: a.creado,
          email: a.email_subida,
          comentario: a.comentario,
        })),
      organizacion: deEstaEmpresa
        .filter((a) => a.origen === "equipo")
        .map((a) => ({ id: a.id, tipo: a.tipo, titulo: a.titulo, nombre: a.nombre_archivo, creado: a.creado })),
    };
  });

  return NextResponse.json({ empresas }, { headers: { "Cache-Control": "no-store" } });
}
