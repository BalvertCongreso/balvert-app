import { NextResponse } from "next/server";
import { crearClienteServicio } from "@/lib/supabaseServidor";
import { documentosEmpresa, edicionPortal, idEdicionActiva } from "@/lib/portal";
import { sesionEmpresa } from "@/lib/portalEmpresa";
import { PONENCIA_POR_CATEGORIA } from "@/lib/datosEmpresa";
import { estadoPatrocinadores, type EstadoPatrocinador } from "@/lib/zonaPatrocinadores";

// Pasos de «Lo que os falta» (pestaña Resumen): los mismos pendientes que
// enseña la Zona de patrocinadores del panel (estadoPatrocinadores) más las
// invitaciones por asignar. «Sin acceso creado» y «Material nuevo sin
// revisar» son de la organización y no salen aquí.
interface PasoResumen {
  titulo: string;
  detalle: string;
  hecho: boolean;
  pestana: "material" | "ponencia" | "invitaciones";
}

function pasosResumen(e: EstadoPatrocinador): PasoResumen[] {
  const pasos: PasoResumen[] = [
    {
      titulo: "Logo de la empresa",
      detalle: e.logoRecibido ? "Recibido" : "Enviadnos el logo en «Material»",
      hecho: e.logoRecibido,
      pestana: "material",
    },
  ];
  if (e.categoria && PONENCIA_POR_CATEGORIA[e.categoria]) {
    pasos.push({
      titulo: "¿Vais a hacer ponencia?",
      detalle:
        e.ponencia === "sin_responder" ? "Falta que nos respondáis" : e.ponencia ? "Sí, vais a hacer ponencia" : "No vais a hacer ponencia",
      hecho: e.ponencia !== "sin_responder",
      pestana: "ponencia",
    });
  }
  if (e.ponencia === "recibida" || e.ponencia === "pendiente") {
    pasos.push({
      titulo: "Presentación de la ponencia",
      detalle: e.ponencia === "recibida" ? "Recibida" : "Falta que nos la enviéis",
      hecho: e.ponencia === "recibida",
      pestana: "ponencia",
    });
  }
  if (e.ponenteCompleto !== null) {
    pasos.push({
      titulo: "Datos del ponente",
      detalle: e.ponenteCompleto ? "Completos" : "Faltan datos del ponente",
      hecho: e.ponenteCompleto,
      pestana: "ponencia",
    });
  }
  const { asignados, incluidos } = e.invitados;
  if (incluidos > 0) {
    const quedan = Math.max(0, incluidos - asignados);
    pasos.push({
      titulo: "Invitaciones",
      detalle: quedan === 0 ? `Todas asignadas (${incluidos})` : `Os quedan ${quedan} de ${incluidos} por asignar`,
      hecho: quedan === 0,
      pestana: "invitaciones",
    });
  }
  return pasos;
}

export const runtime = "nodejs";

// Cabecera y documentos de la zona de empresa (/portal/empresa), con la
// empresa de la sesión de empresa. No acepta ningún parámetro del navegador.
export async function GET() {
  const sesion = await sesionEmpresa();
  if (!sesion) return NextResponse.json({ error: "Sesión no encontrada." }, { status: 401 });

  const supabase = crearClienteServicio();
  const edicionId = await idEdicionActiva(supabase);
  const [{ data: ficha }, edicion] = await Promise.all([
    supabase.from("patrocinadores").select("empresa_entidad, categoria, edicion_id").eq("id", sesion.patrocinadorId).maybeSingle(),
    edicionPortal(supabase, edicionId),
  ]);
  if (!ficha) return NextResponse.json({ error: "Sesión no encontrada." }, { status: 401 });

  let documentos: { id: string; titulo: string; descripcion: string | null; nombre_archivo: string; destino: string; creado: string }[] = [];
  let resumen: { pasos: PasoResumen[]; invitados: EstadoPatrocinador["invitados"]; ponencia: EstadoPatrocinador["ponencia"] } | null =
    null;
  if (edicionId && ficha.edicion_id === edicionId) {
    try {
      // Sin ruta_archivo: la descarga va siempre por /api/portal/empresa/documento.
      const [docs, { estados }] = await Promise.all([
        documentosEmpresa(supabase, edicionId, sesion.patrocinadorId),
        estadoPatrocinadores(supabase, edicionId, sesion.patrocinadorId),
      ]);
      documentos = docs.map(({ id, titulo, descripcion, nombre_archivo, destino, creado }) => ({
        id,
        titulo,
        descripcion,
        nombre_archivo,
        destino,
        creado,
      }));
      const estado = estados[0];
      if (estado) resumen = { pasos: pasosResumen(estado), invitados: estado.invitados, ponencia: estado.ponencia };
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
      edicionNombre: edicion.nombre,
      congreso: edicion.congreso,
      deEstaEdicion: !!edicionId && ficha.edicion_id === edicionId,
      modoOrganizacion: sesion.modoOrganizacion,
      organizador: sesion.organizador,
      documentos,
      resumen,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
