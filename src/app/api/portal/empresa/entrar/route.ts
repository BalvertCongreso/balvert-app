import { NextResponse } from "next/server";
import { crearClienteServicio } from "@/lib/supabaseServidor";
import {
  MAX_CONTRASENA,
  MENSAJE_BLOQUEO,
  comprobarContrasena,
  crearSesionEmpresa,
  estaBloqueado,
  ipDe,
  normalizarUsuario,
  registrarFallo,
} from "@/lib/portalEmpresa";

export const runtime = "nodejs";

// Mismo mensaje exista o no el usuario: no se delata qué empresas tienen acceso.
const MENSAJE_ERROR = "Usuario o contraseña incorrectos.";

// Entrada a la zona de empresa con usuario y contraseña. Tras varios fallos
// seguidos (por usuario escrito o por IP) se bloquea un rato, también para
// usuarios que no existen.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const usuario = normalizarUsuario(body?.usuario);
  const contrasena = typeof body?.contrasena === "string" ? body.contrasena : "";
  if (!usuario || !contrasena || contrasena.length > MAX_CONTRASENA) {
    return NextResponse.json({ error: MENSAJE_ERROR }, { status: 400 });
  }

  const supabase = crearClienteServicio();
  const ip = ipDe(req);
  if (await estaBloqueado(supabase, usuario, ip)) {
    return NextResponse.json({ error: MENSAJE_BLOQUEO }, { status: 429 });
  }

  const { data: acceso } = await supabase
    .from("patrocinador_accesos")
    .select("id, patrocinador_id, hash_contrasena")
    .eq("usuario", usuario)
    .maybeSingle();
  const correcta = await comprobarContrasena(contrasena, acceso?.hash_contrasena ?? null);
  if (!acceso || !correcta) {
    await registrarFallo(supabase, usuario, ip);
    return NextResponse.json({ error: MENSAJE_ERROR }, { status: 401 });
  }

  try {
    // Limpieza oportunista de sesiones caducadas.
    await supabase.from("patrocinador_sesiones").delete().lt("expira_en", new Date().toISOString());
    await crearSesionEmpresa(supabase, acceso.patrocinador_id);
    await supabase.from("patrocinador_accesos").update({ ultimo_acceso: new Date().toISOString() }).eq("id", acceso.id);
  } catch (e) {
    console.error("portal/empresa/entrar: no se pudo crear la sesión", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "No se pudo entrar. Inténtalo de nuevo." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
