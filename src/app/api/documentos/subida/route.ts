import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { crearClienteServicio, usuarioDesdeCabecera } from "@/lib/supabaseServidor";
import { idEdicionActiva } from "@/lib/portal";
import {
  BUCKET_DOCUMENTOS,
  TAMANO_MAXIMO_DOCUMENTO,
  TIPOS_DOCUMENTO_PERMITIDOS,
  sanearNombreArchivo,
} from "@/lib/documentos";

export const runtime = "nodejs";

// Prepara la subida de un documento (pantalla interna /documentos): devuelve
// una URL firmada de un solo uso con la que el navegador sube el archivo
// directamente al bucket privado. Así el archivo no pasa por Vercel, que
// corta las peticiones de más de 4,5 MB.
export async function POST(req: Request) {
  const usuario = await usuarioDesdeCabecera(req.headers.get("authorization"));
  if (!usuario) {
    return NextResponse.json({ error: "Sesión no encontrada. Vuelve a iniciar sesión." }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const nombre = typeof body?.nombre === "string" ? body.nombre : "";
  const tipo = typeof body?.tipo === "string" ? body.tipo : "";
  const tamano = typeof body?.tamano === "number" ? body.tamano : 0;

  if (!TIPOS_DOCUMENTO_PERMITIDOS[tipo]) {
    return NextResponse.json({ error: "Solo se pueden subir PDF o imágenes (PNG, JPG, WEBP)." }, { status: 400 });
  }
  if (tamano <= 0 || tamano > TAMANO_MAXIMO_DOCUMENTO) {
    return NextResponse.json({ error: "El archivo pesa demasiado (máximo 20 MB)." }, { status: 400 });
  }

  const supabase = crearClienteServicio();
  const edicionId = await idEdicionActiva(supabase);
  if (!edicionId) {
    return NextResponse.json({ error: "No hay ninguna edición activa." }, { status: 400 });
  }

  const ruta = `${edicionId}/${randomUUID()}/${sanearNombreArchivo(nombre, tipo)}`;
  const { data, error } = await supabase.storage.from(BUCKET_DOCUMENTOS).createSignedUploadUrl(ruta);
  if (error || !data) {
    return NextResponse.json({ error: "No se pudo preparar la subida: " + (error?.message ?? "") }, { status: 502 });
  }

  return NextResponse.json({ ruta: data.path, token: data.token });
}
