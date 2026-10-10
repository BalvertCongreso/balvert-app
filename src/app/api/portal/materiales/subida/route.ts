import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { crearClienteServicio } from "@/lib/supabaseServidor";
import { sesionPortal } from "@/lib/portal";
import {
  BUCKET_ARCHIVOS_PATROCINADOR,
  FORMATOS_PERMITIDOS,
  MENSAJE_DEMASIADO_GRANDE,
  TAMANO_MAXIMO_ARCHIVO,
  TIPO_POR_EXTENSION,
  esTipoArchivoPortal,
  extensionDe,
  sanearNombre,
} from "@/lib/patrocinadorArchivos";
import {
  LIMITE_SUBIDAS_POR_HORA,
  MENSAJE_LIMITE,
  accionesUltimaHora,
  edicionMaterial,
  fichaDeMiEmpresa,
  registrarAccion,
} from "@/lib/portalMateriales";

export const runtime = "nodejs";

// Prepara la subida de un archivo desde el portal: URL firmada de un solo uso
// para subir directamente al bucket privado, en la carpeta de SU empresa. La
// ruta queda apuntada a nombre de este email: /api/portal/materiales/archivo
// solo registra rutas preparadas aquí por la misma persona.
export async function POST(req: Request) {
  const sesion = await sesionPortal();
  if (!sesion) return NextResponse.json({ error: "Tu sesión ha caducado. Vuelve a entrar." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const nombre = typeof body?.nombre === "string" ? body.nombre : "";
  const tamano = typeof body?.tamano === "number" ? body.tamano : 0;
  if (!esTipoArchivoPortal(body?.tipo)) {
    return NextResponse.json({ error: "Elige qué vas a subir." }, { status: 400 });
  }
  const tipoMime = TIPO_POR_EXTENSION[extensionDe(nombre)];
  if (!tipoMime) {
    return NextResponse.json({ error: `Solo se pueden subir ${FORMATOS_PERMITIDOS}.` }, { status: 400 });
  }
  if (tamano <= 0) return NextResponse.json({ error: "El archivo está vacío." }, { status: 400 });
  if (tamano > TAMANO_MAXIMO_ARCHIVO) return NextResponse.json({ error: MENSAJE_DEMASIADO_GRANDE }, { status: 400 });

  const supabase = crearClienteServicio();
  const edicion = await edicionMaterial(supabase);
  const ficha = edicion ? await fichaDeMiEmpresa(supabase, edicion.id, sesion.email, body?.patrocinador_id) : null;
  if (!ficha) return NextResponse.json({ error: "Empresa no encontrada." }, { status: 404 });

  if ((await accionesUltimaHora(supabase, sesion.email, ["preparar_subida"])) >= LIMITE_SUBIDAS_POR_HORA) {
    return NextResponse.json({ error: MENSAJE_LIMITE }, { status: 429 });
  }

  const ruta = `${ficha.id}/${randomUUID()}/${sanearNombre(nombre)}`;
  const { data, error } = await supabase.storage.from(BUCKET_ARCHIVOS_PATROCINADOR).createSignedUploadUrl(ruta);
  if (error || !data) {
    console.error("portal/materiales/subida:", error?.message);
    return NextResponse.json({ error: "No se pudo preparar la subida. Inténtalo de nuevo." }, { status: 502 });
  }
  try {
    await registrarAccion(supabase, sesion.email, "preparar_subida", data.path);
  } catch (e) {
    console.error("portal/materiales/subida:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "No se pudo preparar la subida. Inténtalo de nuevo." }, { status: 500 });
  }
  return NextResponse.json({ ruta: data.path, token: data.token, tipo: tipoMime });
}
