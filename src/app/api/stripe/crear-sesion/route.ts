import { NextResponse } from "next/server";
import { crearClienteServicio } from "@/lib/supabaseServidor";
import { crearClienteStripe } from "@/lib/stripe";
import type Stripe from "stripe";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Tipo = "congreso" | "gala" | "excursion";
const TIPOS: Tipo[] = ["congreso", "gala", "excursion"];

const CAMPO_PRECIO: Record<Tipo, "precio_congreso" | "precio_gala" | "precio_excursion"> = {
  congreso: "precio_congreso",
  gala: "precio_gala",
  excursion: "precio_excursion",
};

const NOMBRE_EVENTO: Record<Tipo, string> = {
  congreso: "Congreso",
  gala: "Gala",
  excursion: "Excursión",
};

// Límite de caracteres que Stripe permite por valor de metadata. Se deja un
// margen de seguridad (450 en vez de 500) porque el JSON de nombres incluye
// comillas y comas además de los propios nombres.
const LIMITE_METADATA = 450;

function limpiarNombres(valor: unknown): string[] {
  if (!Array.isArray(valor)) return [];
  return valor.map((n) => (typeof n === "string" ? n.trim() : "")).filter((n) => n.length > 0);
}

// Base técnica de Fase 7 (compra online, hito 7c): crea UNA Stripe Checkout
// Session que puede combinar Congreso, Gala y/o Excursión en una sola compra
// (un solo cargo). La entrada NUNCA se genera aquí — solo se crea la sesión
// de pago; las filas reales y el email se crean en /api/stripe/webhook al
// confirmarse el pago (checkout.session.completed).
export async function POST(req: Request) {
  const body = await req.json();

  const compradorEmail = typeof body.comprador_email === "string" ? body.comprador_email.trim().toLowerCase() : "";
  if (!EMAIL_REGEX.test(compradorEmail)) {
    return NextResponse.json({ error: "El email no tiene un formato válido." }, { status: 400 });
  }
  const compradorTelefono =
    typeof body.comprador_telefono === "string" && body.comprador_telefono.trim() ? body.comprador_telefono.trim() : null;
  const compradorCargo =
    typeof body.comprador_cargo === "string" && body.comprador_cargo.trim() ? body.comprador_cargo.trim() : null;

  const grupos = typeof body.grupos === "object" && body.grupos !== null ? body.grupos : {};
  const gruposActivos = TIPOS.map((tipo) => ({ tipo, nombres: limpiarNombres(grupos[tipo]) })).filter(
    (g) => g.nombres.length > 0
  );

  if (gruposActivos.length === 0) {
    return NextResponse.json(
      { error: "Indica al menos el nombre de un asistente en algún tipo de entrada." },
      { status: 400 }
    );
  }

  const supabase = crearClienteServicio();
  const { data: edicion, error: errorEdicion } = await supabase
    .from("ediciones")
    .select("id, nombre, precio_congreso, precio_gala, precio_excursion")
    .eq("activa", true)
    .maybeSingle();

  if (errorEdicion || !edicion) {
    return NextResponse.json(
      { error: "No hay ninguna edición activa configurada. Contacta con la organización." },
      { status: 500 }
    );
  }

  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [];
  const metadata: Record<string, string> = {
    edicion_id: edicion.id,
    comprador_email: compradorEmail,
    comprador_telefono: compradorTelefono ?? "",
    comprador_cargo: compradorCargo ?? "",
  };

  for (const { tipo, nombres } of gruposActivos) {
    const precio = (edicion as unknown as Record<string, number | null>)[CAMPO_PRECIO[tipo]];
    if (precio === null || precio === undefined || precio <= 0) {
      return NextResponse.json(
        { error: `El precio de la entrada de ${NOMBRE_EVENTO[tipo]} todavía no está configurado. Contacta con la organización.` },
        { status: 500 }
      );
    }

    const nombresJson = JSON.stringify(nombres);
    if (nombresJson.length > LIMITE_METADATA) {
      return NextResponse.json(
        {
          error: `Estás intentando comprar demasiadas entradas de ${NOMBRE_EVENTO[tipo]} de golpe. Divide la compra en dos operaciones más pequeñas, por favor.`,
        },
        { status: 400 }
      );
    }

    metadata[`nombres_${tipo}`] = nombresJson;
    metadata[`precio_cents_${tipo}`] = String(Math.round(precio * 100));
    lineItems.push({
      price_data: {
        currency: "eur",
        unit_amount: Math.round(precio * 100),
        product_data: {
          name: `Entrada ${NOMBRE_EVENTO[tipo]} — BALVERT ${edicion.nombre ?? ""}`.trim(),
        },
      },
      quantity: nombres.length,
    });
  }

  const origin = req.headers.get("origin") || new URL(req.url).origin;
  const stripe = crearClienteStripe();

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: compradorEmail,
    line_items: lineItems,
    metadata,
    success_url: `${origin}/entradas/gracias`,
    cancel_url: `${origin}/entradas/cancelado`,
  });

  if (!session.url) {
    return NextResponse.json({ error: "No se pudo crear la sesión de pago." }, { status: 500 });
  }

  return NextResponse.json({ url: session.url });
}
