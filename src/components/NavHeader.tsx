"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCurrentUser } from "@/context/CurrentUserContext";

const enlaces = [
  { href: "/patrocinadores", label: "Patrocinadores" },
  { href: "/notas-equipo", label: "Notas del equipo" },
  { href: "/mis-notas", label: "Mis notas" },
];

export default function NavHeader() {
  const pathname = usePathname();
  const { usuario, setUsuario } = useCurrentUser();

  return (
    <header className="border-b border-[var(--borde)] bg-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-4">
        <div className="flex items-center gap-3">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-md text-sm font-bold text-white"
            style={{
              background:
                "linear-gradient(135deg, var(--balvert-azul), var(--balvert-marron))",
            }}
          >
            B
          </div>
          <div>
            <p className="text-sm font-bold leading-tight text-[var(--balvert-marron)]">
              BALVERT 2027
            </p>
            <p className="text-xs leading-tight text-zinc-500">
              Panel de gestión del congreso
            </p>
          </div>
        </div>

        <nav className="flex items-center gap-1">
          {enlaces.map((enlace) => {
            const activo = pathname?.startsWith(enlace.href);
            return (
              <Link
                key={enlace.href}
                href={enlace.href}
                className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  activo
                    ? "bg-[var(--balvert-azul)] text-white"
                    : "text-zinc-700 hover:bg-zinc-100"
                }`}
              >
                {enlace.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2 text-sm">
          <span className="text-zinc-500">Estás viendo la app como:</span>
          <select
            className="campo-input !w-auto"
            value={usuario ?? ""}
            onChange={(e) => setUsuario(e.target.value as "Ariadna" | "Ariosto")}
          >
            <option value="" disabled>
              Elige quién eres
            </option>
            <option value="Ariadna">Ariadna</option>
            <option value="Ariosto">Ariosto</option>
          </select>
        </div>
      </div>
    </header>
  );
}
