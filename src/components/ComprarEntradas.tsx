import { ORIGEN_PUBLICO } from "@/lib/dominio";

// Botón «Comprar entradas» de la parte de arriba de las dos zonas del portal
// (personal y de empresa). Abre la compra en una pestaña nueva.
export default function ComprarEntradas() {
  return (
    <div className="mb-5 flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
      <a
        href={`${ORIGEN_PUBLICO}/entradas`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex min-h-11 items-center justify-center rounded-md bg-[var(--balvert-azul-oscuro)] px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90"
      >
        Comprar entradas
      </a>
      <p className="text-xs text-zinc-500">Congreso, cena de gala y excursión. Pago con tarjeta, IVA incluido.</p>
    </div>
  );
}
