// Forma de una compra guardada en compras_pendientes (ver
// 018_menu_gala_colegiados_compras_pendientes.sql). La escribe
// /api/stripe/crear-sesion y la lee /api/stripe/webhook.

export const MENUS = ["Carne", "Pescado", "Vegetariano", "Vegano"] as const;

// Una persona ya validada, con el precio unitario que se le cobra calculado
// en /api/stripe/crear-sesion (nunca viene del navegador). Es exactamente lo que se
// guarda en compras_pendientes.grupos y lo que lee el webhook.
export type PersonaCongreso = {
  nombre: string;
  colegiado_profesional: boolean;
  nombre_colegio: string | null;
  numero_colegiado: string | null;
  precio: number;
};
export type PersonaGala = {
  nombre: string;
  menu: (typeof MENUS)[number];
  alergias_intolerancias: string | null;
  precio: number;
};
export type PersonaExcursion = { nombre: string; precio: number };
export type GruposCompra = {
  congreso?: PersonaCongreso[];
  gala?: PersonaGala[];
  excursion?: PersonaExcursion[];
};
