import type { SeccionDef } from "./patrocinadorFields";

export const seccionesCongreso: SeccionDef[] = [
  {
    titulo: "Datos del asistente",
    campos: [
      {
        key: "nombre",
        label: "Nombre",
        tipo: "texto",
        nota: "Puede quedar vacío: es lo normal en una invitación creada desde Patrocinadores antes de saber quién la usará.",
      },
      {
        key: "documento_identidad",
        label: "Documento de identidad",
        tipo: "texto",
        nota: "DNI, NIE o pasaporte. Obligatorio en la compra online; opcional en altas manuales e invitaciones.",
      },
      { key: "email", label: "Email", tipo: "email" },
      { key: "telefono", label: "Teléfono", tipo: "telefono" },
      { key: "cargo", label: "Cargo", tipo: "texto" },
    ],
  },
  {
    titulo: "Vinculación",
    campos: [
      { key: "categoria_patrocinio", label: "Categoría de patrocinio", tipo: "texto" },
      {
        key: "tipo_acceso",
        label: "Tipo de acceso",
        tipo: "select",
        opciones: ["Independiente", "Invitado por patrocinio", "Contacto de empresa patrocinadora"],
      },
    ],
  },
  {
    titulo: "Colegiado profesional",
    campos: [
      {
        key: "colegiado_profesional",
        label: "Colegiado profesional",
        tipo: "booleano",
        nota: "Si viene de la compra online, se cobró al precio de colegiado. Comprueba que el número es real.",
      },
      { key: "nombre_colegio", label: "Colegio", tipo: "texto" },
      { key: "numero_colegiado", label: "Número de colegiado", tipo: "texto" },
    ],
  },
  {
    titulo: "Catering y confirmación",
    campos: [
      { key: "menu", label: "Menú", tipo: "select", opciones: ["Carne", "Pescado", "Vegetariano", "Vegano"] },
      { key: "alergias_intolerancias", label: "Alergias / intolerancias", tipo: "texto-largo" },
      { key: "confirmado", label: "Confirmado", tipo: "select", opciones: ["Sí", "No", "Pendiente"] },
      { key: "entrada_enviada", label: "Entrada enviada", tipo: "select", opciones: ["Sí", "No"] },
    ],
  },
  {
    titulo: "Coste y notas",
    campos: [
      { key: "precio", label: "Precio (€)", tipo: "numero" },
      {
        key: "metodo_pago",
        label: "Método de pago",
        tipo: "select",
        opciones: ["Transferencia", "Pasarela online", "Otro"],
        nota: "Reservado para más adelante. No se usa activamente todavía.",
      },
      {
        key: "referencia_pago_online",
        label: "Referencia de pago online",
        tipo: "texto",
        nota: "Reservado para más adelante. Déjalo vacío por ahora.",
      },
      { key: "observaciones", label: "Observaciones", tipo: "texto-largo" },
    ],
  },
];
