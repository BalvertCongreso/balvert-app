import { NextResponse } from "next/server";
import { crearClienteServicio } from "@/lib/supabaseServidor";
import { NOMBRE_EVENTO_CLIENTE, NOMBRE_TABLA_SQL, type Tabla } from "@/lib/entradaDatos";
import { CAMPOS_FACTURACION, validarDatosFacturacion } from "@/lib/factura";
import { CAMPO_EMAIL, idEdicionActiva, patronEmailExacto, sesionPortal } from "@/lib/portal";

export const runtime = "nodejs";

const TABLAS: Tabla[] = ["congreso", "gala", "excursion"];
const CAMPO_NOMBRE: Record<Tabla, string> = { congreso: "nombre", gala: "nombre_asistente", excursion: "nombre_asistente" };
const CAMPO_PRECIO: Record<Tabla, string> = { congreso: "precio", gala: "precio_entrada", excursion: "precio" };

const euros = (n: number) => n.toLocaleString("es-ES", { style: "currency", currency: "EUR" });

// Solicitud de factura desde el portal, para una compra online (identificada
// por su referencia de pago de Stripe). Solo vale para compras con entradas
// a nombre del email de la sesión. Crea una tarea para Ariadna con los datos
// fiscales y lo comprado: la factura se hace a mano en Holded.
export async function POST(req: Request) {
  const sesion = await sesionPortal();
  if (!sesion) {
    return NextResponse.json({ error: "Tu sesión ha caducado. Vuelve a entrar." }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const referencia = typeof body?.referencia === "string" ? body.referencia : "";
  const datos = validarDatosFacturacion(body?.datos);
  if (typeof datos === "string") {
    return NextResponse.json({ error: datos }, { status: 400 });
  }

  const supabase = crearClienteServicio();
  const edicionId = await idEdicionActiva(supabase);
  const noEncontrada = NextResponse.json({ error: "Compra no encontrada." }, { status: 404 });
  if (!edicionId || !referencia) return noEncontrada;

  // Las entradas de esa compra que son de esta persona. Si no hay ninguna,
  // la compra no es suya (o no existe): no se dice cuál de las dos.
  const lineas: string[] = [];
  let reciboUrl: string | null = null;
  for (const tabla of TABLAS) {
    const { data, error } = await supabase
      .from(NOMBRE_TABLA_SQL[tabla])
      .select(`${CAMPO_NOMBRE[tabla]}, ${CAMPO_PRECIO[tabla]}, recibo_url`)
      .eq("edicion_id", edicionId)
      .eq("referencia_pago_online", referencia)
      .ilike(CAMPO_EMAIL[tabla], patronEmailExacto(sesion.email));
    if (error) {
      console.error("portal/factura: fallo leyendo entradas", error.code, error.message);
      return NextResponse.json({ error: "No se pudo enviar la solicitud." }, { status: 500 });
    }
    for (const fila of (data ?? []) as unknown as Record<string, unknown>[]) {
      const precio = fila[CAMPO_PRECIO[tabla]] as number | null;
      lineas.push(
        `- ${NOMBRE_EVENTO_CLIENTE[tabla]} — ${fila[CAMPO_NOMBRE[tabla]] ?? "(sin nombre)"}${precio != null ? ` — ${euros(precio)}` : ""}`
      );
      reciboUrl ??= (fila.recibo_url as string | null) ?? null;
    }
  }
  if (lineas.length === 0) return noEncontrada;

  const { data: compra } = await supabase
    .from("compras_pendientes")
    .select("importe_total_cents, usada_en")
    .eq("referencia_pago_online", referencia)
    .maybeSingle();

  // Una sola solicitud por compra (referencia única en la tabla).
  const { data: solicitud, error: errorSolicitud } = await supabase
    .from("solicitudes_factura")
    .insert({ email: sesion.email, referencia_pago_online: referencia, datos_facturacion: datos })
    .select("id")
    .single();
  if (errorSolicitud || !solicitud) {
    if (errorSolicitud?.code === "23505") {
      return NextResponse.json({ error: "Ya has pedido la factura de esta compra." }, { status: 409 });
    }
    console.error("portal/factura: no se pudo guardar", errorSolicitud?.code, errorSolicitud?.message);
    return NextResponse.json({ error: "No se pudo enviar la solicitud." }, { status: 500 });
  }

  const notas = [
    "Solicitud de factura hecha por el cliente desde su área (portal).",
    "",
    "DATOS FISCALES",
    ...CAMPOS_FACTURACION.map(({ clave, etiqueta }) => `- ${etiqueta}: ${datos[clave] ?? "—"}`),
    "",
    "COMPRA",
    `- Email del comprador: ${sesion.email}`,
    ...(compra?.usada_en ? [`- Fecha de pago: ${new Date(compra.usada_en).toLocaleDateString("es-ES")}`] : []),
    ...(compra ? [`- Importe total cobrado: ${euros(compra.importe_total_cents / 100)}`] : []),
    `- Referencia de pago (Stripe): ${referencia}`,
    ...(reciboUrl ? [`- Recibo de Stripe: ${reciboUrl}`] : []),
    "",
    "ENTRADAS",
    ...lineas,
    "",
    `CUANDO LA TENGAS: súbela en Documentos → "Una persona (por su email)" → ${sesion.email}. Deja marcado "Avisarle por email": le llegará un aviso y la verá en su área de cliente.`,
  ].join("\n");

  const { data: tarea, error: errorTarea } = await supabase
    .from("tareas")
    .insert({
      edicion_id: edicionId,
      responsable: "🟣 Ariadna",
      tarea: `Crear factura en Holded — ${datos.razon_social}`,
      fase: "General",
      prioridad: "🟡 Media",
      estado: "⏳ Pendiente",
      notas,
    })
    .select("id")
    .single();
  if (errorTarea || !tarea) {
    // Sin tarea, nadie se enteraría: se deshace para que pueda reintentarlo.
    await supabase.from("solicitudes_factura").delete().eq("id", solicitud.id);
    console.error("portal/factura: no se pudo crear la tarea", errorTarea?.code, errorTarea?.message);
    return NextResponse.json({ error: "No se pudo enviar la solicitud. Inténtalo de nuevo." }, { status: 500 });
  }
  await supabase.from("solicitudes_factura").update({ tarea_id: tarea.id }).eq("id", solicitud.id);

  return NextResponse.json({ ok: true });
}
