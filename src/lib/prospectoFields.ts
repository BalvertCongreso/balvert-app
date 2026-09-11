import type { SeccionDef } from "./patrocinadorFields";

export const seccionesProspecto: SeccionDef[] = [
  {
    titulo: "Empresa",
    campos: [
      { key: "empresa", label: "Empresa", tipo: "texto" },
      { key: "entidad_publica", label: "Entidad pública", tipo: "texto" },
      { key: "colegiado_profesional", label: "Colegiado profesional", tipo: "booleano" },
      { key: "nombre_colegio", label: "Nombre del colegio", tipo: "texto" },
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
