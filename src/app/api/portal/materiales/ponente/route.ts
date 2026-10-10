import { NextResponse, after } from "next/server";
import { crearClienteServicio } from "@/lib/supabaseServidor";
import { sesionPortal } from "@/lib/portal";
import { actualizarFichaComo } from "@/lib/patrocinadorArchivos";
import {
  LIMITE_CAMBIOS_POR_HORA,
  MENSAJE_LIMITE,
  accionesUltimaHora,
  autorPortal,
  avisarSecretaria,
  crearTareaRevision,
  edicionMaterial,
  fichaDeMiEmpresa,
  nombreEmpresa,
  registrarAccion,
} from "@/lib/portalMateriales";

export const runtime = "nodejs";

const CAMPOS_TEXTO = [
  { clave: "ponente_nombre", etiqueta: "Nombre del ponente", max: 200 },
  { clave: "ponente_cargo", etiqueta: "Cargo", max: 200 },
  { clave: "ponencia_titulo", etiqueta: "Título de la ponencia", max: 300 },
] as const;
const MAX_DURACION = 600;

// Datos del ponente desde el portal. Solo si la ficha tiene "¿Tiene
// ponencia?: Sí", y solo estos 4 campos.
export async function POST(req: Request) {
  const sesion = await sesionPortal();
  if (!sesion) return NextResponse.json({ error: "Tu sesión ha caducado. Vuelve a entrar." }, { status: 401 });
  const body = await req.json().catch(() => null);

  const supabase = crearClienteServicio();
  const edicion = await edicionMaterial(supabase);
  const ficha = edicion ? await fichaDeMiEmpresa(supabase, edicion.id, sesion.email, body?.patrocinador_id) : null;
  if (!edicion || !ficha) return NextResponse.json({ error: "Empresa no encontrada." }, { status: 404 });
  if (ficha.tiene_ponencia !== "Sí") {
    return NextResponse.json({ error: "Tu patrocinio no tiene ponencia." }, { status: 403 });
  }

  const nuevos: Record<string, string | number | null> = {};
  for (const { clave, etiqueta, max } of CAMPOS_TEXTO) {
    const valor = body?.[clave];
    if (valor !== null && valor !== undefined && typeof valor !== "string") {
      return NextResponse.json({ error: "Datos no válidos." }, { status: 400 });
    }
    const limpio = (valor ?? "").trim();
    if (limpio.length > max) {
      return NextResponse.json({ error: `${etiqueta}: demasiado largo (máximo ${max} caracteres).` }, { status: 400 });
    }
    nuevos[clave] = limpio || null;
  }
  const duracion = body?.ponencia_duracion_min;
  if (duracion === null || duracion === undefined || duracion === "") {
    nuevos.ponencia_duracion_min = null;
  } else if (typeof duracion === "number" && Number.isInteger(duracion) && duracion >= 1 && duracion <= MAX_DURACION) {
    nuevos.ponencia_duracion_min = duracion;
  } else {
    return NextResponse.json({ error: "La duración tiene que ser un número de minutos (sin decimales)." }, { status: 400 });
  }

  const cambios: Record<string, string | number | null> = {};
  for (const [clave, valor] of Object.entries(nuevos)) {
    if (valor !== (ficha[clave as keyof typeof ficha] ?? null)) cambios[clave] = valor;
  }
  if (Object.keys(cambios).length === 0) return NextResponse.json({ ok: true, sinCambios: true });

  if ((await accionesUltimaHora(supabase, sesion.email, ["produccion", "ponente"])) >= LIMITE_CAMBIOS_POR_HORA) {
    return NextResponse.json({ error: MENSAJE_LIMITE }, { status: 429 });
  }
  try {
    await actualizarFichaComo(supabase, ficha.id, autorPortal(sesion.email), cambios);
    await registrarAccion(supabase, sesion.email, "ponente", ficha.id);
  } catch (e) {
    console.error("portal/materiales/ponente:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "No se pudo guardar. Inténtalo de nuevo." }, { status: 500 });
  }

  const empresa = nombreEmpresa(ficha);
  const detalle = [
    `Empresa: ${empresa}`,
    `Enviado por: ${sesion.email}`,
    ...CAMPOS_TEXTO.map(({ clave, etiqueta }) => `${etiqueta}: ${nuevos[clave] ?? "—"}`),
    `Duración (minutos): ${nuevos.ponencia_duracion_min ?? "—"}`,
  ];
  try {
    await crearTareaRevision(
      supabase,
      edicion.id,
      ficha.id,
      `Revisar datos del ponente de ${empresa}`,
      ["Datos del ponente rellenados por la empresa desde su área de cliente (portal).", "", ...detalle].join("\n")
    );
  } catch (e) {
    console.error("portal/materiales/ponente: no se pudo crear la tarea", e instanceof Error ? e.message : e);
  }
  after(() => avisarSecretaria(`${empresa} ha enviado los datos del ponente`, detalle, ficha.id));

  return NextResponse.json({ ok: true });
}
