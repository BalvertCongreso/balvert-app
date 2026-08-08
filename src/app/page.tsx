import Link from "next/link";

const secciones = [
  {
    href: "/patrocinadores",
    titulo: "Patrocinadores",
    descripcion:
      "Ficha completa de cada patrocinador: identificación, contacto, ponencia, mostrador, logo, facturación y beneficios.",
  },
  {
    href: "/notas-equipo",
    titulo: "Notas del equipo",
    descripcion: "Tablón compartido entre Ariadna y Ariosto. Ambos ven y escriben.",
  },
  {
    href: "/mis-notas",
    titulo: "Mis notas",
    descripcion: "Notas privadas. Cada persona ve únicamente las suyas.",
  },
];

export default function Home() {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold text-[var(--balvert-marron)]">
          Congreso BALVERT 2027
        </h1>
        <p className="mt-1 text-sm text-zinc-600">
          Fase 1: estructura de datos, patrocinadores y notas del equipo.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {secciones.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="rounded-lg border border-[var(--borde)] bg-white p-5 transition-shadow hover:shadow-md"
          >
            <h2 className="font-semibold text-[var(--balvert-azul-oscuro)]">
              {s.titulo}
            </h2>
            <p className="mt-2 text-sm text-zinc-600">{s.descripcion}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
