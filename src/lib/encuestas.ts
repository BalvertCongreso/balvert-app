// Cuestionarios de satisfacción (Fase 8): tipos, preguntas de partida y
// validación de respuestas. Lo usan el panel, la página pública
// /encuesta/<token> y las rutas del servidor (sin nada de Node aquí).

export type Publico = "asistentes" | "patrocinadores";
export const PUBLICOS: Publico[] = ["asistentes", "patrocinadores"];
export const NOMBRE_PUBLICO: Record<Publico, string> = {
  asistentes: "Asistentes",
  patrocinadores: "Patrocinadores",
};

export function esPublico(valor: unknown): valor is Publico {
  return valor === "asistentes" || valor === "patrocinadores";
}

export type TipoPregunta = "escala_1_5" | "si_no_quiza" | "opcion_unica" | "texto";
export const TIPOS_PREGUNTA: { valor: TipoPregunta; etiqueta: string }[] = [
  { valor: "escala_1_5", etiqueta: "Puntuación del 1 al 5" },
  { valor: "si_no_quiza", etiqueta: "Sí / No / Quizá" },
  { valor: "opcion_unica", etiqueta: "Elegir una opción" },
  { valor: "texto", etiqueta: "Texto libre" },
];

export const OPCIONES_SI_NO_QUIZA = ["Sí", "No", "Quizá"];

export interface Pregunta {
  id?: string;
  texto: string;
  tipo: TipoPregunta;
  opciones: string[] | null;
  obligatoria: boolean;
}

export interface Encuesta {
  id: string;
  edicion_id: string;
  publico: Publico;
  titulo: string;
  introduccion: string | null;
  enviada_en: string | null;
  recordatorio_pedido_en: string | null;
  cerrada: boolean;
}

export type ValorRespuesta = number | string;
export type Respuestas = Record<string, ValorRespuesta>;

export const MAX_TITULO = 150;
export const MAX_INTRODUCCION = 2000;
export const MAX_TEXTO_PREGUNTA = 300;
export const MAX_OPCIONES = 12;
export const MAX_TEXTO_OPCION = 100;
export const MAX_PREGUNTAS = 40;
export const MAX_TEXTO_RESPUESTA = 3000;

// ---------- Preguntas de partida ----------

const escala = (texto: string): Pregunta => ({ texto, tipo: "escala_1_5", opciones: null, obligatoria: true });
const siNo = (texto: string): Pregunta => ({ texto, tipo: "si_no_quiza", opciones: null, obligatoria: true });
const libre = (texto: string): Pregunta => ({ texto, tipo: "texto", opciones: null, obligatoria: false });

export const ENCUESTA_INICIAL: Record<Publico, { titulo: string; introduccion: string; preguntas: Pregunta[] }> = {
  asistentes: {
    titulo: "Cuestionario de satisfacción — BALVERT 2027",
    introduccion:
      "Gracias por acompañarnos en el Congreso. Tu opinión nos ayuda a preparar una próxima edición todavía mejor: son solo un par de minutos.",
    preguntas: [
      escala("Valoración general del congreso"),
      escala("Organización y logística"),
      escala("Calidad de las ponencias"),
      escala("Interés de las mesas redondas"),
      escala("Sede e instalaciones"),
      escala("Cafés y comida"),
      escala("Compra de entradas, acceso y check-in"),
      siNo("¿Volverías a la próxima edición?"),
      libre("¿Qué temas te gustaría que se trataran en la próxima edición?"),
      libre("Comentarios y sugerencias"),
    ],
  },
  patrocinadores: {
    titulo: "Cuestionario de satisfacción para patrocinadores — BALVERT 2027",
    introduccion:
      "Gracias por patrocinar el Congreso. Nos gustaría conocer vuestra experiencia para mejorar en la próxima edición: son solo un par de minutos.",
    preguntas: [
      escala("Valoración general como patrocinador"),
      escala("Visibilidad de vuestra marca"),
      escala("Ubicación del mostrador"),
      escala("Calidad de los contactos y del público asistente"),
      escala("Atención de la organización antes y durante el congreso"),
      escala("Relación entre lo que incluye el patrocinio y su precio"),
      siNo("¿Patrocinaríais la próxima edición?"),
      libre("¿Qué mejoraríais?"),
      libre("Comentarios"),
    ],
  },
};

// ---------- Validación ----------

// Limpia y valida la lista de preguntas que manda el panel. Devuelve el
// mensaje de error o la lista lista para guardar.
export function validarPreguntas(entrada: unknown): { error: string } | { preguntas: Pregunta[] } {
  if (!Array.isArray(entrada)) return { error: "Lista de preguntas no válida." };
  if (entrada.length === 0) return { error: "El cuestionario necesita al menos una pregunta." };
  if (entrada.length > MAX_PREGUNTAS) return { error: `Como máximo ${MAX_PREGUNTAS} preguntas.` };
  const preguntas: Pregunta[] = [];
  for (const [i, p] of entrada.entries()) {
    const n = i + 1;
    if (typeof p !== "object" || p === null) return { error: `Pregunta ${n} no válida.` };
    const texto = typeof p.texto === "string" ? p.texto.trim() : "";
    if (!texto) return { error: `Escribe el texto de la pregunta ${n}.` };
    if (texto.length > MAX_TEXTO_PREGUNTA) return { error: `La pregunta ${n} es demasiado larga (máximo ${MAX_TEXTO_PREGUNTA}).` };
    if (!TIPOS_PREGUNTA.some((t) => t.valor === p.tipo)) return { error: `Elige el tipo de la pregunta ${n}.` };
    let opciones: string[] | null = null;
    if (p.tipo === "opcion_unica") {
      const lista: string[] = Array.isArray(p.opciones)
        ? p.opciones.filter((o: unknown): o is string => typeof o === "string").map((o: string) => o.trim()).filter(Boolean)
        : [];
      if (lista.length < 2) return { error: `La pregunta ${n} necesita al menos dos opciones.` };
      if (lista.length > MAX_OPCIONES) return { error: `La pregunta ${n} tiene demasiadas opciones (máximo ${MAX_OPCIONES}).` };
      if (lista.some((o) => o.length > MAX_TEXTO_OPCION)) return { error: `Alguna opción de la pregunta ${n} es demasiado larga.` };
      if (new Set(lista).size !== lista.length) return { error: `La pregunta ${n} tiene opciones repetidas.` };
      opciones = lista;
    }
    preguntas.push({ texto, tipo: p.tipo, opciones, obligatoria: p.obligatoria === true });
  }
  return { preguntas };
}

export function opcionesDe(p: Pregunta): string[] {
  if (p.tipo === "si_no_quiza") return OPCIONES_SI_NO_QUIZA;
  if (p.tipo === "opcion_unica") return p.opciones ?? [];
  return [];
}

// Comprueba las respuestas contra las preguntas (en el navegador y otra vez
// en el servidor). Devuelve los errores por id de pregunta y las respuestas
// limpias (solo las de preguntas que existen, sin vacías).
export function validarRespuestas(
  preguntas: (Pregunta & { id: string })[],
  entrada: unknown
): { errores: Record<string, string>; limpias: Respuestas } {
  const datos = typeof entrada === "object" && entrada !== null ? (entrada as Record<string, unknown>) : {};
  const errores: Record<string, string> = {};
  const limpias: Respuestas = {};
  for (const p of preguntas) {
    const bruto = datos[p.id];
    const vacio = bruto === undefined || bruto === null || (typeof bruto === "string" && bruto.trim() === "");
    if (vacio) {
      if (p.obligatoria) errores[p.id] = "Esta pregunta es obligatoria.";
      continue;
    }
    if (p.tipo === "escala_1_5") {
      if (typeof bruto !== "number" || !Number.isInteger(bruto) || bruto < 1 || bruto > 5) {
        errores[p.id] = "Elige una puntuación del 1 al 5.";
        continue;
      }
      limpias[p.id] = bruto;
    } else if (p.tipo === "texto") {
      if (typeof bruto !== "string") {
        errores[p.id] = "Respuesta no válida.";
        continue;
      }
      if (bruto.length > MAX_TEXTO_RESPUESTA) {
        errores[p.id] = `Como máximo ${MAX_TEXTO_RESPUESTA} caracteres.`;
        continue;
      }
      limpias[p.id] = bruto.trim();
    } else {
      if (typeof bruto !== "string" || !opcionesDe(p).includes(bruto)) {
        errores[p.id] = "Elige una de las opciones.";
        continue;
      }
      limpias[p.id] = bruto;
    }
  }
  return { errores, limpias };
}
