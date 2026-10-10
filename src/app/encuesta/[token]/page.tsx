import type { Metadata } from "next";
import PortalMarco from "@/components/PortalMarco";
import { crearClienteServicio } from "@/lib/supabaseServidor";
import { encuestaPorToken } from "@/lib/encuestasServidor";
import ResponderEncuesta from "./ResponderEncuesta";

// El enlace personal va en la URL: que no viaje como "referer" a ningún sitio.
export const metadata: Metadata = {
  title: "BALVERT 2027 — Cuestionario",
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};

// Página pública del cuestionario (enlace personal del email). Abrirla no
// gasta el enlace: solo se gasta al enviar las respuestas.
export default async function EncuestaPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const encuesta = await encuestaPorToken(crearClienteServicio(), token).catch(() => null);

  if (!encuesta || encuesta.estado !== "abierta") {
    const [titulo, texto] = !encuesta
      ? ["No se ha podido cargar", "Ha habido un problema al cargar el cuestionario. Inténtalo de nuevo en unos minutos."]
      : encuesta.estado === "respondida"
      ? ["¡Gracias!", "Este cuestionario ya se ha contestado con este enlace. Cada enlace solo sirve una vez."]
      : encuesta.estado === "cerrada"
      ? ["Cuestionario cerrado", "Este cuestionario ya no admite más respuestas. ¡Gracias por tu interés!"]
      : ["Enlace no válido", "Este enlace no corresponde a ningún cuestionario. Comprueba que lo has copiado entero desde el email."];
    return (
      <PortalMarco subtitulo="Cuestionario de satisfacción">
        <h1 className="mb-2 text-lg font-semibold text-zinc-800">{titulo}</h1>
        <p className="text-sm text-zinc-600">{texto}</p>
      </PortalMarco>
    );
  }

  return (
    <PortalMarco subtitulo="Cuestionario de satisfacción" ancho="max-w-2xl">
      <ResponderEncuesta
        token={token}
        titulo={encuesta.titulo}
        introduccion={encuesta.introduccion}
        preguntas={encuesta.preguntas}
      />
    </PortalMarco>
  );
}
