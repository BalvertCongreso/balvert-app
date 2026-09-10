import { NextResponse } from "next/server";
import { usuarioDesdeCabecera } from "@/lib/supabaseServidor";
import { crearCampana } from "@/lib/mailrelay";

export async function POST(req: Request) {
  const usuario = await usuarioDesdeCabecera(req.headers.get("authorization"));
  if (!usuario) {
    return NextResponse.json({ error: "Sesión no encontrada. Vuelve a iniciar sesión." }, { status: 401 });
  }

  const body = await req.json();
  const { senderId, subject, html, groupId } = body as {
    senderId: number;
    subject: string;
    html: string;
    groupId: number;
  };
  if (!senderId || !subject || !html || !groupId) {
    return NextResponse.json({ error: "Faltan datos para crear la campaña." }, { status: 400 });
  }

  try {
    const campaignId = await crearCampana({ senderId, subject, html, groupId });
    return NextResponse.json({ campaignId });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "No se pudo crear la campaña en Mailrelay." },
      { status: 502 }
    );
  }
}
