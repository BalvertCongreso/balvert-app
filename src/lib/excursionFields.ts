import type { SeccionDef } from "./patrocinadorFields";

export const seccionesExcursion: SeccionDef[] = [
  {
    titulo: "Datos del asistente",
    campos: [
      { key: "nombre_asistente", label: "Nombre", tipo: "texto" },
      {
        key: "email_asistente",
        label: "Email",
        tipo: "email",
        nota: "Necesario para poder enviarle la entrada QR automáticamente.",
      },
      { key: "cargo", label: "Cargo", tipo: "texto" },
    ],
  },
  {
    titulo: "Vinculación",
    campos: [{ key: "categoria_patrocinio", label: "Categoría de patrocinio", tipo: "texto" }],
  },
  {
    titulo: "Entrada",
    campos: [
      {
        key: "tipo_entrada",
        label: "Tipo de entrada",
        tipo: "select",
        opciones: ["Incluida en patrocinio", "Comprada (10€)", "Invitación organización"],
      },
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
