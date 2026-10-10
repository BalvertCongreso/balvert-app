import { NextResponse } from "next/server";
import { crearClienteServidor } from "@/lib/supabaseServidor";
import { construirImagenEntrada } from "@/lib/entradaImagen";
import { NOMBRE_TABLA_SQL, construirDatosEntrada, type Tabla } from "@/lib/entradaDatos";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const tabla = searchParams.get("tabla") as Tabla | null;
  const id = searchParams.get("id");

  if (!tabla || !NOMBRE_TABLA_SQL[tabla] || !id) {
    return NextResponse.json({ error: "Faltan datos (tabla o id)." }, { status: 400 });
  }

  const authHeader = req.headers.get("authorization");
  if (!authHeader) {
    return NextResponse.json({ error: "Sesión no encontrada." }, { status: 401 });
  }

  const supabase = crearClienteServidor(authHeader);

  const { data: fila, error } = await supabase
    .from(NOMBRE_TABLA_SQL[tabla])
    .select("*")
    .eq("id", id)
    .single();

  // Token caducado o no válido: PostgREST responde con códigos PGRST3xx /
  // mensajes "JWT …". Se distingue para que la pantalla pueda decir
  // "vuelve a iniciar sesión" en vez de "no se ha generado".
  if (error && (error.code?.startsWith("PGRST3") || /jwt/i.test(error.message))) {
    return NextResponse.json({ error: "Sesión caducada." }, { status: 401 });
  }

  if (error || !fila || !fila.qr_codigo) {
    return NextResponse.json({ error: "Esta entrada todavía no se ha generado." }, { status: 404 });
  }

  const datos = await construirDatosEntrada(supabase, tabla, fila);
  const png = await construirImagenEntrada(datos);

  return new NextResponse(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": `inline; filename="entrada-${tabla}-${fila.qr_codigo}.png"`,
      "Cache-Control": "no-store",
    },
  });
}
