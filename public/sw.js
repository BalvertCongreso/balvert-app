// Service worker mínimo: solo existe para que Chrome/Android considere la
// app "instalable" como PWA. No cachea ninguna ruta, dato de Supabase, ni
// los JS/CSS de la app, para que cada "vercel --prod" se vea al momento.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", () => {
  // Sin caché: cada petición va siempre a la red.
});
