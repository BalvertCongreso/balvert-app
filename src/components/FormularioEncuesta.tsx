"use client";

import { useState } from "react";
import { MAX_TEXTO_RESPUESTA, opcionesDe, validarRespuestas, type Pregunta, type Respuestas } from "@/lib/encuestas";

type PreguntaConId = Pregunta & { id: string };

// El cuestionario tal como lo ve quien responde. Se usa en la página pública
// /encuesta/<token> y como vista previa en el panel (sin onEnviar).
export default function FormularioEncuesta({
  titulo,
  introduccion,
  preguntas,
  onEnviar,
}: {
  titulo: string;
  introduccion: string | null;
  preguntas: PreguntaConId[];
  // Devuelve null si ha ido bien, o el error general y los de cada pregunta.
  onEnviar?: (respuestas: Respuestas) => Promise<{ error: string; errores?: Record<string, string> } | null>;
}) {
  const [respuestas, setRespuestas] = useState<Respuestas>({});
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const vistaPrevia = !onEnviar;

  function responder(id: string, valor: number | string) {
    setRespuestas((r) => ({ ...r, [id]: valor }));
    setErrores((e) => {
      if (!e[id]) return e;
      const resto = { ...e };
      delete resto[id];
      return resto;
    });
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!onEnviar) return;
    const validacion = validarRespuestas(preguntas, respuestas);
    setErrores(validacion.errores);
    if (Object.keys(validacion.errores).length > 0) {
      setErrorGeneral("Falta alguna respuesta obligatoria: revisa las preguntas marcadas en rojo.");
      const primera = preguntas.find((p) => validacion.errores[p.id]);
      if (primera) document.getElementById(`pregunta-${primera.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setErrorGeneral(null);
    setEnviando(true);
    const fallo = await onEnviar(validacion.limpias);
    if (fallo) {
      setErrorGeneral(fallo.error);
      setErrores(fallo.errores ?? {});
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={enviar} noValidate className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-[var(--balvert-marron)]">{titulo || "(Sin título)"}</h1>
        {introduccion && <p className="mt-2 whitespace-pre-line text-sm text-zinc-700">{introduccion}</p>}
        <p className="mt-3 inline-flex items-center gap-2 rounded-md bg-sky-50 px-3 py-2 text-sm font-medium text-[var(--balvert-azul-oscuro)]">
          🔒 Tus respuestas son anónimas.
        </p>
      </div>

      {preguntas.map((p, i) => (
        <fieldset
          key={p.id}
          id={`pregunta-${p.id}`}
          className={`rounded-lg border p-4 ${errores[p.id] ? "border-red-400 bg-red-50/40" : "border-[var(--borde)]"}`}
        >
          <legend className="sr-only">{p.texto}</legend>
          <p className="mb-3 text-[0.95rem] font-semibold text-zinc-800">
            {i + 1}. {p.texto}
            {p.obligatoria ? (
              <span className="ml-1 text-red-600" title="Obligatoria">*</span>
            ) : (
              <span className="ml-2 text-xs font-normal text-zinc-400">(opcional)</span>
            )}
          </p>

          {p.tipo === "escala_1_5" && (
            <div>
              <div className="grid grid-cols-5 gap-2">
                {[1, 2, 3, 4, 5].map((n) => {
                  const elegido = respuestas[p.id] === n;
                  return (
                    <button
                      key={n}
                      type="button"
                      aria-pressed={elegido}
                      onClick={() => responder(p.id, n)}
                      className={`h-12 rounded-md border text-base font-semibold transition-colors ${
                        elegido
                          ? "border-[var(--balvert-azul-oscuro)] bg-[var(--balvert-azul-oscuro)] text-white"
                          : "border-[var(--borde)] bg-white text-zinc-700 hover:bg-zinc-50"
                      }`}
                    >
                      {n}
                    </button>
                  );
                })}
              </div>
              <div className="mt-1 flex justify-between text-xs text-zinc-500">
                <span>1 = Muy mal</span>
                <span>5 = Excelente</span>
              </div>
            </div>
          )}

          {(p.tipo === "si_no_quiza" || p.tipo === "opcion_unica") && (
            <div className={p.tipo === "si_no_quiza" ? "grid grid-cols-3 gap-2" : "flex flex-col gap-2"}>
              {opcionesDe(p).map((opcion) => {
                const elegido = respuestas[p.id] === opcion;
                return (
                  <button
                    key={opcion}
                    type="button"
                    aria-pressed={elegido}
                    onClick={() => responder(p.id, opcion)}
                    className={`min-h-12 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                      p.tipo === "opcion_unica" ? "text-left" : ""
                    } ${
                      elegido
                        ? "border-[var(--balvert-azul-oscuro)] bg-[var(--balvert-azul-oscuro)] text-white"
                        : "border-[var(--borde)] bg-white text-zinc-700 hover:bg-zinc-50"
                    }`}
                  >
                    {opcion}
                  </button>
                );
              })}
            </div>
          )}

          {p.tipo === "texto" && (
            <textarea
              className="campo-input min-h-28 text-base sm:text-sm"
              maxLength={MAX_TEXTO_RESPUESTA}
              value={typeof respuestas[p.id] === "string" ? (respuestas[p.id] as string) : ""}
              onChange={(e) => responder(p.id, e.target.value)}
              placeholder="Escribe aquí tu respuesta"
            />
          )}

          {errores[p.id] && <p className="mt-2 text-sm text-red-600">{errores[p.id]}</p>}
        </fieldset>
      ))}

      {errorGeneral && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{errorGeneral}</p>}

      <button
        type="submit"
        disabled={enviando || vistaPrevia}
        title={vistaPrevia ? "Vista previa: aquí no se envía nada" : undefined}
        className="w-full rounded-md bg-[var(--balvert-azul-oscuro)] px-4 py-3 text-base font-semibold text-white hover:opacity-90 disabled:opacity-60"
      >
        {vistaPrevia ? "Enviar respuestas (vista previa)" : enviando ? "Enviando…" : "Enviar respuestas"}
      </button>
    </form>
  );
}
