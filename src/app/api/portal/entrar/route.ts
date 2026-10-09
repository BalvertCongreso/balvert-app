import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { crearClienteServicio } from "@/lib/supabaseServidor";
import { COOKIE_PORTAL, DURACION_SESION_MS, generarToken, hashToken } from "@/lib/portal";

export const runtime = "nodejs";

// Canjea el enlace del email por una sesión. Es un POST que lanza el botón
// "Entrar" de /portal/entrar, no la simple apertura del enlace: algunos
// gestores de correo abren los enlaces por su cuenta para revisarlos, y eso
// gastaría el enlace de un solo uso antes de que la persona lo pulse.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const token = typeof body?.token === "string" ? body.token : "";
  if (!token || token.length > 200) {
    return NextResponse.json({ error: "Enlace no válido." }, { status: 400 });
  }

  const supabase = crearClienteServicio();
  const ahora = new Date().toISOString();

  // Marcar como usado y comprobar caducidad en la misma operación: si dos
  // peticiones llegan a la vez con el mismo enlace, solo una lo consigue.
  const { data: enlaces, error } = await supabase
    .from("portal_enlaces")
    .update({ usado_en: ahora })
    .eq("token_hash", hashToken(token))
    .is("usado_en", null)
    .gt("expira_en", ahora)
    .select("email");

  if (error) {
    console.error("portal/entrar: fallo canjeando el enlace", error.code, error.message);
    return NextResponse.json({ error: "No se pudo entrar. Inténtalo de nuevo." }, { status: 500 });
  }
  const email = enlaces?.[0]?.email as string | undefined;
  if (!email) {
    return NextResponse.json(
      { error: "Este enlace ha caducado o ya se ha usado.", caducado: true },
      { status: 400 }
    );
  }

  const tokenSesion = generarToken();
  const expira = new Date(Date.now() + DURACION_SESION_MS);
  const { error: errorSesion } = await supabase.from("portal_sesiones").insert({
    email,
    token_hash: hashToken(tokenSesion),
    expira_en: expira.toISOString(),
  });
  if (errorSesion) {
    console.error("portal/entrar: no se pudo crear la sesión", errorSesion.code, errorSesion.message);
    return NextResponse.json({ error: "No se pudo entrar. Inténtalo de nuevo." }, { status: 500 });
  }

  (await cookies()).set(COOKIE_PORTAL, tokenSesion, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    expires: expira,
  });

  return NextResponse.json({ ok: true });
}
