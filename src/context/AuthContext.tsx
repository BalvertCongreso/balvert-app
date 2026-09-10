"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";
import type { Usuario } from "@/types/database";

const EMAIL_ARIADNA = process.env.NEXT_PUBLIC_EMAIL_ARIADNA?.toLowerCase();
const EMAIL_ARIOSTO = process.env.NEXT_PUBLIC_EMAIL_ARIOSTO?.toLowerCase();

// La identidad ("Ariadna"/"Ariosto") se deriva del email de la cuenta con la
// que se ha iniciado sesión, no de un selector manual como antes.
function emailAUsuario(email: string | null | undefined): Usuario | null {
  if (!email) return null;
  const normalizado = email.toLowerCase();
  if (normalizado === EMAIL_ARIADNA) return "Ariadna";
  if (normalizado === EMAIL_ARIOSTO) return "Ariosto";
  return null;
}

interface AuthContextValue {
  session: Session | null;
  usuario: Usuario | null;
  cargando: boolean;
  cerrarSesion: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setCargando(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_evento, nuevaSession) => {
      setSession(nuevaSession);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  async function cerrarSesion() {
    await supabase.auth.signOut();
  }

  return (
    <AuthContext.Provider
      value={{ session, usuario: emailAUsuario(session?.user?.email), cargando, cerrarSesion }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth debe usarse dentro de AuthProvider");
  }
  return ctx;
}
