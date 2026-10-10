import type { Metadata } from "next";

// Página pública: no se ofrece instalar ninguna app (ni el panel interno ni
// el área de clientes), así que se quita el manifest que pone la raíz.
export const metadata: Metadata = { manifest: null };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
