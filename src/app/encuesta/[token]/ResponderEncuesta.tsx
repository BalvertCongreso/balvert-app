"use client";

import { useState } from "react";
import FormularioEncuesta from "@/components/FormularioEncuesta";
import type { Respuestas } from "@/lib/encuestas";
import type { PreguntaPublica } from "@/lib/encuestasServidor";

export default function ResponderEncuesta({
  token,
  titulo,
  introduccion,
  preguntas,
}: {
  token: string;
  titulo: string;
  introduccion: string | null;
  preguntas: PreguntaPublica[];
}) {
  const [enviado, setEnviado] = useState(false);

  async function enviar(respuestas: Respuestas) {
    try {
      const res = await fetch("/api/encuesta/responder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, respuestas }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return { error: data.error || "No se pudo enviar.", errores: data.errores };
      setEnviado(true);
      window.scrollTo({ top: 0 });
      return null;
    } catch {
      return { error: "No se pudo enviar. Comprueba tu conexión e inténtalo de nuevo." };
    }
  }

  if (enviado) {
    return (
      <div className="py-4 text-center">
        <p className="mb-2 text-3xl">🙌</p>
        <h1 className="mb-2 text-lg font-semibold text-zinc-800">¡Muchas gracias!</h1>
        <p className="text-sm text-zinc-600">Hemos recibido tus respuestas. Nos ayudarán a preparar la próxima edición.</p>
      </div>
    );
  }

  return <FormularioEncuesta titulo={titulo} introduccion={introduccion} preguntas={preguntas} onEnviar={enviar} />;
}
