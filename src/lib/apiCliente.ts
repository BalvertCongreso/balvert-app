"use client";

import { supabase } from "@/lib/supabaseClient";

export async function cabeceraAutorizacion(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function llamarApiJson(path: string, body: unknown) {
  const headers = await cabeceraAutorizacion();
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Error inesperado.");
  return data;
}

export async function llamarApiGet(path: string) {
  const headers = await cabeceraAutorizacion();
  const res = await fetch(path, { headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Error inesperado.");
  return data;
}

export async function subirArchivo(archivo: File): Promise<{ url: string; nombre: string }> {
  const headers = await cabeceraAutorizacion();
  const formData = new FormData();
  formData.append("archivo", archivo);
  const res = await fetch("/api/newsletter/subir", { method: "POST", headers, body: formData });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "No se pudo subir el archivo.");
  return data;
}

// Borra un patrocinador junto con sus archivos internos (ver
// /api/patrocinadores). Devuelve el mensaje de error, o null si fue bien.
export async function eliminarPatrocinador(id: string): Promise<string | null> {
  const res = await fetch(`/api/patrocinadores?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: await cabeceraAutorizacion(),
  });
  if (res.ok) return null;
  const data = await res.json().catch(() => ({}));
  return data.error || "Error inesperado.";
}

// Descarga un archivo de una ruta del panel que exige sesión (no basta con un
// enlace normal: hay que mandar la cabecera Authorization). Devuelve el
// mensaje de error, o null si fue bien.
export async function descargarConSesion(path: string, nombrePorDefecto: string): Promise<string | null> {
  const res = await fetch(path, { headers: await cabeceraAutorizacion() });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    return data.error || "No se pudo descargar.";
  }
  const nombre = /filename="([^"]+)"/.exec(res.headers.get("content-disposition") ?? "")?.[1] ?? nombrePorDefecto;
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return null;
}
