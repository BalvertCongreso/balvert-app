import type { SeccionDef } from "./patrocinadorFields";

export const seccionesProveedor: SeccionDef[] = [
  {
    titulo: "Identificación y contacto",
    campos: [
      { key: "nombre_proveedor", label: "Nombre del proveedor", tipo: "texto" },
      { key: "servicio_prestado", label: "Servicio prestado", tipo: "texto" },
      { key: "persona_contacto", label: "Persona de contacto", tipo: "texto" },
      { key: "email_contacto", label: "Email de contacto", tipo: "email" },
      { key: "telefono_contacto", label: "Teléfono de contacto", tipo: "telefono" },
    ],
  },
  {
    titulo: "Evento",
    campos: [
      {
        key: "evento_vinculado",
        label: "Evento vinculado",
        tipo: "select",
        opciones: ["Congreso", "Gala", "Excursión", "General/Todo el evento"],
      },
    ],
  },
  {
    titulo: "Coste y facturación",
    campos: [
      { key: "coste_acordado", label: "Coste acordado (€)", tipo: "numero" },
      { key: "coste_real_pagado", label: "Coste real pagado (€)", tipo: "numero" },
      { key: "numero_factura", label: "Número de factura", tipo: "texto" },
      { key: "factura_recibida", label: "Factura recibida", tipo: "select", opciones: ["Sí", "No"] },
      { key: "fecha_recepcion_factura", label: "Fecha recepción factura", tipo: "fecha" },
      { key: "factura_pagada", label: "Factura pagada", tipo: "select", opciones: ["Sí", "No"] },
      { key: "fecha_pago", label: "Fecha de pago", tipo: "fecha" },
      { key: "forma_pago", label: "Forma de pago", tipo: "select", opciones: ["Transferencia", "Otro"] },
    ],
  },
  {
    titulo: "Condiciones y notas",
    campos: [
      { key: "condiciones_servicio", label: "Condiciones del servicio", tipo: "texto-largo" },
      { key: "observaciones", label: "Observaciones", tipo: "texto-largo" },
    ],
  },
];
