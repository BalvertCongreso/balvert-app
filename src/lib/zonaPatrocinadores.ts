// Pantalla «Zona de patrocinadores» del panel: el estado de cada empresa de
// un vistazo y lo que han cambiado desde su zona. Solo servidor (clave de
// servicio: lee patrocinador_accesos y patrocinador_archivos, que no tienen
// políticas). La ruta comprueba antes el login interno.
import type { SupabaseClient } from "@supabase/supabase-js";
import { PONENCIA_POR_CATEGORIA } from "@/lib/datosEmpresa";
import { TIPO_ACCESO_INVITADO } from "@/lib/invitados";

export const DIAS_CAMBIOS_RECIENTES = 7;

export interface EstadoPatrocinador {
  id: string;
  empresa: string | null;
  categoria: string | null;
  acceso: { usuario: string; ultimoAcceso: string | null } | null;
  logoRecibido: boolean;
  // null: no tiene ponencia (o no la ha decidido una categoría sin ponencia).
  ponencia: "recibida" | "pendiente" | "sin_responder" | null;
  ponenteCompleto: boolean | null;
  rollups: number;
  vinilado: boolean;
  invitados: { asignados: number; incluidos: number };
  documentos: number;
  materialNuevo: number;
  cambiosRecientes: number;
  pendientes: string[];
}

export interface CambioReciente {
  fecha: string;
  autor: string;
  tabla: string;
  accion: string;
  campos: string[];
}

const COLUMNAS =
  "id, empresa_entidad, categoria, num_invitaciones_incluidas, logo_recibido, tiene_ponencia, ponencia_recibida, ponente_nombre, ponente_cargo, ponente_email, ponente_telefono, ponencia_titulo, ponencia_duracion_min, rollups_solicitados, vinilado_por_nuestra_cuenta";

const NOMBRE_TABLA: Record<string, string> = {
  patrocinadores: "Ficha",
  asistentes_congreso: "Congreso",
  gala: "Cena de gala",
  excursion: "Excursión",
};

// Cambios hechos desde el portal ("Portal: …") en los últimos días, por
// empresa: en su ficha y en las filas de sus invitados.
export async function cambiosRecientes(
  supabase: SupabaseClient,
  patrocinadorIds: string[],
  filasPorEmpresa: Map<string, string>
): Promise<Map<string, CambioReciente[]>> {
  const desde = new Date(Date.now() - DIAS_CAMBIOS_RECIENTES * 24 * 60 * 60 * 1000).toISOString();
  const { data } = await supabase
    .from("historial_cambios")
    .select("fecha, autor, tabla, accion, registro_id, cambios")
    .like("autor", "Portal:%")
    .gte("fecha", desde)
    .order("fecha", { ascending: false })
    .limit(2000);
  const ids = new Set(patrocinadorIds);
  const porEmpresa = new Map<string, CambioReciente[]>();
  for (const h of data ?? []) {
    const cambios = (h.cambios ?? {}) as Record<string, { antes?: unknown; despues?: unknown }>;
    const empresaFila = [cambios.empresa_entidad?.despues, cambios.empresa_entidad?.antes].find(
      (v): v is string => typeof v === "string" && ids.has(v)
    );
    const empresa = ids.has(h.registro_id) ? h.registro_id : empresaFila ?? filasPorEmpresa.get(h.registro_id);
    if (!empresa) continue;
    const lista = porEmpresa.get(empresa) ?? [];
    lista.push({
      fecha: h.fecha,
      autor: h.autor,
      tabla: NOMBRE_TABLA[h.tabla] ?? h.tabla,
      accion: h.accion,
      campos: Object.keys(cambios),
    });
    porEmpresa.set(empresa, lista);
  }
  return porEmpresa;
}

export async function estadoPatrocinadores(
  supabase: SupabaseClient,
  edicionId: string,
  soloId?: string
): Promise<{ estados: EstadoPatrocinador[]; cambios: Map<string, CambioReciente[]> }> {
  let consulta = supabase.from("patrocinadores").select(COLUMNAS).eq("edicion_id", edicionId);
  if (soloId) consulta = consulta.eq("id", soloId);
  const { data: fichas, error } = await consulta.order("empresa_entidad", { ascending: true });
  if (error) throw new Error(error.message);
  const ids = (fichas ?? []).map((f) => f.id as string);
  if (ids.length === 0) return { estados: [], cambios: new Map() };

  const [accesos, archivos, congreso, gala, excursion] = await Promise.all([
    supabase.from("patrocinador_accesos").select("patrocinador_id, usuario, ultimo_acceso").in("patrocinador_id", ids),
    supabase.from("patrocinador_archivos").select("patrocinador_id, origen, revisado_en").in("patrocinador_id", ids),
    supabase.from("asistentes_congreso").select("id, empresa_entidad, tipo_acceso").in("empresa_entidad", ids),
    supabase.from("gala").select("id, empresa_entidad, tipo_entrada").in("empresa_entidad", ids),
    supabase.from("excursion").select("id, empresa_entidad, tipo_entrada").in("empresa_entidad", ids),
  ]);

  const filasPorEmpresa = new Map<string, string>();
  for (const f of [...(congreso.data ?? []), ...(gala.data ?? []), ...(excursion.data ?? [])]) {
    filasPorEmpresa.set(f.id as string, f.empresa_entidad as string);
  }
  const cambios = await cambiosRecientes(supabase, ids, filasPorEmpresa);

  const estados = (fichas ?? []).map((f): EstadoPatrocinador => {
    const acceso = (accesos.data ?? []).find((a) => a.patrocinador_id === f.id);
    const suyos = (archivos.data ?? []).filter((a) => a.patrocinador_id === f.id);
    const asignados = (congreso.data ?? []).filter((c) => c.empresa_entidad === f.id && c.tipo_acceso === TIPO_ACCESO_INVITADO).length;
    const decideEmpresa = Boolean(f.categoria && PONENCIA_POR_CATEGORIA[f.categoria as string]);
    const ponencia =
      f.tiene_ponencia === "Sí"
        ? f.ponencia_recibida === "Sí"
          ? "recibida"
          : "pendiente"
        : decideEmpresa && !f.tiene_ponencia
        ? "sin_responder"
        : null;
    const ponenteCompleto =
      f.tiene_ponencia === "Sí"
        ? Boolean(
            f.ponente_nombre && f.ponente_cargo && f.ponente_email && f.ponente_telefono && f.ponencia_titulo && f.ponencia_duracion_min
          )
        : null;
    const materialNuevo = suyos.filter((a) => a.origen === "patrocinador" && !a.revisado_en).length;

    const pendientes: string[] = [];
    if (!acceso) pendientes.push("Sin acceso creado");
    if (f.logo_recibido !== "Sí") pendientes.push("Logo pendiente");
    if (ponencia === "sin_responder") pendientes.push("No ha respondido si hace ponencia");
    if (ponencia === "pendiente") pendientes.push("Presentación de la ponencia pendiente");
    if (ponenteCompleto === false) pendientes.push("Faltan datos del ponente");
    if (materialNuevo > 0) pendientes.push("Material nuevo sin revisar");

    return {
      id: f.id,
      empresa: f.empresa_entidad,
      categoria: f.categoria,
      acceso: acceso ? { usuario: acceso.usuario, ultimoAcceso: acceso.ultimo_acceso } : null,
      logoRecibido: f.logo_recibido === "Sí",
      ponencia,
      ponenteCompleto,
      rollups: f.rollups_solicitados ?? 0,
      vinilado: f.vinilado_por_nuestra_cuenta === "Sí",
      invitados: { asignados, incluidos: f.num_invitaciones_incluidas ?? 0 },
      documentos: suyos.length,
      materialNuevo,
      cambiosRecientes: cambios.get(f.id)?.length ?? 0,
      pendientes,
    };
  });
  return { estados, cambios };
}
