import { NextResponse } from "next/server";
import { crearClienteServicio, usuarioDesdeCabecera } from "@/lib/supabaseServidor";
import { cargarEdicionCertificado, construirCertificado, nombreArchivoCertificado, respuestaPdf } from "@/lib/certificado";

export const runtime = "nodejs";

// "Ver certificado de ejemplo" en Ediciones: el certificado de esa edición
// con un asistente ficticio, para revisar el diseño. Solo panel interno.
export async function GET(req: Request) {
  if (!(await usuarioDesdeCabecera(req.headers.get("authorization")))) {
    return NextResponse.json({ error: "Sesión no encontrada. Vuelve a iniciar sesión." }, { status: 401 });
  }
  const edicionId = new URL(req.url).searchParams.get("edicion_id");
  const supabase = crearClienteServicio();
  const edicion = edicionId ? await cargarEdicionCertificado(supabase, edicionId) : null;
  if (!edicion) return NextResponse.json({ error: "Edición no encontrada." }, { status: 404 });

  const nombre = "María José Núñez Peña";
  const pdf = await construirCertificado({ nombre, documento: "00000000T" }, edicion);
  return respuestaPdf(pdf, nombreArchivoCertificado(edicion.edicionNombre, `ejemplo ${nombre}`));
}
