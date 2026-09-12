import Stripe from "stripe";

// Cliente de Stripe para el servidor (nunca se importa desde código de
// cliente). Se usa el patrón de Checkout Sessions alojadas por Stripe, así
// que este es el único sitio del proyecto que toca el SDK de Stripe.
export function crearClienteStripe() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("Falta STRIPE_SECRET_KEY en el servidor (.env.local).");
  }
  return new Stripe(secretKey);
}
