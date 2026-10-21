import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { crearClienteServicio } from "@/lib/supabaseServidor";
import { hashToken } from "@/lib/portal";
import { COOKIE_EMPRESA } from "@/lib/portalEmpresa";

export const runtime = "nodejs";

// Cierra la sesión de empresa: borra la fila (la cookie deja de valer aunque
// alguien la hubiera copiado) y la cookie del navegador.
export async function POST() {
  const almacen = await cookies();
  const token = almacen.get(COOKIE_EMPRESA)?.value;
  if (token) {
    await crearClienteServicio().from("patrocinador_sesiones").delete().eq("token_hash", hashToken(token));
  }
  almacen.delete(COOKIE_EMPRESA);
  return NextResponse.json({ ok: true });
}
