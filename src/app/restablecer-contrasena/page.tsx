"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function RestablecerContrasenaPage() {
  const router = useRouter();
  const [listo, setListo] = useState(false);
  const [enlaceInvalido, setEnlaceInvalido] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [hecho, setHecho] = useState(false);

  useEffect(() => {
    // El enlace del email deja a Supabase procesando una sesión de tipo
    // "recovery" en la URL; hasta que no aparece esa sesión no se puede
    // pedir la contraseña nueva. Si el enlace está caducado o ya se usó,
    // Supabase nunca llega a dejar sesión y lo detectamos con un margen.
    const { data: listener } = supabase.auth.onAuthStateChange((evento, session) => {
      if (evento === "PASSWORD_RECOVERY" || (evento === "SIGNED_IN" && session)) {
        setListo(true);
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setListo(true);
      }
    });

    const aviso = setTimeout(() => {
      setListo((yaListo) => {
        if (!yaListo) setEnlaceInvalido(true);
        return yaListo;
      });
    }, 4000);

    return () => {
      listener.subscription.unsubscribe();
      clearTimeout(aviso);
    };
  }, []);

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
    setHecho(true);
    setTimeout(() => router.push("/"), 2000);
  }

  return (
    <div className="mx-auto flex w-full max-w-sm flex-1 items-center px-4 py-8">
      <div className="w-full rounded-lg border border-[var(--borde)] bg-white p-8 shadow-sm">
        <h1 className="mb-4 text-lg font-semibold text-zinc-800">Restablecer contraseña</h1>

        {enlaceInvalido && !listo && (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            Este enlace no es válido o ha caducado. Pide uno nuevo desde la pantalla de inicio de
            sesión.
          </div>
        )}

        {!enlaceInvalido && !listo && (
          <p className="text-sm text-zinc-500">Comprobando el enlace…</p>
        )}

        {listo && hecho && (
          <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-700">
            Contraseña actualizada. Redirigiendo al inicio de sesión…
          </div>
        )}

        {listo && !hecho && (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {error && (
              <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            )}
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
            <button
              type="submit"
              disabled={guardando}
              className="mt-2 rounded-md px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              style={{ background: "var(--balvert-azul-oscuro)" }}
            >
              {guardando ? "Guardando…" : "Guardar contraseña"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
