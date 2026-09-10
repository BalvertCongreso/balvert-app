"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

interface Props {
  onCerrar: () => void;
}

export default function CambiarPasswordModal({ onCerrar }: Props) {
  const [password, setPassword] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    if (password !== confirmar) {
      setError("Las dos contraseñas no coinciden.");
      return;
    }

    setGuardando(true);
    const { error } = await supabase.auth.updateUser({ password });
    setGuardando(false);

    if (error) {
      setError(error.message);
      return;
    }
    setMensaje("Contraseña actualizada correctamente.");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
      <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-lg">
        <h2 className="mb-4 text-lg font-semibold text-[var(--balvert-marron)]">
          Cambiar contraseña
        </h2>

        {error && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}
        {mensaje && (
          <div className="mb-4 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-700">
            {mensaje}
          </div>
        )}

        {!mensaje && (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="campo-label" htmlFor="password-nueva">
                Contraseña nueva
              </label>
              <input
                id="password-nueva"
                type="password"
                required
                autoComplete="new-password"
                className="campo-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div>
              <label className="campo-label" htmlFor="password-confirmar">
                Repetir contraseña
              </label>
              <input
                id="password-confirmar"
                type="password"
                required
                autoComplete="new-password"
                className="campo-input"
                value={confirmar}
                onChange={(e) => setConfirmar(e.target.value)}
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
                disabled={guardando}
                className="rounded-md px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                style={{ background: "var(--balvert-azul-oscuro)" }}
              >
                {guardando ? "Guardando…" : "Guardar"}
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
