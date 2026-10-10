import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { crearClienteServicio, usuarioDesdeCabecera } from "@/lib/supabaseServidor";
import {
  BUCKET_ARCHIVOS_PATROCINADOR,
  TAMANO_MAXIMO_ARCHIVO,
  TIPO_POR_EXTENSION,
  extensionDe,
  sanearNombre,
} from "@/lib/patrocinadorArchivos";

export const runtime = "nodejs";

// Prepara la subida de un archivo a la ficha de un patrocinador: devuelve una
// URL firmada de un solo uso con la que el navegador sube el archivo
// directamente al bucket privado (así no pasa por Vercel, que corta las
// peticiones de más de 4,5 MB), y el tipo con el que debe subirlo.
export async function POST(req: Request) {
  const usuario = await usuarioDesdeCabecera(req.headers.get("authorization"));
  if (!usuario) {
    return NextResponse.json({ error: "Sesión no encontrada. Vuelve a iniciar sesión." }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const patrocinadorId = typeof body?.patrocinador_id === "string" ? body.patrocinador_id : "";
  const nombre = typeof body?.nombre === "string" ? body.nombre : "";
  const tamano = typeof body?.tamano === "number" ? body.tamano : 0;

  const tipo = TIPO_POR_EXTENSION[extensionDe(nombre)];
  if (!tipo) {
    return NextResponse.json(
      { error: "Solo se pueden subir PDF, imágenes (PNG, JPG, WEBP, SVG) o archivos de diseño (AI, EPS)." },
      { status: 400 }
    );
  }
  if (tamano <= 0 || tamano > TAMANO_MAXIMO_ARCHIVO) {
    return NextResponse.json({ error: "El archivo pesa demasiado (máximo 50 MB)." }, { status: 400 });
  }

  const supabase = crearClienteServicio();
  const { data: patrocinador } = await supabase
    .from("patrocinadores")
    .select("id")
    .eq("id", patrocinadorId)
    .maybeSingle();
  if (!patrocinador) {
    return NextResponse.json({ error: "Patrocinador no encontrado." }, { status: 404 });
  }

  const ruta = `${patrocinador.id}/${randomUUID()}/${sanearNombre(nombre)}`;
  const { data, error } = await supabase.storage
    .from(BUCKET_ARCHIVOS_PATROCINADOR)
    .createSignedUploadUrl(ruta);
  if (error || !data) {
    return NextResponse.json({ error: "No se pudo preparar la subida: " + (error?.message ?? "") }, { status: 502 });
  }
  return NextResponse.json({ ruta: data.path, token: data.token, tipo });
}
