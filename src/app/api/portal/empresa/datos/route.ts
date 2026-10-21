import { NextResponse } from "next/server";
import { crearClienteServicio } from "@/lib/supabaseServidor";
import { documentosEmpresa, idEdicionActiva } from "@/lib/portal";
import { sesionEmpresa } from "@/lib/portalEmpresa";

export const runtime = "nodejs";

// Cabecera y documentos de la zona de empresa (/portal/empresa), con la
// empresa de la sesión de empresa. No acepta ningún parámetro del navegador.
export async function GET() {
  const sesion = await sesionEmpresa();
  if (!sesion) return NextResponse.json({ error: "Sesión no encontrada." }, { status: 401 });

  const supabase = crearClienteServicio();
  const edicionId = await idEdicionActiva(supabase);
  const [{ data: ficha }, { data: edicion }] = await Promise.all([
    supabase.from("patrocinadores").select("empresa_entidad, categoria, edicion_id").eq("id", sesion.patrocinadorId).maybeSingle(),
    edicionId ? supabase.from("ediciones").select("nombre").eq("id", edicionId).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  if (!ficha) return NextResponse.json({ error: "Sesión no encontrada." }, { status: 401 });

  let documentos: { id: string; titulo: string; descripcion: string | null; nombre_archivo: string }[] = [];
  if (edicionId && ficha.edicion_id === edicionId) {
    try {
      // Sin ruta_archivo: la descarga va siempre por /api/portal/empresa/documento.
      documentos = (await documentosEmpresa(supabase, edicionId, sesion.patrocinadorId)).map(
        ({ id, titulo, descripcion, nombre_archivo }) => ({ id, titulo, descripcion, nombre_archivo })
      );
    } catch (e) {
      console.error("portal/empresa/datos:", e instanceof Error ? e.message : e);
      return NextResponse.json({ error: "No se pudieron cargar los datos de la empresa." }, { status: 500 });
    }
  }

  return NextResponse.json(
    {
      usuario: sesion.usuario,
      empresa: ficha.empresa_entidad,
      categoria: ficha.categoria,
      edicionNombre: edicion?.nombre ?? null,
      deEstaEdicion: !!edicionId && ficha.edicion_id === edicionId,
      modoOrganizacion: sesion.modoOrganizacion,
      organizador: sesion.organizador,
      documentos,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
