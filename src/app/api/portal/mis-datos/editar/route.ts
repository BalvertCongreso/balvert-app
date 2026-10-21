import { NextResponse } from "next/server";
import { crearClienteServicio } from "@/lib/supabaseServidor";
import { NOMBRE_TABLA_SQL, type Tabla } from "@/lib/entradaDatos";
import { CAMPO_EMAIL, idEdicionActiva, patronEmailExacto, sesionPortal } from "@/lib/portal";
import { AYUDA_DOCUMENTO, esTipoDocumento, nombreTieneApellidos, validarDocumento } from "@/lib/documentoIdentidad";
import { MENUS_GALA } from "@/lib/invitados";
import { LIMITE_CAMBIOS_POR_HORA, MENSAJE_LIMITE, accionesUltimaHora, registrarAccion } from "@/lib/portalMateriales";

export const runtime = "nodejs";

const TELEFONO_REGEX = /^[+\d][\d\s().-]{5,39}$/;
const CAMPO_NOMBRE: Record<Tabla, string> = { congreso: "nombre", gala: "nombre_asistente", excursion: "nombre_asistente" };

// «Editar mis datos» de una entrada desde la zona personal. Solo filas del
// email de la sesión, y solo: nombre y documento (hasta el check-in de esa
// entrada), teléfono (Congreso) y menú/alergias (Cena de gala). El email no
// se cambia (es su acceso). Queda en el historial como "Portal: <email>".
export async function POST(req: Request) {
  const sesion = await sesionPortal();
  if (!sesion) return NextResponse.json({ error: "Tu sesión ha caducado. Vuelve a entrar." }, { status: 401 });
  const body = await req.json().catch(() => null);
  const tabla = body?.tabla as Tabla;
  const id = typeof body?.id === "string" ? body.id : "";
  if (!Object.hasOwn(NOMBRE_TABLA_SQL, tabla) || !id) return NextResponse.json({ error: "Datos no válidos." }, { status: 400 });

  const supabase = crearClienteServicio();
  const edicionId = await idEdicionActiva(supabase);
  const noEncontrada = NextResponse.json({ error: "Entrada no encontrada." }, { status: 404 });
  if (!edicionId) return noEncontrada;
  const columnas = ["id", CAMPO_NOMBRE[tabla], "check_in_hecho", ...(tabla === "congreso" ? ["telefono"] : []), ...(tabla === "gala" ? ["menu", "alergias_intolerancias"] : [])];
  const { data, error } = await supabase
    .from(NOMBRE_TABLA_SQL[tabla])
    .select(columnas.join(", "))
    .eq("id", id)
    .eq("edicion_id", edicionId)
    .ilike(CAMPO_EMAIL[tabla], patronEmailExacto(sesion.email))
    .maybeSingle();
  const fila = data as unknown as Record<string, string | null> | null;
  if (error || !fila) return noEncontrada;
  const conCheckIn = fila.check_in_hecho === "Sí";

  const cambios: Record<string, string | null> = {};
  const texto = (v: unknown) => (typeof v === "string" ? v.trim().replace(/\s+/g, " ") : null);

  if (body.nombre !== undefined) {
    const nombre = texto(body.nombre);
    if (nombre !== (fila[CAMPO_NOMBRE[tabla]] ?? null)) {
      if (conCheckIn) return NextResponse.json({ error: "Ya no se puede modificar: tu entrada ya está registrada." }, { status: 403 });
      if (!nombre || !nombreTieneApellidos(nombre) || nombre.length > 150) {
        return NextResponse.json({ error: "Escribe el nombre y los apellidos." }, { status: 400 });
      }
      cambios[CAMPO_NOMBRE[tabla]] = nombre;
    }
  }

  if (body.documento !== undefined && body.documento !== "") {
    if (conCheckIn) return NextResponse.json({ error: "Ya no se puede modificar: tu entrada ya está registrada." }, { status: 403 });
    const tipo: unknown = body.tipo_documento;
    if (!esTipoDocumento(tipo) || typeof body.documento !== "string") {
      return NextResponse.json({ error: "Elige el tipo de documento." }, { status: 400 });
    }
    const documento = validarDocumento(body.documento, tipo);
    if (!documento) return NextResponse.json({ error: AYUDA_DOCUMENTO[tipo] }, { status: 400 });
    cambios.documento_identidad = documento;
  }

  if (body.telefono !== undefined) {
    if (tabla !== "congreso") return NextResponse.json({ error: "Datos no válidos." }, { status: 400 });
    const telefono = texto(body.telefono) || null;
    if (telefono && !TELEFONO_REGEX.test(telefono)) {
      return NextResponse.json({ error: "El teléfono no tiene un formato válido." }, { status: 400 });
    }
    if (telefono !== (fila.telefono ?? null)) cambios.telefono = telefono;
  }

  if (body.menu !== undefined || body.alergias !== undefined) {
    if (tabla !== "gala") return NextResponse.json({ error: "Datos no válidos." }, { status: 400 });
    if (body.menu !== undefined) {
      if (!(MENUS_GALA as readonly string[]).includes(body.menu)) return NextResponse.json({ error: "Elige el menú." }, { status: 400 });
      if (body.menu !== fila.menu) cambios.menu = body.menu;
    }
    if (body.alergias !== undefined) {
      const alergias = texto(body.alergias) || null;
      if (alergias && alergias.length > 500) return NextResponse.json({ error: "Alergias: demasiado largo." }, { status: 400 });
      if (alergias !== (fila.alergias_intolerancias ?? null)) cambios.alergias_intolerancias = alergias;
    }
  }

  if (Object.keys(cambios).length === 0) return NextResponse.json({ ok: true, sinCambios: true });
  if ((await accionesUltimaHora(supabase, sesion.email, ["mis_datos"])) >= LIMITE_CAMBIOS_POR_HORA) {
    return NextResponse.json({ error: MENSAJE_LIMITE }, { status: 429 });
  }
  const { error: errorGuardado } = await supabase.rpc("actualizar_entrada_como", {
    p_tabla: NOMBRE_TABLA_SQL[tabla],
    p_id: id,
    p_autor: `Portal: ${sesion.email}`,
    p_campos: cambios,
  });
  if (errorGuardado) {
    console.error("portal/mis-datos/editar:", errorGuardado.message);
    return NextResponse.json({ error: "No se pudo guardar. Inténtalo de nuevo." }, { status: 500 });
  }
  await registrarAccion(supabase, sesion.email, "mis_datos", `${tabla}:${id}`).catch(() => null);
  return NextResponse.json({ ok: true });
}
