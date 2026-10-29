// Aplica a Contactos lo que se sabe de cada email (rebote, baja, rebote
// temporal, recibido) — desde un archivo importado o desde Mailrelay — y
// actualiza el histórico de un boletín. Sirve igual en el navegador (sesión
// del panel) y en el servidor (sesión reenviada o clave de servicio): recibe
// el cliente de Supabase con el que trabajar.
//
// Reglas (decisiones de Ariadna, 29/10/2026):
// - Rebote y baja → «Excluido» con ese motivo. Nunca se reactiva a nadie ni se
//   cambia el motivo de quien ya estaba excluido.
// - Rebote temporal → suma 1 al contador y anota la fecha; sigue Activo.
// - No crea contactos ni borra nada.
import type { SupabaseClient } from "@supabase/supabase-js";
import { obtenerTodasLasFilas } from "@/lib/paginarTodo";
import type { MotivoExclusion, ResultadoBoletin } from "@/types/database";

export function normalizarEmail(email: string | null | undefined): string {
  return (email ?? "").trim().toLowerCase();
}

export type SucesoEmail =
  | { email: string; tipo: "excluir"; motivo: MotivoExclusion }
  | { email: string; tipo: "rebote_temporal"; fecha?: string | null }
  | { email: string; tipo: "recibido" };

export interface ResumenExclusiones {
  // Emails distintos que traía la lista.
  emails: number;
  // Coinciden con Contactos y pasan (o pasarían) a Excluido, por motivo.
  excluidos: Record<MotivoExclusion, number>;
  rebotesTemporales: number;
  yaExcluidos: number;
  // Rebotes, bajas o rebotes temporales cuyo email no está en Contactos.
  noEnContactos: string[];
}

export function resumenVacio(): ResumenExclusiones {
  return { emails: 0, excluidos: { Rebote: 0, Baja: 0, Manual: 0 }, rebotesTemporales: 0, yaExcluidos: 0, noEnContactos: [] };
}

export function sumarResumenes(a: ResumenExclusiones, b: ResumenExclusiones): ResumenExclusiones {
  return {
    emails: a.emails + b.emails,
    excluidos: {
      Rebote: a.excluidos.Rebote + b.excluidos.Rebote,
      Baja: a.excluidos.Baja + b.excluidos.Baja,
      Manual: a.excluidos.Manual + b.excluidos.Manual,
    },
    rebotesTemporales: a.rebotesTemporales + b.rebotesTemporales,
    yaExcluidos: a.yaExcluidos + b.yaExcluidos,
    noEnContactos: Array.from(new Set([...a.noEnContactos, ...b.noEnContactos])),
  };
}

// Si un email llega varias veces, cuenta lo más grave.
function gravedad(s: SucesoEmail): number {
  if (s.tipo === "excluir") return s.motivo === "Baja" ? 4 : s.motivo === "Rebote" ? 3 : 2;
  return s.tipo === "rebote_temporal" ? 1 : 0;
}

function resultadoDe(s: SucesoEmail): ResultadoBoletin {
  if (s.tipo === "rebote_temporal") return "Rebote temporal";
  if (s.tipo === "excluir" && s.motivo !== "Manual") return s.motivo;
  return "Enviado";
}

const ORDEN_RESULTADO: Record<ResultadoBoletin, number> = {
  Enviado: 0,
  "Rebote temporal": 1,
  Rebote: 2,
  Baja: 3,
};

const TAMANO_TROZO = 200;

function trozos<T>(lista: T[], tamano = TAMANO_TROZO): T[][] {
  const resultado: T[][] = [];
  for (let i = 0; i < lista.length; i += tamano) resultado.push(lista.slice(i, i + tamano));
  return resultado;
}

interface ContactoEstado {
  id: string;
  email: string | null;
  estado: "Activo" | "Excluido";
}

export async function cargarContactosPorEmail(db: SupabaseClient): Promise<Map<string, ContactoEstado>> {
  const filas = await obtenerTodasLasFilas<ContactoEstado>((desde, hasta) =>
    db.from("contactos_newsletter").select("id, email, estado").order("id").range(desde, hasta)
  );
  const mapa = new Map<string, ContactoEstado>();
  for (const c of filas) if (c.email) mapa.set(normalizarEmail(c.email), c);
  return mapa;
}

export async function aplicarSucesos(
  db: SupabaseClient,
  sucesos: SucesoEmail[],
  opciones: {
    simular?: boolean;
    // Con boletín: además se guarda en el histórico de cada contacto, y un
    // rebote temporal ya anotado para ese boletín no se vuelve a sumar.
    boletin?: { id: string; fecha: string };
    contactos?: Map<string, ContactoEstado>;
  } = {}
): Promise<ResumenExclusiones> {
  const porEmail = new Map<string, SucesoEmail>();
  for (const s of sucesos) {
    const email = normalizarEmail(s.email);
    if (!email) continue;
    const previo = porEmail.get(email);
    if (!previo || gravedad(s) > gravedad(previo)) porEmail.set(email, { ...s, email });
  }

  const contactos = opciones.contactos ?? (await cargarContactosPorEmail(db));

  const historicoPrevio = new Map<string, ResultadoBoletin>();
  if (opciones.boletin) {
    const boletinId = opciones.boletin.id;
    const filas = await obtenerTodasLasFilas<{ contacto_id: string; resultado: ResultadoBoletin }>((desde, hasta) =>
      db
        .from("contacto_boletines")
        .select("contacto_id, resultado")
        .eq("boletin_id", boletinId)
        .order("id")
        .range(desde, hasta)
    );
    for (const f of filas) historicoPrevio.set(f.contacto_id, f.resultado);
  }

  const resumen = resumenVacio();
  resumen.emails = porEmail.size;
  const aExcluir: Record<MotivoExclusion, string[]> = { Rebote: [], Baja: [], Manual: [] };
  const temporalesPorFecha = new Map<string, string[]>();
  const historico: { contacto_id: string; resultado: ResultadoBoletin }[] = [];
  const ahora = new Date().toISOString();

  for (const s of porEmail.values()) {
    const contacto = contactos.get(s.email);
    if (!contacto) {
      if (s.tipo !== "recibido") resumen.noEnContactos.push(s.email);
      continue;
    }

    // Con boletín: si su histórico ya recoge este resultado (o uno más grave),
    // ya se aplicó en una consulta anterior y no se repite. Así no se suma dos
    // veces un rebote temporal, y quien Ariadna haya vuelto a activar a mano
    // no se excluye otra vez por el mismo rebote antiguo.
    const previo = historicoPrevio.get(contacto.id);
    const yaAplicado = previo !== undefined && ORDEN_RESULTADO[previo] >= ORDEN_RESULTADO[resultadoDe(s)];

    if (s.tipo === "excluir") {
      if (contacto.estado === "Excluido") resumen.yaExcluidos++;
      else if (!yaAplicado) {
        aExcluir[s.motivo].push(contacto.id);
        resumen.excluidos[s.motivo]++;
      }
    } else if (s.tipo === "rebote_temporal") {
      if (!yaAplicado) {
        const fecha = s.fecha || ahora;
        temporalesPorFecha.set(fecha, [...(temporalesPorFecha.get(fecha) ?? []), contacto.id]);
        resumen.rebotesTemporales++;
      }
    }

    if (opciones.boletin && !yaAplicado) {
      historico.push({ contacto_id: contacto.id, resultado: resultadoDe(s) });
    }
  }

  if (opciones.simular) return resumen;

  for (const motivo of Object.keys(aExcluir) as MotivoExclusion[]) {
    for (const ids of trozos(aExcluir[motivo])) {
      const { error } = await db
        .from("contactos_newsletter")
        .update({ estado: "Excluido", motivo_exclusion: motivo, fecha_exclusion: ahora })
        .in("id", ids)
        // Por si alguien lo excluyó entretanto: no se pisa su motivo.
        .eq("estado", "Activo");
      if (error) throw new Error("No se pudieron excluir contactos: " + error.message);
    }
  }

  for (const [fecha, ids] of temporalesPorFecha) {
    for (const trozo of trozos(ids)) {
      const { error } = await db.rpc("anotar_rebotes_temporales", { p_ids: trozo, p_fecha: fecha });
      if (error) throw new Error("No se pudieron anotar los rebotes temporales: " + error.message);
    }
  }

  if (opciones.boletin) {
    const { id: boletinId, fecha } = opciones.boletin;
    for (const trozo of trozos(historico, 500)) {
      const { error } = await db.from("contacto_boletines").upsert(
        trozo.map((h) => ({ ...h, boletin_id: boletinId, fecha })),
        { onConflict: "contacto_id,boletin_id" }
      );
      if (error) throw new Error("No se pudo guardar el histórico del boletín: " + error.message);
    }
  }

  return resumen;
}

export function textoResumen(r: ResumenExclusiones): string {
  return `${r.excluidos.Rebote} excluidos por rebote, ${r.excluidos.Baja} por baja, ${r.rebotesTemporales} rebotes temporales anotados, ${r.noEnContactos.length} direcciones que no están en Contactos.`;
}
