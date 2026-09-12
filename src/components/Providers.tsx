"use client";

import { usePathname } from "next/navigation";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import NavHeader from "@/components/NavHeader";
import LoginForm from "@/components/LoginForm";

// Rutas accesibles sin sesión iniciada.
const RUTAS_PUBLICAS: string[] = [
  "/inscripcion-congreso",
  "/entradas",
  "/entradas/gracias",
  "/entradas/cancelado",
];

// Rutas que ocupan todo el ancho de pantalla en vez del max-w-6xl centrado habitual.
const RUTAS_ANCHO_COMPLETO: string[] = ["/"];

function Contenido({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { session, cargando } = useAuth();
  const esRutaPublica = RUTAS_PUBLICAS.includes(pathname ?? "");
  const esAnchoCompleto = RUTAS_ANCHO_COMPLETO.includes(pathname ?? "");

  if (esRutaPublica) {
    return <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">{children}</main>;
  }

  if (cargando) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-zinc-500">
        Cargando…
      </div>
    );
  }

  if (!session) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 items-center px-6 py-8">
        <LoginForm />
      </main>
    );
  }

  return (
    <>
      <NavHeader />
      <main
        className={
          esAnchoCompleto
            ? "w-full flex-1 px-6 py-8"
            : "mx-auto w-full max-w-6xl flex-1 px-6 py-8"
        }
      >
        {children}
      </main>
    </>
  );
}

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <Contenido>{children}</Contenido>
    </AuthProvider>
  );
}
