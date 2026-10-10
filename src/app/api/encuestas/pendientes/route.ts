import { NextResponse } from "next/server";
import { crearClienteServicio } from "@/lib/supabaseServidor";
import { procesarEnviosPendientes } from "@/lib/encuestasServidor";

export const runtime = "nodejs";
export const maxDuration = 60;

// Llamada una vez al día por el cron de Vercel (vercel.json). Manda los
// emails de cuestionarios que no cupieron en el límite diario de los días
// anteriores (primeros envíos y recordatorios). Misma protección que
// /api/limpieza/compras-pendientes: sin CRON_SECRET no hace nada.
export async function GET(req: Request) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto || req.headers.get("authorization") !== `Bearer ${secreto}`) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  const resultado = await procesarEnviosPendientes(crearClienteServicio());
  if (resultado.error) return NextResponse.json(resultado, { status: 500 });
  return NextResponse.json(resultado);
}
