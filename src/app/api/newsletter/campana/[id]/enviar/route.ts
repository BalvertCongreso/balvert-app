import { NextResponse } from "next/server";
import { usuarioDesdeCabecera } from "@/lib/supabaseServidor";
import { enviarCampanaATodos } from "@/lib/mailrelay";

// Envía la campaña a TODO el grupo (destinatarios reales). Solo debe
// dispararse desde el botón de la app, tras confirmación explícita de
// Ariadna/Ariosto en pantalla — nunca desde una prueba automatizada.
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const usuario = await usuarioDesdeCabecera(req.headers.get("authorization"));
  if (!usuario) {
    return NextResponse.json({ error: "Sesión no encontrada. Vuelve a iniciar sesión." }, { status: 401 });
  }

  const { id } = await ctx.params;

  try {
    await enviarCampanaATodos(Number(id));
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "No se pudo enviar la campaña." },
      { status: 502 }
    );
  }
}
