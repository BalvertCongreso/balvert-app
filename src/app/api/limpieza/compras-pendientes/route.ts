import { NextResponse } from "next/server";
import { crearClienteServicio } from "@/lib/supabaseServidor";
import { borrarComprasSinPagarCaducadas } from "@/lib/compraPendiente";

// Llamada una vez al día por el cron de Vercel (vercel.json). Borra las
// compras de /entradas que nadie pagó hace más de 7 días (ver
// borrarComprasSinPagarCaducadas). Vercel manda la cabecera
// "Authorization: Bearer <CRON_SECRET>" si la variable CRON_SECRET existe en
// el proyecto; sin ella la ruta no hace nada (falla cerrada).
export async function GET(req: Request) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto || req.headers.get("authorization") !== `Bearer ${secreto}`) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const borradas = await borrarComprasSinPagarCaducadas(crearClienteServicio());
  if (borradas === null) {
    return NextResponse.json({ error: "No se pudo completar la limpieza." }, { status: 500 });
  }
  return NextResponse.json({ borradas });
}
