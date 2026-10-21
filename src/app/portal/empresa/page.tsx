"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import PortalMarco from "@/components/PortalMarco";
import {
  Aviso,
  DocumentosOrganizacion,
  SeccionMaterial,
  SeccionPatrocinio,
  obtenerMateriales,
  type EmpresaMaterial,
} from "../inicio/MaterialPatrocinador";

// Zona de empresa del portal: se entra con el usuario y la contraseña de la
// empresa (ver src/lib/portalEmpresa.ts). Todo lo que se lee y guarda aquí
// pasa por /api/portal/materiales/* y /api/portal/empresa/*, que deciden la
// empresa con la sesión, nunca con lo que mande el navegador.

interface DatosEmpresa {
  usuario: string;
  empresa: string | null;
  categoria: string | null;
  edicionNombre: string | null;
  deEstaEdicion: boolean;
  documentos: { id: string; titulo: string; descripcion: string | null; nombre_archivo: string }[];
}

type Pestana = "patrocinio" | "material" | "documentos" | "acceso";

const PESTANAS: { id: Pestana; titulo: string; intro: string }[] = [
  {
    id: "patrocinio",
    titulo: "Mi patrocinio",
    intro:
      "Aquí tienes lo que incluye tu patrocinio y puedes pedirnos que te fabriquemos rollups o el vinilado del mostrador. Los precios no incluyen IVA y se facturan después.",
  },
  {
    id: "material",
    titulo: "Material",
    intro:
      "Aquí puedes enviarnos el logo, la ponencia y los diseños de rollup y vinilado. Cuando subas algo, nos llega un aviso y lo revisamos.",
  },
  {
    id: "documentos",
    titulo: "Documentos",
    intro: "Aquí encontrarás los documentos que la organización comparte con tu empresa. Pulsa «Descargar» para guardarlos.",
  },
  {
    id: "acceso",
    titulo: "Cambiar contraseña",
    intro:
      "El usuario y la contraseña son de la empresa: los compartís las personas que trabajáis en el patrocinio. Si cambias la contraseña, se cerrará la sesión en los demás dispositivos.",
  },
];

export default function PortalEmpresaPage() {
  // useSearchParams necesita un Suspense alrededor.
  return (
    <Suspense
      fallback={
        <PortalMarco subtitulo="Zona de patrocinadores" ancho="max-w-3xl">
          <p className="text-sm text-zinc-500">Cargando…</p>
        </PortalMarco>
      }
    >
      <ZonaEmpresa />
    </Suspense>
  );
}

function ZonaEmpresa() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [datos, setDatos] = useState<DatosEmpresa | null>(null);
  const [empresa, setEmpresa] = useState<EmpresaMaterial | null | undefined>(undefined);
  const [errorEmpresa, setErrorEmpresa] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saliendo, setSaliendo] = useState(false);

  useEffect(() => {
    fetch("/api/portal/empresa/datos", { cache: "no-store" })
      .then(async (res) => {
        if (res.status === 401) {
          router.replace("/portal");
          return;
        }
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "No se pudieron cargar los datos. Recarga la página.");
        setDatos(data);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Error inesperado. Recarga la página."));
    obtenerMateriales()
      .then((lista) => setEmpresa(lista[0] ?? null))
      .catch((e) => setErrorEmpresa(e instanceof Error ? e.message : "Error inesperado."));
  }, [router]);

  const recargar = () => {
    obtenerMateriales()
      .then((lista) => {
        setEmpresa(lista[0] ?? null);
        setErrorEmpresa(null);
      })
      .catch((e) => setErrorEmpresa(e instanceof Error ? e.message : "Error inesperado."));
  };

  async function salir() {
    setSaliendo(true);
    await fetch("/api/portal/empresa/salir", { method: "POST" }).catch(() => null);
    router.replace("/portal");
  }

  const botonSalir = (
    <button
      type="button"
      onClick={salir}
      disabled={saliendo}
      className="min-h-11 rounded-md border border-[var(--borde)] px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50 disabled:opacity-60"
    >
      Cerrar sesión
    </button>
  );

  if (error) {
    return (
      <PortalMarco subtitulo="Zona de patrocinadores" ancho="max-w-3xl" accion={botonSalir}>
        <Aviso tipo="error">{error}</Aviso>
        <Contacto />
      </PortalMarco>
    );
  }
  if (!datos) {
    return (
      <PortalMarco subtitulo="Zona de patrocinadores" ancho="max-w-3xl">
        <p className="text-sm text-zinc-500">Cargando…</p>
      </PortalMarco>
    );
  }

  const pedida = searchParams.get("pestana") as Pestana | null;
  const pestana: Pestana = pedida && PESTANAS.some((p) => p.id === pedida) ? pedida : "patrocinio";
  const info = PESTANAS.find((p) => p.id === pestana)!;
  const irA = (p: Pestana) => router.replace(`/portal/empresa?pestana=${p}`, { scroll: false });

  return (
    <PortalMarco
      subtitulo={`Zona de patrocinadores${datos.edicionNombre ? ` — ${datos.edicionNombre}` : ""}`}
      ancho="max-w-3xl"
      accion={botonSalir}
    >
      <div className="mb-4 rounded-md bg-zinc-50 p-3 text-sm">
        <p className="font-semibold text-zinc-800">{datos.empresa ?? "Empresa patrocinadora"}</p>
        {datos.categoria && <p className="text-zinc-600">Patrocinio: {datos.categoria}</p>}
        <p className="text-xs text-zinc-500">Usuario: {datos.usuario}</p>
      </div>

      <nav
        aria-label="Secciones de la zona de empresa"
        className="-mx-6 mb-5 flex gap-1 overflow-x-auto border-b border-[var(--borde)] px-6 sm:-mx-8 sm:px-8"
      >
        {PESTANAS.map(({ id, titulo }) => {
          const activa = id === pestana;
          return (
            <button
              key={id}
              type="button"
              onClick={() => irA(id)}
              aria-current={activa ? "page" : undefined}
              ref={activa ? (el) => el?.scrollIntoView({ block: "nearest", inline: "nearest" }) : undefined}
              className={`min-h-11 shrink-0 whitespace-nowrap border-b-2 px-3 py-2 text-sm font-semibold ${
                activa
                  ? "border-[var(--balvert-azul-oscuro)] text-[var(--balvert-azul-oscuro)]"
                  : "border-transparent text-zinc-500 hover:text-zinc-800"
              }`}
            >
              {titulo}
            </button>
          );
        })}
      </nav>

      <h2 className="mb-1 text-lg font-semibold text-zinc-800">{info.titulo}</h2>
      <p className="mb-5 text-sm text-zinc-600">{info.intro}</p>

      {(pestana === "patrocinio" || pestana === "material") && (
        <>
          {errorEmpresa && <Aviso tipo="error">{errorEmpresa}</Aviso>}
          {empresa === undefined && !errorEmpresa && <p className="text-sm text-zinc-500">Cargando…</p>}
          {empresa === null && (
            <Aviso tipo="info">
              Tu patrocinio no está en la edición actual. Si crees que es un error, escríbenos a secretaria@balvert.es.
            </Aviso>
          )}
          {empresa && pestana === "patrocinio" && <SeccionPatrocinio e={empresa} recargar={recargar} />}
          {empresa && pestana === "material" && (
            <SeccionMaterial e={empresa} recargar={recargar} irAPatrocinio={() => irA("patrocinio")} />
          )}
        </>
      )}

      {pestana === "documentos" && (
        <div className="flex flex-col gap-4">
          {datos.documentos.length === 0 && (!empresa || empresa.organizacion.length === 0) && (
            <Aviso tipo="info">
              Todavía no hay documentos para tu empresa. Cuando la organización comparta alguno (por ejemplo, vuestra
              factura), aparecerá aquí.
            </Aviso>
          )}
          {datos.documentos.length > 0 && (
            <ul className="flex flex-col gap-2">
              {datos.documentos.map((d) => (
                <li
                  key={d.id}
                  className="flex flex-col gap-2 rounded-md border border-[var(--borde)] p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="text-sm">
                    <p className="font-semibold text-zinc-800">{d.titulo}</p>
                    {d.descripcion && <p className="whitespace-pre-line text-zinc-600">{d.descripcion}</p>}
                  </div>
                  <a
                    href={`/api/portal/empresa/documento?id=${encodeURIComponent(d.id)}`}
                    className="inline-flex min-h-11 shrink-0 items-center self-start rounded-md border border-[var(--borde)] px-4 py-2 text-sm font-medium text-[var(--balvert-azul-oscuro)] hover:bg-zinc-50 sm:self-auto"
                  >
                    Descargar
                  </a>
                </li>
              ))}
            </ul>
          )}
          {empresa && <DocumentosOrganizacion empresas={[empresa]} />}
        </div>
      )}

      {pestana === "acceso" && <CambiarContrasena />}

      <Contacto />
    </PortalMarco>
  );
}

const MIN_CONTRASENA = 10;

function CambiarContrasena() {
  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [repetir, setRepetir] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(false);
    if (nueva.length < MIN_CONTRASENA) return setError(`La contraseña nueva tiene que tener al menos ${MIN_CONTRASENA} caracteres.`);
    if (nueva !== repetir) return setError("Las dos contraseñas nuevas no coinciden.");
    setGuardando(true);
    try {
      const res = await fetch("/api/portal/empresa/contrasena", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actual, nueva }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) throw new Error("Tu sesión ha caducado. Vuelve a entrar.");
      if (!res.ok) throw new Error(data.error || "No se pudo cambiar la contraseña.");
      setOk(true);
      setActual("");
      setNueva("");
      setRepetir("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado.");
    }
    setGuardando(false);
  }

  return (
    <form onSubmit={guardar} className="flex max-w-sm flex-col gap-4">
      {/* Para que el gestor de contraseñas sepa de qué cuenta es. */}
      <input type="text" autoComplete="username" hidden readOnly />
      <div>
        <label className="campo-label" htmlFor="actual">Contraseña actual</label>
        <input id="actual" type="password" required autoComplete="current-password" maxLength={200} className="campo-input" value={actual} onChange={(e) => setActual(e.target.value)} />
      </div>
      <div>
        <label className="campo-label" htmlFor="nueva">Contraseña nueva</label>
        <input id="nueva" type="password" required autoComplete="new-password" minLength={MIN_CONTRASENA} maxLength={200} className="campo-input" value={nueva} onChange={(e) => setNueva(e.target.value)} />
        <p className="mt-1 text-xs text-zinc-500">Mínimo {MIN_CONTRASENA} caracteres.</p>
      </div>
      <div>
        <label className="campo-label" htmlFor="repetir">Repite la contraseña nueva</label>
        <input id="repetir" type="password" required autoComplete="new-password" maxLength={200} className="campo-input" value={repetir} onChange={(e) => setRepetir(e.target.value)} />
      </div>
      {error && <Aviso tipo="error">{error}</Aviso>}
      {ok && <Aviso tipo="ok">Contraseña cambiada. Se ha cerrado la sesión en los demás dispositivos.</Aviso>}
      <button
        type="submit"
        disabled={guardando}
        className="min-h-11 rounded-md bg-[var(--balvert-azul-oscuro)] px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
      >
        {guardando ? "Guardando…" : "Cambiar contraseña"}
      </button>
    </form>
  );
}

function Contacto() {
  return (
    <p className="mt-8 border-t border-[var(--borde)] pt-4 text-center text-sm text-zinc-600">
      ¿Dudas? Escríbenos a{" "}
      <a href="mailto:secretaria@balvert.es" className="font-medium text-[var(--balvert-azul-oscuro)] underline">
        secretaria@balvert.es
      </a>
    </p>
  );
}
