import { NextResponse } from "next/server";
import { crearClienteServicio } from "@/lib/supabaseServidor";
import { construirImagenEntrada } from "@/lib/entradaImagen";
import { NOMBRE_TABLA_SQL, construirDatosEntrada, type Tabla } from "@/lib/entradaDatos";
import { consultaEntradas, idEdicionActiva, sesionPortal } from "@/lib/portal";

export const runtime = "nodejs";

// Imagen PNG de una entrada (QR incluido) para el portal. Reutiliza la misma
// generación que /api/entradas/imagen, pero la fila se busca con el email de
// la sesión además del id: con el id de una entrada ajena no devuelve nada.
export async function GET(req: Request) {
  const sesion = await sesionPortal();
  if (!sesion) {
    return NextResponse.json({ error: "Sesión no encontrada." }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const tabla = searchParams.get("tabla") as Tabla | null;
  const id = searchParams.get("id");
  const descargar = searchParams.get("descargar") === "1";
  if (!tabla || !Object.hasOwn(NOMBRE_TABLA_SQL, tabla) || !id) {
    return NextResponse.json({ error: "Faltan datos (tabla o id)." }, { status: 400 });
  }

  const supabase = crearClienteServicio();
  const edicionId = await idEdicionActiva(supabase);
  const noEncontrada = NextResponse.json({ error: "Entrada no encontrada." }, { status: 404 });
  if (!edicionId) return noEncontrada;

  const { data, error } = await consultaEntradas(supabase, tabla, edicionId, sesion.email)
    .eq("id", id)
    .maybeSingle();
  const fila = data as unknown as Record<string, unknown> | null;
  // Un id con formato no válido hace fallar la consulta: mismo 404.
  if (error || !fila || !fila.qr_codigo) return noEncontrada;

  const datos = await construirDatosEntrada(supabase, tabla, fila);
  const png = await construirImagenEntrada(datos);

  return new NextResponse(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": `${descargar ? "attachment" : "inline"}; filename="entrada-${tabla}-${fila.qr_codigo}.png"`,
      "Cache-Control": "private, no-store",
    },
  });
}
