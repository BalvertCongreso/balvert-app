import { NextResponse } from "next/server";
import { crearClienteServicio, crearClienteServidor, usuarioDesdeCabecera } from "@/lib/supabaseServidor";
import { borrarCarpetaPatrocinador } from "@/lib/patrocinadorArchivos";

export const runtime = "nodejs";

// Borra un patrocinador y sus archivos internos. La base de datos borra sola
// las filas de patrocinador_archivos (on delete cascade), pero los ficheros
// del bucket solo se pueden borrar con la API de Storage: por eso el borrado
// pasa por aquí y no directamente desde el navegador.
export async function DELETE(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (!(await usuarioDesdeCabecera(authHeader))) {
    return NextResponse.json({ error: "Sesión no encontrada. Vuelve a iniciar sesión." }, { status: 401 });
  }
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Falta el id." }, { status: 400 });

  // Con la sesión de quien borra (no con la clave de servicio), para que el
  // historial de cambios lo apunte a su nombre.
  const { data, error } = await crearClienteServidor(authHeader)
    .from("patrocinadores")
    .delete()
    .eq("id", id)
    .select("id");
  if (error) {
    return NextResponse.json({ error: "No se pudo eliminar: " + error.message }, { status: 500 });
  }
  if (!data || data.length === 0) {
    return NextResponse.json({ error: "Patrocinador no encontrado." }, { status: 404 });
  }

  await borrarCarpetaPatrocinador(crearClienteServicio(), id);
  return NextResponse.json({ ok: true });
}
