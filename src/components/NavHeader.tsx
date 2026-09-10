"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import CuentaMenu from "@/components/CuentaMenu";

const enlaces = [
  { href: "/", label: "Inicio" },
  { href: "/ediciones", label: "Ediciones" },
  { href: "/patrocinadores", label: "Patrocinadores" },
  { href: "/proveedores", label: "Proveedores" },
  { href: "/congreso", label: "Congreso" },
  { href: "/programa", label: "Programa" },
  { href: "/gala", label: "Gala" },
  { href: "/excursion", label: "Excursión" },
  { href: "/check-in", label: "Check-in" },
  { href: "/tareas", label: "Tareas" },
  { href: "/captacion", label: "Captación" },
  { href: "/contactos", label: "Contactos" },
  { href: "/newsletter", label: "Newsletter" },
  { href: "/notas-equipo", label: "Notas del equipo" },
  { href: "/mis-notas", label: "Mis notas" },
];

export default function NavHeader() {
  const pathname = usePathname();

  return (
    <header className="border-b border-[var(--borde)] bg-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-4">
        <Link href="/" className="flex items-center gap-3">
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
        </Link>

        <nav className="flex flex-wrap items-center gap-1">
          {enlaces.map((enlace) => {
            const activo =
              enlace.href === "/"
                ? pathname === "/"
                : pathname?.startsWith(enlace.href);
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

        <CuentaMenu />
      </div>
    </header>
  );
}
