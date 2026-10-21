"use client";

import { useState } from "react";
import { AVISO_POR_ENCIMA, MENUS_GALA, type Invitado, type ResumenInvitados } from "@/lib/invitados";

// Botones «Añadir cena de gala» / «Añadir excursión» y «Quitar cena» /
// «Quitar excursión» de un invitado ya asignado (solo Diamante). Lo usan el
// bloque de la ficha del panel (puede pasar de lo incluido, con aviso) y la
// pestaña «Invitaciones» de la zona de empresa (solo hasta lo incluido). La
// ruta de cada lado vuelve a validarlo todo.

type Evento = "gala" | "excursion";

const TEXTO: Record<Evento, { anadir: string; quitar: string; asignada: string }> = {
  gala: {
    anadir: "Añadir cena de gala",
    quitar: "Quitar cena",
    asignada: "Ya habéis asignado vuestra invitación a la cena",
  },
  excursion: {
    anadir: "Añadir excursión",
    quitar: "Quitar excursión",
    asignada: "Ya habéis asignado vuestra invitación a la excursión",
  },
};

export default function ExtrasInvitado({
  invitado,
  resumen,
  modo,
  enviar,
}: {
  invitado: Invitado;
  resumen: ResumenInvitados;
  modo: "panel" | "empresa";
  // Llama a la ruta (PATCH) con { clave, accion, evento, menu?, alergias? };
  // devuelve el mensaje para enseñar o lanza el error.
  enviar: (cuerpo: Record<string, string>) => Promise<string>;
}) {
  const [abierto, setAbierto] = useState<Evento | null>(null);
  const [menu, setMenu] = useState("");
  const [alergias, setAlergias] = useState("");
  const [trabajando, setTrabajando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  if (!resumen.esDiamante || !invitado.congreso) return null;

  const libre = (ev: Evento) => resumen.asignadas[ev] < resumen.incluidas[ev];

  async function accion(evento: Evento, tipo: "anadir" | "quitar") {
    setError(null);
    setAviso(null);
    if (tipo === "quitar") {
      const nombre = evento === "gala" ? "la cena de gala" : "la excursión";
      if (!window.confirm(`¿Quitar ${nombre} a ${invitado.nombre || invitado.email}? Su entrada de ${nombre} dejará de ser válida.`)) return;
    }
    if (tipo === "anadir" && evento === "gala" && !menu) return setError("Elige el menú de la cena de gala.");
    setTrabajando(true);
    try {
      const mensaje = await enviar({
        clave: invitado.clave,
        accion: tipo,
        evento,
        ...(tipo === "anadir" && evento === "gala" ? { menu, alergias } : {}),
      });
      setAviso(mensaje);
      setAbierto(null);
      setMenu("");
      setAlergias("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado.");
    }
    setTrabajando(false);
  }

  const boton = "rounded-md border border-[var(--borde)] px-3 py-1.5 text-xs font-medium disabled:opacity-50";

  return (
    <div className="mt-2 flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {(["gala", "excursion"] as const).map((ev) => {
          const entrada = invitado[ev];
          if (entrada) {
            return entrada.checkIn ? null : (
              <button key={ev} type="button" disabled={trabajando} onClick={() => accion(ev, "quitar")} className={`${boton} text-red-600 hover:bg-red-50`}>
                {TEXTO[ev].quitar}
              </button>
            );
          }
          const bloqueado = modo === "empresa" && !libre(ev);
          return (
            <button
              key={ev}
              type="button"
              disabled={trabajando || bloqueado}
              title={bloqueado ? TEXTO[ev].asignada : undefined}
              onClick={() => (ev === "gala" ? setAbierto(abierto === "gala" ? null : "gala") : accion("excursion", "anadir"))}
              className={`${boton} text-[var(--balvert-azul-oscuro)] hover:bg-zinc-50`}
            >
              {TEXTO[ev].anadir}
            </button>
          );
        })}
      </div>
      {modo === "empresa" &&
        (["gala", "excursion"] as const).map((ev) =>
          !invitado[ev] && !libre(ev) ? (
            <p key={ev} className="text-xs text-zinc-500">
              {TEXTO[ev].asignada}.
            </p>
          ) : null
        )}
      {modo === "panel" &&
        (["gala", "excursion"] as const).some((ev) => !invitado[ev] && !libre(ev)) && (
          <p className="text-xs text-amber-800">
            {AVISO_POR_ENCIMA} ({["gala", "excursion"].filter((ev) => !invitado[ev as Evento] && !libre(ev as Evento)).map((ev) => (ev === "gala" ? "cena" : "excursión")).join(" y ")}).
          </p>
        )}
      {abierto === "gala" && (
        <div className="flex flex-wrap items-end gap-2 rounded-md border border-[var(--borde)] bg-zinc-50 p-2">
          <div>
            <label className="campo-label" htmlFor={`menu-${invitado.clave}`}>Menú *</label>
            <select id={`menu-${invitado.clave}`} className="campo-input" value={menu} onChange={(e) => setMenu(e.target.value)}>
              <option value=""></option>
              {MENUS_GALA.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="campo-label" htmlFor={`alergias-${invitado.clave}`}>Alergias</label>
            <input id={`alergias-${invitado.clave}`} className="campo-input" maxLength={500} value={alergias} onChange={(e) => setAlergias(e.target.value)} />
          </div>
          <button
            type="button"
            disabled={trabajando}
            onClick={() => accion("gala", "anadir")}
            className="rounded-md px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
            style={{ background: "var(--balvert-azul-oscuro)" }}
          >
            {trabajando ? "Añadiendo…" : "Añadir y enviar su entrada"}
          </button>
        </div>
      )}
      {error && <p className="text-xs text-red-700">{error}</p>}
      {aviso && <p className="text-xs text-green-700">{aviso}</p>}
    </div>
  );
}
