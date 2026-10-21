// Invitados de un patrocinador (Congreso y, en Diamante, cena de gala y
// excursión). Tipos y reglas compartidos entre el navegador (bloque de la
// ficha) y el servidor (src/lib/invitadosServidor.ts). Nada de servidor aquí.

export const CATEGORIA_DIAMANTE = "💎 DIAMANTE";
export const TIPO_ACCESO_INVITADO = "Invitado por patrocinio";
export const TIPO_ENTRADA_INCLUIDA = "Incluida en patrocinio";
export const MENUS_GALA = ["Carne", "Pescado", "Vegetariano", "Vegano"] as const;
export type MenuGala = (typeof MENUS_GALA)[number];

export const AVISO_POR_ENCIMA = "Esta invitación va por encima de las incluidas en su patrocinio";

export type EventoInvitado = "congreso" | "gala" | "excursion";
export const NOMBRE_EVENTO_INVITADO: Record<EventoInvitado, string> = {
  congreso: "Congreso",
  gala: "Cena de gala",
  excursion: "Excursión",
};

// sin_generar: aún no tiene QR. no_enviada: tiene QR pero el email no salió
// (p. ej. por el límite diario de Resend): se reenvía desde su ficha.
export type EstadoEntrada = "sin_generar" | "enviada" | "no_enviada";
export const NOMBRE_ESTADO_ENTRADA: Record<EstadoEntrada, string> = {
  sin_generar: "Sin generar",
  enviada: "Enviada",
  no_enviada: "No enviada",
};

export interface EntradaInvitado {
  id: string;
  estado: EstadoEntrada;
  checkIn: boolean;
  menu?: string | null;
}

export interface Invitado {
  // Email en minúsculas (o "<tabla>:<id>" si la fila no tiene email): agrupa
  // las filas de una misma persona en las tres pantallas.
  clave: string;
  nombre: string | null;
  email: string | null;
  congreso: EntradaInvitado | null;
  gala: EntradaInvitado | null;
  excursion: EntradaInvitado | null;
}

export type Contadores = Record<EventoInvitado, number>;

export interface ResumenInvitados {
  invitados: Invitado[];
  incluidas: Contadores;
  asignadas: Contadores;
  esDiamante: boolean;
}

// Diamante: 1 cena de gala y 1 excursión (dossier). Las demás categorías no
// tienen ni cena ni excursión con el patrocinio.
export function incluidasDe(p: { categoria: string | null; num_invitaciones_incluidas: number | null }): Contadores {
  const diamante = p.categoria === CATEGORIA_DIAMANTE;
  return {
    congreso: p.num_invitaciones_incluidas ?? 0,
    gala: diamante ? 1 : 0,
    excursion: diamante ? 1 : 0,
  };
}

export function tieneCheckIn(i: Invitado) {
  return [i.congreso, i.gala, i.excursion].some((e) => e?.checkIn);
}

export interface DatosNuevoInvitado {
  nombre: string;
  email: string;
  documento: string;
  gala: { menu: string; alergias: string } | null;
  excursion: boolean;
}

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
