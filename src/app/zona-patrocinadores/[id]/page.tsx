"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { llamarApiGet, llamarApiJson } from "@/lib/apiCliente";
import AccesoPatrocinador from "@/components/AccesoPatrocinador";
import ArchivosPatrocinador from "@/components/ArchivosPatrocinador";
import EditorCamposPatrocinador from "@/components/EditorCamposPatrocinador";
import InvitadosPatrocinador from "@/components/InvitadosPatrocinador";
import { CAMPOS_CONTACTO, CAMPOS_FACTURACION_EMPRESA, PONENCIA_POR_CATEGORIA } from "@/lib/datosEmpresa";
import type { CambioReciente, EstadoPatrocinador } from "@/lib/zonaPatrocinadores";
import type { Patrocinador } from "@/types/database";

// Espacio de una empresa en la Zona de patrocinadores: las mismas pestañas que
// ve ella en su zona, en modo gestión (ver y corregir, subirle documentos,
// su acceso y sus invitados).

type Pestana = "patrocinio" | "material" | "invitaciones" | "ponencia" | "documentos" | "datos" | "acceso" | "cambios";

const PESTANAS: { id: Pestana; titulo: string }[] = [
  { id: "patrocinio", titulo: "Mi patrocinio" },
  { id: "invitaciones", titulo: "Invitaciones" },
  { id: "ponencia", titulo: "Ponencia" },
  { id: "material", titulo: "Material" },
  { id: "documentos", titulo: "Documentos" },
  { id: "datos", titulo: "Datos de la empresa" },
  { id: "acceso", titulo: "Acceso" },
  { id: "cambios", titulo: "Cambios recientes" },
];

const fecha = (iso: string) =>
  new Date(iso).toLocaleString("es-ES", { timeZone: "Europe/Madrid", dateStyle: "short", timeStyle: "short" });

const ACCION = { creado: "Alta", modificado: "Cambio", borrado: "Baja" } as Record<string, string>;

export default function EspacioPatrocinadorPage() {
  const { id } = useParams<{ id: string }>();
  const [ficha, setFicha] = useState<Patrocinador | null>(null);
  const [estado, setEstado] = useState<EstadoPatrocinador | null>(null);
  const [cambios, setCambios] = useState<CambioReciente[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pestana, setPestana] = useState<Pestana>("patrocinio");
  const [version, setVersion] = useState(0);

  useEffect(() => {
    supabase
      .from("patrocinadores")
      .select("*")
      .eq("id", id)
      .single()
      .then(({ data, error: e }) => (e ? setError(e.message) : setFicha(data)));
    llamarApiGet(`/api/zona-patrocinadores?id=${encodeURIComponent(id)}`)
      .then((d) => {
        setEstado(d.estados[0] ?? null);
        setCambios(d.cambios);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Error inesperado."));
  }, [id, version]);

  const recargar = () => setVersion((v) => v + 1);

  // Abre su zona en otra pestaña con una sesión de la organización (2 horas;
  // no cuenta como acceso de la empresa y lo que cambies queda a tu nombre).
  async function verComoEmpresa() {
    setError(null);
    // La pestaña se abre antes de la petición para que el navegador no la bloquee.
    const ventana = window.open("", "_blank");
    try {
      await llamarApiJson("/api/zona-patrocinadores/ver-como", { patrocinador_id: id });
      const destino = `${window.location.origin}/portal/empresa`;
      if (ventana) ventana.location.href = destino;
      else window.location.assign(destino);
    } catch (e) {
      ventana?.close();
      setError(e instanceof Error ? e.message : "No se pudo abrir la zona de la empresa.");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/zona-patrocinadores" className="text-sm text-[var(--balvert-azul-oscuro)] hover:underline">
            ← Zona de patrocinadores
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-[var(--balvert-marron)]">{ficha?.empresa_entidad || "Empresa"}</h1>
          <p className="text-sm text-zinc-600">{ficha?.categoria ?? ""}</p>
          {estado && estado.pendientes.length > 0 && (
            <p className="mt-1 text-sm text-amber-800">Pendiente: {estado.pendientes.join(" · ")}</p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={verComoEmpresa}
            className="rounded-md px-4 py-2 text-sm font-semibold text-white"
            style={{ background: "var(--balvert-azul-oscuro)" }}
          >
            Ver como la empresa
          </button>
          <Link
            href={`/patrocinadores/${id}`}
            className="rounded-md border border-[var(--borde)] bg-white px-4 py-2 text-sm font-medium text-[var(--balvert-azul-oscuro)] hover:bg-zinc-50"
          >
            Ficha completa
          </Link>
        </div>
      </div>

      {error && <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <nav className="flex flex-wrap gap-1 border-b border-[var(--borde)]">
        {PESTANAS.filter(
          // Ponencia: Diamante y Oro, o quien la tenga activada en la ficha (p. ej. una Plata).
          (p) => p.id !== "ponencia" || !ficha || Boolean(ficha.categoria && PONENCIA_POR_CATEGORIA[ficha.categoria]) || ficha.tiene_ponencia === "Sí"
        ).map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setPestana(p.id)}
            className={`border-b-2 px-3 py-2 text-sm font-semibold ${
              p.id === pestana
                ? "border-[var(--balvert-azul-oscuro)] text-[var(--balvert-azul-oscuro)]"
                : "border-transparent text-zinc-500 hover:text-zinc-800"
            }`}
          >
            {p.titulo}
            {p.id === "material" && estado && estado.materialNuevo > 0 && (
              <span className="ml-1 rounded-full bg-red-100 px-1.5 text-xs text-red-700">{estado.materialNuevo}</span>
            )}
            {p.id === "cambios" && cambios.length > 0 && (
              <span className="ml-1 rounded-full bg-zinc-100 px-1.5 text-xs text-zinc-600">{cambios.length}</span>
            )}
          </button>
        ))}
      </nav>

      {!ficha && !error && <p className="text-sm text-zinc-500">Cargando…</p>}

      {ficha && pestana === "patrocinio" && (
        <EditorCamposPatrocinador
          key={`p-${version}`}
          patrocinadorId={id}
          titulo="Mostrador y producción (rollups y vinilado)"
          claves={["tiene_stand", "rollups_solicitados", "rollup_por_nuestra_cuenta", "vinilado_por_nuestra_cuenta", "necesidades_stand"]}
          valores={ficha as unknown as Record<string, unknown>}
          onGuardado={recargar}
        />
      )}

      {ficha && pestana === "material" && (
        <>
          <ArchivosPatrocinador
            key={`m-${version}`}
            patrocinadorId={id}
            solo="empresa"
            tipos={["logo", "rollup", "vinilado"]}
            onRevisado={recargar}
          />
          <EditorCamposPatrocinador
            key={`mat-${version}`}
            patrocinadorId={id}
            titulo="Logo"
            claves={["logo_recibido", "formato_logo", "fecha_limite_materiales"]}
            valores={ficha as unknown as Record<string, unknown>}
            onGuardado={recargar}
          />
        </>
      )}

      {ficha && pestana === "ponencia" && (
        <>
          <ArchivosPatrocinador key={`pa-${version}`} patrocinadorId={id} solo="empresa" tipos={["ponencia"]} onRevisado={recargar} />
          <EditorCamposPatrocinador
            key={`pon-${version}`}
            patrocinadorId={id}
            titulo="Ponencia"
            claves={[
              "tiene_ponencia",
              "ponente_nombre",
              "ponente_cargo",
              "ponente_email",
              "ponente_telefono",
              "ponencia_titulo",
              "ponencia_duracion_min",
              "ponencia_recibida",
            ]}
            valores={ficha as unknown as Record<string, unknown>}
            onGuardado={recargar}
          />
        </>
      )}

      {pestana === "invitaciones" && <InvitadosPatrocinador patrocinadorId={id} />}

      {pestana === "documentos" && <ArchivosPatrocinador patrocinadorId={id} solo="equipo" />}

      {ficha && pestana === "datos" && (
        <EditorCamposPatrocinador
          key={`d-${version}`}
          patrocinadorId={id}
          titulo="Contactos y facturación (lo mismo que puede cambiar la empresa)"
          claves={[...CAMPOS_CONTACTO, ...CAMPOS_FACTURACION_EMPRESA].map((c) => c.clave)}
          valores={ficha as unknown as Record<string, unknown>}
          onGuardado={recargar}
        />
      )}

      {pestana === "acceso" && <AccesoPatrocinador patrocinadorId={id} />}

      {pestana === "cambios" && (
        <section className="rounded-lg border border-[var(--borde)] bg-white p-4">
          <h3 className="seccion-titulo">Cambios hechos por la empresa o sus invitados (últimos 7 días)</h3>
          {cambios.length === 0 ? (
            <p className="text-sm text-zinc-500">No hay cambios recientes desde su zona.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-[var(--borde)] text-sm">
              {cambios.map((c, i) => (
                <li key={i} className="py-2">
                  <span className="text-zinc-500">{fecha(c.fecha)}</span> · <span className="font-medium">{c.tabla}</span> ·{" "}
                  {ACCION[c.accion] ?? c.accion} · <span className="text-zinc-600">{c.autor}</span>
                  {c.accion === "modificado" && c.campos.length > 0 && (
                    <p className="text-xs text-zinc-500">Campos: {c.campos.join(", ")}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-zinc-500">El detalle completo está en el historial de la ficha.</p>
        </section>
      )}
    </div>
  );
}
