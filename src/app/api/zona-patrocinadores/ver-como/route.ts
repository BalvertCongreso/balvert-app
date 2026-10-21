import { NextResponse } from "next/server";
import { crearClienteServicio, usuarioDesdeCabecera } from "@/lib/supabaseServidor";
import { idEdicionActiva } from "@/lib/portal";
import { crearSesionEmpresa } from "@/lib/portalEmpresa";
import { nombreAutor } from "@/lib/patrocinadorArchivos";

export const runtime = "nodejs";

// «Ver como la empresa» (espacio de la empresa en la Zona de patrocinadores):
// solo con el login del panel. Abre una sesión de empresa de la organización
// (2 horas, con el nombre de quien la abre): no toca el último acceso de la
// empresa, sus cambios van al historial como «Organización: <nombre>», no
// avisa a secretaría y no deja cambiar la contraseña. La cookie la deja esta
// misma respuesta en el navegador del panel; después se abre /portal/empresa.
export async function POST(req: Request) {
  const usuario = await usuarioDesdeCabecera(req.headers.get("authorization"));
  if (!usuario) return NextResponse.json({ error: "Sesión no encontrada. Vuelve a iniciar sesión." }, { status: 401 });
  const body = await req.json().catch(() => null);
  const patrocinadorId = typeof body?.patrocinador_id === "string" ? body.patrocinador_id : "";
  if (!patrocinadorId) return NextResponse.json({ error: "Falta el patrocinador." }, { status: 400 });

  const supabase = crearClienteServicio();
  const edicionId = await idEdicionActiva(supabase);
  const { data: ficha } = await supabase
    .from("patrocinadores")
    .select("id, edicion_id")
    .eq("id", patrocinadorId)
    .maybeSingle();
  if (!ficha || ficha.edicion_id !== edicionId) {
    return NextResponse.json({ error: "Ese patrocinador no está en la edición activa." }, { status: 404 });
  }
  try {
    await crearSesionEmpresa(supabase, patrocinadorId, nombreAutor(usuario.email) ?? "Organización");
  } catch (e) {
    console.error("zona-patrocinadores/ver-como:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "No se pudo abrir la zona de la empresa." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
