import type { SeccionDef } from "./patrocinadorFields";

export const seccionesTarea: SeccionDef[] = [
  {
    titulo: "Tarea",
    campos: [
      {
        key: "responsable",
        label: "Responsable",
        tipo: "select",
        opciones: ["🔴 Ariosto", "🟣 Ariadna", "🤝 Ambos"],
      },
      { key: "tarea", label: "Tarea", tipo: "texto" },
      {
        key: "fase",
        label: "Fase",
        tipo: "select",
        opciones: [
          "Fase 0 - Cierre 2026",
          "Fase 1 - Jul/Ago 2026",
          "Fase 2 - Sep/Nov 2026",
          "Fase 3 - Dic 2026/Ene 2027",
          "Fase 4 - Feb 2027",
          "Fase 5 - Congreso",
          "General",
        ],
      },
      {
        key: "prioridad",
        label: "Prioridad",
        tipo: "select",
        opciones: ["🔴 Alta", "🟡 Media", "🟢 Baja"],
      },
    ],
  },
  {
    titulo: "Estado y fechas",
    campos: [
      { key: "fecha_limite", label: "Fecha límite", tipo: "fecha" },
      {
        key: "estado",
        label: "Estado",
        tipo: "select",
        opciones: ["⏳ Pendiente", "🔄 En curso", "✅ Completada", "❌ Cancelada"],
      },
      { key: "fecha_completada", label: "Fecha completada", tipo: "fecha" },
    ],
  },
  {
    titulo: "Notas",
    campos: [{ key: "notas", label: "Notas", tipo: "texto-largo" }],
  },
];
