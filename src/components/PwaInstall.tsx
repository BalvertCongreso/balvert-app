"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

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

// Chrome lanza "beforeinstallprompt" una sola vez por carga de página, y en
// el portal suele llegar en /portal/entrar, antes de pasar a /portal/inicio
// (donde se muestra el aviso). Se captura aquí, fuera del componente, para no
// perderlo en esa navegación.
let eventoGuardado: EventoInstalacion | null = null;
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (evento) => {
    evento.preventDefault();
    eventoGuardado = evento as EventoInstalacion;
  });
  window.addEventListener("appinstalled", () => {
    eventoGuardado = null;
  });
}

// Qué app se ofrece instalar en cada página. En el portal, solo en
// /portal/inicio (con sesión): en /portal/entrar la URL lleva el token de un
// solo uso, y en iPhone "Añadir a pantalla de inicio" guardaría esa URL.
// En las páginas públicas (entradas, restablecer contraseña, cuestionarios…)
// ninguna.
type Modo = "panel" | "portal" | null;

const RUTAS_SIN_AVISO = ["/entradas", "/restablecer-contrasena", "/inscripcion-congreso", "/encuesta"];

function modoDeRuta(pathname: string): Modo {
  if (pathname === "/portal" || pathname.startsWith("/portal/")) {
    return pathname === "/portal/inicio" ? "portal" : null;
  }
  if (RUTAS_SIN_AVISO.some((r) => pathname === r || pathname.startsWith(r + "/"))) return null;
  return "panel";
}

const TEXTOS = {
  panel: {
    nombre: "Balvert",
    frase: "Instala Balvert en tu dispositivo para un acceso más rápido.",
    clave: "balvert-pwa-aviso-descartado",
  },
  portal: {
    nombre: "tu Área de clientes de BALVERT",
    frase: "Instala tu Área de clientes de BALVERT en el móvil: tendrás tus entradas y documentos a un toque.",
    clave: "balvert-portal-pwa-aviso-descartado",
  },
} as const;

export default function PwaInstall() {
  const modo = modoDeRuta(usePathname() ?? "");
  if (!modo) return null;
  // key: al pasar del panel al portal (o al revés) se reinicia el estado.
  return <AvisoInstalar key={modo} modo={modo} />;
}

function AvisoInstalar({ modo }: { modo: "panel" | "portal" }) {
  const textos = TEXTOS[modo];
  const [instalada, setInstalada] = useState(true);
  const [eventoDiferido, setEventoDiferido] = useState<EventoInstalacion | null>(() => eventoGuardado);
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
      setDescartado(sessionStorage.getItem(textos.clave) === "1");
    alComprobarDescartado();

    const alCapturarPrompt = (evento: Event) => setEventoDiferido(evento as EventoInstalacion);
    window.addEventListener("beforeinstallprompt", alCapturarPrompt);

    const alInstalar = () => setInstalada(true);
    window.addEventListener("appinstalled", alInstalar);

    return () => {
      mql.removeEventListener("change", alCambiarModo);
      window.removeEventListener("beforeinstallprompt", alCapturarPrompt);
      window.removeEventListener("appinstalled", alInstalar);
    };
  }, [textos.clave]);

  if (instalada || descartado) return null;

  const descartar = () => {
    sessionStorage.setItem(textos.clave, "1");
    setDescartado(true);
  };

  const instalar = async () => {
    if (!eventoDiferido) return;
    await eventoDiferido.prompt();
    const eleccion = await eventoDiferido.userChoice;
    // Un evento solo sirve para un prompt(): aceptado o no, se descarta.
    eventoGuardado = null;
    setEventoDiferido(null);
    if (eleccion.outcome === "dismissed") descartar();
  };

  if (eventoDiferido) {
    return (
      <div className="flex items-center justify-between gap-3 px-4 py-2 text-sm text-white" style={{ backgroundColor: "#5BB8E8" }}>
        <span>{textos.frase}</span>
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
          Instala {textos.nombre}: toca <strong>Compartir</strong> y luego{" "}
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
        Instala {textos.nombre} desde el menú de tu navegador (busca &quot;Instalar
        aplicación&quot; o &quot;Añadir a pantalla de inicio&quot;).
      </span>
      <button onClick={descartar} aria-label="Descartar" className="shrink-0 text-white/80 hover:text-white">
        ✕
      </button>
    </div>
  );
}
