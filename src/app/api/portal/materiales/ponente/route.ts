import { NextResponse, after } from "next/server";
import { crearClienteServicio } from "@/lib/supabaseServidor";
import { EMAIL_REGEX } from "@/lib/portal";
import { autorEmpresa, claveAcciones, sesionEmpresa } from "@/lib/portalEmpresa";
import { actualizarFichaComo } from "@/lib/patrocinadorArchivos";
import { PONENCIA_POR_CATEGORIA } from "@/lib/datosEmpresa";
import {
  LIMITE_CAMBIOS_POR_HORA,
  MENSAJE_LIMITE,
  accionesUltimaHora,
  avisarSecretaria,
  crearTareaRevision,
  edicionMaterial,
  fichaDeLaSesion,
  nombreEmpresa,
  registrarAccion,
} from "@/lib/portalMateriales";

export const runtime = "nodejs";

const CAMPOS_TEXTO = [
  { clave: "ponente_nombre", etiqueta: "Nombre del ponente", max: 200 },
  { clave: "ponente_cargo", etiqueta: "Cargo", max: 200 },
  { clave: "ponente_email", etiqueta: "Email del ponente", max: 200 },
  { clave: "ponente_telefono", etiqueta: "Teléfono del ponente", max: 40 },
  { clave: "ponencia_titulo", etiqueta: "Título de la ponencia", max: 300 },
] as const;
// Categorías sin ponencia incluida (la decide la organización): sin tope propio.
const MAX_DURACION_GENERAL = 600;
const TELEFONO_REGEX = /^[+\d][\d\s().-]{5,39}$/;

// Ponencia desde la zona de empresa. Diamante y Oro (la incluyen) responden
// «¿Vais a hacer ponencia?» (tiene_ponencia) y rellenan los datos, con la
// duración máxima de su patrocinio. En las demás categorías solo se rellenan
// los datos si la organización ha puesto «¿Tiene ponencia?: Sí».
export async function POST(req: Request) {
  const sesion = await sesionEmpresa();
  if (!sesion) return NextResponse.json({ error: "Tu sesión ha caducado. Vuelve a entrar." }, { status: 401 });
  const body = await req.json().catch(() => null);

  const supabase = crearClienteServicio();
  const edicion = await edicionMaterial(supabase);
  const ficha = edicion ? await fichaDeLaSesion(supabase, edicion.id, sesion.patrocinadorId) : null;
  if (!edicion || !ficha) return NextResponse.json({ error: "Empresa no encontrada." }, { status: 404 });

  const regla = ficha.categoria ? PONENCIA_POR_CATEGORIA[ficha.categoria] : undefined;
  const nuevos: Record<string, string | number | null> = {};

  if (body?.tiene_ponencia !== undefined) {
    if (!regla) return NextResponse.json({ error: "La ponencia de tu patrocinio la decide la organización." }, { status: 403 });
    if (body.tiene_ponencia !== "Sí" && body.tiene_ponencia !== "No") {
      return NextResponse.json({ error: "Responde si vais a hacer ponencia." }, { status: 400 });
    }
    nuevos.tiene_ponencia = body.tiene_ponencia;
  }
  const tendra = (nuevos.tiene_ponencia ?? ficha.tiene_ponencia) === "Sí";

  if (tendra) {
    for (const { clave, etiqueta, max } of CAMPOS_TEXTO) {
      const valor = body?.[clave];
      if (valor === undefined) continue;
      if (valor !== null && typeof valor !== "string") return NextResponse.json({ error: "Datos no válidos." }, { status: 400 });
      const limpio = (valor ?? "").trim();
      if (limpio.length > max) {
        return NextResponse.json({ error: `${etiqueta}: demasiado largo (máximo ${max} caracteres).` }, { status: 400 });
      }
      if (limpio && clave === "ponente_email" && !EMAIL_REGEX.test(limpio)) {
        return NextResponse.json({ error: "El email del ponente no tiene un formato válido." }, { status: 400 });
      }
      if (limpio && clave === "ponente_telefono" && !TELEFONO_REGEX.test(limpio)) {
        return NextResponse.json({ error: "El teléfono del ponente no tiene un formato válido." }, { status: 400 });
      }
      nuevos[clave] = limpio || null;
    }
    const duracion = body?.ponencia_duracion_min;
    const maximo = regla?.maxMinutos ?? MAX_DURACION_GENERAL;
    if (duracion === null || duracion === "") {
      nuevos.ponencia_duracion_min = null;
    } else if (duracion !== undefined) {
      if (typeof duracion !== "number" || !Number.isInteger(duracion) || duracion < 1) {
        return NextResponse.json({ error: "La duración tiene que ser un número de minutos (sin decimales)." }, { status: 400 });
      }
      if (duracion > maximo) {
        return NextResponse.json(
          { error: regla ? `La duración máxima de vuestra ponencia es de ${maximo} minutos. ${regla.explicacion}` : "Duración no válida." },
          { status: 400 }
        );
      }
      nuevos.ponencia_duracion_min = duracion;
    }
  } else if (Object.keys(nuevos).length === 0) {
    return NextResponse.json({ error: "Tu patrocinio no tiene ponencia." }, { status: 403 });
  }

  const cambios: Record<string, string | number | null> = {};
  for (const [clave, valor] of Object.entries(nuevos)) {
    if (valor !== ((ficha as unknown as Record<string, unknown>)[clave] ?? null)) cambios[clave] = valor;
  }
  if (Object.keys(cambios).length === 0) return NextResponse.json({ ok: true, sinCambios: true });

  if ((await accionesUltimaHora(supabase, claveAcciones(sesion), ["produccion", "ponente"])) >= LIMITE_CAMBIOS_POR_HORA) {
    return NextResponse.json({ error: MENSAJE_LIMITE }, { status: 429 });
  }
  try {
    await actualizarFichaComo(supabase, ficha.id, autorEmpresa(sesion), cambios);
    await registrarAccion(supabase, claveAcciones(sesion), "ponente", ficha.id);
  } catch (e) {
    console.error("portal/materiales/ponente:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "No se pudo guardar. Inténtalo de nuevo." }, { status: 500 });
  }

  const empresa = nombreEmpresa(ficha);
  const final = { ...(ficha as unknown as Record<string, unknown>), ...cambios };
  const detalle = [
    `Empresa: ${empresa}`,
    `Enviado por: ${autorEmpresa(sesion)}`,
    `¿Hace ponencia?: ${final.tiene_ponencia ?? "—"}`,
    ...(tendra
      ? [
          ...CAMPOS_TEXTO.map(({ clave, etiqueta }) => `${etiqueta}: ${final[clave] ?? "—"}`),
          `Duración (minutos): ${final.ponencia_duracion_min ?? "—"}`,
        ]
      : []),
  ];
  const titulo = tendra ? `Revisar datos del ponente de ${empresa}` : `${empresa} no hará ponencia`;
  try {
    await crearTareaRevision(
      supabase,
      edicion.id,
      ficha.id,
      titulo,
      ["Datos de la ponencia rellenados por la empresa desde su zona (portal).", "", ...detalle].join("\n")
    );
  } catch (e) {
    console.error("portal/materiales/ponente: no se pudo crear la tarea", e instanceof Error ? e.message : e);
  }
  after(() =>
    avisarSecretaria(tendra ? `${empresa} ha enviado los datos del ponente` : `${empresa} ha respondido que no hará ponencia`, detalle, ficha.id)
  );

  return NextResponse.json({ ok: true });
}
