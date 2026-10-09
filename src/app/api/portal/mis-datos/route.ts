import { NextResponse } from "next/server";
import { crearClienteServicio } from "@/lib/supabaseServidor";
import { construirDatosEntrada, type Tabla } from "@/lib/entradaDatos";
import { consultaEntradas, empresasDelEmail, idEdicionActiva, sesionPortal } from "@/lib/portal";

export const runtime = "nodejs";

const TABLAS: Tabla[] = ["congreso", "gala", "excursion"];

// Todo lo que ve la persona en /portal/inicio, leído con el email de SU
// sesión. No acepta ningún parámetro del navegador.
export async function GET() {
  const sesion = await sesionPortal();
  if (!sesion) {
    return NextResponse.json({ error: "Sesión no encontrada." }, { status: 401 });
  }

  const supabase = crearClienteServicio();
  const edicionId = await idEdicionActiva(supabase);
  const { data: edicion } = edicionId
    ? await supabase.from("ediciones").select("nombre").eq("id", edicionId).maybeSingle()
    : { data: null };

  const entradas: {
    tabla: Tabla;
    id: string;
    nombre: string | null;
    evento: string;
    lugar: string;
    fechaHora: string;
    detalleLabel: string | null;
    detalleValor: string | null;
    generada: boolean;
  }[] = [];

  if (edicionId) {
    for (const tabla of TABLAS) {
      const { data: filas, error } = await consultaEntradas(supabase, tabla, edicionId, sesion.email);
      if (error) {
        console.error(`portal/mis-datos: fallo leyendo ${tabla}`, error.code, error.message);
        return NextResponse.json({ error: "No se pudieron cargar tus datos." }, { status: 500 });
      }
      for (const fila of (filas ?? []) as unknown as Record<string, unknown>[]) {
        const datos = await construirDatosEntrada(supabase, tabla, fila);
        entradas.push({
          tabla,
          id: fila.id as string,
          nombre: datos.nombreAsistente,
          evento: datos.evento,
          lugar: datos.lugar,
          fechaHora: datos.fechaHora,
          detalleLabel: datos.detalleLabel,
          detalleValor: datos.detalleValor,
          generada: Boolean(fila.qr_codigo),
        });
      }
    }
  }

  const empresas = edicionId ? await empresasDelEmail(supabase, edicionId, sesion.email) : [];

  return NextResponse.json(
    {
      email: sesion.email,
      edicionNombre: edicion?.nombre ?? null,
      entradas,
      empresas: empresas.map((e) => ({ empresa: e.empresa, categoria: e.categoria })),
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
