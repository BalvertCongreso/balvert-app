import { supabase } from "./supabaseClient";
import { obtenerTodasLasFilas } from "./paginarTodo";

// Asistentes y tareas guardan el patrocinador vinculado como id; para buscar
// y descargar hace falta su nombre. Devuelve { id: empresa_entidad }.
export async function obtenerNombresPatrocinadores(): Promise<Record<string, string>> {
  const filas = await obtenerTodasLasFilas<{ id: string; empresa_entidad: string | null }>((desde, hasta) =>
    supabase.from("patrocinadores").select("id, empresa_entidad").order("id").range(desde, hasta)
  );
  return Object.fromEntries(filas.map((p) => [p.id, p.empresa_entidad ?? "(sin nombre)"]));
}
