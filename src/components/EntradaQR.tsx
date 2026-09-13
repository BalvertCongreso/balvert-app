"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Tabla = "congreso" | "gala" | "excursion";

interface Props {
  tabla: Tabla;
  registroId: string;
  qrCodigo: string | null;
  nombre: string | null;
  email: string | null;
  entradaEnviada: "Sí" | "No" | null;
  onActualizado: (datos: { qr_codigo: string; entrada_enviada: "Sí" | "No" }) => void;
}

async function cabeceraAutorizacion(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export default function EntradaQR({
  tabla,
  registroId,
  qrCodigo,
  nombre,
  email,
  entradaEnviada,
  onActualizado,
}: Props) {
  const [enviando, setEnviando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [imagenBlobUrl, setImagenBlobUrl] = useState<string | null>(null);
  const [emailDestino, setEmailDestino] = useState("");

  // La imagen final (logo + datos + QR) la compone siempre el servidor
  // (misma imagen que se adjunta en el email); aquí solo la mostramos. Se
  // pide por fetch (no <img src> directo) para poder mandar la sesión en la
  // cabecera Authorization, que la ruta necesita ahora que las tablas
  // exigen auth.uid().
  useEffect(() => {
    if (!qrCodigo) {
      setImagenBlobUrl(null);
      return;
    }
    let cancelado = false;
    let urlCreada: string | null = null;

    (async () => {
      const headers = await cabeceraAutorizacion();
      const res = await fetch(`/api/entradas/imagen?tabla=${tabla}&id=${registroId}&v=${qrCodigo}`, {
        headers,
      });
      if (!res.ok || cancelado) return;
      const blob = await res.blob();
      urlCreada = URL.createObjectURL(blob);
      if (!cancelado) setImagenBlobUrl(urlCreada);
    })();

    return () => {
      cancelado = true;
      if (urlCreada) URL.revokeObjectURL(urlCreada);
    };
  }, [tabla, registroId, qrCodigo]);

  async function generarYEnviar() {
    setEnviando(true);
    setError(null);
    setMensaje(null);
    try {
      const headers = await cabeceraAutorizacion();
      const destinoLimpio = emailDestino.trim();
      const res = await fetch("/api/entradas/enviar", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({ tabla, id: registroId, ...(destinoLimpio ? { emailDestino: destinoLimpio } : {}) }),
      });
      const data = await res.json();

      // Aunque el envío del email haya fallado, la entrada puede haberse
      // generado y guardado igualmente: si viene un código, actualizamos la pantalla.
      if (data.qr_codigo) {
        onActualizado({ qr_codigo: data.qr_codigo, entrada_enviada: data.enviado ? "Sí" : "No" });
      }

      if (!res.ok) {
        throw new Error(data.error || "No se pudo generar la entrada.");
      }

      setMensaje(
        data.enviado
          ? `Entrada generada y enviada a ${data.email}.`
          : "Entrada generada. No se ha enviado ningún email porque no hay una dirección guardada."
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <section>
      <h3 className="seccion-titulo">Entrada (QR)</h3>

      {error && (
        <div className="mb-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {mensaje && (
        <div className="mb-3 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-700">
          {mensaje}
        </div>
      )}

      {imagenBlobUrl ? (
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-start">
          <img
            src={imagenBlobUrl}
            alt={`Entrada de ${nombre ?? "este asistente"}`}
            width={200}
            className="rounded-md border border-[var(--borde)]"
          />
          <div className="flex flex-col gap-2">
            <p className="text-sm text-zinc-600">
              Entrada enviada: <span className="font-medium">{entradaEnviada ?? "No"}</span>
            </p>
            <a
              href={imagenBlobUrl}
              download={`entrada-${tabla}-${registroId}.png`}
              className="text-sm font-medium text-[var(--balvert-azul-oscuro)] hover:underline"
            >
              Descargar entrada
            </a>
            {email && (
              <div className="flex flex-col gap-2">
                <div>
                  <label className="campo-label" htmlFor="email-destino-reenvio">
                    Enviar a otro email (opcional)
                  </label>
                  <input
                    id="email-destino-reenvio"
                    type="email"
                    className="campo-input"
                    placeholder={email}
                    value={emailDestino}
                    onChange={(e) => setEmailDestino(e.target.value)}
                  />
                </div>
                <button
                  type="button"
                  onClick={generarYEnviar}
                  disabled={enviando}
                  className="self-start text-sm font-medium text-[var(--balvert-azul-oscuro)] hover:underline disabled:opacity-60"
                >
                  {enviando ? "Reenviando…" : "Reenviar entrada por email"}
                </button>
              </div>
            )}
          </div>
        </div>
      ) : qrCodigo ? (
        <p className="text-sm text-zinc-500">Cargando entrada…</p>
      ) : (
        <div>
          <p className="mb-3 text-sm text-zinc-600">
            Todavía no se ha generado la entrada para{" "}
            {email ? "este asistente" : "este asistente (sin email guardado, solo se generará el QR)"}.
          </p>
          <button
            type="button"
            onClick={generarYEnviar}
            disabled={enviando}
            className="rounded-md px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            style={{ background: "var(--balvert-azul-oscuro)" }}
          >
            {enviando
              ? "Generando…"
              : email
              ? "Generar entrada QR y enviar por email"
              : "Generar entrada QR"}
          </button>
        </div>
      )}
    </section>
  );
}
