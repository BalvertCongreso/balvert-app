import { NextResponse } from "next/server";
import { usuarioDesdeCabecera } from "@/lib/supabaseServidor";
import { crearGrupo } from "@/lib/mailrelay";

export async function POST(req: Request) {
  const usuario = await usuarioDesdeCabecera(req.headers.get("authorization"));
  if (!usuario) {
    return NextResponse.json({ error: "Sesión no encontrada. Vuelve a iniciar sesión." }, { status: 401 });
  }

  const body = await req.json();
  const nombre = body.nombre as string;
  if (!nombre) {
    return NextResponse.json({ error: "Falta el nombre del grupo." }, { status: 400 });
  }

  try {
    const groupId = await crearGrupo(nombre);
    return NextResponse.json({ groupId });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "No se pudo crear el grupo en Mailrelay." },
      { status: 502 }
    );
  }
}
