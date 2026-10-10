import { NextResponse } from "next/server";
import { crearClienteServicio, usuarioDesdeCabecera } from "@/lib/supabaseServidor";
import { BUCKET_DOCUMENTOS } from "@/lib/documentos";

export const runtime = "nodejs";

// URL firmada de 60 segundos para abrir un documento desde la pantalla
// interna /documentos.
export async function GET(req: Request) {
  const usuario = await usuarioDesdeCabecera(req.headers.get("authorization"));
  if (!usuario) {
    return NextResponse.json({ error: "Sesión no encontrada. Vuelve a iniciar sesión." }, { status: 401 });
  }
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Falta el id." }, { status: 400 });

  const supabase = crearClienteServicio();
  const { data: doc } = await supabase.from("documentos").select("ruta_archivo").eq("id", id).maybeSingle();
  if (!doc) return NextResponse.json({ error: "Documento no encontrado." }, { status: 404 });

  const { data, error } = await supabase.storage.from(BUCKET_DOCUMENTOS).createSignedUrl(doc.ruta_archivo, 60);
  if (error || !data) {
    return NextResponse.json({ error: "No se pudo abrir el documento." }, { status: 502 });
  }
  return NextResponse.json({ url: data.signedUrl });
}
