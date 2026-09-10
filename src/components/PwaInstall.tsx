"use client";

import { useEffect, useState } from "react";

interface EventoInstalacion extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function estaInstalada(): boolean {
  if (typeof window === "undefined") return false;
  const standaloneIOS = (window.navigator as { standalone?: boolean }).standalone === true;
  return window.matchMedia("(display-mode: standalone)").matches || standaloneIOS;
}

function esIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export default function PwaInstall() {
  const [instalada, setInstalada] = useState(true);
  const [eventoDiferido, setEventoDiferido] = useState<EventoInstalacion | null>(null);
  const [descartado, setDescartado] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    const alCambiarModo = () => setInstalada(estaInstalada());
    const mql = window.matchMedia("(display-mode: standalone)");
    mql.addEventListener("change", alCambiarModo);
    alCambiarModo();

    const alComprobarDescartado = () =>
      setDescartado(sessionStorage.getItem("balvert-pwa-aviso-descartado") === "1");
    alComprobarDescartado();

    const alCapturarPrompt = (evento: Event) => {
      evento.preventDefault();
      setEventoDiferido(evento as EventoInstalacion);
    };
    window.addEventListener("beforeinstallprompt", alCapturarPrompt);

    const alInstalar = () => setInstalada(true);
    window.addEventListener("appinstalled", alInstalar);

    return () => {
      mql.removeEventListener("change", alCambiarModo);
      window.removeEventListener("beforeinstallprompt", alCapturarPrompt);
      window.removeEventListener("appinstalled", alInstalar);
    };
  }, []);

  if (instalada || descartado) return null;

  const descartar = () => {
    sessionStorage.setItem("balvert-pwa-aviso-descartado", "1");
    setDescartado(true);
  };

  const instalar = async () => {
    if (!eventoDiferido) return;
    await eventoDiferido.prompt();
    const eleccion = await eventoDiferido.userChoice;
    if (eleccion.outcome === "accepted") setEventoDiferido(null);
  };

  if (eventoDiferido) {
    return (
      <div className="flex items-center justify-between gap-3 px-4 py-2 text-sm text-white" style={{ backgroundColor: "#5BB8E8" }}>
        <span>Instala Balvert en tu dispositivo para un acceso más rápido.</span>
        <div className="flex shrink-0 items-center gap-3">
          <button onClick={instalar} className="rounded bg-white px-3 py-1 font-medium" style={{ color: "#5BB8E8" }}>
            Instalar app
          </button>
          <button onClick={descartar} aria-label="Descartar" className="text-white/80 hover:text-white">
            ✕
          </button>
        </div>
      </div>
    );
  }

  if (esIOS()) {
    return (
      <div className="flex items-center justify-between gap-3 px-4 py-2 text-sm text-white" style={{ backgroundColor: "#5BB8E8" }}>
        <span>
          Instala Balvert: toca <strong>Compartir</strong> y luego{" "}
          <strong>Añadir a pantalla de inicio</strong>.
        </span>
        <button onClick={descartar} aria-label="Descartar" className="shrink-0 text-white/80 hover:text-white">
          ✕
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2 text-sm text-white" style={{ backgroundColor: "#5BB8E8" }}>
      <span>
        Instala Balvert desde el menú de tu navegador (busca &quot;Instalar
        aplicación&quot; o &quot;Añadir a pantalla de inicio&quot;).
      </span>
      <button onClick={descartar} aria-label="Descartar" className="shrink-0 text-white/80 hover:text-white">
        ✕
      </button>
    </div>
  );
}
