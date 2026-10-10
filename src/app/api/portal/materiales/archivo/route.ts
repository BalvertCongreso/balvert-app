import { NextResponse, after } from "next/server";
import { crearClienteServicio } from "@/lib/supabaseServidor";
import { empresasDelEmail, sesionPortal } from "@/lib/portal";
import {
  BUCKET_ARCHIVOS_PATROCINADOR,
  CASILLA_POR_TIPO,
  MAX_COMENTARIO_ARCHIVO,
  NOMBRE_TIPO_ARCHIVO,
  actualizarFichaComo,
  desmarcarCasillaSiNoQuedan,
  esTipoArchivoPortal,
} from "@/lib/patrocinadorArchivos";
import {
  autorPortal,
  avisarSecretaria,
  crearTareaRevision,
  edicionMaterial,
  fichaDeMiEmpresa,
  nombreEmpresa,
} from "@/lib/portalMateriales";

export const runtime = "nodejs";

// Registra un archivo que la empresa acaba de subir con la URL de
// /api/portal/materiales/subida. Marca la casilla (logo → "Logo recibido",
// ponencia → "Ponencia recibida"), crea la tarea de revisión y avisa por
// email a la secretaría.
export async function POST(req: Request) {
  const sesion = await sesionPortal();
  if (!sesion) return NextResponse.json({ error: "Tu sesión ha caducado. Vuelve a entrar." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const ruta = typeof body?.ruta === "string" ? body.ruta : "";
  const tipo = body?.tipo;
  const comentario = typeof body?.comentario === "string" ? body.comentario.trim() : "";
  if (!esTipoArchivoPortal(tipo)) return NextResponse.json({ error: "Elige qué vas a subir." }, { status: 400 });
  if (comentario.length > MAX_COMENTARIO_ARCHIVO) {
    return NextResponse.json(
      { error: `El comentario es demasiado largo (máximo ${MAX_COMENTARIO_ARCHIVO} caracteres).` },
      { status: 400 }
    );
  }

  const supabase = crearClienteServicio();
  const edicion = await edicionMaterial(supabase);
  const ficha = edicion ? await fichaDeMiEmpresa(supabase, edicion.id, sesion.email, body?.patrocinador_id) : null;
  if (!edicion || !ficha) return NextResponse.json({ error: "Empresa no encontrada." }, { status: 404 });

  // Solo una ruta de la carpeta de SU empresa que haya preparado esta misma
  // persona en las últimas 2 horas, y que esté subida de verdad.
  const partes = ruta.split("/");
  const noValido = NextResponse.json({ error: "Archivo no válido. Vuelve a subirlo." }, { status: 400 });
  if (partes.length !== 3 || partes[0] !== ficha.id || ruta.includes("..")) return noValido;
  const haceDosHoras = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  const { count } = await supabase
    .from("portal_acciones")
    .select("id", { count: "exact", head: true })
    .eq("email", sesion.email)
    .eq("accion", "preparar_subida")
    .eq("detalle", ruta)
    .gte("creado", haceDosHoras);
  if (!count) return noValido;

  const bucket = supabase.storage.from(BUCKET_ARCHIVOS_PATROCINADOR);
  const { data: existe } = await bucket.exists(ruta);
  if (!existe) return NextResponse.json({ error: "El archivo no se ha subido. Inténtalo de nuevo." }, { status: 400 });

  const autor = autorPortal(sesion.email);
  const { error } = await supabase.from("patrocinador_archivos").insert({
    patrocinador_id: ficha.id,
    tipo,
    ruta_archivo: ruta,
    nombre_archivo: partes[2],
    autor,
    origen: "patrocinador",
    email_subida: sesion.email,
    comentario: comentario || null,
    visible_empresa: false,
  });
  if (error) {
    // 23505: esa ruta ya estaba registrada (doble envío): no se borra nada.
    if (error.code !== "23505") await bucket.remove([ruta]);
    console.error("portal/materiales/archivo: no se pudo guardar", error.code, error.message);
    return NextResponse.json({ error: "No se pudo guardar el archivo. Inténtalo de nuevo." }, { status: 500 });
  }

  const casilla = CASILLA_POR_TIPO[tipo];
  if (casilla) {
    try {
      await actualizarFichaComo(supabase, ficha.id, autor, { [casilla]: "Sí" });
    } catch (e) {
      console.error("portal/materiales/archivo: no se pudo marcar la casilla", e instanceof Error ? e.message : e);
    }
  }

  const empresa = nombreEmpresa(ficha);
  const nombreTipo = NOMBRE_TIPO_ARCHIVO[tipo].toLowerCase();
  const detalle = [
    `Empresa: ${empresa}`,
    `Subido por: ${sesion.email}`,
    `Tipo: ${NOMBRE_TIPO_ARCHIVO[tipo]}`,
    `Archivo: ${partes[2]}`,
    `Comentario: ${comentario || "—"}`,
  ];
  try {
    await crearTareaRevision(
      supabase,
      edicion.id,
      ficha.id,
      `Revisar ${nombreTipo} de ${empresa}`,
      [
        "Archivo subido por la empresa desde su área de cliente (portal).",
        "",
        ...detalle,
        "",
        "Lo tienes en la ficha del patrocinador → Archivos.",
      ].join("\n")
    );
  } catch (e) {
    console.error("portal/materiales/archivo: no se pudo crear la tarea", e instanceof Error ? e.message : e);
  }
  after(() => avisarSecretaria(`${empresa} ha subido ${nombreTipo}`, detalle, ficha.id));

  return NextResponse.json({ ok: true });
}

// La empresa borra un archivo que subió ELLA (nunca los del equipo). Si era
// su último logo/ponencia, la casilla de la ficha vuelve a "No".
export async function DELETE(req: Request) {
  const sesion = await sesionPortal();
  if (!sesion) return NextResponse.json({ error: "Tu sesión ha caducado. Vuelve a entrar." }, { status: 401 });
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
    .select("id, ruta_archivo, patrocinador_id, tipo")
    .eq("id", id)
    .eq("origen", "patrocinador")
    .in("patrocinador_id", ids)
    .maybeSingle();
  if (!archivo) return noEncontrado;

  const { error } = await supabase.from("patrocinador_archivos").delete().eq("id", archivo.id);
  if (error) {
    console.error("portal/materiales/archivo: no se pudo borrar", error.message);
    return NextResponse.json({ error: "No se pudo borrar. Inténtalo de nuevo." }, { status: 500 });
  }
  await supabase.storage.from(BUCKET_ARCHIVOS_PATROCINADOR).remove([archivo.ruta_archivo]);
  try {
    await desmarcarCasillaSiNoQuedan(supabase, archivo.patrocinador_id, archivo.tipo, autorPortal(sesion.email));
  } catch (e) {
    console.error("portal/materiales/archivo: no se pudo desmarcar la casilla", e instanceof Error ? e.message : e);
  }
  return NextResponse.json({ ok: true });
}
