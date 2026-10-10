import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { crearClienteServicio, usuarioDesdeCabecera } from "@/lib/supabaseServidor";
import { BUCKET_CERTIFICADOS } from "@/lib/certificado";

export const runtime = "nodejs";

// Firma e imagen de cabecera del certificado de una edición, en el bucket
// privado "certificados" (solo el servidor lo lee). Solo panel interno.
//   POST   → prepara la subida (URL firmada de un solo uso)
//   PUT    → la confirma: guarda la ruta en la edición y borra la anterior
//   GET    → URL firmada de 60 s para ver la imagen actual
//   DELETE → la quita

const COLUMNA = { firma: "certificado_firma_ruta", imagen: "certificado_imagen_ruta" } as const;
type TipoImagen = keyof typeof COLUMNA;
const TIPOS_MIME: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg" };
const TAMANO_MAXIMO = 5 * 1024 * 1024;

const esTipo = (v: unknown): v is TipoImagen => v === "firma" || v === "imagen";
const sinSesion = () =>
  NextResponse.json({ error: "Sesión no encontrada. Vuelve a iniciar sesión." }, { status: 401 });

async function edicionExiste(edicionId: unknown) {
  if (typeof edicionId !== "string" || !edicionId) return null;
  const supabase = crearClienteServicio();
  const { data } = await supabase
    .from("ediciones")
    .select("id, certificado_firma_ruta, certificado_imagen_ruta")
    .eq("id", edicionId)
    .maybeSingle();
  return data;
}

export async function POST(req: Request) {
  if (!(await usuarioDesdeCabecera(req.headers.get("authorization")))) return sinSesion();
  const body = await req.json().catch(() => null);
  const nombre = typeof body?.nombre === "string" ? body.nombre : "";
  const tamano = typeof body?.tamano === "number" ? body.tamano : 0;
  const extension = /\.([a-z0-9]+)$/i.exec(nombre)?.[1]?.toLowerCase() ?? "";
  const tipoMime = TIPOS_MIME[extension];
  if (!esTipo(body?.tipo)) return NextResponse.json({ error: "Tipo de imagen no válido." }, { status: 400 });
  if (!tipoMime) return NextResponse.json({ error: "Solo se pueden subir imágenes PNG o JPG." }, { status: 400 });
  if (tamano <= 0 || tamano > TAMANO_MAXIMO) {
    return NextResponse.json({ error: "La imagen pesa demasiado (máximo 5 MB)." }, { status: 400 });
  }
  const edicion = await edicionExiste(body?.edicion_id);
  if (!edicion) return NextResponse.json({ error: "Edición no encontrada." }, { status: 404 });

  const ruta = `${edicion.id}/${body.tipo}-${randomUUID()}.${extension === "jpeg" ? "jpg" : extension}`;
  const { data, error } = await crearClienteServicio().storage.from(BUCKET_CERTIFICADOS).createSignedUploadUrl(ruta);
  if (error || !data) {
    return NextResponse.json({ error: "No se pudo preparar la subida: " + (error?.message ?? "") }, { status: 502 });
  }
  return NextResponse.json({ ruta: data.path, token: data.token, tipo: tipoMime });
}

export async function PUT(req: Request) {
  if (!(await usuarioDesdeCabecera(req.headers.get("authorization")))) return sinSesion();
  const body = await req.json().catch(() => null);
  const ruta = typeof body?.ruta === "string" ? body.ruta : "";
  if (!esTipo(body?.tipo)) return NextResponse.json({ error: "Tipo de imagen no válido." }, { status: 400 });
  const edicion = await edicionExiste(body?.edicion_id);
  if (!edicion) return NextResponse.json({ error: "Edición no encontrada." }, { status: 404 });
  // Solo una ruta de la carpeta de esta edición y de este tipo, ya subida.
  const valida = new RegExp(`^${edicion.id}/${body.tipo}-[0-9a-f-]{36}\\.(png|jpg)$`).test(ruta);
  const supabase = crearClienteServicio();
  const bucket = supabase.storage.from(BUCKET_CERTIFICADOS);
  if (!valida || !(await bucket.exists(ruta)).data) {
    return NextResponse.json({ error: "La imagen no se ha subido. Inténtalo de nuevo." }, { status: 400 });
  }
  const columna = COLUMNA[body.tipo as TipoImagen];
  const anterior = edicion[columna];
  const { error } = await supabase.from("ediciones").update({ [columna]: ruta }).eq("id", edicion.id);
  if (error) return NextResponse.json({ error: "No se pudo guardar: " + error.message }, { status: 500 });
  if (anterior && anterior !== ruta) await bucket.remove([anterior]);
  return NextResponse.json({ ok: true });
}

export async function GET(req: Request) {
  if (!(await usuarioDesdeCabecera(req.headers.get("authorization")))) return sinSesion();
  const params = new URL(req.url).searchParams;
  const tipo = params.get("tipo");
  if (!esTipo(tipo)) return NextResponse.json({ error: "Tipo de imagen no válido." }, { status: 400 });
  const edicion = await edicionExiste(params.get("edicion_id"));
  if (!edicion) return NextResponse.json({ error: "Edición no encontrada." }, { status: 404 });
  const ruta = edicion[COLUMNA[tipo]];
  if (!ruta) return NextResponse.json({ url: null });
  const { data } = await crearClienteServicio().storage.from(BUCKET_CERTIFICADOS).createSignedUrl(ruta, 60);
  return NextResponse.json({ url: data?.signedUrl ?? null });
}

export async function DELETE(req: Request) {
  if (!(await usuarioDesdeCabecera(req.headers.get("authorization")))) return sinSesion();
  const params = new URL(req.url).searchParams;
  const tipo = params.get("tipo");
  if (!esTipo(tipo)) return NextResponse.json({ error: "Tipo de imagen no válido." }, { status: 400 });
  const edicion = await edicionExiste(params.get("edicion_id"));
  if (!edicion) return NextResponse.json({ error: "Edición no encontrada." }, { status: 404 });
  const ruta = edicion[COLUMNA[tipo]];
  const supabase = crearClienteServicio();
  const { error } = await supabase.from("ediciones").update({ [COLUMNA[tipo]]: null }).eq("id", edicion.id);
  if (error) return NextResponse.json({ error: "No se pudo quitar: " + error.message }, { status: 500 });
  if (ruta) await supabase.storage.from(BUCKET_CERTIFICADOS).remove([ruta]);
  return NextResponse.json({ ok: true });
}
