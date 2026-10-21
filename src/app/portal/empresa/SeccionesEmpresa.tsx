"use client";

import { useEffect, useState } from "react";
import { Aviso } from "../inicio/MaterialPatrocinador";
import { AYUDA_DOCUMENTO_SIN_TIPO, nombreTieneApellidos, validarDocumentoSinTipo } from "@/lib/documentoIdentidad";
import {
  EMAIL_REGEX,
  MENUS_GALA,
  NOMBRE_ESTADO_ENTRADA,
  tieneCheckIn,
  type EntradaInvitado,
  type EventoInvitado,
  type Invitado,
  type ResumenInvitados,
} from "@/lib/invitados";
import { CAMPOS_CONTACTO, CAMPOS_FACTURACION_EMPRESA, type CampoEmpresa } from "@/lib/datosEmpresa";
import ExtrasInvitado from "@/components/ExtrasInvitado";

// Pestañas «Invitaciones» y «Datos de la empresa» de la zona de empresa. Las
// rutas (/api/portal/empresa/*) deciden la empresa con la sesión y validan
// todo otra vez (límite de invitaciones, campos permitidos…).

const botonPrincipal =
  "min-h-11 rounded-md bg-[var(--balvert-azul-oscuro)] px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50";

async function pedir(url: string, init?: RequestInit) {
  const res = await fetch(url, { cache: "no-store", ...init });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) throw new Error("Tu sesión ha caducado. Recarga la página y vuelve a entrar.");
  if (!res.ok) throw new Error(data.error || "No se ha podido completar. Inténtalo de nuevo en un momento.");
  return data;
}

const MENSAJE_COMPLETAS =
  "Ya habéis asignado todas vuestras invitaciones; si necesitáis más, escribid a secretaria@balvert.es.";

// ---- Invitaciones ----

export function InvitacionesEmpresa() {
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

  async function cargar() {
    try {
      setResumen(await pedir("/api/portal/empresa/invitados"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado.");
    }
  }

  useEffect(() => {
    cargar();
  }, []);

  if (!resumen) {
    return error ? <Aviso tipo="error">{error}</Aviso> : <p className="text-sm text-zinc-500">Cargando…</p>;
  }

  const { incluidas, asignadas, esDiamante, invitados } = resumen;
  const quedan = (ev: EventoInvitado) => Math.max(incluidas[ev] - asignadas[ev], 0);
  const completas = quedan("congreso") === 0;

  async function anadir(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setAviso(null);
    const nombreLimpio = nombre.trim().replace(/\s+/g, " ");
    const emailLimpio = email.trim().toLowerCase();
    if (!nombreTieneApellidos(nombreLimpio)) return setError("Escribe el nombre y los apellidos del invitado.");
    if (!EMAIL_REGEX.test(emailLimpio)) return setError("El email del invitado no tiene un formato válido.");
    if (documento.trim() && !validarDocumentoSinTipo(documento)) return setError(AYUDA_DOCUMENTO_SIN_TIPO);
    if (conGala && !menu) return setError("Elige el menú de la cena de gala.");
    setGuardando(true);
    try {
      const r = await pedir("/api/portal/empresa/invitados", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: nombreLimpio,
          email: emailLimpio,
          documento: documento.trim(),
          gala: conGala ? { menu, alergias: alergias.trim() } : null,
          excursion: conExcursion,
        }),
      });
      setAviso(
        r.enviado
          ? `Invitado añadido. Le hemos enviado su entrada a ${emailLimpio}.`
          : "Invitado añadido y entrada generada, pero ahora mismo no hemos podido enviarle el email. Puedes descargarla aquí y dársela; nosotros se la reenviaremos."
      );
      setNombre("");
      setEmail("");
      setDocumento("");
      setConGala(false);
      setMenu("");
      setAlergias("");
      setConExcursion(false);
      setAbierto(false);
      await cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado.");
    }
    setGuardando(false);
  }

  // Cena / excursión de un invitado ya asignado (Diamante, solo hasta lo incluido).
  async function cambiarExtra(cuerpo: Record<string, string>): Promise<string> {
    const r = await pedir("/api/portal/empresa/invitados", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cuerpo),
    });
    await cargar();
    if (cuerpo.accion === "quitar") return "Quitada. La invitación vuelve a estar libre para otra persona.";
    return r.enviado
      ? "Añadida. Le hemos enviado su entrada."
      : "Añadida y entrada generada, pero ahora no hemos podido enviarle el email. Puedes descargarla aquí y dársela.";
  }

  async function quitar(inv: Invitado) {
    if (!window.confirm(`¿Quitar a ${inv.nombre || inv.email}? Su entrada dejará de ser válida.`)) return;
    setError(null);
    setAviso(null);
    setQuitando(inv.clave);
    try {
      await pedir(`/api/portal/empresa/invitados?clave=${encodeURIComponent(inv.clave)}`, { method: "DELETE" });
      setAviso("Invitado quitado. Su plaza vuelve a estar libre para otra persona.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado.");
    }
    await cargar();
    setQuitando(null);
  }

  const resumenLinea = (titulo: string, ev: EventoInvitado) => (
    <p>
      <span className="font-semibold">{titulo}</span> — Incluidas: {incluidas[ev]} · Asignadas: {asignadas[ev]} · Por asignar:{" "}
      {quedan(ev)}
    </p>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1 rounded-md bg-zinc-50 p-3 text-sm text-zinc-700">
        {resumenLinea("Congreso", "congreso")}
        {esDiamante && resumenLinea("Cena de gala", "gala")}
        {esDiamante && resumenLinea("Excursión", "excursion")}
      </div>

      {error && <Aviso tipo="error">{error}</Aviso>}
      {aviso && <Aviso tipo="ok">{aviso}</Aviso>}

      {completas ? (
        <Aviso tipo="info">{MENSAJE_COMPLETAS}</Aviso>
      ) : !abierto ? (
        <div>
          <button type="button" onClick={() => setAbierto(true)} className={botonPrincipal}>
            Añadir invitado
          </button>
        </div>
      ) : (
        <form onSubmit={anadir} className="grid gap-4 rounded-md border border-[var(--borde)] p-4 sm:grid-cols-2">
          <div>
            <label className="campo-label" htmlFor="inv-nombre">Nombre y apellidos *</label>
            <input id="inv-nombre" className="campo-input text-base" maxLength={150} value={nombre} onChange={(e) => setNombre(e.target.value)} />
          </div>
          <div>
            <label className="campo-label" htmlFor="inv-email">Email *</label>
            <input id="inv-email" type="email" className="campo-input text-base" maxLength={200} value={email} onChange={(e) => setEmail(e.target.value)} />
            <p className="mt-1 text-xs text-zinc-500">Le enviaremos ahí su entrada.</p>
          </div>
          <div>
            <label className="campo-label" htmlFor="inv-doc">Documento de identidad (opcional)</label>
            <input id="inv-doc" className="campo-input text-base" maxLength={30} placeholder="DNI, NIE o pasaporte" value={documento} onChange={(e) => setDocumento(e.target.value)} />
          </div>
          {esDiamante && (
            <div className="flex flex-col gap-2 sm:col-span-2">
              <label className={`flex items-center gap-2 text-sm ${quedan("gala") === 0 ? "text-zinc-400" : ""}`}>
                <input type="checkbox" className="h-5 w-5" disabled={quedan("gala") === 0} checked={conGala} onChange={(e) => setConGala(e.target.checked)} />
                También a la cena de gala {quedan("gala") === 0 && "(ya asignada)"}
              </label>
              {conGala && (
                <div className="grid gap-3 pl-7 sm:grid-cols-2">
                  <div>
                    <label className="campo-label" htmlFor="inv-menu">Menú *</label>
                    <select id="inv-menu" className="campo-input text-base" value={menu} onChange={(e) => setMenu(e.target.value)}>
                      <option value=""></option>
                      {MENUS_GALA.map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="campo-label" htmlFor="inv-alergias">Alergias</label>
                    <input id="inv-alergias" className="campo-input text-base" maxLength={500} value={alergias} onChange={(e) => setAlergias(e.target.value)} />
                  </div>
                </div>
              )}
              <label className={`flex items-center gap-2 text-sm ${quedan("excursion") === 0 ? "text-zinc-400" : ""}`}>
                <input type="checkbox" className="h-5 w-5" disabled={quedan("excursion") === 0} checked={conExcursion} onChange={(e) => setConExcursion(e.target.checked)} />
                También a la excursión {quedan("excursion") === 0 && "(ya asignada)"}
              </label>
            </div>
          )}
          <div className="flex gap-2 sm:col-span-2">
            <button type="submit" disabled={guardando} className={botonPrincipal}>
              {guardando ? "Añadiendo…" : "Añadir y enviar su entrada"}
            </button>
            <button type="button" onClick={() => setAbierto(false)} className="min-h-11 rounded-md border border-[var(--borde)] px-4 py-2 text-sm text-zinc-600">
              Cancelar
            </button>
          </div>
        </form>
      )}

      {invitados.length === 0 ? (
        <p className="text-sm text-zinc-500">Todavía no habéis asignado ninguna invitación.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-[var(--borde)] rounded-md border border-[var(--borde)]">
          {invitados.map((inv) => (
            <li key={inv.clave} className="flex flex-col gap-3 p-4 text-sm sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="font-semibold text-zinc-800">{inv.nombre || "—"}</p>
                <p className="break-all text-zinc-500">{inv.email}</p>
                <div className="mt-2 flex flex-col gap-2">
                  {(
                    [
                      ["congreso", "Congreso"],
                      ["gala", "Cena de gala"],
                      ["excursion", "Excursión"],
                    ] as const
                  ).map(([tabla, titulo]) =>
                    inv[tabla] ? <EntradaFila key={tabla} tabla={tabla} titulo={titulo} entrada={inv[tabla]!} /> : null
                  )}
                </div>
                <ExtrasInvitado invitado={inv} resumen={resumen} modo="empresa" enviar={cambiarExtra} />
              </div>
              {tieneCheckIn(inv) ? (
                <span className="text-xs text-zinc-400">Ya ha hecho el check-in</span>
              ) : (
                <button
                  type="button"
                  onClick={() => quitar(inv)}
                  disabled={quitando === inv.clave}
                  className="min-h-11 self-start rounded-md border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-60"
                >
                  {quitando === inv.clave ? "Quitando…" : "Quitar"}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-zinc-500">
        Para cambiar a un invitado, quítalo y añade a la otra persona: le enviaremos su entrada nueva.
      </p>
    </div>
  );
}

function EntradaFila({ tabla, titulo, entrada }: { tabla: EventoInvitado; titulo: string; entrada: EntradaInvitado }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-28 font-medium text-zinc-700">{titulo}</span>
      <span
        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
          entrada.estado === "enviada" ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"
        }`}
      >
        {NOMBRE_ESTADO_ENTRADA[entrada.estado]}
      </span>
      {entrada.estado !== "sin_generar" && (
        <a
          href={`/api/portal/empresa/entrada?tabla=${tabla}&id=${encodeURIComponent(entrada.id)}`}
          className="text-sm font-medium text-[var(--balvert-azul-oscuro)] underline"
        >
          Descargar entrada
        </a>
      )}
    </div>
  );
}

// ---- Datos de la empresa ----

export function DatosEmpresa() {
  const [valores, setValores] = useState<Record<string, string> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    pedir("/api/portal/empresa/ficha")
      .then((d) => {
        const v: Record<string, string> = {};
        for (const [k, x] of Object.entries(d.campos as Record<string, string | null>)) v[k] = x ?? "";
        setValores(v);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Error inesperado."));
  }, []);

  if (!valores) return error ? <Aviso tipo="error">{error}</Aviso> : <p className="text-sm text-zinc-500">Cargando…</p>;

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(false);
    for (const c of [...CAMPOS_CONTACTO, ...CAMPOS_FACTURACION_EMPRESA]) {
      const v = valores![c.clave]?.trim();
      if (v && c.tipo === "email" && !EMAIL_REGEX.test(v)) return setError(`${c.etiqueta}: el email no tiene un formato válido.`);
    }
    setGuardando(true);
    try {
      await pedir("/api/portal/empresa/ficha", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(valores),
      });
      setOk(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado.");
    }
    setGuardando(false);
  }

  const campo = (c: CampoEmpresa) => (
    <div key={c.clave} className={c.clave === "direccion_fiscal" || c.clave === "razon_social_facturacion" ? "sm:col-span-2" : ""}>
      <label className="campo-label" htmlFor={c.clave}>{c.etiqueta}</label>
      {c.tipo === "select" ? (
        <select id={c.clave} className="campo-input text-base" value={valores[c.clave]} onChange={(e) => setValores({ ...valores, [c.clave]: e.target.value })}>
          <option value=""></option>
          {c.opciones!.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      ) : (
        <input
          id={c.clave}
          type={c.tipo === "email" ? "email" : c.tipo === "telefono" ? "tel" : "text"}
          className="campo-input text-base"
          maxLength={c.max}
          value={valores[c.clave]}
          onChange={(e) => setValores({ ...valores, [c.clave]: e.target.value })}
        />
      )}
    </div>
  );

  return (
    <form onSubmit={guardar} className="flex flex-col gap-6">
      <section>
        <h3 className="mb-1 text-base font-semibold text-[var(--balvert-marron)]">Personas de contacto</h3>
        <p className="mb-3 text-sm text-zinc-600">Con quién hablamos sobre el patrocinio.</p>
        <div className="grid gap-4 sm:grid-cols-2">{CAMPOS_CONTACTO.map(campo)}</div>
      </section>
      <section>
        <h3 className="mb-1 text-base font-semibold text-[var(--balvert-marron)]">Datos de facturación</h3>
        <p className="mb-3 text-sm text-zinc-600">Los datos con los que os haremos la factura.</p>
        <div className="grid gap-4 sm:grid-cols-2">{CAMPOS_FACTURACION_EMPRESA.map(campo)}</div>
      </section>
      {error && <Aviso tipo="error">{error}</Aviso>}
      {ok && <Aviso tipo="ok">Datos guardados. Gracias.</Aviso>}
      <div>
        <button type="submit" disabled={guardando} className={botonPrincipal}>
          {guardando ? "Guardando…" : "Guardar datos"}
        </button>
      </div>
    </form>
  );
}
