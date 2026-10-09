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

// Devuelve el documento normalizado si es válido, o null si no lo es.
// - Forma de DNI (8 dígitos + letra) o NIE (X/Y/Z + 7 dígitos + letra): se
//   comprueba la letra con el algoritmo oficial (resto entre 23; en el NIE,
//   X/Y/Z cuentan como 0/1/2).
// - Cualquier otra cosa se acepta como pasaporte: alfanumérico, 5-20 caracteres.
export function validarDocumento(valor: string): string | null {
  const doc = normalizarDocumento(valor);
  if (FORMA_DNI.test(doc)) {
    return letraCorrecta(doc.slice(0, 8), doc[8]) ? doc : null;
  }
  if (FORMA_NIE.test(doc)) {
    const numero = "XYZ".indexOf(doc[0]) + doc.slice(1, 8);
    return letraCorrecta(numero, doc[8]) ? doc : null;
  }
  return FORMA_PASAPORTE.test(doc) ? doc : null;
}

// "Nombre y apellidos": al menos dos palabras.
export function nombreTieneApellidos(nombre: string): boolean {
  return nombre.trim().split(/\s+/).filter(Boolean).length >= 2;
}
