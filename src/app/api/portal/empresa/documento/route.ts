import { NextResponse } from "next/server";
import { crearClienteServicio } from "@/lib/supabaseServidor";
import { BUCKET_DOCUMENTOS } from "@/lib/documentos";
import { documentosEmpresa, idEdicionActiva } from "@/lib/portal";
import { sesionEmpresa } from "@/lib/portalEmpresa";

export const runtime = "nodejs";

// Descarga de un documento desde la zona de empresa: solo si está entre los
// de SU empresa o los de todos los patrocinadores. URL firmada de 60 s.
export async function GET(req: Request) {
  const sesion = await sesionEmpresa();
  if (!sesion) return NextResponse.json({ error: "Sesión no encontrada." }, { status: 401 });
  const id = new URL(req.url).searchParams.get("id");
  const noEncontrado = NextResponse.json({ error: "Documento no encontrado." }, { status: 404 });
  if (!id) return noEncontrado;

  const supabase = crearClienteServicio();
  const edicionId = await idEdicionActiva(supabase);
  if (!edicionId) return noEncontrado;
  const documento = (await documentosEmpresa(supabase, edicionId, sesion.patrocinadorId)).find((d) => d.id === id);
  if (!documento) return noEncontrado;

  const { data, error } = await supabase.storage
    .from(BUCKET_DOCUMENTOS)
    .createSignedUrl(documento.ruta_archivo, 60, { download: documento.nombre_archivo });
  if (error || !data) return NextResponse.json({ error: "No se pudo preparar la descarga." }, { status: 502 });
  return NextResponse.redirect(data.signedUrl, { status: 303, headers: { "Cache-Control": "no-store" } });
}
