import type { MetadataRoute } from "next";

// Manifest del panel interno. Se sirve con una ruta normal (no con el
// app/manifest.ts de Next, que se enlaza a la fuerza en todas las páginas)
// para que el portal pueda enlazar el suyo y las páginas públicas ninguno:
// lo enlaza src/app/layout.tsx y lo sustituyen src/app/portal/layout.tsx,
// src/app/entradas/layout.tsx y src/app/restablecer-contrasena/layout.tsx.
export function GET() {
  const manifest: MetadataRoute.Manifest = {
    id: "/",
    name: "Balvert",
    short_name: "Balvert",
    start_url: "/",
    display: "standalone",
    background_color: "#FFFFFF",
    theme_color: "#5BB8E8",
    icons: [
      {
        src: "/pwa/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/pwa/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/pwa/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
  return new Response(JSON.stringify(manifest), {
    headers: { "Content-Type": "application/manifest+json" },
  });
}
