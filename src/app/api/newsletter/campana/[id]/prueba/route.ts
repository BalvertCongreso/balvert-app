import { NextResponse } from "next/server";
import { usuarioDesdeCabecera } from "@/lib/supabaseServidor";
import { enviarCampanaDePrueba } from "@/lib/mailrelay";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const usuario = await usuarioDesdeCabecera(req.headers.get("authorization"));
  if (!usuario) {
    return NextResponse.json({ error: "Sesión no encontrada. Vuelve a iniciar sesión." }, { status: 401 });
  }

  const { id } = await ctx.params;
  const body = await req.json();
  const emails = body.emails as string[];
  if (!Array.isArray(emails) || emails.length === 0) {
    return NextResponse.json({ error: "Falta al menos un email de prueba." }, { status: 400 });
  }

  try {
    await enviarCampanaDePrueba(Number(id), emails);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "No se pudo enviar la prueba." },
      { status: 502 }
    );
  }
}
