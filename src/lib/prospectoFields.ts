import type { SeccionDef } from "./patrocinadorFields";

export const seccionesProspecto: SeccionDef[] = [
  {
    titulo: "Empresa",
    campos: [
      { key: "empresa_entidad", label: "Empresa / entidad", tipo: "texto" },
      {
        key: "responsable",
        label: "Responsable",
        tipo: "select",
        opciones: ["🔴 Ariosto", "🟣 Ariadna", "🤝 Ambos"],
      },
      {
        key: "interes",
        label: "Interés",
        tipo: "select",
        opciones: [
          "Sin contactar",
          "Contactado",
          "Interesado",
          "En negociación",
          "No interesado",
          "Convertido en patrocinador",
        ],
      },
    ],
  },
  {
    titulo: "Contacto",
    campos: [
      { key: "contacto_nombre", label: "Nombre", tipo: "texto" },
      { key: "contacto_cargo", label: "Cargo", tipo: "texto" },
      { key: "contacto_email", label: "Email", tipo: "email" },
      { key: "contacto_telefono", label: "Teléfono", tipo: "telefono" },
    ],
  },
  {
    titulo: "Notas",
    campos: [{ key: "observaciones", label: "Observaciones", tipo: "texto-largo" }],
  },
];
