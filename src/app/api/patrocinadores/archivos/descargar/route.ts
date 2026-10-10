import { NextResponse } from "next/server";
import { crearClienteServicio, usuarioDesdeCabecera } from "@/lib/supabaseServidor";
import { BUCKET_ARCHIVOS_PATROCINADOR } from "@/lib/patrocinadorArchivos";

export const runtime = "nodejs";

// URL firmada de 60 segundos para descargar un archivo de la ficha de un
// patrocinador. Siempre como descarga (Content-Disposition: attachment), para
// que un SVG nunca se abra como página dentro del navegador.
export async function GET(req: Request) {
  if (!(await usuarioDesdeCabecera(req.headers.get("authorization")))) {
    return NextResponse.json({ error: "Sesión no encontrada. Vuelve a iniciar sesión." }, { status: 401 });
  }
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Falta el id." }, { status: 400 });

  const supabase = crearClienteServicio();
  const { data: archivo } = await supabase
    .from("patrocinador_archivos")
    .select("ruta_archivo, nombre_archivo")
    .eq("id", id)
    .maybeSingle();
  if (!archivo) return NextResponse.json({ error: "Archivo no encontrado." }, { status: 404 });

  const { data, error } = await supabase.storage
    .from(BUCKET_ARCHIVOS_PATROCINADOR)
    .createSignedUrl(archivo.ruta_archivo, 60, { download: archivo.nombre_archivo });
  if (error || !data) {
    return NextResponse.json({ error: "No se pudo preparar la descarga." }, { status: 502 });
  }
  return NextResponse.json({ url: data.signedUrl });
}
