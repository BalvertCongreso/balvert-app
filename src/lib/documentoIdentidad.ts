// Validación del documento de identidad y del nombre de cada asistente en
// /entradas. Se usa tal cual en el navegador (aviso inmediato) y en
// /api/stripe/crear-sesion (la comprobación que cuenta), así que no puede
// depender de nada del servidor.

const LETRAS_DNI = "TRWAGMYFPDXBNJZSQVHLCKE";
const FORMA_DNI = /^\d{8}[A-Z]$/;
const FORMA_NIE = /^[XYZ]\d{7}[A-Z]$/;
const FORMA_PASAPORTE = /^[A-Z0-9]{5,20}$/;

// Mayúsculas, sin espacios ni guiones (ni puntos): "12.345.678-z" → "12345678Z".
export function normalizarDocumento(valor: string): string {
  return valor.toUpperCase().replace(/[\s.\-]/g, "");
}

function letraCorrecta(numero: string, letra: string) {
  return LETRAS_DNI[Number(numero) % 23] === letra;
}

export const TIPOS_DOCUMENTO = ["DNI", "NIE", "Pasaporte"] as const;
export type TipoDocumento = (typeof TIPOS_DOCUMENTO)[number];

export function esTipoDocumento(valor: unknown): valor is TipoDocumento {
  return TIPOS_DOCUMENTO.some((t) => t === valor);
}

// Devuelve el documento normalizado si es válido para el tipo elegido, o
// null si no lo es.
// - DNI: 8 dígitos + letra, con la letra comprobada (resto entre 23).
// - NIE: X/Y/Z + 7 dígitos + letra, con la letra comprobada (X/Y/Z cuentan
//   como 0/1/2).
// - Pasaporte: alfanumérico, 5-20 caracteres.
export function validarDocumento(valor: string, tipo: TipoDocumento): string | null {
  const doc = normalizarDocumento(valor);
  if (tipo === "DNI") {
    return FORMA_DNI.test(doc) && letraCorrecta(doc.slice(0, 8), doc[8]) ? doc : null;
  }
  if (tipo === "NIE") {
    return FORMA_NIE.test(doc) && letraCorrecta("XYZ".indexOf(doc[0]) + doc.slice(1, 8), doc[8]) ? doc : null;
  }
  return FORMA_PASAPORTE.test(doc) ? doc : null;
}

// Cómo se nombra cada tipo dentro de una frase ("El pasaporte de…").
export const NOMBRE_DOCUMENTO: Record<TipoDocumento, string> = { DNI: "DNI", NIE: "NIE", Pasaporte: "pasaporte" };

// Pista para el mensaje de error, sin repetir el documento.
export const AYUDA_DOCUMENTO: Record<TipoDocumento, string> = {
  DNI: "Un DNI son 8 números y una letra, y la letra debe ser la correcta.",
  NIE: "Un NIE es X, Y o Z, 7 números y una letra, y la letra debe ser la correcta.",
  Pasaporte: "Un pasaporte tiene entre 5 y 20 letras o números.",
};

// "Nombre y apellidos": al menos dos palabras.
export function nombreTieneApellidos(nombre: string): boolean {
  return nombre.trim().split(/\s+/).filter(Boolean).length >= 2;
}
