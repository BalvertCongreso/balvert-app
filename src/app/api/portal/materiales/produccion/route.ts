import { NextResponse, after } from "next/server";
import { crearClienteServicio } from "@/lib/supabaseServidor";
import { sesionPortal } from "@/lib/portal";
import { actualizarFichaComo } from "@/lib/patrocinadorArchivos";
import {
  LIMITE_CAMBIOS_POR_HORA,
  MAX_ROLLUPS,
  MENSAJE_LIMITE,
  accionesUltimaHora,
  autorPortal,
  avisarSecretaria,
  crearTareaRevision,
  edicionMaterial,
  euros,
  fichaDeMiEmpresa,
  nombreEmpresa,
  precioOfrecido,
  registrarAccion,
} from "@/lib/portalMateriales";

export const runtime = "nodejs";

// Pedido de producción desde el portal: cuántos rollups quiere que le
// fabriquemos y si quiere el vinilado del mostrador. Solo cambia
// rollups_solicitados, rollup_por_nuestra_cuenta y vinilado_por_nuestra_cuenta
// (nada más de la ficha). No hay cobro online: Ariadna lo factura en Holded.
export async function POST(req: Request) {
  const sesion = await sesionPortal();
  if (!sesion) return NextResponse.json({ error: "Tu sesión ha caducado. Vuelve a entrar." }, { status: 401 });
  const body = await req.json().catch(() => null);

  const supabase = crearClienteServicio();
  const edicion = await edicionMaterial(supabase);
  const ficha = edicion ? await fichaDeMiEmpresa(supabase, edicion.id, sesion.email, body?.patrocinador_id) : null;
  if (!edicion || !ficha) return NextResponse.json({ error: "Empresa no encontrada." }, { status: 404 });

  const precioRollup = precioOfrecido(edicion.precio_rollup);
  const precioVinilado = ficha.tiene_stand === "Sí" ? precioOfrecido(edicion.precio_vinilado) : null;
  const cambios: Record<string, string | number> = {};
  const lineas: string[] = [];
  const resumen: string[] = [];

  if (body?.rollups !== undefined) {
    const rollups = body.rollups;
    if (typeof rollups !== "number" || !Number.isInteger(rollups) || rollups < 0 || rollups > MAX_ROLLUPS) {
      return NextResponse.json({ error: `El número de rollups tiene que estar entre 0 y ${MAX_ROLLUPS}.` }, { status: 400 });
    }
    if (rollups !== (ficha.rollups_solicitados ?? 0)) {
      if (!precioRollup) return NextResponse.json({ error: "La producción de rollups no está disponible." }, { status: 400 });
      cambios.rollups_solicitados = rollups;
      cambios.rollup_por_nuestra_cuenta = rollups > 0 ? "Sí" : "No";
      if (rollups > 0) {
        const texto = `${rollups} rollup${rollups === 1 ? "" : "s"} (${euros(rollups * precioRollup)} + IVA)`;
        resumen.push(texto);
        lineas.push(`Rollups: ${texto}. Antes: ${ficha.rollups_solicitados ?? 0}.`);
      } else {
        resumen.push("ningún rollup");
        lineas.push(`Rollups: ya no quiere ninguno. Antes: ${ficha.rollups_solicitados ?? 0}.`);
      }
    }
  }

  if (body?.vinilado !== undefined) {
    if (typeof body.vinilado !== "boolean") return NextResponse.json({ error: "Datos no válidos." }, { status: 400 });
    const valor = body.vinilado ? "Sí" : "No";
    if (valor !== (ficha.vinilado_por_nuestra_cuenta ?? "No")) {
      if (!precioVinilado) return NextResponse.json({ error: "El vinilado del mostrador no está disponible." }, { status: 400 });
      cambios.vinilado_por_nuestra_cuenta = valor;
      if (body.vinilado) {
        resumen.push(`vinilado del mostrador (${euros(precioVinilado)} + IVA)`);
        lineas.push(`Vinilado del mostrador: SÍ (${euros(precioVinilado)} + IVA).`);
      } else {
        resumen.push("sin vinilado del mostrador");
        lineas.push("Vinilado del mostrador: ya NO lo quiere.");
      }
    }
  }

  if (Object.keys(cambios).length === 0) return NextResponse.json({ ok: true, sinCambios: true });

  if ((await accionesUltimaHora(supabase, sesion.email, ["produccion", "ponente"])) >= LIMITE_CAMBIOS_POR_HORA) {
    return NextResponse.json({ error: MENSAJE_LIMITE }, { status: 429 });
  }

  try {
    await actualizarFichaComo(supabase, ficha.id, autorPortal(sesion.email), cambios);
    await registrarAccion(supabase, sesion.email, "produccion", ficha.id);
  } catch (e) {
    console.error("portal/materiales/produccion:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "No se pudo guardar. Inténtalo de nuevo." }, { status: 500 });
  }

  const empresa = nombreEmpresa(ficha);
  const detalle = [`Empresa: ${empresa}`, `Pedido por: ${sesion.email}`, ...lineas];
  try {
    await crearTareaRevision(
      supabase,
      edicion.id,
      ficha.id,
      `Revisar pedido de rollups/vinilado de ${empresa}`,
      [
        "Cambio en el pedido de producción hecho por la empresa desde su área de cliente (portal).",
        "",
        ...detalle,
        "",
        "No se ha cobrado nada online: si procede, factúralo en Holded.",
      ].join("\n")
    );
  } catch (e) {
    console.error("portal/materiales/produccion: no se pudo crear la tarea", e instanceof Error ? e.message : e);
  }
  after(() => avisarSecretaria(`${empresa} ha pedido ${resumen.join(" y ")}`, detalle, ficha.id));

  return NextResponse.json({ ok: true });
}
