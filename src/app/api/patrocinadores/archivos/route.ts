import { NextResponse } from "next/server";
import { crearClienteServicio, usuarioDesdeCabecera } from "@/lib/supabaseServidor";
import {
  BUCKET_ARCHIVOS_PATROCINADOR,
  EXTENSIONES_CON_MINIATURA,
  MAX_TITULO_ARCHIVO,
  desmarcarCasillaSiNoQuedan,
  esTipoArchivo,
  extensionDe,
  nombreAutor,
} from "@/lib/patrocinadorArchivos";

export const runtime = "nodejs";

// Archivos de la ficha de un patrocinador, desde el panel interno. La tabla
// patrocinador_archivos y su bucket no tienen políticas: solo se tocan con la
// clave de servicio, aquí (tras comprobar el login interno) y desde
// /api/portal/materiales/* (con la sesión del portal, solo lo de su empresa).

const sinSesion = () =>
  NextResponse.json({ error: "Sesión no encontrada. Vuelve a iniciar sesión." }, { status: 401 });

export async function GET(req: Request) {
  if (!(await usuarioDesdeCabecera(req.headers.get("authorization")))) return sinSesion();
  const patrocinadorId = new URL(req.url).searchParams.get("patrocinador_id");
  if (!patrocinadorId) return NextResponse.json({ error: "Falta el patrocinador." }, { status: 400 });

  const supabase = crearClienteServicio();
  const { data, error } = await supabase
    .from("patrocinador_archivos")
    .select("id, tipo, titulo, nombre_archivo, ruta_archivo, autor, creado, origen, email_subida, comentario, visible_empresa")
    .eq("patrocinador_id", patrocinadorId)
    .order("creado", { ascending: false });
  if (error) {
    return NextResponse.json({ error: "No se pudieron cargar los archivos: " + error.message }, { status: 500 });
  }

  // Miniatura solo para PNG/JPG/WEBP (URL firmada de 60 s, lo justo para
  // pintarla). SVG, AI y EPS nunca se muestran en la página.
  const archivos = await Promise.all(
    (data ?? []).map(async ({ ruta_archivo, ...a }) => {
      let miniatura: string | null = null;
      if (EXTENSIONES_CON_MINIATURA.has(extensionDe(a.nombre_archivo))) {
        const { data: firmada } = await supabase.storage
          .from(BUCKET_ARCHIVOS_PATROCINADOR)
          .createSignedUrl(ruta_archivo, 60);
        miniatura = firmada?.signedUrl ?? null;
      }
      return { ...a, miniatura };
    })
  );
  return NextResponse.json({ archivos });
}

// Registra un archivo ya subido con la URL de /api/patrocinadores/archivos/subida.
export async function POST(req: Request) {
  const usuario = await usuarioDesdeCabecera(req.headers.get("authorization"));
  if (!usuario) return sinSesion();
  const body = await req.json().catch(() => null);
  const patrocinadorId = typeof body?.patrocinador_id === "string" ? body.patrocinador_id : "";
  const ruta = typeof body?.ruta_archivo === "string" ? body.ruta_archivo : "";
  const tipo = body?.tipo;
  const titulo = typeof body?.titulo === "string" ? body.titulo.trim() : "";
  const visibleEmpresa = body?.visible_empresa === true;

  if (!esTipoArchivo(tipo)) {
    return NextResponse.json({ error: "Elige el tipo de archivo." }, { status: 400 });
  }
  if (titulo.length > MAX_TITULO_ARCHIVO) {
    return NextResponse.json({ error: `El título es demasiado largo (máximo ${MAX_TITULO_ARCHIVO}).` }, { status: 400 });
  }
  // La ruta solo puede ser una que haya preparado la ruta de subida para
  // este mismo patrocinador, y el archivo tiene que estar subido.
  const partes = ruta.split("/");
  if (!patrocinadorId || partes.length !== 3 || partes[0] !== patrocinadorId || ruta.includes("..")) {
    return NextResponse.json({ error: "Archivo no válido." }, { status: 400 });
  }

  const supabase = crearClienteServicio();
  const bucket = supabase.storage.from(BUCKET_ARCHIVOS_PATROCINADOR);
  const { data: existe } = await bucket.exists(ruta);
  if (!existe) {
    return NextResponse.json({ error: "El archivo no se ha subido. Inténtalo de nuevo." }, { status: 400 });
  }

  const { error } = await supabase.from("patrocinador_archivos").insert({
    patrocinador_id: patrocinadorId,
    tipo,
    titulo: titulo || null,
    ruta_archivo: ruta,
    nombre_archivo: partes[2],
    autor: nombreAutor(usuario.email),
    origen: "equipo",
    visible_empresa: visibleEmpresa,
  });
  if (error) {
    await bucket.remove([ruta]);
    return NextResponse.json({ error: "No se pudo guardar el archivo: " + error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

// "Visible para la empresa en su área": solo en los archivos del equipo (lo
// que sube la empresa ya lo ve ella siempre).
export async function PATCH(req: Request) {
  if (!(await usuarioDesdeCabecera(req.headers.get("authorization")))) return sinSesion();
  const body = await req.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id : "";
  if (!id || typeof body?.visible_empresa !== "boolean") {
    return NextResponse.json({ error: "Datos no válidos." }, { status: 400 });
  }
  const supabase = crearClienteServicio();
  const { data, error } = await supabase
    .from("patrocinador_archivos")
    .update({ visible_empresa: body.visible_empresa })
    .eq("id", id)
    .eq("origen", "equipo")
    .select("id");
  if (error) {
    return NextResponse.json({ error: "No se pudo guardar: " + error.message }, { status: 500 });
  }
  if (!data || data.length === 0) return NextResponse.json({ error: "Archivo no encontrado." }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const usuario = await usuarioDesdeCabecera(req.headers.get("authorization"));
  if (!usuario) return sinSesion();
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Falta el id." }, { status: 400 });

  const supabase = crearClienteServicio();
  const { data: archivo } = await supabase
    .from("patrocinador_archivos")
    .select("ruta_archivo, patrocinador_id, tipo")
    .eq("id", id)
    .maybeSingle();
  if (!archivo) return NextResponse.json({ error: "Archivo no encontrado." }, { status: 404 });

  const { error } = await supabase.from("patrocinador_archivos").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: "No se pudo borrar: " + error.message }, { status: 500 });
  }
  await supabase.storage.from(BUCKET_ARCHIVOS_PATROCINADOR).remove([archivo.ruta_archivo]);

  // Si era el último logo/ponencia, "Logo recibido"/"Ponencia recibida" vuelve a No.
  let cambiosFicha: Record<string, string> = {};
  try {
    cambiosFicha = await desmarcarCasillaSiNoQuedan(
      supabase,
      archivo.patrocinador_id,
      archivo.tipo,
      nombreAutor(usuario.email) ?? "Equipo"
    );
  } catch (e) {
    console.error("archivos: no se pudo actualizar la casilla", e instanceof Error ? e.message : e);
  }
  return NextResponse.json({ ok: true, cambiosFicha });
}
