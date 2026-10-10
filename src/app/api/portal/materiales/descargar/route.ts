import { NextResponse } from "next/server";
import { crearClienteServicio } from "@/lib/supabaseServidor";
import { empresasDelEmail, sesionPortal } from "@/lib/portal";
import { BUCKET_ARCHIVOS_PATROCINADOR } from "@/lib/patrocinadorArchivos";
import { edicionMaterial } from "@/lib/portalMateriales";

export const runtime = "nodejs";

// Descarga desde el portal de un archivo de la ficha: solo de SUS empresas, y
// solo lo que subió la empresa o lo que el equipo marcó como visible. URL
// firmada de 60 s forzada como descarga (un SVG nunca se abre como página).
export async function GET(req: Request) {
  const sesion = await sesionPortal();
  if (!sesion) return NextResponse.json({ error: "Sesión no encontrada." }, { status: 401 });
  const id = new URL(req.url).searchParams.get("id");
  const noEncontrado = NextResponse.json({ error: "Archivo no encontrado." }, { status: 404 });
  if (!id) return noEncontrado;

  const supabase = crearClienteServicio();
  const edicion = await edicionMaterial(supabase);
  if (!edicion) return noEncontrado;
  const ids = (await empresasDelEmail(supabase, edicion.id, sesion.email)).map((e) => e.id);
  if (ids.length === 0) return noEncontrado;

  const { data: archivo } = await supabase
    .from("patrocinador_archivos")
    .select("ruta_archivo, nombre_archivo")
    .eq("id", id)
    .in("patrocinador_id", ids)
    .or("origen.eq.patrocinador,visible_empresa.eq.true")
    .maybeSingle();
  if (!archivo) return noEncontrado;

  const { data, error } = await supabase.storage
    .from(BUCKET_ARCHIVOS_PATROCINADOR)
    .createSignedUrl(archivo.ruta_archivo, 60, { download: archivo.nombre_archivo });
  if (error || !data) return NextResponse.json({ error: "No se pudo preparar la descarga." }, { status: 502 });
  return NextResponse.redirect(data.signedUrl, { status: 303, headers: { "Cache-Control": "no-store" } });
}
