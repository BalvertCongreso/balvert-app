import { NextResponse } from "next/server";
import { crearClienteServicio } from "@/lib/supabaseServidor";
import { construirImagenEntrada } from "@/lib/entradaImagen";
import { NOMBRE_TABLA_SQL, construirDatosEntrada, type Tabla } from "@/lib/entradaDatos";
import { TIPO_ACCESO_INVITADO, TIPO_ENTRADA_INCLUIDA } from "@/lib/invitados";
import { sesionEmpresa } from "@/lib/portalEmpresa";

export const runtime = "nodejs";

// Descarga de la entrada (PNG con el QR) de un invitado de SU empresa, para
// que la empresa pueda repartirlas. La misma imagen que ve el invitado. Solo
// filas de invitados de la empresa de la sesión, y ya generadas.
const COLUMNAS: Record<Tabla, string> = {
  congreso: "id, nombre, tipo_acceso, empresa_entidad, categoria_patrocinio, edicion_id, qr_codigo",
  gala: "id, nombre_asistente, menu, empresa_entidad, categoria_patrocinio, edicion_id, qr_codigo",
  excursion: "id, nombre_asistente, tipo_entrada, empresa_entidad, categoria_patrocinio, edicion_id, qr_codigo",
};

export async function GET(req: Request) {
  const sesion = await sesionEmpresa();
  if (!sesion) return NextResponse.json({ error: "Sesión no encontrada." }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const tabla = searchParams.get("tabla") as Tabla | null;
  const id = searchParams.get("id");
  if (!tabla || !Object.hasOwn(NOMBRE_TABLA_SQL, tabla) || !id) {
    return NextResponse.json({ error: "Faltan datos (tabla o id)." }, { status: 400 });
  }
  const supabase = crearClienteServicio();
  let consulta = supabase
    .from(NOMBRE_TABLA_SQL[tabla])
    .select(COLUMNAS[tabla])
    .eq("id", id)
    .eq("empresa_entidad", sesion.patrocinadorId);
  consulta = tabla === "congreso" ? consulta.eq("tipo_acceso", TIPO_ACCESO_INVITADO) : consulta.eq("tipo_entrada", TIPO_ENTRADA_INCLUIDA);
  const { data, error } = await consulta.maybeSingle();
  const fila = data as unknown as Record<string, unknown> | null;
  if (error || !fila || !fila.qr_codigo) return NextResponse.json({ error: "Entrada no encontrada." }, { status: 404 });

  const png = await construirImagenEntrada(await construirDatosEntrada(supabase, tabla, fila));
  return new NextResponse(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": `attachment; filename="entrada-${tabla}-${fila.qr_codigo}.png"`,
      "Cache-Control": "private, no-store",
    },
  });
}
