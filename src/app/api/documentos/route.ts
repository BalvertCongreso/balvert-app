import { NextResponse } from "next/server";
import { crearClienteServicio, usuarioDesdeCabecera } from "@/lib/supabaseServidor";
import { EMAIL_REGEX, empresasDelEmail, idEdicionActiva, normalizarEmail, tieneEntradas } from "@/lib/portal";
import { BUCKET_DOCUMENTOS, MAX_DESCRIPCION, MAX_TITULO, esDestino } from "@/lib/documentos";

export const runtime = "nodejs";

// Gestión interna de documentos (pantalla /documentos). La tabla documentos
// no tiene políticas RLS: solo se toca desde aquí con la clave de servicio,
// tras comprobar el login de Ariadna/Ariosto.

async function comprobarUsuario(req: Request) {
  return usuarioDesdeCabecera(req.headers.get("authorization"));
}
const sinSesion = () =>
  NextResponse.json({ error: "Sesión no encontrada. Vuelve a iniciar sesión." }, { status: 401 });

export async function GET(req: Request) {
  if (!(await comprobarUsuario(req))) return sinSesion();
  const supabase = crearClienteServicio();
  const edicionId = await idEdicionActiva(supabase);
  if (!edicionId) return NextResponse.json({ documentos: [] });

  const { data, error } = await supabase
    .from("documentos")
    .select("id, titulo, descripcion, nombre_archivo, destino, patrocinador_id, email_destinatario, creado, patrocinadores(empresa_entidad)")
    .eq("edicion_id", edicionId)
    .order("creado", { ascending: false });
  if (error) {
    return NextResponse.json({ error: "No se pudieron cargar los documentos: " + error.message }, { status: 500 });
  }
  return NextResponse.json({ documentos: data ?? [] });
}

// Crea un documento o, con "id", lo modifica (título, destino…) y, si llega
// una ruta nueva, reemplaza el archivo y borra el anterior.
export async function POST(req: Request) {
  if (!(await comprobarUsuario(req))) return sinSesion();
  const body = await req.json().catch(() => null);
  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Petición no válida." }, { status: 400 });
  }

  const id = typeof body.id === "string" ? body.id : null;
  const titulo = typeof body.titulo === "string" ? body.titulo.trim() : "";
  const descripcion = typeof body.descripcion === "string" ? body.descripcion.trim() : "";
  const destino = body.destino;
  const patrocinadorId = typeof body.patrocinador_id === "string" && body.patrocinador_id ? body.patrocinador_id : null;
  const ruta = typeof body.ruta_archivo === "string" ? body.ruta_archivo : null;
  const emailDestinatario = normalizarEmail(body.email_destinatario);

  if (!titulo || titulo.length > MAX_TITULO) {
    return NextResponse.json({ error: `Escribe un título (máximo ${MAX_TITULO} caracteres).` }, { status: 400 });
  }
  if (descripcion.length > MAX_DESCRIPCION) {
    return NextResponse.json({ error: `La descripción es demasiado larga (máximo ${MAX_DESCRIPCION}).` }, { status: 400 });
  }
  if (!esDestino(destino)) {
    return NextResponse.json({ error: "Elige a quién va el documento." }, { status: 400 });
  }
  if (destino === "patrocinador" && !patrocinadorId) {
    return NextResponse.json({ error: "Elige la empresa patrocinadora." }, { status: 400 });
  }
  if (destino === "asistente" && !EMAIL_REGEX.test(emailDestinatario)) {
    return NextResponse.json({ error: "Escribe el email de la persona." }, { status: 400 });
  }

  const supabase = crearClienteServicio();
  const edicionId = await idEdicionActiva(supabase);
  if (!edicionId) {
    return NextResponse.json({ error: "No hay ninguna edición activa." }, { status: 400 });
  }

  if (destino === "patrocinador") {
    const { data: patrocinador } = await supabase
      .from("patrocinadores")
      .select("id")
      .eq("id", patrocinadorId!)
      .eq("edicion_id", edicionId)
      .maybeSingle();
    if (!patrocinador) {
      return NextResponse.json({ error: "Esa empresa no está en la edición activa." }, { status: 400 });
    }
  }

  // Para evitar erratas: el email tiene que poder entrar en el portal (tener
  // entradas o ser contacto de un patrocinador en la edición activa).
  if (destino === "asistente") {
    const [conEntradas, empresas] = await Promise.all([
      tieneEntradas(supabase, edicionId, emailDestinatario),
      empresasDelEmail(supabase, edicionId, emailDestinatario),
    ]);
    if (!conEntradas && empresas.length === 0) {
      return NextResponse.json(
        { error: "Ese email no tiene entradas ni es contacto de un patrocinador en esta edición: no podría entrar al área de clientes para verlo. Revisa que esté bien escrito." },
        { status: 400 }
      );
    }
  }

  // La ruta solo puede ser una que haya preparado /api/documentos/subida
  // (carpeta de la edición activa) y el archivo tiene que estar subido.
  if (ruta) {
    if (!ruta.startsWith(`${edicionId}/`) || ruta.includes("..")) {
      return NextResponse.json({ error: "Archivo no válido." }, { status: 400 });
    }
    const { data: existe } = await supabase.storage.from(BUCKET_DOCUMENTOS).exists(ruta);
    if (!existe) {
      return NextResponse.json({ error: "El archivo no se ha subido. Inténtalo de nuevo." }, { status: 400 });
    }
  }

  const campos = {
    titulo,
    descripcion: descripcion || null,
    destino,
    patrocinador_id: destino === "patrocinador" ? patrocinadorId : null,
    email_destinatario: destino === "asistente" ? emailDestinatario : null,
    ...(ruta && { ruta_archivo: ruta, nombre_archivo: ruta.split("/").pop()! }),
  };

  if (!id) {
    if (!ruta) {
      return NextResponse.json({ error: "Falta el archivo." }, { status: 400 });
    }
    const { error } = await supabase.from("documentos").insert({ ...campos, edicion_id: edicionId });
    if (error) {
      await supabase.storage.from(BUCKET_DOCUMENTOS).remove([ruta]);
      return NextResponse.json({ error: "No se pudo guardar el documento: " + error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  const { data: anterior } = await supabase.from("documentos").select("ruta_archivo").eq("id", id).maybeSingle();
  if (!anterior) {
    return NextResponse.json({ error: "Documento no encontrado." }, { status: 404 });
  }
  const { error } = await supabase.from("documentos").update(campos).eq("id", id);
  if (error) {
    return NextResponse.json({ error: "No se pudo guardar el documento: " + error.message }, { status: 500 });
  }
  if (ruta && ruta !== anterior.ruta_archivo) {
    await supabase.storage.from(BUCKET_DOCUMENTOS).remove([anterior.ruta_archivo]);
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  if (!(await comprobarUsuario(req))) return sinSesion();
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Falta el id." }, { status: 400 });

  const supabase = crearClienteServicio();
  const { data: doc } = await supabase.from("documentos").select("ruta_archivo").eq("id", id).maybeSingle();
  if (!doc) return NextResponse.json({ error: "Documento no encontrado." }, { status: 404 });

  const { error } = await supabase.from("documentos").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: "No se pudo borrar: " + error.message }, { status: 500 });
  }
  await supabase.storage.from(BUCKET_DOCUMENTOS).remove([doc.ruta_archivo]);
  return NextResponse.json({ ok: true });
}
