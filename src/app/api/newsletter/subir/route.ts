import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { usuarioDesdeCabecera, crearClienteServicio } from "@/lib/supabaseServidor";

const BUCKET = "newsletter-media";
const TAMANO_MAXIMO = 10 * 1024 * 1024; // 10MB

export async function POST(req: Request) {
  const usuario = await usuarioDesdeCabecera(req.headers.get("authorization"));
  if (!usuario) {
    return NextResponse.json({ error: "Sesión no encontrada. Vuelve a iniciar sesión." }, { status: 401 });
  }

  const formData = await req.formData();
  const archivo = formData.get("archivo") as File | null;
  if (!archivo) {
    return NextResponse.json({ error: "Falta el archivo." }, { status: 400 });
  }
  if (archivo.size > TAMANO_MAXIMO) {
    return NextResponse.json({ error: "El archivo pesa demasiado (máximo 10MB)." }, { status: 400 });
  }

  const extension = archivo.name.includes(".") ? archivo.name.split(".").pop() : "";
  const nombreArchivo = `${randomUUID()}${extension ? "." + extension : ""}`;

  const supabase = crearClienteServicio();
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(nombreArchivo, archivo, { contentType: archivo.type || undefined });

  if (error) {
    return NextResponse.json({ error: "No se pudo subir el archivo: " + error.message }, { status: 502 });
  }

  const { data: publica } = supabase.storage.from(BUCKET).getPublicUrl(nombreArchivo);

  return NextResponse.json({ url: publica.publicUrl, nombre: archivo.name });
}
