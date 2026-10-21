"use client";

import { ORIGEN_PUBLICO } from "@/lib/dominio";

// Marco de las dos zonas del portal (/portal/inicio y /portal/empresa), según
// la maqueta aprobada (Maqueta_Portal_Balvert.html): cabecera azul con saludo,
// lugar, días y cuenta atrás, «Comprar entradas» y «Salir»; menú lateral en
// escritorio y pestañas deslizables en móvil (por debajo de 760 px). Las
// pantallas de entrar siguen con PortalMarco.

export interface CongresoCabecera {
  lugar: string | null;
  dias: string | null;
  fechaInicio: string | null;
}

export interface PestanaZona<T extends string> {
  id: T;
  titulo: string;
  // Algo pendiente en esa pestaña: un número o «!».
  insignia?: number | string | null;
}

// Días que faltan hasta el inicio del congreso (las dos fechas a medianoche).
// null si no hay fecha o ya ha empezado.
function diasParaCongreso(fechaInicio: string | null): number | null {
  if (!fechaInicio) return null;
  const [anio, mes, dia] = fechaInicio.slice(0, 10).split("-").map(Number);
  if (!anio || !mes || !dia) return null;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const dias = Math.round((new Date(anio, mes - 1, dia).getTime() - hoy.getTime()) / 86400000);
  return dias >= 0 ? dias : null;
}

export default function PortalZona<T extends string>({
  subtitulo,
  saludo,
  etiqueta,
  congreso,
  pestanas,
  activa,
  onIr,
  onSalir,
  saliendo,
  children,
}: {
  subtitulo: string;
  saludo: string;
  etiqueta?: string | null;
  congreso: CongresoCabecera | null;
  pestanas: PestanaZona<T>[];
  activa: T;
  onIr: (id: T) => void;
  onSalir: () => void;
  saliendo: boolean;
  children: React.ReactNode;
}) {
  const dias = diasParaCongreso(congreso?.fechaInicio ?? null);
  const lugarDias = [congreso?.lugar, congreso?.dias].filter(Boolean).join(" · ");

  return (
    <div className="flex w-full flex-1 flex-col bg-[#f3f6f8] text-[#1f2a33]">
      <header
        className="text-white"
        style={{
          background: "linear-gradient(120deg, #163f57 0%, var(--balvert-azul-oscuro) 60%, var(--balvert-azul) 100%)",
        }}
      >
        <div className="mx-auto w-full max-w-[1240px] px-4 pb-5 pt-4 min-[760px]:px-6 min-[760px]:pb-6">
          <div className="flex items-center justify-between gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-balvert.png" alt="BALVERT" className="h-10 w-auto rounded-lg bg-white p-1" />
            <div className="flex gap-2">
              <a
                href={`${ORIGEN_PUBLICO}/entradas`}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Comprar entradas"
                title="Congreso, cena de gala y excursión. Pago con tarjeta, IVA incluido."
                className="inline-flex min-h-11 items-center gap-2 rounded-[10px] bg-[var(--balvert-marron-claro)] px-4 text-sm font-bold text-[#2b1f00] hover:brightness-105"
              >
                <span aria-hidden="true">🎟️</span>
                <span className="hidden min-[760px]:inline">Comprar entradas</span>
              </a>
              <button
                type="button"
                onClick={onSalir}
                disabled={saliendo}
                className="min-h-11 rounded-[10px] border border-white/35 bg-white/15 px-4 text-sm font-bold text-white hover:bg-white/25 disabled:opacity-60"
              >
                Salir
              </button>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm opacity-90">{subtitulo}</p>
              <h1 className="mt-0.5 break-words text-[22px] font-bold leading-tight min-[760px]:text-[28px]">{saludo}</h1>
              {(etiqueta || lugarDias) && (
                <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm opacity-95">
                  {etiqueta && (
                    <span className="rounded-full bg-[#f6e7b8] px-2.5 py-0.5 text-xs font-bold text-[#5b4300]">{etiqueta}</span>
                  )}
                  {lugarDias && <span>{lugarDias}</span>}
                </p>
              )}
            </div>
            {dias !== null && (
              <div className="rounded-xl border border-white/30 bg-white/15 px-3 py-2 text-center min-[760px]:px-4 min-[760px]:py-2.5">
                {dias === 0 ? (
                  <>
                    <b className="block text-xl min-[760px]:text-[26px]">Hoy</b>
                    <span className="text-xs opacity-90">empieza el congreso</span>
                  </>
                ) : (
                  <>
                    <b className="block text-xl min-[760px]:text-[26px]">{dias}</b>
                    <span className="text-xs opacity-90">{dias === 1 ? "día" : "días"} para el congreso</span>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      <div
        className={`mx-auto grid w-full max-w-[1240px] flex-1 gap-3.5 p-3.5 min-[760px]:gap-6 min-[760px]:p-6 ${
          pestanas.length > 1 ? "min-[760px]:grid-cols-[230px_minmax(0,1fr)]" : ""
        }`}
      >
        {pestanas.length > 1 ? (
          <nav
            aria-label="Secciones"
            className="-mx-3.5 flex gap-1.5 overflow-x-auto px-3.5 pb-1 min-[760px]:sticky min-[760px]:top-4 min-[760px]:mx-0 min-[760px]:flex-col min-[760px]:gap-1 min-[760px]:self-start min-[760px]:overflow-visible min-[760px]:px-0"
          >
            {pestanas.map(({ id, titulo, insignia }) => {
              const on = id === activa;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => onIr(id)}
                  aria-current={on ? "page" : undefined}
                  // En móvil la fila se desliza: que la pestaña abierta quede a la vista.
                  ref={on ? (el) => el?.scrollIntoView({ block: "nearest", inline: "nearest" }) : undefined}
                  className={`flex min-h-11 shrink-0 items-center justify-between gap-2 whitespace-nowrap rounded-[10px] border px-3 py-2 text-left text-sm min-[760px]:border-transparent min-[760px]:py-2.5 ${
                    on
                      ? "border-[var(--balvert-azul-oscuro)] bg-[var(--balvert-azul-oscuro)] font-bold text-white min-[760px]:bg-white min-[760px]:text-[var(--balvert-azul-oscuro)] min-[760px]:shadow-sm"
                      : "border-[var(--borde)] bg-white text-[#1f2a33] min-[760px]:bg-transparent min-[760px]:hover:bg-[#e7eef3]"
                  }`}
                >
                  {titulo}
                  {insignia !== null && insignia !== undefined && insignia !== 0 && (
                    <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#fff3d6] px-1.5 text-[11px] font-extrabold text-[#a86a00]">
                      {insignia}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        ) : null}
        <div className="flex min-w-0 flex-col gap-4">{children}</div>
      </div>
    </div>
  );
}

// ---- Piezas de las dos zonas ----

export function Tarjeta({
  titulo,
  ayuda,
  nivel = 3,
  className = "",
  children,
}: {
  titulo?: React.ReactNode;
  ayuda?: React.ReactNode;
  // 2: título de la pestaña (marrón dorado, más grande); 3: título de tarjeta.
  nivel?: 2 | 3;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <section className={`rounded-[14px] border border-[#e3e8ec] bg-white p-5 ${className}`}>
      {titulo &&
        (nivel === 2 ? (
          <h2 className="mb-1 text-lg font-bold text-[var(--balvert-marron)]">{titulo}</h2>
        ) : (
          <h3 className="mb-1.5 text-base font-bold text-[var(--balvert-marron)]">{titulo}</h3>
        ))}
      {ayuda && <div className="text-sm leading-relaxed text-[#5d6b76]">{ayuda}</div>}
      {children !== undefined && children !== null && children !== false && (
        <div className={titulo || ayuda ? "mt-3" : ""}>{children}</div>
      )}
    </section>
  );
}

export function EtiquetaEstado({ bien, children }: { bien: boolean; children: React.ReactNode }) {
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-bold ${
        bien ? "bg-[#e3f5ea] text-[#1f8a4c]" : "bg-[#fff3d6] text-[#a86a00]"
      }`}
    >
      {children}
    </span>
  );
}

export function ContactoZona() {
  return (
    <p className="pt-2 text-center text-sm text-[#5d6b76]">
      ¿Dudas? Escríbenos a{" "}
      <a href="mailto:secretaria@balvert.es" className="font-medium text-[var(--balvert-azul-oscuro)] underline">
        secretaria@balvert.es
      </a>
    </p>
  );
}
