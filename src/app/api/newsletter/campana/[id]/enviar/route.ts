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
  const body = await req.json().catch(() => ({}));
  const scheduledAtUtc = typeof body.scheduledAtUtc === "string" ? body.scheduledAtUtc : undefined;
  if (scheduledAtUtc && !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(scheduledAtUtc)) {
    return NextResponse.json(
      { error: "Formato de fecha programada inválido." },
      { status: 400 }
    );
  }

  try {
    await enviarCampanaATodos(Number(id), scheduledAtUtc);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "No se pudo enviar la campaña." },
      { status: 502 }
    );
  }
}
