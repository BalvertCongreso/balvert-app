import type { Metadata } from "next";

// El portal enlaza su propio manifest (sustituye al del panel interno que
// pone src/app/manifest.ts en todas las páginas), para que lo que se instala
// desde aquí sea el área de clientes.
export const metadata: Metadata = {
  title: "BALVERT 2027 — Área de clientes",
  manifest: "/portal/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "BALVERT Clientes",
  },
};

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return children;
}
