import type { SupabaseClient } from "@supabase/supabase-js";

// Forma de una compra guardada en compras_pendientes (ver
// 018_menu_gala_colegiados_compras_pendientes.sql). La escribe
// /api/stripe/crear-sesion y la lee /api/stripe/webhook.

export const MENUS = ["Carne", "Pescado", "Vegetariano", "Vegano"] as const;

// Una persona ya validada, con el precio unitario que se le cobra calculado
// en /api/stripe/crear-sesion (nunca viene del navegador). Es exactamente lo que se
// guarda en compras_pendientes.grupos y lo que lee el webhook.
// documento_identidad: DNI/NIE/pasaporte ya normalizado. Solo se guarda en
// la base de datos (nunca en la metadata de Stripe, logs, emails ni QR).
export type PersonaCongreso = {
  nombre: string;
  documento_identidad: string;
  colegiado_profesional: boolean;
  nombre_colegio: string | null;
  numero_colegiado: string | null;
  precio: number;
};
export type PersonaGala = {
  nombre: string;
  documento_identidad: string;
  menu: (typeof MENUS)[number];
  alergias_intolerancias: string | null;
  precio: number;
};
export type PersonaExcursion = { nombre: string; documento_identidad: string; precio: number };
export type GruposCompra = {
  congreso?: PersonaCongreso[];
  gala?: PersonaGala[];
  excursion?: PersonaExcursion[];
};

// Copia de los grupos sin documentos de identidad. Se guarda así en cuanto el
// webhook termina bien: los documentos ya están en las filas reales
// (asistentes_congreso/gala/excursion) y aquí solo quedaría una copia de más.
// El resto (nombres, menú, precio…) se conserva como registro del pago.
export function gruposSinDocumentos(grupos: GruposCompra): GruposCompra {
  const quitar = <T extends { documento_identidad?: string }>(personas?: T[]) =>
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    personas?.map(({ documento_identidad, ...resto }) => resto);
  return {
    ...(grupos.congreso && { congreso: quitar(grupos.congreso) as PersonaCongreso[] }),
    ...(grupos.gala && { gala: quitar(grupos.gala) as PersonaGala[] }),
    ...(grupos.excursion && { excursion: quitar(grupos.excursion) as PersonaExcursion[] }),
  };
}

// Días que se guarda una compra que nunca se pagó. La sesión de Stripe
// caduca a las 24 h, así que pasado este plazo ya no puede pagarse.
export const DIAS_COMPRA_SIN_PAGAR = 7;

// Borra las compras sin pagar (usada_en nulo) creadas hace más de
// DIAS_COMPRA_SIN_PAGAR días. Las compras pagadas no se tocan nunca.
// Devuelve cuántas se borraron, o null si falló.
export async function borrarComprasSinPagarCaducadas(supabase: SupabaseClient): Promise<number | null> {
  const limite = new Date(Date.now() - DIAS_COMPRA_SIN_PAGAR * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("compras_pendientes")
    .delete()
    .is("usada_en", null)
    .lt("creado_en", limite)
    .select("id");
  if (error) {
    console.error("Limpieza compras_pendientes: fallo al borrar", error.code, error.message);
    return null;
  }
  return data?.length ?? 0;
}
