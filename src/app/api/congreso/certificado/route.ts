import { NextResponse } from "next/server";
import { crearClienteServicio, usuarioDesdeCabecera } from "@/lib/supabaseServidor";
import { cargarEdicionCertificado, construirCertificado, nombreArchivoCertificado, respuestaPdf } from "@/lib/certificado";

export const runtime = "nodejs";

// Certificado de asistencia desde la ficha interna de un asistente del
// Congreso (por si alguien lo pide por otra vía). Solo con check-in hecho.
export async function GET(req: Request) {
  if (!(await usuarioDesdeCabecera(req.headers.get("authorization")))) {
    return NextResponse.json({ error: "Sesión no encontrada. Vuelve a iniciar sesión." }, { status: 401 });
  }
  const id = new URL(req.url).searchParams.get("id");
  const supabase = crearClienteServicio();
  const { data: fila } = id
    ? await supabase
        .from("asistentes_congreso")
        .select("nombre, documento_identidad, check_in_hecho, edicion_id")
        .eq("id", id)
        .maybeSingle()
    : { data: null };
  if (!fila) return NextResponse.json({ error: "Asistente no encontrado." }, { status: 404 });
  if (fila.check_in_hecho !== "Sí") {
    return NextResponse.json({ error: "Este asistente aún no tiene el check-in hecho." }, { status: 409 });
  }
  const nombre = fila.nombre?.trim();
  if (!nombre) return NextResponse.json({ error: "Falta el nombre del asistente." }, { status: 409 });
  const edicion = fila.edicion_id ? await cargarEdicionCertificado(supabase, fila.edicion_id) : null;
  if (!edicion) return NextResponse.json({ error: "El asistente no tiene edición." }, { status: 409 });

  const pdf = await construirCertificado({ nombre, documento: fila.documento_identidad?.trim() || null }, edicion);
  return respuestaPdf(pdf, nombreArchivoCertificado(edicion.edicionNombre, nombre));
}
