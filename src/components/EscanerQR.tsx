"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import jsQR from "jsqr";

interface Props {
  // Mientras está pausado, la cámara sigue encendida pero no se procesan
  // fotogramas — evita volver a detectar el mismo QR antes de que el
  // personal pulse "Escanear siguiente".
  pausado: boolean;
  onDetectado: (payload: string) => void;
}

export default function EscanerQR({ pausado, onDetectado }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animacionRef = useRef<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // "Effect Event": siempre ve el valor más reciente de pausado/onDetectado
  // sin obligar a reiniciar la cámara cada vez que cambian.
  const alDetectar = useEffectEvent((payload: string) => {
    if (!pausado) onDetectado(payload);
  });

  useEffect(() => {
    let cancelado = false;

    async function iniciar() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        if (cancelado) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setError(null);
        procesarFotograma();
      } catch {
        setError(
          "No se pudo acceder a la cámara. Dale permiso al navegador, o usa la búsqueda manual de abajo."
        );
      }
    }

    function procesarFotograma() {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
        animacionRef.current = requestAnimationFrame(procesarFotograma);
        return;
      }

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const contexto = canvas.getContext("2d");
      if (!contexto) {
        animacionRef.current = requestAnimationFrame(procesarFotograma);
        return;
      }

      contexto.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imagen = contexto.getImageData(0, 0, canvas.width, canvas.height);
      const codigo = jsQR(imagen.data, imagen.width, imagen.height);

      if (codigo && codigo.data) {
        alDetectar(codigo.data);
      }

      animacionRef.current = requestAnimationFrame(procesarFotograma);
    }

    iniciar();

    return () => {
      cancelado = true;
      if (animacionRef.current) cancelAnimationFrame(animacionRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return (
    <div>
      {error ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          {error}
        </div>
      ) : (
        <div className="relative overflow-hidden rounded-lg border border-[var(--borde)] bg-black">
          <video ref={videoRef} className="w-full" muted playsInline />
          {pausado && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-sm font-medium text-white">
              Pausado
            </div>
          )}
        </div>
      )}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
