"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setEnviando(false);
    if (error) {
      setError("Email o contraseña incorrectos.");
    }
    // Si no hay error, el AuthContext detecta la sesión sola (onAuthStateChange)
    // y la pantalla protegida se muestra automáticamente, sin recargar nada.
  }

  return (
    <div className="w-full rounded-lg border border-[var(--borde)] bg-white p-8 shadow-sm">
      <div className="mb-6 flex items-center gap-3">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-md text-sm font-bold text-white"
          style={{
            background: "linear-gradient(135deg, var(--balvert-azul), var(--balvert-marron))",
          }}
        >
          B
        </div>
        <div>
          <p className="text-sm font-bold leading-tight text-[var(--balvert-marron)]">
            BALVERT 2027
          </p>
          <p className="text-xs leading-tight text-zinc-500">Panel de gestión del congreso</p>
        </div>
      </div>

      <h1 className="mb-4 text-lg font-semibold text-zinc-800">Iniciar sesión</h1>

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="campo-label" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            className="campo-input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div>
          <label className="campo-label" htmlFor="password">
            Contraseña
          </label>
          <input
            id="password"
            type="password"
            required
            autoComplete="current-password"
            className="campo-input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <button
          type="submit"
          disabled={enviando}
          className="mt-2 rounded-md px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          style={{ background: "var(--balvert-azul-oscuro)" }}
        >
          {enviando ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </div>
  );
}
