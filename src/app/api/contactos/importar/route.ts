import { NextResponse } from "next/server";
import { crearClienteServidor, usuarioDesdeCabecera } from "@/lib/supabaseServidor";
import { obtenerTodasLasFilas } from "@/lib/paginarTodo";
import { normalizarEmail } from "@/lib/exclusiones";
import {
  CAMPOS_IMPORTACION,
  MAX_FILAS,
  planificarImportacion,
  resumirPlan,
  type CamposContacto,
  type FilaEnviada,
} from "@/lib/importarContactos";
import type { ContactoNewsletter } from "@/types/database";

// «Importar contactos». Con `simular: true` devuelve la previsualización sin
// guardar nada; sin él, vuelve a calcularlo todo con los datos de ese momento
// y lo aplica. Las dos cosas pasan por planificarImportacion, así que lo que
// se ve en la previsualización es lo que se aplica. Con la sesión del panel
// (las escrituras pasan por las mismas reglas de acceso).
//
// Nunca borra, nunca cambia el estado de nadie, nunca pisa un dato que ya
// exista y no sincroniza con Mailrelay.
export const maxDuration = 60;

const CAMPOS_VALIDOS = new Set<string>(CAMPOS_IMPORTACION.map((c) => c.key));
const LOTE = 500;

function validarFilas(valor: unknown): FilaEnviada[] | string {
  if (!Array.isArray(valor)) return "Faltan las filas del archivo.";
  if (valor.length === 0) return "El archivo no tiene filas con datos.";
  if (valor.length > MAX_FILAS) return `El archivo tiene ${valor.length} filas; el máximo son ${MAX_FILAS}.`;
  const filas: FilaEnviada[] = [];
  for (const f of valor) {
    if (!f || typeof f !== "object" || typeof (f as { fila?: unknown }).fila !== "number") return "Hay filas con un formato no válido.";
    const limpia: FilaEnviada = { fila: (f as { fila: number }).fila };
    for (const [k, v] of Object.entries(f as Record<string, unknown>)) {
      if (k === "fila") continue;
      if (!CAMPOS_VALIDOS.has(k) || typeof v !== "string") return `Campo no válido en la fila ${limpia.fila}: ${k}.`;
      (limpia as Record<string, unknown>)[k] = v;
    }
    filas.push(limpia);
  }
  return filas;
}

export async function POST(req: Request) {
  const authHeader = req.headers.get("authorization");
  const usuario = await usuarioDesdeCabecera(authHeader);
  if (!usuario) {
    return NextResponse.json({ error: "Sesión no encontrada. Vuelve a iniciar sesión." }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const filas = validarFilas(body?.filas);
  if (typeof filas === "string") return NextResponse.json({ error: filas }, { status: 400 });
  const origenGeneral = typeof body?.origen === "string" ? body.origen.trim().slice(0, 200) : "";
  if (!origenGeneral) {
    return NextResponse.json({ error: "Elige o escribe el «Origen de la lista» para el archivo." }, { status: 400 });
  }
  if (!filas.some((f) => f.email !== undefined)) {
    return NextResponse.json({ error: "Falta la columna de email." }, { status: 400 });
  }
  const simular = body?.simular === true;

  const db = crearClienteServidor(authHeader);
  let existentes: Map<string, ContactoNewsletter>;
  try {
    const todos = await obtenerTodasLasFilas<ContactoNewsletter>((desde, hasta) =>
      db.from("contactos_newsletter").select("*").order("id").range(desde, hasta)
    );
    existentes = new Map(todos.filter((c) => c.email).map((c) => [normalizarEmail(c.email), c]));
  } catch (e) {
    return NextResponse.json(
      { error: "No se pudieron leer los contactos: " + (e instanceof Error ? e.message : String(e)) },
      { status: 500 }
    );
  }

  const plan = planificarImportacion(filas, origenGeneral, existentes);
  if (simular) return NextResponse.json({ simulado: true, ...resumirPlan(plan) });

  let creados = 0;
  let completados = 0;
  try {
    // Nuevos: si entretanto alguien ha creado el mismo email, se deja como
    // está (ignoreDuplicates), nunca se pisa.
    for (let i = 0; i < plan.nuevos.length; i += LOTE) {
      const lote = plan.nuevos.slice(i, i + LOTE).map((n) => n.datos);
      const { data, error } = await db
        .from("contactos_newsletter")
        .upsert(lote, { onConflict: "email", ignoreDuplicates: true })
        .select("id");
      if (error) throw new Error(error.message);
      creados += data?.length ?? 0;
    }

    // Completar: se agrupan los contactos que completan los mismos campos y
    // se actualizan de golpe, solo esas columnas (ni estado ni nada más).
    const grupos = new Map<string, { id: string; email: string; cambios: CamposContacto }[]>();
    for (const c of [...plan.completar, ...plan.excluidos]) {
      const claves = Object.keys(c.cambios).sort();
      if (claves.length === 0) continue;
      const clave = claves.join(",");
      grupos.set(clave, [...(grupos.get(clave) ?? []), { id: c.id, email: c.email, cambios: c.cambios }]);
    }
    for (const lista of grupos.values()) {
      for (let i = 0; i < lista.length; i += LOTE) {
        // El email va con su mismo valor: no cambia nada y evita que, si el
        // contacto se borrase justo ahora, quedara una fila sin email.
        const lote = lista.slice(i, i + LOTE).map((c) => ({ id: c.id, email: c.email, ...c.cambios }));
        const { error } = await db.from("contactos_newsletter").upsert(lote, { onConflict: "id" });
        if (error) throw new Error(error.message);
        completados += lote.length;
      }
    }
  } catch (e) {
    return NextResponse.json(
      {
        error: `Se paró a medias (${creados} creados, ${completados} completados): ${
          e instanceof Error ? e.message : String(e)
        }. Vuelve a subir el archivo: lo ya importado saldrá como «sin cambios».`,
      },
      { status: 500 }
    );
  }

  return NextResponse.json({ simulado: false, creados, completados, ...resumirPlan(plan) });
}
