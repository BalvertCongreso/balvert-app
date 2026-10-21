import { NextResponse } from "next/server";
import { crearClienteServicio } from "@/lib/supabaseServidor";
import {
  MAX_CONTRASENA,
  MENSAJE_BLOQUEO,
  MIN_CONTRASENA,
  comprobarContrasena,
  estaBloqueado,
  hashContrasena,
  ipDe,
  registrarFallo,
  sesionEmpresa,
} from "@/lib/portalEmpresa";

export const runtime = "nodejs";

// La empresa cambia su contraseña desde su zona: pide la actual, y al
// cambiarla cierra todas las demás sesiones de la empresa (la de quien la
// cambia sigue abierta).
export async function POST(req: Request) {
  const sesion = await sesionEmpresa();
  if (!sesion) return NextResponse.json({ error: "Tu sesión ha caducado. Vuelve a entrar." }, { status: 401 });
  // «Ver como la empresa»: la organización no cambia la contraseña de la empresa
  // (para eso está «Generar contraseña nueva» en el panel).
  if (sesion.modoOrganizacion) {
    return NextResponse.json({ error: "Desde «Ver como la empresa» no se puede cambiar la contraseña." }, { status: 403 });
  }
  const body = await req.json().catch(() => null);
  const actual = typeof body?.actual === "string" ? body.actual : "";
  const nueva = typeof body?.nueva === "string" ? body.nueva : "";

  if (nueva.length < MIN_CONTRASENA) {
    return NextResponse.json({ error: `La contraseña nueva tiene que tener al menos ${MIN_CONTRASENA} caracteres.` }, { status: 400 });
  }
  if (nueva.length > MAX_CONTRASENA) return NextResponse.json({ error: "La contraseña nueva es demasiado larga." }, { status: 400 });
  if (nueva === actual) return NextResponse.json({ error: "La contraseña nueva tiene que ser distinta de la actual." }, { status: 400 });

  const supabase = crearClienteServicio();
  const ip = ipDe(req);
  if (await estaBloqueado(supabase, sesion.usuario, ip)) {
    return NextResponse.json({ error: MENSAJE_BLOQUEO }, { status: 429 });
  }
  const { data: acceso } = await supabase
    .from("patrocinador_accesos")
    .select("id, hash_contrasena")
    .eq("patrocinador_id", sesion.patrocinadorId)
    .maybeSingle();
  if (!acceso || !actual || actual.length > MAX_CONTRASENA || !(await comprobarContrasena(actual, acceso.hash_contrasena))) {
    await registrarFallo(supabase, sesion.usuario, ip);
    return NextResponse.json({ error: "La contraseña actual no es correcta." }, { status: 400 });
  }

  const { error } = await supabase
    .from("patrocinador_accesos")
    .update({ hash_contrasena: await hashContrasena(nueva), actualizado: new Date().toISOString() })
    .eq("id", acceso.id);
  if (error) return NextResponse.json({ error: "No se pudo cambiar la contraseña. Inténtalo de nuevo." }, { status: 500 });
  await supabase
    .from("patrocinador_sesiones")
    .delete()
    .eq("patrocinador_id", sesion.patrocinadorId)
    .neq("id", sesion.sesionId);
  return NextResponse.json({ ok: true });
}
