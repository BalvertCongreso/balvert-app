import { NextResponse } from "next/server";
import { crearClienteServicio, usuarioDesdeCabecera } from "@/lib/supabaseServidor";
import { idEdicionActiva } from "@/lib/portal";
import { estadoPatrocinadores } from "@/lib/zonaPatrocinadores";

export const runtime = "nodejs";

// Zona de patrocinadores del panel: estado de cada empresa de la edición
// activa (?id= para una sola, con su lista de cambios recientes). Solo con el
// login interno.
export async function GET(req: Request) {
  if (!(await usuarioDesdeCabecera(req.headers.get("authorization")))) {
    return NextResponse.json({ error: "Sesión no encontrada. Vuelve a iniciar sesión." }, { status: 401 });
  }
  const id = new URL(req.url).searchParams.get("id") ?? undefined;
  const supabase = crearClienteServicio();
  const edicionId = await idEdicionActiva(supabase);
  if (!edicionId) return NextResponse.json({ estados: [], cambios: [] });
  try {
    const { estados, cambios } = await estadoPatrocinadores(supabase, edicionId, id);
    return NextResponse.json(
      { estados, cambios: id ? cambios.get(id) ?? [] : [] },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (e) {
    console.error("zona-patrocinadores:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "No se pudo cargar la zona de patrocinadores." }, { status: 500 });
  }
}
