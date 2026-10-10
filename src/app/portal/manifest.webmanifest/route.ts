// Manifest propio del área de clientes: lo que se instala desde /portal/* es
// el portal (empieza en /portal/inicio y no sale de /portal/), nunca el panel
// interno. Solo lo enlaza src/app/portal/layout.tsx.
export function GET() {
  const manifest = {
    id: "/portal/",
    name: "BALVERT — Área de clientes",
    short_name: "BALVERT Clientes",
    start_url: "/portal/inicio",
    scope: "/portal/",
    display: "standalone",
    background_color: "#FFFFFF",
    theme_color: "#5BB8E8",
    icons: [
      { src: "/pwa/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pwa/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/pwa/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
  return new Response(JSON.stringify(manifest), {
    headers: { "Content-Type": "application/manifest+json" },
  });
}
