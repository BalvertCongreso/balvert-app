"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

// "¿Esta persona ya vino antes?" (PROJECT_BRIEF.md): sin tabla de personas,
// solo se busca el mismo email en las otras ediciones. Es un aviso
// informativo; nunca impide guardar.

export type TablaHistorial = "asistentes_congreso" | "gala" | "excursion" | "patrocinadores";

// Campos de email que identifican a la persona en cada tabla. Patrocinadores
// tiene dos contactos.
export const CAMPOS_EMAIL_HISTORIAL: Record<TablaHistorial, string[]> = {
  asistentes_congreso: ["email"],
  gala: ["email_asistente"],
  excursion: ["email_asistente"],
  patrocinadores: ["contacto1_email", "contacto2_email"],
};

const BUSQUEDAS: {
  tabla: TablaHistorial;
  campo: string;
  tipo: string;
  ruta: string;
  nombre: string;
}[] = [
  { tabla: "asistentes_congreso", campo: "email", tipo: "Congreso", ruta: "/congreso", nombre: "nombre" },
  { tabla: "gala", campo: "email_asistente", tipo: "Gala", ruta: "/gala", nombre: "nombre_asistente" },
  { tabla: "excursion", campo: "email_asistente", tipo: "Excursión", ruta: "/excursion", nombre: "nombre_asistente" },
  { tabla: "patrocinadores", campo: "contacto1_email", tipo: "Patrocinador", ruta: "/patrocinadores", nombre: "empresa_entidad" },
  { tabla: "patrocinadores", campo: "contacto2_email", tipo: "Patrocinador", ruta: "/patrocinadores", nombre: "empresa_entidad" },
];

const MAX_ENLACES = 5;

interface Coincidencia {
  clave: string;
  edicion: string;
  tipo: string;
  href: string;
  nombre: string | null;
}

function normalizar(email: string): string {
  return email.trim().toLowerCase();
}

// Escapa los comodines de LIKE para que el email se busque tal cual.
function escaparLike(texto: string): string {
  return texto.replace(/[\\%_]/g, (c) => `\\${c}`);
}

async function buscar(
  email: string,
  edicionId: string | null,
  tablaActual: TablaHistorial,
  registroId: string | null
): Promise<Coincidencia[]> {
  const objetivo = normalizar(email);
  const resultados = await Promise.all(
    BUSQUEDAS.map(async (b) => {
      // ilike con %…% para tolerar espacios guardados alrededor; luego se
      // compara exacto (sin mayúsculas ni espacios) en el navegador.
      let consulta = supabase
        .from(b.tabla)
        .select(`id, ${b.campo}, ${b.nombre}, ediciones(nombre)`)
        .ilike(b.campo, `%${escaparLike(objetivo)}%`)
        .limit(50);
      consulta = edicionId
        ? consulta.neq("edicion_id", edicionId)
        : consulta.not("edicion_id", "is", null);
      if (registroId && b.tabla === tablaActual) consulta = consulta.neq("id", registroId);

      const { data, error } = await consulta;
      if (error || !data) return [];
      return (data as unknown as Record<string, unknown>[])
        .filter((fila) => typeof fila[b.campo] === "string" && normalizar(fila[b.campo] as string) === objetivo)
        .map((fila) => {
          const edicion = fila.ediciones as { nombre: string | null } | null;
          return {
            clave: `${b.tabla}:${fila.id}`,
            edicion: edicion?.nombre ?? "Otra edición",
            tipo: b.tipo,
            href: `${b.ruta}/${fila.id}`,
            nombre: (fila[b.nombre] as string | null) ?? null,
          };
        });
    })
  );

  // Un patrocinador puede coincidir por los dos contactos: solo una vez.
  const vistos = new Set<string>();
  return resultados.flat().filter((c) => {
    if (vistos.has(c.clave)) return false;
    vistos.add(c.clave);
    return true;
  });
}

interface Props {
  email: string;
  edicionId: string | null;
  tablaActual: TablaHistorial;
  registroId: string | null;
}

export default function AvisoEmailOtrasEdiciones({ email, edicionId, tablaActual, registroId }: Props) {
  // Resultado junto al email buscado: si el email ya no coincide (se ha
  // seguido escribiendo o borrado), el aviso antiguo deja de mostrarse.
  const [resultado, setResultado] = useState<{ email: string; coincidencias: Coincidencia[] } | null>(null);
  const limpio = normalizar(email);
  const valido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(limpio);

  useEffect(() => {
    if (!valido) return;
    let cancelado = false;
    // Espera a que se deje de escribir para no lanzar una búsqueda por tecla.
    const temporizador = setTimeout(async () => {
      const encontradas = await buscar(limpio, edicionId, tablaActual, registroId);
      if (!cancelado) setResultado({ email: limpio, coincidencias: encontradas });
    }, 600);
    return () => {
      cancelado = true;
      clearTimeout(temporizador);
    };
  }, [limpio, valido, edicionId, tablaActual, registroId]);

  const coincidencias = valido && resultado?.email === limpio ? resultado.coincidencias : [];
  if (coincidencias.length === 0) return null;

  // "BALVERT 2026 (Gala, Congreso)" agrupando por edición.
  const porEdicion = new Map<string, Set<string>>();
  for (const c of coincidencias) {
    if (!porEdicion.has(c.edicion)) porEdicion.set(c.edicion, new Set());
    porEdicion.get(c.edicion)!.add(c.tipo);
  }
  const resumen = [...porEdicion.entries()]
    .map(([edicion, tipos]) => `${edicion} (${[...tipos].join(", ")})`)
    .join("; ");
  const restantes = coincidencias.length - MAX_ENLACES;

  return (
    <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
      <p className="font-semibold">Este email ya aparece en {resumen}.</p>
      <ul className="mt-1 flex flex-col gap-0.5">
        {coincidencias.slice(0, MAX_ENLACES).map((c) => (
          <li key={c.clave}>
            <Link href={c.href} target="_blank" className="underline hover:no-underline">
              {c.edicion} · {c.tipo}
              {c.nombre ? ` · ${c.nombre}` : ""}
            </Link>
          </li>
        ))}
      </ul>
      {restantes > 0 && <p className="mt-1">y {restantes} más</p>}
    </div>
  );
}
