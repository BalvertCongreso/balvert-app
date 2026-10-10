"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { obtenerEdicionActiva } from "@/lib/edicionActiva";
import { cabeceraAutorizacion, llamarApiGet, llamarApiJson } from "@/lib/apiCliente";
import {
  BUCKET_DOCUMENTOS,
  DESTINOS,
  MAX_DESCRIPCION,
  MAX_TITULO,
  NOMBRE_DESTINO,
  TAMANO_MAXIMO_DOCUMENTO,
  TIPOS_DOCUMENTO_PERMITIDOS,
  type Destino,
} from "@/lib/documentos";
import type { Edicion } from "@/types/database";

interface Documento {
  id: string;
  titulo: string;
  descripcion: string | null;
  nombre_archivo: string;
  destino: Destino;
  patrocinador_id: string | null;
  email_destinatario: string | null;
  creado: string;
  patrocinadores: { empresa_entidad: string | null } | null;
}

interface PatrocinadorOpcion {
  id: string;
  empresa_entidad: string | null;
}

interface Formulario {
  id: string | null; // con id = editar/reemplazar
  titulo: string;
  descripcion: string;
  destino: Destino;
  patrocinadorId: string;
  emailDestinatario: string;
  archivo: File | null;
}

const formularioVacio = (): Formulario => ({
  id: null,
  titulo: "",
  descripcion: "",
  destino: "todos_asistentes",
  patrocinadorId: "",
  emailDestinatario: "",
  archivo: null,
});

// Sube el archivo directamente al bucket privado con una URL firmada que
// prepara el servidor (sin pasar por Vercel, que corta a 4,5 MB).
async function subirDocumento(archivo: File): Promise<string> {
  const { ruta, token } = await llamarApiJson("/api/documentos/subida", {
    nombre: archivo.name,
    tipo: archivo.type,
    tamano: archivo.size,
  });
  const { error } = await supabase.storage
    .from(BUCKET_DOCUMENTOS)
    .uploadToSignedUrl(ruta, token, archivo, { contentType: archivo.type });
  if (error) throw new Error("No se pudo subir el archivo: " + error.message);
  return ruta;
}

export default function DocumentosPage() {
  const [edicion, setEdicion] = useState<Edicion | null>(null);
  const [documentos, setDocumentos] = useState<Documento[]>([]);
  const [patrocinadores, setPatrocinadores] = useState<PatrocinadorOpcion[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<Formulario | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [errorForm, setErrorForm] = useState<string | null>(null);

  async function cargar() {
    setCargando(true);
    try {
      const edicionActiva = await obtenerEdicionActiva();
      setEdicion(edicionActiva);
      const [{ documentos }, patros] = await Promise.all([
        llamarApiGet("/api/documentos"),
        edicionActiva
          ? supabase
              .from("patrocinadores")
              .select("id, empresa_entidad")
              .eq("edicion_id", edicionActiva.id)
              .order("empresa_entidad", { ascending: true })
          : Promise.resolve({ data: [] }),
      ]);
      setDocumentos(documentos);
      setPatrocinadores((patros.data ?? []) as PatrocinadorOpcion[]);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado.");
    }
    setCargando(false);
  }

  useEffect(() => {
    cargar();
  }, []);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setErrorForm(null);

    if (!form.id && !form.archivo) {
      setErrorForm("Elige el archivo.");
      return;
    }
    if (form.archivo) {
      if (!TIPOS_DOCUMENTO_PERMITIDOS[form.archivo.type]) {
        setErrorForm("Solo se pueden subir PDF o imágenes (PNG, JPG, WEBP).");
        return;
      }
      if (form.archivo.size > TAMANO_MAXIMO_DOCUMENTO) {
        setErrorForm("El archivo pesa demasiado (máximo 20 MB).");
        return;
      }
    }
    if (form.destino === "patrocinador" && !form.patrocinadorId) {
      setErrorForm("Elige la empresa patrocinadora.");
      return;
    }
    if (form.destino === "asistente" && !form.emailDestinatario.trim()) {
      setErrorForm("Escribe el email de la persona.");
      return;
    }

    setGuardando(true);
    try {
      const ruta = form.archivo ? await subirDocumento(form.archivo) : null;
      await llamarApiJson("/api/documentos", {
        id: form.id,
        titulo: form.titulo,
        descripcion: form.descripcion,
        destino: form.destino,
        patrocinador_id: form.destino === "patrocinador" ? form.patrocinadorId : null,
        email_destinatario: form.destino === "asistente" ? form.emailDestinatario : null,
        ruta_archivo: ruta,
      });
      setForm(null);
      await cargar();
    } catch (e) {
      setErrorForm(e instanceof Error ? e.message : "Error inesperado.");
    }
    setGuardando(false);
  }

  async function ver(id: string) {
    // Se abre la pestaña antes de pedir la URL para que el navegador no la
    // bloquee como ventana emergente.
    const ventana = window.open("", "_blank");
    try {
      const { url } = await llamarApiGet(`/api/documentos/ver?id=${encodeURIComponent(id)}`);
      if (ventana) ventana.location.href = url;
      else window.location.href = url;
    } catch (e) {
      ventana?.close();
      alert(e instanceof Error ? e.message : "No se pudo abrir el documento.");
    }
  }

  async function eliminar(doc: Documento) {
    if (!window.confirm(`¿Borrar "${doc.titulo}"? Dejará de verse en el área de clientes. No se puede deshacer.`)) return;
    const res = await fetch(`/api/documentos?id=${encodeURIComponent(doc.id)}`, {
      method: "DELETE",
      headers: await cabeceraAutorizacion(),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(data.error || "No se pudo borrar.");
      return;
    }
    setDocumentos((prev) => prev.filter((d) => d.id !== doc.id));
  }

  function editar(doc: Documento) {
    setErrorForm(null);
    setForm({
      id: doc.id,
      titulo: doc.titulo,
      descripcion: doc.descripcion ?? "",
      destino: doc.destino,
      patrocinadorId: doc.patrocinador_id ?? "",
      emailDestinatario: doc.email_destinatario ?? "",
      archivo: null,
    });
  }

  const aQuien = (d: Documento) =>
    d.destino === "patrocinador"
      ? `Empresa: ${d.patrocinadores?.empresa_entidad ?? "(empresa borrada)"}`
      : d.destino === "asistente"
      ? `Persona: ${d.email_destinatario}`
      : NOMBRE_DESTINO[d.destino];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[var(--balvert-marron)]">Documentos</h1>
          <p className="text-sm text-zinc-600">
            Archivos que ven los asistentes y patrocinadores en su área de clientes (/portal).
            {edicion?.nombre && (
              <span className="ml-2 rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-500">
                Edición: {edicion.nombre}
              </span>
            )}
          </p>
        </div>
        {!form && (
          <button
            type="button"
            onClick={() => {
              setErrorForm(null);
              setForm(formularioVacio());
            }}
            className="rounded-md px-4 py-2 text-sm font-semibold text-white"
            style={{ background: "var(--balvert-azul-oscuro)" }}
          >
            + Subir documento
          </button>
        )}
      </div>

      {form && (
        <form
          onSubmit={guardar}
          className="flex flex-col gap-4 rounded-lg border border-[var(--borde)] bg-white p-6 shadow-sm"
        >
          <h2 className="text-base font-semibold text-zinc-800">
            {form.id ? "Editar o reemplazar documento" : "Subir documento"}
          </h2>
          <div>
            <label className="campo-label" htmlFor="doc-archivo">
              {form.id ? "Archivo nuevo (déjalo vacío para mantener el actual)" : "Archivo *"}
            </label>
            <input
              id="doc-archivo"
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/png,image/jpeg,image/webp"
              className="campo-input"
              onChange={(e) => setForm({ ...form, archivo: e.target.files?.[0] ?? null })}
            />
            <p className="mt-1 text-xs text-zinc-500">PDF o imagen (PNG, JPG, WEBP), máximo 20 MB.</p>
          </div>
          <div>
            <label className="campo-label" htmlFor="doc-titulo">
              Título *
            </label>
            <input
              id="doc-titulo"
              required
              maxLength={MAX_TITULO}
              className="campo-input"
              value={form.titulo}
              onChange={(e) => setForm({ ...form, titulo: e.target.value })}
            />
          </div>
          <div>
            <label className="campo-label" htmlFor="doc-descripcion">
              Descripción
            </label>
            <textarea
              id="doc-descripcion"
              rows={2}
              maxLength={MAX_DESCRIPCION}
              className="campo-input"
              value={form.descripcion}
              onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="campo-label" htmlFor="doc-destino">
                ¿Quién lo ve? *
              </label>
              <select
                id="doc-destino"
                className="campo-input"
                value={form.destino}
                onChange={(e) => setForm({ ...form, destino: e.target.value as Destino })}
              >
                {DESTINOS.map((d) => (
                  <option key={d} value={d}>
                    {NOMBRE_DESTINO[d]}
                  </option>
                ))}
              </select>
            </div>
            {form.destino === "patrocinador" && (
              <div>
                <label className="campo-label" htmlFor="doc-patrocinador">
                  Empresa *
                </label>
                <select
                  id="doc-patrocinador"
                  className="campo-input"
                  value={form.patrocinadorId}
                  onChange={(e) => setForm({ ...form, patrocinadorId: e.target.value })}
                >
                  <option value="">Elige una empresa…</option>
                  {patrocinadores.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.empresa_entidad ?? "(sin nombre)"}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {form.destino === "asistente" && (
              <div>
                <label className="campo-label" htmlFor="doc-email">
                  Email de la persona *
                </label>
                <input
                  id="doc-email"
                  type="email"
                  maxLength={254}
                  className="campo-input"
                  placeholder="El mismo con el que compró o pidió la factura"
                  value={form.emailDestinatario}
                  onChange={(e) => setForm({ ...form, emailDestinatario: e.target.value })}
                />
              </div>
            )}
          </div>
          {errorForm && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{errorForm}</div>
          )}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={guardando}
              className="rounded-md px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              style={{ background: "var(--balvert-azul-oscuro)" }}
            >
              {guardando ? "Guardando…" : "Guardar"}
            </button>
            <button
              type="button"
              onClick={() => setForm(null)}
              className="rounded-md border border-[var(--borde)] px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-50"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {error && <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {cargando ? (
        <p className="text-sm text-zinc-500">Cargando…</p>
      ) : documentos.length === 0 ? (
        <p className="rounded-md border border-[var(--borde)] bg-white p-6 text-sm text-zinc-500">
          Todavía no hay documentos.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {documentos.map((d) => (
            <li
              key={d.id}
              className="flex flex-col gap-3 rounded-md border border-[var(--borde)] bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="text-sm">
                <p className="font-semibold text-zinc-800">{d.titulo}</p>
                {d.descripcion && <p className="text-zinc-600">{d.descripcion}</p>}
                <p className="mt-1 text-xs text-zinc-500">
                  {aQuien(d)} · {d.nombre_archivo} · subido el {new Date(d.creado).toLocaleDateString("es-ES")}
                </p>
              </div>
              <div className="flex shrink-0 gap-2 text-sm">
                <button
                  type="button"
                  onClick={() => ver(d.id)}
                  className="rounded-md border border-[var(--borde)] px-3 py-1.5 text-[var(--balvert-azul-oscuro)] hover:bg-zinc-50"
                >
                  Ver
                </button>
                <button
                  type="button"
                  onClick={() => editar(d)}
                  className="rounded-md border border-[var(--borde)] px-3 py-1.5 text-zinc-700 hover:bg-zinc-50"
                >
                  Editar / reemplazar
                </button>
                <button
                  type="button"
                  onClick={() => eliminar(d)}
                  className="rounded-md border border-red-200 px-3 py-1.5 text-red-700 hover:bg-red-50"
                >
                  Borrar
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
