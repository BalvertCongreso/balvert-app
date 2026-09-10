import type { SupabaseClient } from "@supabase/supabase-js";
import type { DatosEntrada } from "@/lib/entradaImagen";

export type Tabla = "congreso" | "gala" | "excursion";

export const NOMBRE_TABLA_SQL: Record<Tabla, string> = {
  congreso: "asistentes_congreso",
  gala: "gala",
  excursion: "excursion",
};

export const NOMBRE_EVENTO: Record<Tabla, "Congreso" | "Gala" | "Excursión"> = {
  congreso: "Congreso",
  gala: "Gala",
  excursion: "Excursión",
};

const CAMPO_LUGAR: Record<Tabla, string> = {
  congreso: "lugar_congreso",
  gala: "lugar_gala",
  excursion: "lugar_excursion",
};

const CAMPO_FECHA_HORA: Record<Tabla, string> = {
  congreso: "fecha_hora_congreso",
  gala: "fecha_hora_gala",
  excursion: "fecha_hora_excursion",
};

export const POR_CONFIRMAR = "Por confirmar";

export function formatearFechaHora(valor: string | null): string {
  if (!valor) return POR_CONFIRMAR;
  try {
    return new Date(valor).toLocaleString("es-ES", {
      dateStyle: "long",
      timeStyle: "short",
    });
  } catch {
    return POR_CONFIRMAR;
  }
}

// Cada tabla guarda el nombre y el email del asistente en columnas distintas
// (herencia del Excel original: asistentes_congreso usa "nombre"/"email",
// gala y excursion usan "nombre_asistente"/"email_asistente").
export function extraerNombreYEmail(tabla: Tabla, fila: Record<string, unknown>) {
  if (tabla === "congreso") {
    return { nombre: fila.nombre as string | null, email: fila.email as string | null };
  }
  return {
    nombre: fila.nombre_asistente as string | null,
    email: fila.email_asistente as string | null,
  };
}

function extraerDetalle(tabla: Tabla, fila: Record<string, unknown>) {
  if (tabla === "gala") {
    return { detalleLabel: "Menú", detalleValor: (fila.menu as string | null) ?? null };
  }
  if (tabla === "congreso") {
    return {
      detalleLabel: "Tipo de acceso",
      detalleValor: (fila.tipo_acceso as string | null) ?? null,
    };
  }
  return {
    detalleLabel: "Tipo de acceso",
    detalleValor: (fila.tipo_entrada as string | null) ?? null,
  };
}

export async function construirDatosEntrada(
  supabase: SupabaseClient,
  tabla: Tabla,
  fila: Record<string, unknown>
): Promise<DatosEntrada> {
  const { nombre } = extraerNombreYEmail(tabla, fila);
  const { detalleLabel, detalleValor } = extraerDetalle(tabla, fila);

  let empresa: string | null = null;
  if (fila.empresa_entidad) {
    const { data: patrocinador } = await supabase
      .from("patrocinadores")
      .select("empresa_entidad")
      .eq("id", fila.empresa_entidad as string)
      .maybeSingle();
    empresa = patrocinador?.empresa_entidad ?? null;
  }

  let edicionNombre: string | null = null;
  let lugar = POR_CONFIRMAR;
  let fechaHora = POR_CONFIRMAR;
  if (fila.edicion_id) {
    const { data: edicion } = await supabase
      .from("ediciones")
      .select("*")
      .eq("id", fila.edicion_id as string)
      .maybeSingle();
    if (edicion) {
      edicionNombre = edicion.nombre ?? null;
      lugar = (edicion[CAMPO_LUGAR[tabla]] as string | null) || POR_CONFIRMAR;
      fechaHora = formatearFechaHora((edicion[CAMPO_FECHA_HORA[tabla]] as string | null) ?? null);
    }
  }

  return {
    qrPayload: `${tabla}:${fila.qr_codigo as string}`,
    nombreAsistente: nombre,
    evento: NOMBRE_EVENTO[tabla],
    edicionNombre,
    empresa,
    categoriaPatrocinio: (fila.categoria_patrocinio as string | null) ?? null,
    detalleLabel,
    detalleValor,
    lugar,
    fechaHora,
  };
}
