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

export interface Edicion {
  id: string;
  nombre: string | null;
  anio: number | null;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  ciudad: string | null;
  activa: boolean;

  lugar_congreso: string | null;
  fecha_hora_congreso: string | null;
  lugar_gala: string | null;
  fecha_hora_gala: string | null;
  lugar_excursion: string | null;
  fecha_hora_excursion: string | null;
}

export type EdicionInput = Omit<Edicion, "id">;

export interface Patrocinador {
  id: string;
  edicion_id: string | null;

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

export interface Proveedor {
  id: string;
  edicion_id: string | null;

  // Identificación y contacto
  nombre_proveedor: string | null;
  servicio_prestado: string | null;
  persona_contacto: string | null;
  email_contacto: string | null;
  telefono_contacto: string | null;

  // Evento
  evento_vinculado: "Congreso" | "Gala" | "Excursión" | "General/Todo el evento" | null;

  // Coste y facturación
  coste_acordado: number | null;
  coste_real_pagado: number | null;
  numero_factura: string | null;
  factura_recibida: SiNo | null;
  fecha_recepcion_factura: string | null;
  factura_pagada: SiNo | null;
  fecha_pago: string | null;
  forma_pago: "Transferencia" | "Otro" | null;

  // Condiciones y notas
  condiciones_servicio: string | null;
  observaciones: string | null;
}

export type ProveedorInput = Omit<Proveedor, "id">;

export interface AsistenteCongreso {
  id: string;
  edicion_id: string | null;
  nombre: string | null;
  email: string | null;
  telefono: string | null;
  cargo: string | null;
  empresa_entidad: string | null;
  categoria_patrocinio: string | null;
  tipo_acceso:
    | "Independiente"
    | "Invitado por patrocinio"
    | "Contacto de empresa patrocinadora"
    | null;
  menu: "Carne" | "Pescado" | "Vegetariano" | "Vegano" | null;
  alergias_intolerancias: string | null;
  confirmado: "Sí" | "No" | "Pendiente" | null;
  entrada_enviada: SiNo | null;
  precio: number | null;
  metodo_pago: "Transferencia" | "Pasarela online" | "Otro" | null;
  referencia_pago_online: string | null;
  observaciones: string | null;
  qr_codigo: string | null;
  check_in_hecho: SiNo | null;
  check_in_fecha: string | null;
}

export type AsistenteCongresoInput = Omit<AsistenteCongreso, "id">;

export interface Gala {
  id: string;
  edicion_id: string | null;
  empresa_entidad: string | null;
  categoria_patrocinio: string | null;
  nombre_asistente: string | null;
  email_asistente: string | null;
  cargo: string | null;
  tipo_entrada: "Incluida en patrocinio" | "Comprada" | "Invitación organización" | null;
  menu: "Carne" | "Pescado" | "Vegetariano" | "Vegano" | null;
  alergias_intolerancias: string | null;
  confirmado: "Sí" | "No" | "Pendiente" | null;
  entrada_enviada: SiNo | null;
  precio_entrada: number | null;
  observaciones: string | null;
  metodo_pago: "Transferencia" | "Pasarela online" | "Otro" | null;
  referencia_pago_online: string | null;
  qr_codigo: string | null;
  check_in_hecho: SiNo | null;
  check_in_fecha: string | null;
}

export type GalaInput = Omit<Gala, "id">;

export interface Excursion {
  id: string;
  edicion_id: string | null;
  empresa_entidad: string | null;
  categoria_patrocinio: string | null;
  nombre_asistente: string | null;
  email_asistente: string | null;
  cargo: string | null;
  tipo_entrada:
    | "Incluida en patrocinio"
    | "Comprada (10€)"
    | "Invitación organización"
    | null;
  confirmado: "Sí" | "No" | "Pendiente" | null;
  entrada_enviada: SiNo | null;
  precio: number | null;
  observaciones: string | null;
  metodo_pago: "Transferencia" | "Pasarela online" | "Otro" | null;
  referencia_pago_online: string | null;
  qr_codigo: string | null;
  check_in_hecho: SiNo | null;
  check_in_fecha: string | null;
}

export type ExcursionInput = Omit<Excursion, "id">;

export interface ContactoNewsletter {
  id: string;
  nombre: string | null;
  apellidos: string | null;
  email: string | null;
  telefono: string | null;
  origen_lista: string | null;
  fecha_alta: string;
}

export type ContactoNewsletterInput = Omit<ContactoNewsletter, "id" | "fecha_alta">;

export interface Tarea {
  id: string;
  edicion_id: string | null;
  responsable: "🔴 Ariosto" | "🟣 Ariadna" | "🤝 Ambos" | null;
  tarea: string | null;
  entidad_relacionada: string | null;
  fase:
    | "Fase 0 - Cierre 2026"
    | "Fase 1 - Jul/Ago 2026"
    | "Fase 2 - Sep/Nov 2026"
    | "Fase 3 - Dic 2026/Ene 2027"
    | "Fase 4 - Feb 2027"
    | "Fase 5 - Congreso"
    | "General"
    | null;
  prioridad: "🔴 Alta" | "🟡 Media" | "🟢 Baja" | null;
  fecha_limite: string | null;
  estado: "⏳ Pendiente" | "🔄 En curso" | "✅ Completada" | "❌ Cancelada" | null;
  fecha_completada: string | null;
  notas: string | null;
}

export interface TareaComentario {
  id: string;
  tarea_id: string;
  autor: Usuario | null;
  contenido: string | null;
  fecha_creacion: string;
}

export type TareaInput = Omit<Tarea, "id">;

export interface ProspectoPatrocinio {
  id: string;
  edicion_id: string | null;
  empresa_entidad: string | null;
  contacto_nombre: string | null;
  contacto_cargo: string | null;
  contacto_email: string | null;
  contacto_telefono: string | null;
  interes:
    | "Sin contactar"
    | "Contactado"
    | "Interesado"
    | "En negociación"
    | "No interesado"
    | "Convertido en patrocinador"
    | null;
  responsable: "🔴 Ariosto" | "🟣 Ariadna" | "🤝 Ambos" | null;
  observaciones: string | null;
}

export type ProspectoPatrocinioInput = Omit<ProspectoPatrocinio, "id">;

export interface ProspectoContacto {
  id: string;
  prospecto_id: string;
  fecha: string;
  autor: Usuario | null;
  comentario: string | null;
}

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
