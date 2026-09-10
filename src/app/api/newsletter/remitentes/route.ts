import { NextResponse } from "next/server";
import { usuarioDesdeCabecera } from "@/lib/supabaseServidor";
import { listarRemitentes } from "@/lib/mailrelay";

export async function GET(req: Request) {
  const usuario = await usuarioDesdeCabecera(req.headers.get("authorization"));
  if (!usuario) {
    return NextResponse.json({ error: "Sesión no encontrada. Vuelve a iniciar sesión." }, { status: 401 });
  }

  try {
    const remitentes = await listarRemitentes();
    return NextResponse.json({ remitentes });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "No se pudieron cargar los remitentes de Mailrelay." },
      { status: 502 }
    );
  }
}
