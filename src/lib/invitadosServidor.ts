// Alta, listado y baja de invitados de un patrocinador (Congreso y, en
// Diamante, cena de gala y excursión). Solo servidor. Lo usan la ficha del
// patrocinador en el panel (/api/patrocinadores/invitados, con la sesión del
// panel: el historial sale con su nombre) y la zona de la empresa en el
// portal (/api/portal/empresa/invitados, clave de servicio y autor "Portal:
// <usuario>" en el historial). El cliente de Supabase lo decide quien llama.
import { randomUUID } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { construirDatosEntrada, type Tabla } from "@/lib/entradaDatos";
import { enviarEmailConVariasEntradas, type EntradaParaEmail } from "@/lib/entradaEmail";
import { ORIGEN_PUBLICO } from "@/lib/dominio";
import { AYUDA_DOCUMENTO_SIN_TIPO, nombreTieneApellidos, validarDocumentoSinTipo } from "@/lib/documentoIdentidad";
import {
  CATEGORIA_DIAMANTE,
  EMAIL_REGEX,
  MENUS_GALA,
  TIPO_ACCESO_INVITADO,
  TIPO_ENTRADA_INCLUIDA,
  incluidasDe,
  tieneCheckIn,
  type DatosNuevoInvitado,
  type EntradaInvitado,
  type EstadoEntrada,
  type Invitado,
  type ResumenInvitados,
} from "@/lib/invitados";

export interface PatrocinadorInvitaciones {
  id: string;
  edicion_id: string | null;
  empresa_entidad: string | null;
  categoria: string | null;
  num_invitaciones_incluidas: number | null;
}

export async function leerPatrocinador(supabase: SupabaseClient, id: string): Promise<PatrocinadorInvitaciones | null> {
  const { data } = await supabase
    .from("patrocinadores")
    .select("id, edicion_id, empresa_entidad, categoria, num_invitaciones_incluidas")
    .eq("id", id)
    .maybeSingle();
  return data ?? null;
}

type Fila = Record<string, unknown>;

// Escrituras en Congreso/Gala/Excursión. Con autor (portal, clave de
// servicio) van por las funciones de la migración 031, que lo dejan en el
// historial; sin autor, directas con la sesión del panel.
async function insertarFila(supabase: SupabaseClient, sql: string, fila: Fila, autor?: string): Promise<Fila> {
  if (autor) {
    const { data, error } = await supabase.rpc("insertar_entrada_como", { p_tabla: sql, p_autor: autor, p_fila: fila });
    if (error || !data) throw new Error(error?.message ?? "sin datos");
    return data as Fila;
  }
  const { data, error } = await supabase.from(sql).insert(fila).select("*").single();
  if (error || !data) throw new Error(error?.message ?? "sin datos");
  return data;
}

async function actualizarFila(supabase: SupabaseClient, sql: string, id: string, campos: Fila, autor?: string) {
  const { error } = autor
    ? await supabase.rpc("actualizar_entrada_como", { p_tabla: sql, p_id: id, p_autor: autor, p_campos: campos })
    : await supabase.from(sql).update(campos).eq("id", id);
  if (error) throw new Error(error.message);
}

async function borrarFila(supabase: SupabaseClient, sql: string, id: string, autor?: string) {
  const { error } = autor
    ? await supabase.rpc("borrar_entrada_como", { p_tabla: sql, p_id: id, p_autor: autor })
    : await supabase.from(sql).delete().eq("id", id);
  if (error) throw new Error(error.message);
}

function estadoDe(fila: Fila): EstadoEntrada {
  if (!fila.qr_codigo) return "sin_generar";
  return fila.entrada_enviada === "Sí" ? "enviada" : "no_enviada";
}

function entradaDe(fila: Fila): EntradaInvitado {
  return {
    id: fila.id as string,
    estado: estadoDe(fila),
    checkIn: fila.check_in_hecho === "Sí",
    ...(fila.menu !== undefined ? { menu: (fila.menu as string | null) ?? null } : {}),
  };
}

function claveDe(email: unknown, tabla: Tabla, id: unknown) {
  const e = typeof email === "string" ? email.trim().toLowerCase() : "";
  return e || `${tabla}:${id as string}`;
}

export async function listarInvitados(
  supabase: SupabaseClient,
  patrocinador: PatrocinadorInvitaciones
): Promise<ResumenInvitados> {
  const [congreso, gala, excursion] = await Promise.all([
    supabase
      .from("asistentes_congreso")
      .select("id, nombre, email, qr_codigo, entrada_enviada, check_in_hecho")
      .eq("empresa_entidad", patrocinador.id)
      .eq("tipo_acceso", TIPO_ACCESO_INVITADO),
    supabase
      .from("gala")
      .select("id, nombre_asistente, email_asistente, qr_codigo, entrada_enviada, check_in_hecho, menu")
      .eq("empresa_entidad", patrocinador.id)
      .eq("tipo_entrada", TIPO_ENTRADA_INCLUIDA),
    supabase
      .from("excursion")
      .select("id, nombre_asistente, email_asistente, qr_codigo, entrada_enviada, check_in_hecho")
      .eq("empresa_entidad", patrocinador.id)
      .eq("tipo_entrada", TIPO_ENTRADA_INCLUIDA),
  ]);
  const error = congreso.error || gala.error || excursion.error;
  if (error) throw new Error("No se pudieron cargar los invitados: " + error.message);

  const porClave = new Map<string, Invitado>();
  function obtener(clave: string, nombre: unknown, email: unknown): Invitado {
    let inv = porClave.get(clave);
    if (!inv) {
      inv = { clave, nombre: null, email: null, congreso: null, gala: null, excursion: null };
      porClave.set(clave, inv);
    }
    inv.nombre ??= (nombre as string | null) || null;
    inv.email ??= (email as string | null) || null;
    return inv;
  }
  for (const f of (congreso.data ?? []) as Fila[]) {
    obtener(claveDe(f.email, "congreso", f.id), f.nombre, f.email).congreso = entradaDe(f);
  }
  for (const f of (gala.data ?? []) as Fila[]) {
    obtener(claveDe(f.email_asistente, "gala", f.id), f.nombre_asistente, f.email_asistente).gala = entradaDe(f);
  }
  for (const f of (excursion.data ?? []) as Fila[]) {
    const inv = obtener(claveDe(f.email_asistente, "excursion", f.id), f.nombre_asistente, f.email_asistente);
    inv.excursion = entradaDe(f);
  }

  const invitados = [...porClave.values()].sort((a, b) =>
    (a.nombre ?? a.email ?? "").localeCompare(b.nombre ?? b.email ?? "", "es")
  );
  return {
    invitados,
    incluidas: incluidasDe(patrocinador),
    asignadas: {
      congreso: congreso.data?.length ?? 0,
      gala: gala.data?.length ?? 0,
      excursion: excursion.data?.length ?? 0,
    },
    esDiamante: patrocinador.categoria === CATEGORIA_DIAMANTE,
  };
}

// Comprueba y limpia lo que llega del navegador. Devuelve el mensaje de error
// o los datos listos para guardar.
export function validarNuevoInvitado(body: unknown): DatosNuevoInvitado | string {
  const b = (body ?? {}) as Record<string, unknown>;
  const nombre = typeof b.nombre === "string" ? b.nombre.trim().replace(/\s+/g, " ") : "";
  const email = typeof b.email === "string" ? b.email.trim().toLowerCase() : "";
  const documentoBruto = typeof b.documento === "string" ? b.documento.trim() : "";
  if (!nombre || !nombreTieneApellidos(nombre)) return "Escribe el nombre y los apellidos del invitado.";
  if (nombre.length > 150) return "El nombre es demasiado largo.";
  if (!EMAIL_REGEX.test(email) || email.length > 200) return "El email del invitado no tiene un formato válido.";
  let documento = "";
  if (documentoBruto) {
    const valido = validarDocumentoSinTipo(documentoBruto);
    if (!valido) return AYUDA_DOCUMENTO_SIN_TIPO;
    documento = valido;
  }
  let gala: DatosNuevoInvitado["gala"] = null;
  if (b.gala && typeof b.gala === "object") {
    const g = b.gala as Record<string, unknown>;
    const menu = typeof g.menu === "string" ? g.menu : "";
    if (!(MENUS_GALA as readonly string[]).includes(menu)) return "Elige el menú de la cena de gala.";
    const alergias = typeof g.alergias === "string" ? g.alergias.trim().slice(0, 500) : "";
    gala = { menu, alergias };
  }
  return { nombre, email, documento, gala, excursion: b.excursion === true };
}

export interface ResultadoAlta {
  clave: string;
  // Solo si se pidió enviar: si el email salió o no (las entradas quedan
  // generadas igualmente y se reenvían desde su ficha).
  enviado: boolean | null;
  errorEnvio?: string;
}

// Crea las filas del invitado (Congreso y, si se piden, cena y excursión) y,
// si enviar es true, genera sus entradas y se las manda en un solo email.
// limitar: no deja pasar de lo incluido (la empresa desde su zona); el panel
// sí puede (con aviso en pantalla).
export async function anadirInvitado(
  supabase: SupabaseClient,
  patrocinador: PatrocinadorInvitaciones,
  datos: DatosNuevoInvitado,
  opciones: { enviar: boolean; limitar: boolean; autor?: string }
): Promise<ResultadoAlta> {
  const esDiamante = patrocinador.categoria === CATEGORIA_DIAMANTE;
  if ((datos.gala || datos.excursion) && !esDiamante) {
    throw new ErrorInvitados("La cena de gala y la excursión solo se incluyen en el patrocinio Diamante.");
  }

  const resumen = await listarInvitados(supabase, patrocinador);
  if (resumen.invitados.some((i) => i.clave === datos.email)) {
    throw new ErrorInvitados("Esta persona ya está en la lista de invitados de la empresa.");
  }
  if (opciones.limitar) {
    const { incluidas, asignadas } = resumen;
    if (asignadas.congreso >= incluidas.congreso) throw new ErrorInvitados(MENSAJE_LIMITE);
    if (datos.gala && asignadas.gala >= incluidas.gala) throw new ErrorInvitados(MENSAJE_LIMITE);
    if (datos.excursion && asignadas.excursion >= incluidas.excursion) throw new ErrorInvitados(MENSAJE_LIMITE);
  }

  const qr = () => (opciones.enviar ? randomUUID() : null);
  const comunes = {
    edicion_id: patrocinador.edicion_id,
    empresa_entidad: patrocinador.id,
    categoria_patrocinio: patrocinador.categoria,
    documento_identidad: datos.documento || null,
    confirmado: "Pendiente",
    entrada_enviada: "No",
  };

  const creadas: { tabla: Tabla; fila: Fila }[] = [];
  async function insertar(tabla: Tabla, sql: string, fila: Fila) {
    try {
      creadas.push({ tabla, fila: await insertarFila(supabase, sql, fila, opciones.autor) });
    } catch (e) {
      throw new Error(`No se pudo guardar el invitado (${tabla}): ${e instanceof Error ? e.message : e}`);
    }
  }

  try {
    await insertar("congreso", "asistentes_congreso", {
      ...comunes,
      nombre: datos.nombre,
      email: datos.email,
      tipo_acceso: TIPO_ACCESO_INVITADO,
      qr_codigo: qr(),
    });
    if (datos.gala) {
      await insertar("gala", "gala", {
        ...comunes,
        nombre_asistente: datos.nombre,
        email_asistente: datos.email,
        tipo_entrada: TIPO_ENTRADA_INCLUIDA,
        menu: datos.gala.menu,
        alergias_intolerancias: datos.gala.alergias || null,
        qr_codigo: qr(),
      });
    }
    if (datos.excursion) {
      await insertar("excursion", "excursion", {
        ...comunes,
        nombre_asistente: datos.nombre,
        email_asistente: datos.email,
        tipo_entrada: TIPO_ENTRADA_INCLUIDA,
        qr_codigo: qr(),
      });
    }
  } catch (e) {
    // Sin filas a medias: si falla una, se deshacen las ya creadas.
    for (const c of creadas) {
      await borrarFila(supabase, TABLA_SQL[c.tabla], c.fila.id as string, opciones.autor).catch(() => null);
    }
    throw e;
  }

  if (!opciones.enviar) return { clave: datos.email, enviado: null };
  const envio = await enviarEntradas(supabase, patrocinador, datos.email, creadas, opciones.autor);
  return { clave: datos.email, enviado: envio.enviado, errorEnvio: envio.error };
}

// Manda en un solo email las entradas (ya con QR) y las marca como enviadas.
async function enviarEntradas(
  supabase: SupabaseClient,
  patrocinador: PatrocinadorInvitaciones,
  email: string,
  filas: { tabla: Tabla; fila: Fila }[],
  autor?: string
) {
  const entradas: EntradaParaEmail[] = await Promise.all(
    filas.map(async ({ tabla, fila }) => ({
      tabla,
      qrCodigo: fila.qr_codigo as string,
      datos: await construirDatosEntrada(supabase, tabla, fila),
    }))
  );
  const resultado = await enviarEmailConVariasEntradas(
    email,
    entradas,
    ORIGEN_PUBLICO,
    patrocinador.empresa_entidad || "Una empresa patrocinadora"
  );
  if (resultado.enviado) {
    for (const { tabla, fila } of filas) {
      await actualizarFila(supabase, TABLA_SQL[tabla], fila.id as string, { entrada_enviada: "Sí" }, autor);
    }
  }
  return resultado;
}

// Borra todas las filas del invitado (Congreso, cena y excursión). No se
// puede si ya ha hecho el check-in en alguna.
export async function quitarInvitado(
  supabase: SupabaseClient,
  patrocinador: PatrocinadorInvitaciones,
  clave: string,
  autor?: string
) {
  const { invitados } = await listarInvitados(supabase, patrocinador);
  const inv = invitados.find((i) => i.clave === clave);
  if (!inv) throw new ErrorInvitados("Ese invitado ya no está en la lista.", 404);
  if (tieneCheckIn(inv)) throw new ErrorInvitados("No se puede quitar: ya ha hecho el check-in.");
  for (const tabla of ["congreso", "gala", "excursion"] as const) {
    const entrada = inv[tabla];
    if (!entrada) continue;
    try {
      await borrarFila(supabase, TABLA_SQL[tabla], entrada.id, autor);
    } catch (e) {
      throw new Error("No se pudo quitar al invitado: " + (e instanceof Error ? e.message : e));
    }
  }
  return inv;
}

const TABLA_SQL: Record<Tabla, string> = { congreso: "asistentes_congreso", gala: "gala", excursion: "excursion" };

export const MENSAJE_LIMITE =
  "Ya habéis asignado todas vuestras invitaciones; si necesitáis más, escribid a secretaria@balvert.es";

// Errores que se enseñan tal cual a quien hace la petición (400/404).
export class ErrorInvitados extends Error {
  constructor(mensaje: string, public estado = 400) {
    super(mensaje);
  }
}
