import { NextResponse } from "next/server";
import { crearClienteServidor, usuarioDesdeCabecera } from "@/lib/supabaseServidor";
import { actualizarDesdeMailrelay } from "@/lib/mailrelayResultados";

// Botón «Actualizar rebotes y bajas desde Mailrelay» de Contactos. Con la
// sesión del panel (las escrituras pasan por las mismas reglas de acceso).
// Revisa todas las campañas enviadas; se puede pulsar las veces que haga
// falta: no suma dos veces el mismo rebote temporal ni reactiva a nadie.
export const maxDuration = 60;

export async function POST(req: Request) {
  const authHeader = req.headers.get("authorization");
  const usuario = await usuarioDesdeCabecera(authHeader);
  if (!usuario) {
    return NextResponse.json({ error: "Sesión no encontrada. Vuelve a iniciar sesión." }, { status: 401 });
  }

  try {
    const resumen = await actualizarDesdeMailrelay(crearClienteServidor(authHeader));
    return NextResponse.json(resumen);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "No se pudo consultar Mailrelay." },
      { status: 502 }
    );
  }
}
