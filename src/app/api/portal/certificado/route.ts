import { NextResponse } from "next/server";
import { crearClienteServicio } from "@/lib/supabaseServidor";
import { consultaEntradas, idEdicionActiva, sesionPortal } from "@/lib/portal";
import { cargarEdicionCertificado, construirCertificado, nombreArchivoCertificado, respuestaPdf } from "@/lib/certificado";

export const runtime = "nodejs";

// Certificado de asistencia desde el portal: solo de una entrada de Congreso
// del email de la sesión y con el check-in hecho. El documento de identidad
// solo se lee aquí para pintarlo en el PDF; nunca va en la página ni en JSON.
export async function GET(req: Request) {
  const sesion = await sesionPortal();
  if (!sesion) return NextResponse.json({ error: "Sesión no encontrada." }, { status: 401 });
  const id = new URL(req.url).searchParams.get("id");
  const noDisponible = NextResponse.json({ error: "Certificado no disponible." }, { status: 404 });
  if (!id) return noDisponible;

  const supabase = crearClienteServicio();
  const edicionId = await idEdicionActiva(supabase);
  if (!edicionId) return noDisponible;

  // Comprueba que la entrada es de este email (un id ajeno no devuelve nada).
  const { data, error } = await consultaEntradas(supabase, "congreso", edicionId, sesion.email).eq("id", id).maybeSingle();
  const entrada = data as unknown as { id: string; nombre: string | null; check_in_hecho: string | null } | null;
  if (error || !entrada || entrada.check_in_hecho !== "Sí" || !entrada.nombre?.trim()) return noDisponible;

  const { data: doc } = await supabase
    .from("asistentes_congreso")
    .select("documento_identidad")
    .eq("id", entrada.id)
    .maybeSingle();
  const edicion = await cargarEdicionCertificado(supabase, edicionId);
  if (!edicion) return noDisponible;

  const nombre = entrada.nombre.trim();
  const pdf = await construirCertificado({ nombre, documento: doc?.documento_identidad?.trim() || null }, edicion);
  return respuestaPdf(pdf, nombreArchivoCertificado(edicion.edicionNombre, nombre));
}
