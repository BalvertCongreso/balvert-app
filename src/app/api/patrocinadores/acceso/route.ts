import { NextResponse } from "next/server";
import { crearClienteServicio, usuarioDesdeCabecera } from "@/lib/supabaseServidor";
import { ErrorAcceso, crearOCambiarAcceso } from "@/lib/portalEmpresa";

export const runtime = "nodejs";

// Acceso de la empresa a su zona del portal, desde la ficha del panel. La
// tabla patrocinador_accesos solo se toca con la clave de servicio, aquí tras
// comprobar el login interno. Nunca se devuelve el hash; la contraseña en
// claro solo sale en la respuesta de POST (una vez) y no se guarda ni se
// registra en ningún log.

const sinSesion = () =>
  NextResponse.json({ error: "Sesión no encontrada. Vuelve a iniciar sesión." }, { status: 401 });

export async function GET(req: Request) {
  if (!(await usuarioDesdeCabecera(req.headers.get("authorization")))) return sinSesion();
  const patrocinadorId = new URL(req.url).searchParams.get("patrocinador_id");
  if (!patrocinadorId) return NextResponse.json({ error: "Falta el patrocinador." }, { status: 400 });
  const { data, error } = await crearClienteServicio()
    .from("patrocinador_accesos")
    .select("usuario, creado, actualizado, ultimo_acceso")
    .eq("patrocinador_id", patrocinadorId)
    .maybeSingle();
  if (error) return NextResponse.json({ error: "No se pudo cargar el acceso." }, { status: 500 });
  return NextResponse.json({ acceso: data ?? null }, { headers: { "Cache-Control": "no-store" } });
}

// { patrocinador_id, modo: "crear" | "nueva" }
export async function POST(req: Request) {
  if (!(await usuarioDesdeCabecera(req.headers.get("authorization")))) return sinSesion();
  const body = await req.json().catch(() => null);
  const patrocinadorId = typeof body?.patrocinador_id === "string" ? body.patrocinador_id : "";
  const modo = body?.modo === "nueva" ? "nueva" : body?.modo === "crear" ? "crear" : null;
  if (!patrocinadorId || !modo) return NextResponse.json({ error: "Datos no válidos." }, { status: 400 });
  try {
    const credenciales = await crearOCambiarAcceso(crearClienteServicio(), patrocinadorId, modo);
    return NextResponse.json(credenciales, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    if (e instanceof ErrorAcceso) return NextResponse.json({ error: e.message }, { status: e.estado });
    console.error("patrocinadores/acceso:", e instanceof Error ? e.message : "error");
    return NextResponse.json({ error: "No se pudo guardar el acceso. Inténtalo de nuevo." }, { status: 500 });
  }
}
