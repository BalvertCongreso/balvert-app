import { supabase } from "./supabaseClient";
import type { Edicion } from "@/types/database";

export async function obtenerEdicionActiva(): Promise<Edicion | null> {
  const { data, error } = await supabase
    .from("ediciones")
    .select("*")
    .eq("activa", true)
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return data;
}
