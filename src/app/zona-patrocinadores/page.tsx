"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { llamarApiGet } from "@/lib/apiCliente";
import type { EstadoPatrocinador } from "@/lib/zonaPatrocinadores";

// Zona de patrocinadores: lo que ve y hace cada empresa en su zona del
// portal, de un vistazo. Al pulsar una empresa se abre su espacio.

const fecha = (iso: string) =>
  new Date(iso).toLocaleString("es-ES", { timeZone: "Europe/Madrid", dateStyle: "short", timeStyle: "short" });

function Marca({ bien, children }: { bien: boolean | null; children: React.ReactNode }) {
  if (bien === null) return <span className="text-zinc-400">{children}</span>;
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ${
        bien ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"
      }`}
    >
      {children}
    </span>
  );
}

const TEXTO_PONENCIA = {
  recibida: "Recibida",
  pendiente: "Pendiente",
  sin_responder: "Sin responder",
} as const;

export default function ZonaPatrocinadoresPage() {
  const [estados, setEstados] = useState<EstadoPatrocinador[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [soloPendientes, setSoloPendientes] = useState(false);
  const [busqueda, setBusqueda] = useState("");

  useEffect(() => {
    llamarApiGet("/api/zona-patrocinadores")
      .then((d) => setEstados(d.estados))
      .catch((e) => setError(e instanceof Error ? e.message : "Error inesperado."));
  }, []);

  const termino = busqueda.trim().toLowerCase();
  const visibles = (estados ?? []).filter(
    (e) =>
      (!soloPendientes || e.pendientes.length > 0) &&
      (!termino ||
        (e.empresa ?? "").toLowerCase().includes(termino) ||
        (e.acceso?.usuario ?? "").includes(termino) ||
        (e.categoria ?? "").toLowerCase().includes(termino))
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--balvert-marron)]">Zona de patrocinadores</h1>
        <p className="text-sm text-zinc-600">
          Lo que tiene y hace cada empresa en su zona (usuario y contraseña de la empresa en /portal). Pulsa una empresa
          para abrir su espacio.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <input
          type="search"
          className="campo-input max-w-xs"
          placeholder="Buscar empresa, usuario o categoría…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={soloPendientes} onChange={(e) => setSoloPendientes(e.target.checked)} />
          Con algo pendiente
        </label>
      </div>

      {error && <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {!estados && !error && <p className="text-sm text-zinc-500">Cargando…</p>}
      {estados && visibles.length === 0 && (
        <p className="rounded-md border border-[var(--borde)] bg-white p-6 text-sm text-zinc-500">
          {estados.length === 0 ? "No hay patrocinadores en la edición activa." : "Ninguna empresa coincide."}
        </p>
      )}

      {visibles.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-[var(--borde)] bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 text-xs uppercase text-zinc-500">
              <tr>
                <th className="px-4 py-3">Empresa</th>
                <th className="px-4 py-3">Acceso</th>
                <th className="px-4 py-3">Logo</th>
                <th className="px-4 py-3">Ponencia</th>
                <th className="px-4 py-3">Ponente</th>
                <th className="px-4 py-3">Rollups</th>
                <th className="px-4 py-3">Vinilado</th>
                <th className="px-4 py-3">Invitados</th>
                <th className="px-4 py-3">Docs.</th>
                <th className="px-4 py-3">Novedades</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--borde)]">
              {visibles.map((e) => (
                <tr key={e.id} className="align-top hover:bg-zinc-50">
                  <td className="px-4 py-3">
                    <Link href={`/zona-patrocinadores/${e.id}`} className="font-semibold text-[var(--balvert-azul-oscuro)] hover:underline">
                      {e.empresa || "(sin nombre)"}
                    </Link>
                    <p className="text-xs text-zinc-500">{e.categoria ?? "—"}</p>
                    {e.pendientes.length > 0 && (
                      <p className="mt-1 text-xs text-amber-800">{e.pendientes.join(" · ")}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {e.acceso ? (
                      <>
                        <span className="font-mono text-xs">{e.acceso.usuario}</span>
                        <p className="text-xs text-zinc-500">
                          {e.acceso.ultimoAcceso ? `Entró: ${fecha(e.acceso.ultimoAcceso)}` : "Aún no ha entrado"}
                        </p>
                      </>
                    ) : (
                      <Marca bien={false}>Sin acceso</Marca>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Marca bien={e.logoRecibido}>{e.logoRecibido ? "Recibido" : "Pendiente"}</Marca>
                  </td>
                  <td className="px-4 py-3">
                    {e.ponencia ? (
                      <Marca bien={e.ponencia === "recibida"}>{TEXTO_PONENCIA[e.ponencia]}</Marca>
                    ) : (
                      <span className="text-zinc-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {e.ponenteCompleto === null ? (
                      <span className="text-zinc-400">—</span>
                    ) : (
                      <Marca bien={e.ponenteCompleto}>{e.ponenteCompleto ? "Completos" : "Faltan"}</Marca>
                    )}
                  </td>
                  <td className="px-4 py-3">{e.rollups}</td>
                  <td className="px-4 py-3">{e.vinilado ? "Sí" : "No"}</td>
                  <td className="whitespace-nowrap px-4 py-3">
                    {e.invitados.asignados} / {e.invitados.incluidos}
                  </td>
                  <td className="px-4 py-3">{e.documentos}</td>
                  <td className="px-4 py-3 text-xs">
                    {e.materialNuevo > 0 && (
                      <p className="font-semibold text-red-700">
                        {e.materialNuevo} archivo{e.materialNuevo === 1 ? "" : "s"} sin revisar
                      </p>
                    )}
                    {e.cambiosRecientes > 0 && (
                      <p className="text-zinc-600">
                        {e.cambiosRecientes} cambio{e.cambiosRecientes === 1 ? "" : "s"} en 7 días
                      </p>
                    )}
                    {e.materialNuevo === 0 && e.cambiosRecientes === 0 && <span className="text-zinc-400">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
