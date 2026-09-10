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
