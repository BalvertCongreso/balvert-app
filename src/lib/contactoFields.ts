import type { SeccionDef } from "./patrocinadorFields";

export const seccionesContacto: SeccionDef[] = [
  {
    titulo: "Datos del contacto",
    campos: [
      { key: "nombre", label: "Nombre", tipo: "texto" },
      { key: "apellidos", label: "Apellidos", tipo: "texto" },
      { key: "email", label: "Email", tipo: "email" },
      { key: "telefono", label: "Teléfono", tipo: "telefono" },
      {
        key: "origen_lista",
        label: "Origen de la lista",
        tipo: "texto",
        nota: 'Ej. "Newsletter general", "Ponentes", "Prensa"… sirve para segmentar envíos.',
      },
    ],
  },
  {
    titulo: "Empresa / colegiación",
    campos: [
      { key: "empresa", label: "Empresa", tipo: "texto" },
      { key: "entidad_publica", label: "Entidad pública", tipo: "texto" },
      { key: "colegiado_profesional", label: "Colegiado profesional", tipo: "booleano" },
      { key: "nombre_colegio", label: "Nombre del colegio", tipo: "texto" },
    ],
  },
];
