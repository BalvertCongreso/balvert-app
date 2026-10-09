"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import PortalMarco from "@/components/PortalMarco";

type Tabla = "congreso" | "gala" | "excursion";

interface EntradaPortal {
  tabla: Tabla;
  id: string;
  nombre: string | null;
  evento: string;
  lugar: string;
  fechaHora: string;
  detalleLabel: string | null;
  detalleValor: string | null;
  generada: boolean;
}

interface DatosPortal {
  email: string;
  edicionNombre: string | null;
  entradas: EntradaPortal[];
  empresas: { empresa: string | null; categoria: string | null }[];
}

const GRUPOS: { tabla: Tabla; titulo: string }[] = [
  { tabla: "congreso", titulo: "Congreso" },
  { tabla: "gala", titulo: "Cena de gala" },
  { tabla: "excursion", titulo: "Excursión" },
];

function urlEntrada(e: EntradaPortal, descargar: boolean) {
  const params = new URLSearchParams({ tabla: e.tabla, id: e.id });
  if (descargar) params.set("descargar", "1");
  return `/api/portal/entrada?${params}`;
}

function TarjetaEntrada({ entrada }: { entrada: EntradaPortal }) {
  return (
    <div className="flex flex-col gap-3 rounded-md border border-[var(--borde)] p-4 sm:flex-row">
      {entrada.generada ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={urlEntrada(entrada, false)}
          alt={`Entrada de ${entrada.evento}`}
          loading="lazy"
          className="w-full rounded-md border border-[var(--borde)] sm:w-48"
        />
      ) : null}
      <div className="flex flex-1 flex-col gap-1 text-sm">
        <p className="font-semibold text-zinc-800">{entrada.nombre ?? "Asistente"}</p>
        <p className="text-zinc-600">Lugar: {entrada.lugar}</p>
        <p className="text-zinc-600">Fecha y hora: {entrada.fechaHora}</p>
        {entrada.detalleLabel && entrada.detalleValor && (
          <p className="text-zinc-600">
            {entrada.detalleLabel}: {entrada.detalleValor}
          </p>
        )}
        {entrada.generada ? (
          <a
            href={urlEntrada(entrada, true)}
            className="mt-2 self-start rounded-md border border-[var(--borde)] px-3 py-1.5 text-sm font-medium text-[var(--balvert-azul-oscuro)] hover:bg-zinc-50"
          >
            Descargar entrada
          </a>
        ) : (
          <p className="mt-2 text-zinc-500">Tu entrada aún no está lista. Te avisaremos por email.</p>
        )}
      </div>
    </div>
  );
}

export default function PortalInicioPage() {
  const router = useRouter();
  const [datos, setDatos] = useState<DatosPortal | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saliendo, setSaliendo] = useState(false);

  useEffect(() => {
    fetch("/api/portal/mis-datos", { cache: "no-store" })
      .then(async (res) => {
        if (res.status === 401) {
          router.replace("/portal");
          return;
        }
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "No se pudieron cargar tus datos.");
        setDatos(data);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Error inesperado."));
  }, [router]);

  async function salir() {
    setSaliendo(true);
    await fetch("/api/portal/salir", { method: "POST" }).catch(() => null);
    router.replace("/portal");
  }

  const botonSalir = (
    <button
      type="button"
      onClick={salir}
      disabled={saliendo}
      className="rounded-md border border-[var(--borde)] px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50 disabled:opacity-60"
    >
      Cerrar sesión
    </button>
  );

  if (error) {
    return (
      <PortalMarco subtitulo="Área de clientes" ancho="max-w-3xl" accion={botonSalir}>
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      </PortalMarco>
    );
  }

  if (!datos) {
    return (
      <PortalMarco subtitulo="Área de clientes" ancho="max-w-3xl">
        <p className="text-sm text-zinc-500">Cargando…</p>
      </PortalMarco>
    );
  }

  const esPatrocinador = datos.empresas.length > 0;
  const esAsistente = datos.entradas.length > 0;

  return (
    <PortalMarco
      subtitulo={`Área de clientes${datos.edicionNombre ? ` — ${datos.edicionNombre}` : ""}`}
      ancho="max-w-3xl"
      accion={botonSalir}
    >
      <p className="mb-6 text-sm text-zinc-500">Has entrado como {datos.email}</p>

      {esPatrocinador && (
        <section className="mb-8">
          <h2 className="mb-3 text-base font-semibold text-zinc-800">Tu empresa</h2>
          <div className="flex flex-col gap-2">
            {datos.empresas.map((e, i) => (
              <div key={i} className="rounded-md border border-[var(--borde)] bg-zinc-50 p-4">
                <p className="font-semibold text-zinc-800">{e.empresa ?? "Empresa patrocinadora"}</p>
                {e.categoria && <p className="text-sm text-zinc-600">Patrocinio: {e.categoria}</p>}
              </div>
            ))}
          </div>
        </section>
      )}

      {(esAsistente || !esPatrocinador) && (
        <section className="mb-8">
          <h2 className="mb-3 text-base font-semibold text-zinc-800">Mis entradas</h2>
          {!esAsistente ? (
            <p className="rounded-md border border-[var(--borde)] bg-zinc-50 p-4 text-sm text-zinc-600">
              No tienes entradas a tu nombre en esta edición. Si crees que es un error, responde a
              cualquier email de secretaria@balvert.es.
            </p>
          ) : (
            <div className="flex flex-col gap-6">
              {GRUPOS.map(({ tabla, titulo }) => {
                const delGrupo = datos.entradas.filter((e) => e.tabla === tabla);
                if (delGrupo.length === 0) return null;
                return (
                  <div key={tabla}>
                    <h3 className="mb-2 text-sm font-semibold text-[var(--balvert-marron)]">
                      {titulo} ({delGrupo.length})
                    </h3>
                    <div className="flex flex-col gap-3">
                      {delGrupo.map((e) => (
                        <TarjetaEntrada key={e.id} entrada={e} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      <section>
        <h2 className="mb-3 text-base font-semibold text-zinc-800">Documentos</h2>
        <p className="rounded-md border border-[var(--borde)] bg-zinc-50 p-4 text-sm text-zinc-600">
          Aquí aparecerán los documentos que la organización comparta contigo.
        </p>
      </section>
    </PortalMarco>
  );
}
