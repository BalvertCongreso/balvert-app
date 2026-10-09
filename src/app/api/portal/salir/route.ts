import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { crearClienteServicio } from "@/lib/supabaseServidor";
import { COOKIE_PORTAL, hashToken } from "@/lib/portal";

export const runtime = "nodejs";

// Cierra la sesión del portal: borra la fila (la cookie deja de valer aunque
// alguien la hubiera copiado) y la cookie del navegador.
export async function POST() {
  const almacen = await cookies();
  const token = almacen.get(COOKIE_PORTAL)?.value;
  if (token) {
    await crearClienteServicio().from("portal_sesiones").delete().eq("token_hash", hashToken(token));
  }
  almacen.delete(COOKIE_PORTAL);
  return NextResponse.json({ ok: true });
}
