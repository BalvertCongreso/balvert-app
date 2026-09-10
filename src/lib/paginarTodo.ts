// Supabase (PostgREST) nunca devuelve más de 1000 filas de golpe, ni aunque
// se pida un rango mayor con .range() — hay que pedirlo por bloques. Este
// helper repite la consulta avanzando el rango hasta agotar los resultados.
const TAMANO_PAGINA = 1000;

export async function obtenerTodasLasFilas<T>(
  construirConsulta: (
    desde: number,
    hasta: number
  ) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>
): Promise<T[]> {
  const todas: T[] = [];
  let desde = 0;
  for (;;) {
    const { data, error } = await construirConsulta(desde, desde + TAMANO_PAGINA - 1);
    if (error) throw new Error(error.message);
    const filas = data ?? [];
    todas.push(...filas);
    if (filas.length < TAMANO_PAGINA) break;
    desde += TAMANO_PAGINA;
  }
  return todas;
}
