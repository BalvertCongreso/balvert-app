// Registro de los boletines enviados desde la app y de la fila «Enviado» de
// cada destinatario en su histórico. Los resultados (rebote, baja…) llegan
// después desde Mailrelay (ver mailrelayResultados.ts).
import type { SupabaseClient } from "@supabase/supabase-js";
import { obtenerTodasLasFilas } from "@/lib/paginarTodo";

export async function registrarBoletinEnviado(
  db: SupabaseClient,
  datos: { campaignId: number; asunto: string; fechaEnvio: string; origen: string | null }
): Promise<{ boletinId: string; destinatarios: number }> {
  // Los mismos que se han sincronizado con Mailrelay: Activos (del origen
  // elegido, o todos) con email.
  const destinatarios = await obtenerTodasLasFilas<{ id: string }>((desde, hasta) => {
    let q = db
      .from("contactos_newsletter")
      .select("id")
      .eq("estado", "Activo")
      .not("email", "is", null)
      .order("id")
      .range(desde, hasta);
    if (datos.origen) q = q.eq("origen_lista", datos.origen);
    return q;
  });

  const { data: boletin, error } = await db
    .from("boletines")
    .insert({
      mailrelay_campaign_id: datos.campaignId,
      asunto: datos.asunto,
      fecha_envio: datos.fechaEnvio,
      origen_lista: datos.origen ?? "Todos",
      destinatarios: destinatarios.length,
      enviado_desde: "App",
    })
    .select("id")
    .single<{ id: string }>();
  if (error) throw new Error(error.message);

  for (let i = 0; i < destinatarios.length; i += 500) {
    const { error: errorFilas } = await db.from("contacto_boletines").upsert(
      destinatarios.slice(i, i + 500).map((c) => ({
        contacto_id: c.id,
        boletin_id: boletin.id,
        fecha: datos.fechaEnvio,
        resultado: "Enviado",
      })),
      { onConflict: "contacto_id,boletin_id", ignoreDuplicates: true }
    );
    if (errorFilas) throw new Error(errorFilas.message);
  }

  return { boletinId: boletin.id, destinatarios: destinatarios.length };
}
