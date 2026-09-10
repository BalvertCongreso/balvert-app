import type { SupabaseClient } from "@supabase/supabase-js";
import { NOMBRE_TABLA_SQL, NOMBRE_EVENTO, construirDatosEntrada, type Tabla } from "@/lib/entradaDatos";

export interface ResultadoCheckin {
  ok: boolean;
  error?: string;
  tabla?: Tabla;
  evento?: string;
  nombre?: string | null;
  empresa?: string | null;
  categoriaPatrocinio?: string | null;
  detalleLabel?: string | null;
  detalleValor?: string | null;
  yaEstaba?: boolean;
  checkInFechaAnterior?: string | null;
}

// El QR lleva "tabla:codigo" (ej. "gala:3f9c2e1b-..."), así el check-in sabe
// en qué tabla buscar sin tener que probar las tres (ver Fase 2B en el brief).
export function parsearQrPayload(payload: string): { tabla: Tabla; codigo: string } | null {
  const idx = payload.indexOf(":");
  if (idx === -1) return null;
  const tabla = payload.slice(0, idx) as Tabla;
  const codigo = payload.slice(idx + 1).trim();
  if (!NOMBRE_TABLA_SQL[tabla] || !codigo) return null;
  return { tabla, codigo };
}

export async function registrarCheckin(
  supabase: SupabaseClient,
  tabla: Tabla,
  filtro: { id: string } | { qr_codigo: string }
): Promise<ResultadoCheckin> {
  const tablaSql = NOMBRE_TABLA_SQL[tabla];
  const columna = "id" in filtro ? "id" : "qr_codigo";
  const valor = "id" in filtro ? filtro.id : filtro.qr_codigo;

  const { data: fila, error: errorLectura } = await supabase
    .from(tablaSql)
    .select("*")
    .eq(columna, valor)
    .maybeSingle();

  if (errorLectura || !fila) {
    return { ok: false, error: "No se encontró ninguna entrada con ese código." };
  }

  const yaEstaba = fila.check_in_hecho === "Sí";
  const checkInFechaAnterior = (fila.check_in_fecha as string | null) ?? null;

  if (!yaEstaba) {
    const { error: errorGuardado } = await supabase
      .from(tablaSql)
      .update({ check_in_hecho: "Sí", check_in_fecha: new Date().toISOString() })
      .eq("id", fila.id);
    if (errorGuardado) {
      return { ok: false, error: "No se pudo registrar el check-in." };
    }
  }

  const datos = await construirDatosEntrada(supabase, tabla, fila);

  return {
    ok: true,
    tabla,
    evento: NOMBRE_EVENTO[tabla],
    nombre: datos.nombreAsistente,
    empresa: datos.empresa,
    categoriaPatrocinio: datos.categoriaPatrocinio,
    detalleLabel: datos.detalleLabel,
    detalleValor: datos.detalleValor,
    yaEstaba,
    checkInFechaAnterior,
  };
}
