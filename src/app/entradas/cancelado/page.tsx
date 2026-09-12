import Link from "next/link";

export default function PagoCanceladoPage() {
  return (
    <div className="mx-auto w-full max-w-md">
      <div className="rounded-lg border border-[var(--borde)] bg-white p-8 text-center shadow-sm">
        <h1 className="mb-3 text-xl font-bold text-[var(--balvert-marron)]">Pago cancelado</h1>
        <p className="text-sm text-zinc-600">
          No se ha realizado ningún cargo. Puedes volver a intentarlo cuando quieras.
        </p>
        <Link
          href="/entradas"
          className="mt-4 inline-block rounded-md px-4 py-2 text-sm font-semibold text-white"
          style={{ background: "var(--balvert-azul-oscuro)" }}
        >
          Volver a intentarlo
        </Link>
      </div>
    </div>
  );
}
