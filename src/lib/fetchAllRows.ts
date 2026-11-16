/**
 * Supabase (PostgREST) devuelve como máximo 1000 filas por consulta. Para
 * operaciones que necesitan TODAS las filas (descargar todo, borrar todo) hay
 * que pedirlas por páginas; una consulta sin rango se trunca sin avisar.
 */
export const SUPABASE_MAX_ROWS = 1000;

export type RowsPage<T> = { data: T[] | null; error: unknown };

/**
 * Recorre todas las páginas de una consulta. `fetchPage` debe aplicar un orden
 * estable (con desempate por `id`) y `.range(from, to)`.
 */
export const fetchAllRows = async <T,>(
  fetchPage: (from: number, to: number) => PromiseLike<RowsPage<T>>,
) => {
  const rows: T[] = [];
  for (let from = 0; ; from += SUPABASE_MAX_ROWS) {
    const { data, error } = await fetchPage(from, from + SUPABASE_MAX_ROWS - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < SUPABASE_MAX_ROWS) return rows;
  }
};
