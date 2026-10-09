import { NextResponse } from "next/server";
import { crearClienteServicio } from "@/lib/supabaseServidor";
import { crearClienteStripe } from "@/lib/stripe";
import type Stripe from "stripe";
import { MENUS, type GruposCompra } from "@/lib/compraPendiente";
import { nombreTieneApellidos, validarDocumento } from "@/lib/documentoIdentidad";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Tipo = "congreso" | "gala" | "excursion";
const TIPOS: Tipo[] = ["congreso", "gala", "excursion"];

const CAMPO_PRECIO: Record<Tipo, "precio_congreso" | "precio_gala" | "precio_excursion"> = {
  congreso: "precio_congreso",
  gala: "precio_gala",
  excursion: "precio_excursion",
};

// Nombres de cara al cliente (mensajes de error y líneas del cargo, que se
// ven en la página de pago de Stripe): "Gala" se rotula "Cena de gala".
const NOMBRE_EVENTO: Record<Tipo, string> = {
  congreso: "Congreso",
  gala: "Cena de gala",
  excursion: "Excursión",
};

// Topes de tamaño para que nadie pueda mandar una compra desproporcionada.
// Coinciden con los maxLength de los campos en /entradas, así que una
// persona usando el formulario normal nunca los alcanza.
const MAX_PERSONAS_POR_TIPO = 50;
const MAX_NOMBRE = 150;
const MAX_ALERGIAS = 500;
const MAX_COLEGIO = 150;
const MAX_NUMERO_COLEGIADO = 50;

class ErrorValidacion extends Error {}

function texto(valor: unknown): string {
  return typeof valor === "string" ? valor.trim() : "";
}

function comprobarLargo(valor: string, maximo: number, campo: string) {
  if (valor.length > maximo) {
    throw new ErrorValidacion(`El campo "${campo}" es demasiado largo (máximo ${maximo} caracteres).`);
  }
}

// Personas de un tipo tal como llegan del navegador: se descartan las filas
// sin nombre (igual que antes: "+ Añadir persona" y dejarla vacía no cuenta)
// y se comprueban los topes.
function personasCrudas(valor: unknown, tipo: Tipo): Record<string, unknown>[] {
  if (!Array.isArray(valor)) return [];
  const personas = valor
    .filter((p): p is Record<string, unknown> => typeof p === "object" && p !== null)
    .filter((p) => texto(p.nombre).length > 0);
  if (personas.length > MAX_PERSONAS_POR_TIPO) {
    throw new ErrorValidacion(
      `Como máximo se pueden comprar ${MAX_PERSONAS_POR_TIPO} entradas de ${NOMBRE_EVENTO[tipo]} de golpe.`
    );
  }
  for (const p of personas) {
    const nombre = texto(p.nombre);
    comprobarLargo(nombre, MAX_NOMBRE, "Nombre y apellidos");
    if (!nombreTieneApellidos(nombre)) {
      throw new ErrorValidacion(`Escribe nombre y apellidos de "${nombre}" en ${NOMBRE_EVENTO[tipo]}.`);
    }
  }
  return personas;
}

// El mensaje de error nunca incluye el documento, solo el nombre.
function documentoValido(p: Record<string, unknown>, tipo: Tipo): string {
  const nombre = texto(p.nombre);
  const crudo = typeof p.documento_identidad === "string" ? p.documento_identidad : "";
  if (!crudo.trim()) {
    throw new ErrorValidacion(`Indica el documento de identidad de ${nombre} (${NOMBRE_EVENTO[tipo]}).`);
  }
  const doc = validarDocumento(crudo);
  if (!doc) {
    throw new ErrorValidacion(
      `El documento de identidad de ${nombre} (${NOMBRE_EVENTO[tipo]}) no es válido. Revisa el DNI/NIE (la letra debe ser la correcta) o el pasaporte.`
    );
  }
  return doc;
}

const precioValido = (p: number | null | undefined): p is number => p !== null && p !== undefined && p > 0;

// Base técnica de Fase 7 (compra online, hito 7c): crea UNA Stripe Checkout
// Session que puede combinar Congreso, Gala y/o Excursión en una sola compra
// (un solo cargo). La entrada NUNCA se genera aquí: solo se guarda la compra
// en compras_pendientes y se crea la sesión de pago; las filas reales y el
// email se crean en /api/stripe/webhook al confirmarse el pago
// (checkout.session.completed).
//
// Los datos de cada persona (menú, alergias, colegio, número de colegiado…)
// ya no viajan en la metadata de Stripe (tope de ~500 caracteres por valor),
// sino en la fila de compras_pendientes; a Stripe solo se le pasa su id.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Petición no válida." }, { status: 400 });
  }

  const compradorEmail = texto(body.comprador_email).toLowerCase();
  if (!EMAIL_REGEX.test(compradorEmail)) {
    return NextResponse.json({ error: "El email no tiene un formato válido." }, { status: 400 });
  }
  const compradorTelefono = texto(body.comprador_telefono) || null;
  const compradorCargo = texto(body.comprador_cargo) || null;

  const supabase = crearClienteServicio();
  const { data: edicion, error: errorEdicion } = await supabase
    .from("ediciones")
    .select("id, nombre, precio_congreso, precio_gala, precio_excursion, precio_congreso_colegiado")
    .eq("activa", true)
    .maybeSingle();

  if (errorEdicion || !edicion) {
    return NextResponse.json(
      { error: "No hay ninguna edición activa configurada. Contacta con la organización." },
      { status: 500 }
    );
  }

  const gruposEntrada = typeof body.grupos === "object" && body.grupos !== null ? body.grupos : {};
  const grupos: GruposCompra = {};

  try {
    comprobarLargo(compradorTelefono ?? "", 50, "Teléfono");
    comprobarLargo(compradorCargo ?? "", 150, "Empresa");

    for (const tipo of TIPOS) {
      const crudas = personasCrudas(gruposEntrada[tipo], tipo);
      if (crudas.length === 0) continue;

      const precio = (edicion as unknown as Record<string, number | null>)[CAMPO_PRECIO[tipo]];
      if (!precioValido(precio)) {
        throw new ErrorValidacion(
          `El precio de la entrada de ${NOMBRE_EVENTO[tipo]} todavía no está configurado. Contacta con la organización.`
        );
      }

      if (tipo === "congreso") {
        const precioColegiado = edicion.precio_congreso_colegiado as number | null;
        grupos.congreso = crudas.map((p) => {
          const nombre = texto(p.nombre);
          const documento_identidad = documentoValido(p, tipo);
          if (p.colegiado_profesional !== true) {
            return {
              nombre,
              documento_identidad,
              colegiado_profesional: false,
              nombre_colegio: null,
              numero_colegiado: null,
              precio,
            };
          }
          // Casilla marcada: solo es válida si la edición tiene precio de
          // colegiado (si no, el formulario ni siquiera la muestra — llegar
          // aquí así es una petición manipulada) y con colegio + número.
          if (!precioValido(precioColegiado)) {
            throw new ErrorValidacion("El precio de colegiado no está disponible en esta edición.");
          }
          const colegio = texto(p.nombre_colegio);
          const numero = texto(p.numero_colegiado);
          if (!colegio || !numero) {
            throw new ErrorValidacion(`Indica el colegio y el número de colegiado de ${nombre}.`);
          }
          comprobarLargo(colegio, MAX_COLEGIO, "Colegio");
          comprobarLargo(numero, MAX_NUMERO_COLEGIADO, "Número de colegiado");
          return {
            nombre,
            documento_identidad,
            colegiado_profesional: true,
            nombre_colegio: colegio,
            numero_colegiado: numero,
            precio: precioColegiado,
          };
        });
      } else if (tipo === "gala") {
        grupos.gala = crudas.map((p) => {
          const nombre = texto(p.nombre);
          const documento_identidad = documentoValido(p, tipo);
          const menu = MENUS.find((m) => m === p.menu);
          if (!menu) {
            throw new ErrorValidacion(`Elige el menú de ${nombre} para la Cena de gala.`);
          }
          const alergias = texto(p.alergias_intolerancias);
          comprobarLargo(alergias, MAX_ALERGIAS, "Alergias o intolerancias");
          return { nombre, documento_identidad, menu, alergias_intolerancias: alergias || null, precio };
        });
      } else {
        grupos.excursion = crudas.map((p) => ({
          nombre: texto(p.nombre),
          documento_identidad: documentoValido(p, tipo),
          precio,
        }));
      }
    }
  } catch (e) {
    if (e instanceof ErrorValidacion) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    throw e;
  }

  // Líneas del cargo de Stripe: una por tipo y precio (en Congreso puede
  // haber dos: general y colegiado).
  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [];
  const sufijo = `— ${edicion.nombre || "BALVERT"}`;
  function anadirLinea(nombre: string, precio: number, cantidad: number) {
    if (cantidad === 0) return;
    lineItems.push({
      price_data: {
        currency: "eur",
        unit_amount: Math.round(precio * 100),
        product_data: { name: `${nombre} ${sufijo}` },
      },
      quantity: cantidad,
    });
  }
  if (grupos.congreso) {
    const generales = grupos.congreso.filter((p) => !p.colegiado_profesional);
    const colegiados = grupos.congreso.filter((p) => p.colegiado_profesional);
    if (generales.length) anadirLinea("Entrada Congreso", generales[0].precio, generales.length);
    if (colegiados.length) anadirLinea("Entrada Congreso (colegiado)", colegiados[0].precio, colegiados.length);
  }
  if (grupos.gala) anadirLinea("Entrada Cena de gala", grupos.gala[0].precio, grupos.gala.length);
  if (grupos.excursion) anadirLinea("Entrada Excursión", grupos.excursion[0].precio, grupos.excursion.length);

  if (lineItems.length === 0) {
    return NextResponse.json(
      { error: "Indica al menos el nombre de un asistente en algún tipo de entrada." },
      { status: 400 }
    );
  }

  const importeTotalCents = lineItems.reduce(
    (suma, l) => suma + (l.price_data?.unit_amount ?? 0) * (l.quantity ?? 0),
    0
  );

  const { data: compra, error: errorCompra } = await supabase
    .from("compras_pendientes")
    .insert({
      edicion_id: edicion.id,
      comprador_email: compradorEmail,
      comprador_telefono: compradorTelefono,
      comprador_cargo: compradorCargo,
      grupos,
      importe_total_cents: importeTotalCents,
    })
    .select("id")
    .single();

  if (errorCompra || !compra) {
    // Solo código y mensaje: el "details" de Postgres puede incluir la fila
    // entera (con documentos de identidad).
    console.error("crear-sesion: no se pudo guardar la compra pendiente", errorCompra?.code, errorCompra?.message);
    return NextResponse.json({ error: "No se pudo iniciar el pago. Inténtalo de nuevo." }, { status: 500 });
  }

  const origin = req.headers.get("origin") || new URL(req.url).origin;
  const stripe = crearClienteStripe();

  let session: Stripe.Checkout.Session;
  try {
    session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: compradorEmail,
      line_items: lineItems,
      client_reference_id: compra.id,
      metadata: { compra_pendiente_id: compra.id },
      success_url: `${origin}/entradas/gracias`,
      cancel_url: `${origin}/entradas/cancelado`,
    });
  } catch (e) {
    console.error("crear-sesion: Stripe rechazó la creación de la sesión", e);
    await supabase.from("compras_pendientes").delete().eq("id", compra.id);
    return NextResponse.json({ error: "No se pudo iniciar el pago. Inténtalo de nuevo." }, { status: 500 });
  }

  if (!session.url) {
    return NextResponse.json({ error: "No se pudo crear la sesión de pago." }, { status: 500 });
  }

  await supabase.from("compras_pendientes").update({ stripe_session_id: session.id }).eq("id", compra.id);

  return NextResponse.json({ url: session.url });
}
