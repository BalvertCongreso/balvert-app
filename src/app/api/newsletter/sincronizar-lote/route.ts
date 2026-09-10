import { NextResponse } from "next/server";
import { usuarioDesdeCabecera } from "@/lib/supabaseServidor";
import { sincronizarSuscriptor } from "@/lib/mailrelay";

interface ContactoLote {
  email: string;
  nombre: string | null;
}

export async function POST(req: Request) {
  const usuario = await usuarioDesdeCabecera(req.headers.get("authorization"));
  if (!usuario) {
    return NextResponse.json({ error: "Sesión no encontrada. Vuelve a iniciar sesión." }, { status: 401 });
  }

  const body = await req.json();
  const groupId = body.groupId as number;
  const contactos = body.contactos as ContactoLote[];
  if (!groupId || !Array.isArray(contactos)) {
    return NextResponse.json({ error: "Faltan datos (groupId o contactos)." }, { status: 400 });
  }

  const errores: string[] = [];
  // Uno a uno, en paralelo limitado, para no saturar la API de Mailrelay ni
  // que un solo fallo tire abajo todo el lote.
  const TAMANO_TANDA = 10;
  for (let i = 0; i < contactos.length; i += TAMANO_TANDA) {
    const tanda = contactos.slice(i, i + TAMANO_TANDA);
    const resultados = await Promise.allSettled(
      tanda.map((c) => sincronizarSuscriptor({ email: c.email, nombre: c.nombre, groupId }))
    );
    resultados.forEach((r, idx) => {
      if (r.status === "rejected") {
        errores.push(`${tanda[idx].email}: ${r.reason?.message ?? "error desconocido"}`);
      }
    });
  }

  return NextResponse.json({
    sincronizados: contactos.length - errores.length,
    errores,
  });
}
