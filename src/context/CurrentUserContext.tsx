"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { Usuario } from "@/types/database";

const STORAGE_KEY = "balvert_usuario_actual";

interface CurrentUserContextValue {
  usuario: Usuario | null;
  setUsuario: (usuario: Usuario) => void;
}

const CurrentUserContext = createContext<CurrentUserContextValue | undefined>(
  undefined
);

export function CurrentUserProvider({ children }: { children: React.ReactNode }) {
  const [usuario, setUsuarioState] = useState<Usuario | null>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "Ariadna" || stored === "Ariosto") {
      setUsuarioState(stored);
    }
  }, []);

  function setUsuario(nuevo: Usuario) {
    window.localStorage.setItem(STORAGE_KEY, nuevo);
    setUsuarioState(nuevo);
  }

  return (
    <CurrentUserContext.Provider value={{ usuario, setUsuario }}>
      {children}
    </CurrentUserContext.Provider>
  );
}

export function useCurrentUser() {
  const ctx = useContext(CurrentUserContext);
  if (!ctx) {
    throw new Error("useCurrentUser debe usarse dentro de CurrentUserProvider");
  }
  return ctx;
}
