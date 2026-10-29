import { supabase } from "@/lib/supabaseClient";
import { normalizarEmail } from "@/lib/exclusiones";
import type { ProspectoPatrocinioInput } from "@/types/database";

const INTERESES_QUE_SINCRONIZAN = ["Interesado", "En negociación", "Convertido en patrocinador"];

// Copia un prospecto de Captación a Contactos cuando su interés indica que
// merece la pena tenerlo en la lista de newsletter. Si el interés retrocede
// (Sin contactar / Contactado / No interesado), no se toca ni se borra la
// ficha ya creada en Contactos. Si el email ya está en Contactos (también si
// está «Excluido de envíos») solo se actualizan sus datos: el estado no se
// toca nunca desde aquí.
export async function sincronizarContactoDesdeProspecto(datos: ProspectoPatrocinioInput) {
  if (!datos.interes || !INTERESES_QUE_SINCRONIZAN.includes(datos.interes)) return;
  const email = normalizarEmail(datos.contacto_email);
  if (!email) return;

  const { data: existente, error: errorBusqueda } = await supabase
    .from("contactos_newsletter")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (errorBusqueda) return;

  const camposComunes = {
    nombre: datos.contacto_nombre ?? null,
    telefono: datos.contacto_telefono ?? null,
    empresa: datos.empresa ?? null,
    entidad_publica: datos.entidad_publica ?? null,
    colegiado_profesional: datos.colegiado_profesional ?? false,
    nombre_colegio: datos.nombre_colegio ?? null,
    nacionalidad: datos.nacionalidad ?? null,
  };

  if (existente) {
    await supabase.from("contactos_newsletter").update(camposComunes).eq("id", existente.id);
  } else {
    await supabase.from("contactos_newsletter").insert({
      ...camposComunes,
      email,
      origen_lista: "Captación de patrocinio",
    });
  }
}
