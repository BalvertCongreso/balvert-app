export type CampoTipo = "texto" | "texto-largo" | "numero" | "fecha" | "select" | "email" | "telefono";

export interface CampoDef {
  key: string;
  label: string;
  tipo: CampoTipo;
  opciones?: string[];
  nota?: string;
}

export interface SeccionDef {
  titulo: string;
  campos: CampoDef[];
}

export const seccionesPatrocinador: SeccionDef[] = [
  {
    titulo: "Identificación",
    campos: [
      {
        key: "categoria",
        label: "Categoría",
        tipo: "select",
        opciones: ["💎 DIAMANTE", "⭐ ORO", "🥈 PLATA", "🏛 INSTITUCIONAL", "Personalizado"],
      },
      { key: "empresa_entidad", label: "Empresa / entidad", tipo: "texto" },
      { key: "nombre_comercial_cartel", label: "Nombre comercial (cartel)", tipo: "texto" },
    ],
  },
  {
    titulo: "Contacto",
    campos: [
      { key: "contacto1_nombre", label: "Contacto 1 — Nombre", tipo: "texto" },
      { key: "contacto1_cargo", label: "Contacto 1 — Cargo", tipo: "texto" },
      { key: "contacto1_email", label: "Contacto 1 — Email", tipo: "email" },
      { key: "contacto1_telefono", label: "Contacto 1 — Teléfono", tipo: "telefono" },
      { key: "contacto2_nombre", label: "Contacto 2 — Nombre", tipo: "texto" },
      { key: "contacto2_cargo", label: "Contacto 2 — Cargo", tipo: "texto" },
      { key: "contacto2_email", label: "Contacto 2 — Email", tipo: "email" },
      { key: "contacto2_telefono", label: "Contacto 2 — Teléfono", tipo: "telefono" },
    ],
  },
  {
    titulo: "Invitaciones",
    campos: [
      { key: "num_invitaciones_incluidas", label: "Nº invitaciones incluidas", tipo: "numero" },
      { key: "nombres_invitados", label: "Nombres de los invitados", tipo: "texto-largo" },
      { key: "emails_invitados", label: "Emails de los invitados", tipo: "texto-largo" },
      {
        key: "invitaciones_enviadas",
        label: "Invitaciones enviadas",
        tipo: "select",
        opciones: ["Sí", "No", "N/A"],
      },
    ],
  },
  {
    titulo: "Ponencia",
    campos: [
      { key: "tiene_ponencia", label: "¿Tiene ponencia?", tipo: "select", opciones: ["Sí", "No", "N/A"] },
      { key: "ponente_nombre", label: "Ponente — Nombre", tipo: "texto" },
      { key: "ponente_cargo", label: "Ponente — Cargo", tipo: "texto" },
      { key: "ponencia_titulo", label: "Título de la ponencia", tipo: "texto" },
      { key: "ponencia_duracion_min", label: "Duración (minutos)", tipo: "numero" },
      { key: "ponencia_recibida", label: "Ponencia recibida", tipo: "select", opciones: ["Sí", "No"] },
    ],
  },
  {
    titulo: "Mostrador",
    campos: [
      { key: "tiene_stand", label: "¿Tiene mostrador?", tipo: "select", opciones: ["Sí", "No", "N/A"] },
      {
        key: "vinilado_por_nuestra_cuenta",
        label: "Vinilado por nuestra cuenta",
        tipo: "select",
        opciones: ["Sí", "No"],
      },
      {
        key: "rollup_por_nuestra_cuenta",
        label: "Roll up por nuestra cuenta",
        tipo: "select",
        opciones: ["Sí", "No"],
      },
      { key: "necesidades_stand", label: "Necesidades del mostrador", tipo: "texto-largo" },
    ],
  },
  {
    titulo: "Logo y materiales",
    campos: [
      { key: "logo_recibido", label: "Logo recibido", tipo: "select", opciones: ["Sí", "No"] },
      {
        key: "formato_logo",
        label: "Formato del logo",
        tipo: "select",
        opciones: ["AI (vector)", "PNG alta res", "JPG", "Pendiente"],
      },
      { key: "fecha_limite_materiales", label: "Fecha límite materiales", tipo: "fecha" },
    ],
  },
  {
    titulo: "Facturación",
    campos: [
      { key: "razon_social_facturacion", label: "Razón social", tipo: "texto" },
      { key: "cif_nif", label: "CIF / NIF", tipo: "texto" },
      { key: "direccion_fiscal", label: "Dirección fiscal", tipo: "texto" },
      { key: "email_contabilidad", label: "Email de contabilidad", tipo: "email" },
      {
        key: "canal_especial_facturacion",
        label: "Canal especial de facturación",
        tipo: "select",
        opciones: ["No", "FACe", "eFACtura", "Otro"],
      },
      { key: "fecha_facturacion_solicitada", label: "Fecha facturación solicitada", tipo: "fecha" },
      { key: "precio_tarifa", label: "Precio tarifa (€)", tipo: "numero" },
      { key: "precio_real_pagado", label: "Precio real pagado (€)", tipo: "numero" },
      { key: "factura_emitida", label: "Factura emitida", tipo: "select", opciones: ["Sí", "No"] },
      { key: "fecha_emision_factura", label: "Fecha emisión factura", tipo: "fecha" },
      { key: "factura_enviada", label: "Factura enviada", tipo: "select", opciones: ["Sí", "No"] },
      { key: "pago_recibido", label: "Pago recibido", tipo: "select", opciones: ["Sí", "No"] },
      { key: "fecha_pago", label: "Fecha de pago", tipo: "fecha" },
      {
        key: "metodo_pago",
        label: "Método de pago",
        tipo: "select",
        opciones: ["Transferencia", "Pasarela online", "Otro"],
        nota: "Reservado para más adelante (pasarela de pago online). No se usa activamente todavía.",
      },
      {
        key: "referencia_pago_online",
        label: "Referencia de pago online",
        tipo: "texto",
        nota: "Reservado para más adelante. Déjalo vacío por ahora.",
      },
    ],
  },
  {
    titulo: "Beneficios y notas",
    campos: [
      { key: "beneficios_incluidos", label: "Beneficios incluidos", tipo: "texto-largo" },
      { key: "beneficios_excluidos", label: "Beneficios excluidos", tipo: "texto-largo" },
      { key: "observaciones", label: "Observaciones", tipo: "texto-largo" },
    ],
  },
];
