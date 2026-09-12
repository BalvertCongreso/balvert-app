import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import type Stripe from "stripe";
import { crearClienteServicio } from "@/lib/supabaseServidor";
import { crearClienteStripe } from "@/lib/stripe";
import { enviarEmailConVariasEntradas, type EntradaParaEmail } from "@/lib/entradaEmail";
import { NOMBRE_TABLA_SQL, construirDatosEntrada, type Tabla } from "@/lib/entradaDatos";

export const runtime = "nodejs";

const TIPOS: Tabla[] = ["congreso", "gala", "excursion"];

// Único sitio del proyecto donde se genera una entrada de pago online: la
// página de "gracias" a la que Stripe redirige tras el checkout es solo
// visual (cualquiera podría llegar a esa URL sin haber pagado), así que las
// filas en asistentes_congreso/gala/excursion y el email con los QR SOLO se
// crean aquí, tras verificar la firma del evento con STRIPE_WEBHOOK_SECRET.
//
// Fase 7c: una misma sesión de Stripe puede combinar varios tipos de entrada
// (Congreso + Gala + Excursión juntos o por separado) — la metadata trae un
// grupo "nombres_<tipo>" por cada tipo comprado. Se procesa cada grupo con
// la misma lógica que en el hito anterior (idempotencia por
// referencia_pago_online, propia de cada tabla) y, al final, se manda un
// único email al comprador con todas las entradas generadas en esta compra.
export async function POST(req: Request) {
  const firma = req.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!firma || !webhookSecret) {
    return NextResponse.json({ error: "Webhook de Stripe no configurado en el servidor." }, { status: 500 });
  }

  const cuerpoCrudo = await req.text();
  const stripe = crearClienteStripe();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(cuerpoCrudo, firma, webhookSecret);
  } catch (e) {
    const mensaje = e instanceof Error ? e.message : "Firma inválida.";
    return NextResponse.json({ error: `Firma no válida: ${mensaje}` }, { status: 400 });
  }

  if (event.type !== "checkout.session.completed") {
    return NextResponse.json({ recibido: true });
  }

  const session = event.data.object as Stripe.Checkout.Session;
  const metadata = session.metadata ?? {};

  const compradorEmail = metadata.comprador_email || null;
  const compradorTelefono = metadata.comprador_telefono || null;
  const compradorCargo = metadata.comprador_cargo || null;
  const edicionId = metadata.edicion_id || null;

  const grupos: { tipo: Tabla; nombres: string[] }[] = [];
  for (const tipo of TIPOS) {
    const crudo = metadata[`nombres_${tipo}`];
    if (!crudo) continue;
    try {
      const nombres = JSON.parse(crudo);
      if (Array.isArray(nombres) && nombres.length > 0) {
        grupos.push({ tipo, nombres });
      }
    } catch {
      // metadata corrupta para este tipo: se ignora ese grupo, no toda la compra.
      console.error(`Webhook Stripe: metadata "nombres_${tipo}" no es JSON válido`, crudo);
    }
  }

  if (!compradorEmail || grupos.length === 0) {
    return NextResponse.json({ error: "Metadata de la sesión incompleta." }, { status: 400 });
  }

  // Identificador estable de este pago. payment_intent es lo normal en modo
  // "payment"; session.id como último recurso si no llegara a existir.
  const referencia = (typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id) || session.id;
  const supabase = crearClienteServicio();

  const entradasParaEmail: EntradaParaEmail[] = [];
  const filasParaMarcarEnviadas: { tabla: Tabla; id: string }[] = [];

  for (const { tipo, nombres } of grupos) {
    const tablaSql = NOMBRE_TABLA_SQL[tipo];

    // Idempotencia por grupo/tabla: Stripe puede reintentar el mismo evento
    // (p.ej. si nuestra respuesta tarda o falla). Si ya existe una fila con
    // esta referencia de pago en esta tabla, este grupo ya se procesó antes
    // — no se vuelve a insertar ni se incluye en el email.
    const { data: existente, error: errorExistente } = await supabase
      .from(tablaSql)
      .select("id")
      .eq("referencia_pago_online", referencia)
      .limit(1);

    if (errorExistente) {
      console.error(`Webhook Stripe: fallo comprobando duplicados en ${tablaSql}`, errorExistente);
      continue;
    }
    if (existente && existente.length > 0) {
      continue;
    }

    // El precio por unidad de este grupo viaja en la propia metadata (el que
    // se cobró en el momento de crear la sesión), para no depender de
    // volver a consultar el precio actual de la edición (que pudo cambiar
    // entre la compra y este evento) ni de expandir line_items de Stripe.
    const precioCents = metadata[`precio_cents_${tipo}`];
    const precioUnitario = precioCents ? Number(precioCents) / 100 : null;

    for (const nombre of nombres) {
      const qrCodigo = randomUUID();
      const filaComun = {
        id: randomUUID(),
        edicion_id: edicionId,
        qr_codigo: qrCodigo,
        cargo: compradorCargo,
        // El pago con Stripe confirma la asistencia al instante (a diferencia
        // de una transferencia, que queda "Pendiente" hasta revisar el banco a
        // mano) — por eso aquí "confirmado" pasa directamente a "Sí".
        confirmado: "Sí" as const,
        entrada_enviada: "No" as const,
        metodo_pago: "Pasarela online" as const,
        referencia_pago_online: referencia,
      };

      const fila: Record<string, unknown> =
        tipo === "congreso"
          ? {
              ...filaComun,
              nombre,
              email: compradorEmail,
              telefono: compradorTelefono,
              tipo_acceso: "Independiente" as const,
              precio: precioUnitario,
            }
          : tipo === "gala"
          ? {
              ...filaComun,
              nombre_asistente: nombre,
              email_asistente: compradorEmail,
              tipo_entrada: "Comprada" as const,
              precio_entrada: precioUnitario,
            }
          : {
              ...filaComun,
              nombre_asistente: nombre,
              email_asistente: compradorEmail,
              tipo_entrada: "Comprada (10€)" as const,
              precio: precioUnitario,
            };

      const { data: filaInsertada, error: errorInsercion } = await supabase
        .from(tablaSql)
        .insert(fila)
        .select("*")
        .single();

      if (errorInsercion || !filaInsertada) {
        console.error(`Webhook Stripe: fallo al crear entrada en ${tablaSql} (referencia ${referencia})`, errorInsercion);
        continue;
      }

      const datosEntrada = await construirDatosEntrada(supabase, tipo, filaInsertada);
      entradasParaEmail.push({ tabla: tipo, qrCodigo, datos: datosEntrada });
      filasParaMarcarEnviadas.push({ tabla: tipo, id: filaInsertada.id });
    }
  }

  if (entradasParaEmail.length === 0) {
    // Todos los grupos ya estaban procesados (reintento de Stripe) o todas
    // las inserciones fallaron — en ambos casos no hay nada que enviar.
    return NextResponse.json({ recibido: true, ya_procesado: true });
  }

  const resultado = await enviarEmailConVariasEntradas(compradorEmail, entradasParaEmail);
  if (resultado.enviado) {
    for (const { tabla, id } of filasParaMarcarEnviadas) {
      await supabase.from(NOMBRE_TABLA_SQL[tabla]).update({ entrada_enviada: "Sí" }).eq("id", id);
    }
  } else {
    console.error(`Webhook Stripe: filas creadas pero email fallido (referencia ${referencia})`, resultado.error);
  }

  return NextResponse.json({ recibido: true });
}
