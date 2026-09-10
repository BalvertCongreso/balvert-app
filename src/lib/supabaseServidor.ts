import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key";

// Cliente para usar dentro de rutas de la API (servidor). Si se le pasa el
// token de sesión del usuario (reenviado desde el navegador vía cabecera
// Authorization), las políticas RLS que exigen auth.uid() funcionan igual
// que si la petición viniera directamente del navegador logueado. Sin
// token, se comporta como un visitante anónimo — es lo que usa el
// formulario público de inscripción.
export function crearClienteServidor(authHeader?: string | null) {
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: authHeader ? { headers: { Authorization: authHeader } } : undefined,
  });
}

// Comprueba que la cabecera Authorization corresponde a una sesión real de
// Supabase. A diferencia de las rutas que solo leen/escriben en Supabase (esa
// comprobación ya la hace RLS), esto hace falta en rutas que llaman a un
// servicio externo (p. ej. Mailrelay) donde RLS no protege nada.
export async function usuarioDesdeCabecera(authHeader: string | null) {
  const token = authHeader?.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const supabase = crearClienteServidor();
  const { data } = await supabase.auth.getUser(token);
  return data.user ?? null;
}

// Cliente con la clave "service_role": salta las políticas RLS por completo.
// Solo debe usarse en código de servidor que nunca se envía al navegador, y
// solo cuando la propia ruta valida a mano y de forma estricta qué se puede
// leer o escribir (p. ej. el formulario público de inscripción, que no tiene
// sesión con la que satisfacer auth.uid()).
export function crearClienteServicio() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    throw new Error("Falta SUPABASE_SERVICE_ROLE_KEY en el servidor (.env.local).");
  }
  return createClient(supabaseUrl, serviceKey);
}
