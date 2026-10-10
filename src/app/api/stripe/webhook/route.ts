import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import type Stripe from "stripe";
import { crearClienteServicio } from "@/lib/supabaseServidor";
import { crearClienteStripe } from "@/lib/stripe";
import { enviarEmailConVariasEntradas, type EntradaParaEmail } from "@/lib/entradaEmail";
import { NOMBRE_TABLA_SQL, construirDatosEntrada, type Tabla } from "@/lib/entradaDatos";
import { origenDeConfianza } from "@/lib/portal";
import { gruposSinDocumentos, type GruposCompra, type PersonaCongreso, type PersonaGala } from "@/lib/compraPendiente";

export const runtime = "nodejs";

const TIPOS: Tabla[] = ["congreso", "gala", "excursion"];

// Único sitio del proyecto donde se genera una entrada de pago online: la
// página de "gracias" a la que Stripe redirige tras el checkout es solo
// visual (cualquiera podría llegar a esa URL sin haber pagado), así que las
// filas en asistentes_congreso/gala/excursion y el email con los QR SOLO se
// crean aquí, tras verificar la firma del evento con STRIPE_WEBHOOK_SECRET.
//
// Fase 7c: una misma sesión de Stripe puede combinar varios tipos de entrada
// (Congreso + Gala + Excursión juntos o por separado). La metadata solo trae
// "compra_pendiente_id": la compra completa (comprador, personas, menú,
// alergias, datos de colegiado y precio de cada una) se lee de la tabla
// compras_pendientes, que guardó crear-sesion. Se procesa cada grupo con
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

  // Cinturón de seguridad: "completed" no siempre significa cobrado (con
  // métodos de pago diferidos, como una domiciliación, llega antes de que
  // entre el dinero). Sin cobro confirmado no se crea nada ni se marca la
  // compra; se responde 200 para que Stripe no reintente en bucle.
  if (session.payment_status !== "paid") {
    console.error(`Webhook Stripe: sesión ${session.id} completada sin cobrar (payment_status ${session.payment_status}); no se crean entradas`);
    return NextResponse.json({ recibido: true, sin_cobrar: true });
  }

  const compraId = session.metadata?.compra_pendiente_id || null;
  if (!compraId) {
    return NextResponse.json({ error: "La sesión no trae compra_pendiente_id." }, { status: 400 });
  }

  const supabase = crearClienteServicio();
  const { data: compra, error: errorCompra } = await supabase
    .from("compras_pendientes")
    .select("*")
    .eq("id", compraId)
    .maybeSingle();

  if (errorCompra) {
    // Fallo de base de datos: se responde 500 para que Stripe reintente.
    console.error(`Webhook Stripe: fallo leyendo la compra pendiente ${compraId}`, errorCompra);
    return NextResponse.json({ error: "No se pudo leer la compra pendiente." }, { status: 500 });
  }
  if (!compra) {
    console.error(`Webhook Stripe: compra pendiente ${compraId} no encontrada (sesión ${session.id})`);
    return NextResponse.json({ error: "Compra pendiente no encontrada." }, { status: 400 });
  }
  if (compra.stripe_session_id && compra.stripe_session_id !== session.id) {
    console.error(
      `Webhook Stripe: la compra ${compraId} pertenece a la sesión ${compra.stripe_session_id}, no a ${session.id}`
    );
    return NextResponse.json({ error: "La compra no corresponde a esta sesión." }, { status: 400 });
  }
  if (session.amount_total !== null && session.amount_total !== compra.importe_total_cents) {
    // No debería pasar nunca (el importe lo calcula crear-sesion a partir de
    // esta misma fila). Se deja constancia pero se generan las entradas: el
    // cliente ya ha pagado.
    console.error(
      `Webhook Stripe: importe cobrado (${session.amount_total}) distinto del guardado (${compra.importe_total_cents}) en la compra ${compraId}`
    );
  }

  const compradorEmail: string = compra.comprador_email;
  const compradorTelefono: string | null = compra.comprador_telefono;
  const compradorCargo: string | null = compra.comprador_cargo;
  const edicionId: string | null = compra.edicion_id;
  const gruposCompra = (compra.grupos ?? {}) as GruposCompra;

  // Identificador estable de este pago. payment_intent es lo normal en modo
  // "payment"; session.id como último recurso si no llegara a existir.
  const referencia = (typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id) || session.id;

  // Enlace al recibo que genera Stripe para este cobro (el portal lo enseña
  // como "Ver recibo del pago"). Si no se consigue, las entradas se crean
  // igual, sin recibo.
  let reciboUrl: string | null = null;
  if (typeof session.payment_intent === "string" || session.payment_intent) {
    try {
      const idPago = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent!.id;
      const pago = await stripe.paymentIntents.retrieve(idPago, { expand: ["latest_charge"] });
      const cargo = pago.latest_charge;
      reciboUrl = (typeof cargo === "object" && cargo?.receipt_url) || null;
    } catch (e) {
      console.error(`Webhook Stripe: no se pudo leer el recibo (referencia ${referencia})`, e instanceof Error ? e.message : e);
    }
  }

  const entradasParaEmail: EntradaParaEmail[] = [];
  const filasParaMarcarEnviadas: { tabla: Tabla; id: string }[] = [];

  let huboFallos = false;

  for (const tipo of TIPOS) {
    const personas = gruposCompra[tipo];
    if (!personas || personas.length === 0) continue;
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
      huboFallos = true;
      continue;
    }
    if (existente && existente.length > 0) {
      continue;
    }

    // El precio de cada persona es el que se calculó en crear-sesion (el
    // que se cobró), no el precio actual de la edición, que pudo cambiar
    // entre la compra y este evento.
    for (const persona of personas) {
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
        recibo_url: reciboUrl,
      };

      let fila: Record<string, unknown>;
      if (tipo === "congreso") {
        const p = persona as PersonaCongreso;
        fila = {
          ...filaComun,
          nombre: p.nombre,
          documento_identidad: p.documento_identidad,
          email: compradorEmail,
          telefono: compradorTelefono,
          tipo_acceso: "Independiente" as const,
          precio: p.precio,
          colegiado_profesional: p.colegiado_profesional,
          nombre_colegio: p.nombre_colegio,
          numero_colegiado: p.numero_colegiado,
        };
      } else if (tipo === "gala") {
        const p = persona as PersonaGala;
        fila = {
          ...filaComun,
          nombre_asistente: p.nombre,
          documento_identidad: p.documento_identidad,
          email_asistente: compradorEmail,
          tipo_entrada: "Comprada" as const,
          precio_entrada: p.precio,
          menu: p.menu,
          alergias_intolerancias: p.alergias_intolerancias,
        };
      } else {
        fila = {
          ...filaComun,
          nombre_asistente: persona.nombre,
          documento_identidad: persona.documento_identidad,
          email_asistente: compradorEmail,
          tipo_entrada: "Comprada (10€)" as const,
          precio: persona.precio,
        };
      }

      const { data: filaInsertada, error: errorInsercion } = await supabase
        .from(tablaSql)
        .insert(fila)
        .select("*")
        .single();

      if (errorInsercion || !filaInsertada) {
        // Solo código y mensaje: el "details" de Postgres puede incluir la
        // fila entera (con el documento de identidad).
        console.error(
          `Webhook Stripe: fallo al crear entrada en ${tablaSql} (referencia ${referencia})`,
          errorInsercion?.code,
          errorInsercion?.message
        );
        huboFallos = true;
        continue;
      }

      const datosEntrada = await construirDatosEntrada(supabase, tipo, filaInsertada);
      entradasParaEmail.push({ tabla: tipo, qrCodigo, datos: datosEntrada });
      filasParaMarcarEnviadas.push({ tabla: tipo, id: filaInsertada.id });
    }
  }

  // La compra se marca como usada solo si todo salió bien; si algo falló se
  // queda sin marcar, para que se vea en compras_pendientes que necesita
  // revisión. "Usada" no bloquea un reenvío del evento desde Stripe: la
  // protección real contra duplicados sigue siendo la comprobación por
  // referencia_pago_online de cada tabla (así un reenvío puede completar
  // una tabla que falló sin duplicar las que ya se crearon).
  // Al marcarla se quitan también los documentos de identidad de la copia
  // (ya están en las filas reales). Si algo falló, no se toca nada: el
  // reintento necesita la compra completa.
  if (!huboFallos) {
    await supabase
      .from("compras_pendientes")
      .update({
        usada_en: new Date().toISOString(),
        referencia_pago_online: referencia,
        grupos: gruposSinDocumentos(gruposCompra),
      })
      .eq("id", compraId)
      .is("usada_en", null);
  }

  if (entradasParaEmail.length === 0) {
    // Todos los grupos ya estaban procesados (reintento de Stripe) o todas
    // las inserciones fallaron — en ambos casos no hay nada que enviar.
    return NextResponse.json({ recibido: true, ya_procesado: true });
  }

  const resultado = await enviarEmailConVariasEntradas(compradorEmail, entradasParaEmail, origenDeConfianza(req));
  if (resultado.enviado) {
    for (const { tabla, id } of filasParaMarcarEnviadas) {
      await supabase.from(NOMBRE_TABLA_SQL[tabla]).update({ entrada_enviada: "Sí" }).eq("id", id);
    }
  } else {
    console.error(`Webhook Stripe: filas creadas pero email fallido (referencia ${referencia})`, resultado.error);
  }

  return NextResponse.json({ recibido: true });
}
