import { supabase } from "@/lib/supabaseClient";

// Tablas que apuntan a una edición (edicion_id). La base de datos impide
// borrar una edición mientras alguna de estas tenga filas suyas (error de
// clave foránea 23503); aquí solo se traduce ese error a algo legible.
const TABLAS_CON_EDICION: { tabla: string; etiqueta: string }[] = [
  { tabla: "patrocinadores", etiqueta: "patrocinadores" },
  { tabla: "proveedores", etiqueta: "proveedores" },
  { tabla: "asistentes_congreso", etiqueta: "inscripciones al congreso" },
  { tabla: "gala", etiqueta: "inscripciones a la gala" },
  { tabla: "excursion", etiqueta: "inscripciones a la excursión" },
  { tabla: "tareas", etiqueta: "tareas" },
  { tabla: "prospectos_patrocinio", etiqueta: "prospectos de captación" },
  { tabla: "documentos", etiqueta: "documentos" },
  { tabla: "compras_pendientes", etiqueta: "compras pendientes" },
];

const MENSAJE_BASE =
  "No se puede borrar esta edición porque tiene datos asociados (patrocinadores, proveedores, inscripciones, tareas…). Bórralos antes o conserva la edición.";

async function resumenDatosAsociados(edicionId: string): Promise<string> {
  const recuentos = await Promise.all(
    TABLAS_CON_EDICION.map(async ({ tabla, etiqueta }) => {
      const { count, error } = await supabase
        .from(tabla)
        .select("id", { count: "exact", head: true })
        .eq("edicion_id", edicionId);
      // Si una tabla no se puede consultar (permisos), simplemente no se lista.
      return !error && count ? `${etiqueta}: ${count}` : null;
    })
  );
  return recuentos.filter(Boolean).join(", ");
}

// Devuelve null si se ha borrado, o el mensaje a mostrar si no.
export async function borrarEdicion(edicionId: string): Promise<string | null> {
  const { error } = await supabase.from("ediciones").delete().eq("id", edicionId);
  if (!error) return null;
  if (error.code !== "23503") return error.message;

  const resumen = await resumenDatosAsociados(edicionId);
  return resumen ? `${MENSAJE_BASE} Ahora mismo tiene: ${resumen}.` : MENSAJE_BASE;
}
