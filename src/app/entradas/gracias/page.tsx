// Página puramente visual: la entrada NUNCA se genera aquí (nadie llega a
// esta URL sin haber pagado de verdad, pero tampoco haría falta — cualquiera
// podría teclearla a mano). Las filas y el email ya se crearon en el webhook
// de Stripe antes de que Stripe redirigiera hasta aquí.
export default function GraciasPagoPage() {
  return (
    <div className="mx-auto w-full max-w-md">
      <div className="rounded-lg border border-[var(--borde)] bg-white p-8 text-center shadow-sm">
        <h1 className="mb-3 text-xl font-bold text-[var(--balvert-marron)]">Pago recibido</h1>
        <p className="text-sm text-zinc-600">
          Revisa tu email en unos minutos: te hemos enviado tus entradas con código QR. Preséntalas
          (en el móvil o impresas) en el acceso correspondiente.
        </p>
      </div>
    </div>
  );
}
