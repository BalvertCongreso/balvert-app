// Tipos alineados 1:1 con supabase/schema.sql y PROJECT_BRIEF.md

export type Usuario = "Ariadna" | "Ariosto";

export type Categoria =
  | "💎 DIAMANTE"
  | "⭐ ORO"
  | "🥈 PLATA"
  | "🏛 INSTITUCIONAL"
  | "Personalizado";

export type SiNo = "Sí" | "No";
export type SiNoNA = "Sí" | "No" | "N/A";

export interface Patrocinador {
  id: string;

  // Identificación
  categoria: Categoria | null;
  empresa_entidad: string | null;
  nombre_comercial_cartel: string | null;

  // Contacto
  contacto1_nombre: string | null;
  contacto1_cargo: string | null;
  contacto1_email: string | null;
  contacto1_telefono: string | null;
  contacto2_nombre: string | null;
  contacto2_cargo: string | null;
  contacto2_email: string | null;
  contacto2_telefono: string | null;

  // Invitaciones
  num_invitaciones_incluidas: number | null;
  nombres_invitados: string | null;
  emails_invitados: string | null;
  invitaciones_enviadas: SiNoNA | null;

  // Ponencia
  tiene_ponencia: SiNoNA | null;
  ponente_nombre: string | null;
  ponente_cargo: string | null;
  ponencia_titulo: string | null;
  ponencia_duracion_min: number | null;
  ponencia_recibida: SiNo | null;

  // Mostrador
  tiene_stand: SiNoNA | null;
  vinilado_por_nuestra_cuenta: SiNo | null;
  rollup_por_nuestra_cuenta: SiNo | null;
  necesidades_stand: string | null;

  // Logo y materiales
  logo_recibido: SiNo | null;
  formato_logo: "AI (vector)" | "PNG alta res" | "JPG" | "Pendiente" | null;
  fecha_limite_materiales: string | null;

  // Facturación
  razon_social_facturacion: string | null;
  cif_nif: string | null;
  direccion_fiscal: string | null;
  email_contabilidad: string | null;
  canal_especial_facturacion: "No" | "FACe" | "eFACtura" | "Otro" | null;
  fecha_facturacion_solicitada: string | null;
  precio_tarifa: number | null;
  precio_real_pagado: number | null;
  factura_emitida: SiNo | null;
  fecha_emision_factura: string | null;
  factura_enviada: SiNo | null;
  pago_recibido: SiNo | null;
  fecha_pago: string | null;
  metodo_pago: "Transferencia" | "Pasarela online" | "Otro" | null;
  referencia_pago_online: string | null;

  // Beneficios y notas
  beneficios_incluidos: string | null;
  beneficios_excluidos: string | null;
  observaciones: string | null;
}

export type PatrocinadorInput = Omit<Patrocinador, "id">;

export interface NotaCompartida {
  id: string;
  autor: Usuario | null;
  contenido: string | null;
  fecha_creacion: string;
  fecha_actualizacion: string;
}

export interface NotaPrivada {
  id: string;
  usuario: Usuario | null;
  contenido: string | null;
  fecha_creacion: string;
  fecha_actualizacion: string;
}
