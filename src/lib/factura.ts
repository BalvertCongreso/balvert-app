// Datos fiscales que rellena el cliente al pedir factura desde el portal
// (/api/portal/factura). Se guardan en solicitudes_factura y se crea con
// ellos una tarea para Ariadna: la factura se hace a mano en Holded.
// Todos obligatorios salvo email_factura.
export type DatosFacturacion = {
  razon_social: string;
  nif: string;
  direccion: string;
  codigo_postal: string;
  ciudad: string;
  pais: string;
  email_factura: string | null;
};

export const CAMPOS_FACTURACION: { clave: keyof DatosFacturacion; etiqueta: string; maximo: number; opcional?: boolean }[] = [
  { clave: "razon_social", etiqueta: "Razón social o nombre completo", maximo: 200 },
  { clave: "nif", etiqueta: "NIF / CIF", maximo: 30 },
  { clave: "direccion", etiqueta: "Dirección fiscal", maximo: 250 },
  { clave: "codigo_postal", etiqueta: "Código postal", maximo: 15 },
  { clave: "ciudad", etiqueta: "Ciudad", maximo: 100 },
  { clave: "pais", etiqueta: "País", maximo: 100 },
  { clave: "email_factura", etiqueta: "Email para enviar la factura", maximo: 254, opcional: true },
];

// Devuelve los datos limpios o el texto del error a mostrar.
export function validarDatosFacturacion(valor: unknown): DatosFacturacion | string {
  const entrada = typeof valor === "object" && valor !== null ? (valor as Record<string, unknown>) : {};
  const datos: Record<string, string | null> = {};
  for (const { clave, etiqueta, maximo, opcional } of CAMPOS_FACTURACION) {
    const texto = typeof entrada[clave] === "string" ? (entrada[clave] as string).trim() : "";
    if (!texto && !opcional) return `Para la factura falta: ${etiqueta}.`;
    if (texto.length > maximo) return `El campo "${etiqueta}" es demasiado largo (máximo ${maximo} caracteres).`;
    datos[clave] = texto || null;
  }
  if (datos.email_factura && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(datos.email_factura)) {
    return "El email para la factura no tiene un formato válido.";
  }
  return datos as DatosFacturacion;
}
