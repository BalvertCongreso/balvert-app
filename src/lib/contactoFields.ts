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
];
