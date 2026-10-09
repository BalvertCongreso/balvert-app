"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

interface Props {
  onCerrar: () => void;
}

const MENSAJE_GENERICO =
  "Si ese email existe, te hemos enviado un enlace para restablecer la contraseña.";

export default function RecuperarPasswordModal({ onCerrar }: Props) {
  const [email, setEmail] = useState("");
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);

    const redirectTo =
      typeof window !== "undefined"
        ? `${window.location.origin}/restablecer-contrasena`
        : undefined;

    // No se distingue en pantalla si el email existe o no en la base de
    // datos: siempre se muestra el mismo mensaje genérico, para que esta
    // pantalla no se pueda usar para averiguar qué cuentas existen.
    await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });

    setEnviando(false);
    setMensaje(MENSAJE_GENERICO);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
      <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-lg">
        <h2 className="mb-4 text-lg font-semibold text-[var(--balvert-marron)]">
          Recuperar contraseña
        </h2>

        {mensaje && (
          <div className="mb-4 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-700">
            {mensaje}
          </div>
        )}

        {!mensaje && (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="campo-label" htmlFor="email-recuperar">
                Email
              </label>
              <input
                id="email-recuperar"
                type="email"
                required
                autoComplete="email"
                className="campo-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="mt-2 flex justify-end gap-3">
              <button
                type="button"
                onClick={onCerrar}
                className="rounded-md px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={enviando}
                className="rounded-md px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                style={{ background: "var(--balvert-azul-oscuro)" }}
              >
                {enviando ? "Enviando…" : "Enviar enlace"}
              </button>
            </div>
          </form>
        )}

        {mensaje && (
          <div className="flex justify-end">
            <button
              onClick={onCerrar}
              className="rounded-md px-4 py-2 text-sm font-semibold text-white"
              style={{ background: "var(--balvert-azul-oscuro)" }}
            >
              Cerrar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
