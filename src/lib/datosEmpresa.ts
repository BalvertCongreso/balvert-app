// Lo que la empresa puede cambiar de su ficha desde su zona (pestaña «Datos
// de la empresa»): contactos y facturación, nada más. Compartido entre la
// pantalla y /api/portal/empresa/ficha (que es la que manda).

export interface CampoEmpresa {
  clave: string;
  etiqueta: string;
  tipo: "texto" | "email" | "telefono" | "select";
  max: number;
  opciones?: string[];
}

export const CAMPOS_CONTACTO: CampoEmpresa[] = [
  { clave: "contacto1_nombre", etiqueta: "Contacto 1 — Nombre", tipo: "texto", max: 150 },
  { clave: "contacto1_cargo", etiqueta: "Contacto 1 — Cargo", tipo: "texto", max: 150 },
  { clave: "contacto1_email", etiqueta: "Contacto 1 — Email", tipo: "email", max: 200 },
  { clave: "contacto1_telefono", etiqueta: "Contacto 1 — Teléfono", tipo: "telefono", max: 40 },
  { clave: "contacto2_nombre", etiqueta: "Contacto 2 — Nombre", tipo: "texto", max: 150 },
  { clave: "contacto2_cargo", etiqueta: "Contacto 2 — Cargo", tipo: "texto", max: 150 },
  { clave: "contacto2_email", etiqueta: "Contacto 2 — Email", tipo: "email", max: 200 },
  { clave: "contacto2_telefono", etiqueta: "Contacto 2 — Teléfono", tipo: "telefono", max: 40 },
];

export const CAMPOS_FACTURACION_EMPRESA: CampoEmpresa[] = [
  { clave: "razon_social_facturacion", etiqueta: "Razón social", tipo: "texto", max: 200 },
  { clave: "cif_nif", etiqueta: "CIF / NIF", tipo: "texto", max: 30 },
  { clave: "direccion_fiscal", etiqueta: "Dirección fiscal", tipo: "texto", max: 300 },
  { clave: "email_contabilidad", etiqueta: "Email de contabilidad", tipo: "email", max: 200 },
  {
    clave: "canal_especial_facturacion",
    etiqueta: "Canal especial de facturación",
    tipo: "select",
    max: 20,
    opciones: ["No", "FACe", "eFACtura", "Otro"],
  },
];

export const CAMPOS_EMPRESA = [...CAMPOS_CONTACTO, ...CAMPOS_FACTURACION_EMPRESA];

// Ponencia (dossier): Diamante y Oro la incluyen y la rellena la propia
// empresa; en las demás categorías la decide la organización.
export const PONENCIA_POR_CATEGORIA: Record<string, { maxMinutos: number; explicacion: string }> = {
  "💎 DIAMANTE": {
    maxMinutos: 15,
    explicacion: "Patrocinio Diamante: hasta 15 minutos (5 de presentación de empresa o producto + 10 de caso técnico).",
  },
  "⭐ ORO": {
    maxMinutos: 10,
    explicacion: "Patrocinio Oro: hasta 10 minutos (5 de presentación de empresa o producto + 5 de caso técnico).",
  },
};
