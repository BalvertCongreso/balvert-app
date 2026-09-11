import { supabase } from "@/lib/supabaseClient";
import type { ProspectoPatrocinioInput } from "@/types/database";

const INTERESES_QUE_SINCRONIZAN = ["Interesado", "En negociación", "Convertido en patrocinador"];

// Copia un prospecto de Captación a Contactos cuando su interés indica que
// merece la pena tenerlo en la lista de newsletter. Si el interés retrocede
// (Sin contactar / Contactado / No interesado), no se toca ni se borra la
// ficha ya creada en Contactos.
export async function sincronizarContactoDesdeProspecto(datos: ProspectoPatrocinioInput) {
  if (!datos.interes || !INTERESES_QUE_SINCRONIZAN.includes(datos.interes)) return;
  if (!datos.contacto_email) return;

  const { data: existente, error: errorBusqueda } = await supabase
    .from("contactos_newsletter")
    .select("id")
    .eq("email", datos.contacto_email)
    .maybeSingle();

  if (errorBusqueda) return;

  const camposComunes = {
    nombre: datos.contacto_nombre ?? null,
    telefono: datos.contacto_telefono ?? null,
    empresa: datos.empresa ?? null,
    entidad_publica: datos.entidad_publica ?? null,
    colegiado_profesional: datos.colegiado_profesional ?? false,
    nombre_colegio: datos.nombre_colegio ?? null,
  };

  if (existente) {
    await supabase.from("contactos_newsletter").update(camposComunes).eq("id", existente.id);
  } else {
    await supabase.from("contactos_newsletter").insert({
      ...camposComunes,
      email: datos.contacto_email,
      origen_lista: "Captación de patrocinio",
    });
  }
}
