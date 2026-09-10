"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import CambiarPasswordModal from "@/components/CambiarPasswordModal";

export default function CuentaMenu() {
  const { usuario, cerrarSesion } = useAuth();
  const [abierto, setAbierto] = useState(false);
  const [modalAbierto, setModalAbierto] = useState(false);
  const contenedorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function alClicFuera(e: MouseEvent) {
      if (contenedorRef.current && !contenedorRef.current.contains(e.target as Node)) {
        setAbierto(false);
      }
    }
    document.addEventListener("mousedown", alClicFuera);
    return () => document.removeEventListener("mousedown", alClicFuera);
  }, []);

  return (
    <div className="relative" ref={contenedorRef}>
      <button
        onClick={() => setAbierto((v) => !v)}
        className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100"
      >
        Hola, <span className="font-semibold">{usuario}</span>
        <span className="text-xs text-zinc-400">▾</span>
      </button>

      {abierto && (
        <div className="absolute left-0 z-40 mt-1 w-48 rounded-md border border-[var(--borde)] bg-white py-1 shadow-md">
          <button
            onClick={() => {
              setModalAbierto(true);
              setAbierto(false);
            }}
            className="block w-full px-4 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-50"
          >
            Cambiar contraseña
          </button>
          <button
            onClick={cerrarSesion}
            className="block w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-zinc-50"
          >
            Cerrar sesión
          </button>
        </div>
      )}

      {modalAbierto && <CambiarPasswordModal onCerrar={() => setModalAbierto(false)} />}
    </div>
  );
}
