"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { cabeceraAutorizacion, llamarApiGet, llamarApiJson } from "@/lib/apiCliente";
import ExtrasInvitado from "@/components/ExtrasInvitado";
import { AYUDA_DOCUMENTO_SIN_TIPO, nombreTieneApellidos, validarDocumentoSinTipo } from "@/lib/documentoIdentidad";
import {
  AVISO_POR_ENCIMA,
  CATEGORIA_DIAMANTE,
  EMAIL_REGEX,
  MENUS_GALA,
  NOMBRE_ESTADO_ENTRADA,
  incluidasDe,
  tieneCheckIn,
  type Contadores,
  type EntradaInvitado,
  type Invitado,
  type ResumenInvitados,
} from "@/lib/invitados";

// Invitaciones del patrocinador: una a una, con sus datos, sin plazas vacías.
// En la ficha (patrocinadorId) cada alta crea las filas en Congreso (y en
// Diamante, si se marcan, en Gala y Excursión) y manda la entrada sola. En el
// alta de un patrocinador nuevo (sin id todavía) se apuntan aquí y la página
// los guarda al crear la ficha (ver nuevo/page.tsx).

export interface InvitadoPendiente {
  nombre: string;
  email: string;
  documento: string;
  gala: { menu: string; alergias: string } | null;
  excursion: boolean;
  enviar: boolean;
}

type Props =
  | { patrocinadorId: string; pendientes?: undefined; onPendientes?: undefined; categoria?: undefined; numIncluidas?: undefined }
  | {
      patrocinadorId?: undefined;
      pendientes: InvitadoPendiente[];
      onPendientes: (p: InvitadoPendiente[]) => void;
      categoria: string | null;
      numIncluidas: number | null;
    };

const RUTA_FICHA = { congreso: "/congreso", gala: "/gala", excursion: "/excursion" } as const;

function Estado({ entrada, tabla, etiqueta }: { entrada: EntradaInvitado; tabla: keyof typeof RUTA_FICHA; etiqueta: string }) {
  const color =
    entrada.estado === "enviada"
      ? "bg-green-100 text-green-800"
      : entrada.estado === "no_enviada"
      ? "bg-red-100 text-red-800"
      : "bg-zinc-100 text-zinc-600";
  return (
    <Link
      href={`${RUTA_FICHA[tabla]}/${entrada.id}`}
      className="inline-flex items-center gap-1 rounded-full border border-[var(--borde)] px-2 py-0.5 text-xs hover:bg-zinc-50"
      title="Abrir su ficha"
    >
      <span className="font-medium">{etiqueta}</span>
      <span className={`rounded-full px-1.5 ${color}`}>{NOMBRE_ESTADO_ENTRADA[entrada.estado]}</span>
      {entrada.checkIn && <span className="text-green-700">✓ check-in</span>}
    </Link>
  );
}

export default function InvitadosPatrocinador(props: Props) {
  const enFicha = !!props.patrocinadorId;
  const [resumen, setResumen] = useState<ResumenInvitados | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [abierto, setAbierto] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [quitando, setQuitando] = useState<string | null>(null);

  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [documento, setDocumento] = useState("");
  const [conGala, setConGala] = useState(false);
  const [menu, setMenu] = useState("");
  const [alergias, setAlergias] = useState("");
  const [conExcursion, setConExcursion] = useState(false);
  const [enviar, setEnviar] = useState(true);

  async function cargar() {
    if (!props.patrocinadorId) return;
    try {
      setResumen(await llamarApiGet(`/api/patrocinadores/invitados?patrocinador_id=${encodeURIComponent(props.patrocinadorId)}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado.");
    }
  }

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.patrocinadorId]);

  // En el alta, los contadores salen de lo que se va apuntando.
  const esDiamante = enFicha ? !!resumen?.esDiamante : props.categoria === CATEGORIA_DIAMANTE;
  const incluidas: Contadores | null = enFicha
    ? resumen?.incluidas ?? null
    : incluidasDe({ categoria: props.categoria ?? null, num_invitaciones_incluidas: props.numIncluidas ?? null });
  const asignadas: Contadores | null = enFicha
    ? resumen?.asignadas ?? null
    : {
        congreso: props.pendientes!.length,
        gala: props.pendientes!.filter((p) => p.gala).length,
        excursion: props.pendientes!.filter((p) => p.excursion).length,
      };

  const porEncima =
    !!incluidas &&
    !!asignadas &&
    (asignadas.congreso >= incluidas.congreso ||
      (conGala && asignadas.gala >= incluidas.gala) ||
      (conExcursion && asignadas.excursion >= incluidas.excursion));

  function limpiarFormulario() {
    setNombre("");
    setEmail("");
    setDocumento("");
    setConGala(false);
    setMenu("");
    setAlergias("");
    setConExcursion(false);
    setEnviar(true);
  }

  async function anadir() {
    setError(null);
    setAviso(null);
    const nombreLimpio = nombre.trim().replace(/\s+/g, " ");
    const emailLimpio = email.trim().toLowerCase();
    if (!nombreTieneApellidos(nombreLimpio)) return setError("Escribe el nombre y los apellidos del invitado.");
    if (!EMAIL_REGEX.test(emailLimpio)) return setError("El email del invitado no tiene un formato válido.");
    if (documento.trim() && !validarDocumentoSinTipo(documento)) return setError(AYUDA_DOCUMENTO_SIN_TIPO);
    if (conGala && !menu) return setError("Elige el menú de la cena de gala.");

    const nuevo: InvitadoPendiente = {
      nombre: nombreLimpio,
      email: emailLimpio,
      documento: documento.trim(),
      gala: esDiamante && conGala ? { menu, alergias: alergias.trim() } : null,
      excursion: esDiamante && conExcursion,
      enviar,
    };

    if (!props.patrocinadorId) {
      const pendientes = props.pendientes ?? [];
      if (pendientes.some((p) => p.email === emailLimpio)) {
        return setError("Esta persona ya está en la lista de invitados.");
      }
      props.onPendientes?.([...pendientes, nuevo]);
      limpiarFormulario();
      return;
    }

    setGuardando(true);
    try {
      const r = await llamarApiJson("/api/patrocinadores/invitados", { patrocinador_id: props.patrocinadorId, ...nuevo });
      if (r.enviado === false) {
        setAviso(
          `Invitado añadido y entrada generada, pero el email no salió (${r.errorEnvio ?? "error desconocido"}). Queda como «No enviada»: reenvíala desde su ficha.`
        );
      } else {
        setAviso(r.enviado ? `Invitado añadido. Entrada enviada a ${emailLimpio}.` : "Invitado añadido, sin enviar la entrada todavía.");
      }
      limpiarFormulario();
      await cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado.");
    }
    setGuardando(false);
  }

  // Cena / excursión de un invitado ya asignado (Diamante).
  async function cambiarExtra(cuerpo: Record<string, string>): Promise<string> {
    const res = await fetch("/api/patrocinadores/invitados", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...(await cabeceraAutorizacion()) },
      body: JSON.stringify({ patrocinador_id: props.patrocinadorId, ...cuerpo }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "No se pudo guardar.");
    await cargar();
    if (cuerpo.accion === "quitar") return "Quitada.";
    return data.enviado ? "Añadida. Entrada enviada." : `Añadida y entrada generada, pero el email no salió (${data.errorEnvio ?? "error"}): reenvíala desde su ficha.`;
  }

  async function quitar(inv: Invitado) {
    const ok = window.confirm(
      `¿Quitar a ${inv.nombre || inv.email || "este invitado"}? Se borrarán sus filas de Congreso${inv.gala ? ", Cena de gala" : ""}${
        inv.excursion ? ", Excursión" : ""
      } y su entrada dejará de ser válida.`
    );
    if (!ok || !props.patrocinadorId) return;
    setError(null);
    setAviso(null);
    setQuitando(inv.clave);
    const res = await fetch(
      `/api/patrocinadores/invitados?patrocinador_id=${encodeURIComponent(props.patrocinadorId)}&clave=${encodeURIComponent(inv.clave)}`,
      { method: "DELETE", headers: await cabeceraAutorizacion() }
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) setError(data.error || "No se pudo quitar.");
    await cargar();
    setQuitando(null);
  }

  return (
    <section className="rounded-lg border border-[var(--borde)] bg-white p-4">
      <h3 className="seccion-titulo">Invitaciones</h3>

      {incluidas && asignadas && (
        <div className="mb-4 flex flex-col gap-1 text-sm">
          <p>
            <span className="font-semibold">Congreso</span> — Incluidas: {incluidas.congreso} · Asignadas: {asignadas.congreso} · Por
            asignar: {Math.max(incluidas.congreso - asignadas.congreso, 0)}
            {asignadas.congreso > incluidas.congreso && (
              <span className="ml-2 text-amber-700">({asignadas.congreso - incluidas.congreso} por encima)</span>
            )}
          </p>
          {esDiamante && (
            <>
              <p>
                <span className="font-semibold">Cena de gala</span>: {incluidas.gala} incluida · asignadas {asignadas.gala}
              </p>
              <p>
                <span className="font-semibold">Excursión</span>: {incluidas.excursion} incluida · asignadas {asignadas.excursion}
              </p>
            </>
          )}
        </div>
      )}

      {error && <div className="mb-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {aviso && <div className="mb-3 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800">{aviso}</div>}

      {!abierto ? (
        <button
          type="button"
          onClick={() => setAbierto(true)}
          className="mb-4 rounded-md px-4 py-2 text-sm font-semibold text-white"
          style={{ background: "var(--balvert-azul-oscuro)" }}
        >
          Añadir invitado
        </button>
      ) : (
        // No es un <form>: en el alta este bloque va junto al formulario del
        // patrocinador y un formulario dentro de otro no es válido.
        <div className="mb-5 grid gap-3 rounded-md border border-[var(--borde)] bg-zinc-50 p-3 sm:grid-cols-2">
          <div>
            <label className="campo-label" htmlFor="inv-nombre">Nombre y apellidos *</label>
            <input id="inv-nombre" className="campo-input" value={nombre} onChange={(e) => setNombre(e.target.value)} />
          </div>
          <div>
            <label className="campo-label" htmlFor="inv-email">Email *</label>
            <input id="inv-email" type="email" className="campo-input" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="campo-label" htmlFor="inv-doc">Documento de identidad (opcional)</label>
            <input id="inv-doc" className="campo-input" value={documento} onChange={(e) => setDocumento(e.target.value)} placeholder="DNI, NIE o pasaporte" />
          </div>
          {esDiamante && (
            <div className="flex flex-col gap-2 sm:col-span-2">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={conGala} onChange={(e) => setConGala(e.target.checked)} />
                Cena de gala
              </label>
              {conGala && (
                <div className="grid gap-3 pl-6 sm:grid-cols-2">
                  <div>
                    <label className="campo-label" htmlFor="inv-menu">Menú *</label>
                    <select id="inv-menu" className="campo-input" value={menu} onChange={(e) => setMenu(e.target.value)}>
                      <option value=""></option>
                      {MENUS_GALA.map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="campo-label" htmlFor="inv-alergias">Alergias</label>
                    <input id="inv-alergias" className="campo-input" value={alergias} onChange={(e) => setAlergias(e.target.value)} />
                  </div>
                </div>
              )}
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={conExcursion} onChange={(e) => setConExcursion(e.target.checked)} />
                Excursión
              </label>
            </div>
          )}
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" checked={enviar} onChange={(e) => setEnviar(e.target.checked)} />
            Enviar la entrada ahora {!enFicha && "(al crear el patrocinador)"}
          </label>
          {porEncima && (
            <p className="rounded-md border border-amber-300 bg-amber-50 p-2 text-sm text-amber-900 sm:col-span-2">
              {AVISO_POR_ENCIMA}.
            </p>
          )}
          <div className="flex gap-3 sm:col-span-2">
            <button
              type="button"
              onClick={anadir}
              disabled={guardando}
              className="rounded-md px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              style={{ background: "var(--balvert-azul-oscuro)" }}
            >
              {guardando ? "Añadiendo…" : "Añadir"}
            </button>
            <button
              type="button"
              onClick={() => {
                setAbierto(false);
                limpiarFormulario();
              }}
              className="rounded-md border border-[var(--borde)] px-4 py-2 text-sm"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}

      {enFicha && !resumen && !error && <p className="text-sm text-zinc-500">Cargando…</p>}

      {enFicha && resumen && resumen.invitados.length === 0 && (
        <p className="text-sm text-zinc-500">Todavía no hay invitados.</p>
      )}

      {enFicha && resumen && resumen.invitados.length > 0 && (
        <ul className="flex flex-col divide-y divide-[var(--borde)]">
          {resumen.invitados.map((inv) => (
            <li key={inv.clave} className="flex flex-wrap items-center gap-3 py-3 text-sm">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{inv.nombre || "—"}</p>
                <p className="truncate text-xs text-zinc-500">{inv.email || "sin email"}</p>
                <div className="mt-1 flex flex-wrap gap-2">
                  {inv.congreso && <Estado entrada={inv.congreso} tabla="congreso" etiqueta="Congreso" />}
                  {inv.gala && <Estado entrada={inv.gala} tabla="gala" etiqueta="Cena" />}
                  {inv.excursion && <Estado entrada={inv.excursion} tabla="excursion" etiqueta="Excursión" />}
                </div>
                <ExtrasInvitado invitado={inv} resumen={resumen} modo="panel" enviar={cambiarExtra} />
              </div>
              {tieneCheckIn(inv) ? (
                <span className="text-xs text-zinc-400">Con check-in: no se puede quitar</span>
              ) : (
                <button
                  type="button"
                  onClick={() => quitar(inv)}
                  disabled={quitando === inv.clave}
                  className="font-medium text-red-600 hover:underline disabled:opacity-60"
                >
                  {quitando === inv.clave ? "Quitando…" : "Quitar"}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {!enFicha && props.pendientes!.length > 0 && (
        <ul className="flex flex-col divide-y divide-[var(--borde)]">
          {props.pendientes!.map((p) => (
            <li key={p.email} className="flex flex-wrap items-center gap-3 py-3 text-sm">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{p.nombre}</p>
                <p className="truncate text-xs text-zinc-500">
                  {p.email} · {["Congreso", p.gala && `Cena (${p.gala.menu})`, p.excursion && "Excursión"].filter(Boolean).join(" + ")} ·{" "}
                  {p.enviar ? "se enviará la entrada al crear" : "sin enviar"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => props.onPendientes!(props.pendientes!.filter((x) => x.email !== p.email))}
                className="font-medium text-red-600 hover:underline"
              >
                Quitar
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
