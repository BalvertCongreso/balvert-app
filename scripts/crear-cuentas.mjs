#!/usr/bin/env node
// Script puntual para dar de alta las cuentas de Ariadna y Ariosto en
// Supabase Auth vía la API de administración. Necesita SUPABASE_SERVICE_ROLE_KEY
// en .env.local (clave "secret"/"service_role", nunca la publishable/anon).
// Las contraseñas se pasan por variables de entorno en el momento de
// ejecutarlo, nunca quedan escritas en este archivo.
import { readFileSync } from "fs";
import path from "path";

const envPath = path.join(process.cwd(), ".env.local");
for (const linea of readFileSync(envPath, "utf-8").split("\n")) {
  const m = linea.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) process.env[m[1]] ??= m[2];
}

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL || !SERVICE_ROLE) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local");
  process.exit(1);
}

const cuentas = [
  {
    email: process.env.NEXT_PUBLIC_EMAIL_ARIADNA,
    password: process.env.CUENTA_PASSWORD_ARIADNA,
  },
  {
    email: process.env.NEXT_PUBLIC_EMAIL_ARIOSTO,
    password: process.env.CUENTA_PASSWORD_ARIOSTO,
  },
];

for (const cuenta of cuentas) {
  if (!cuenta.email || !cuenta.password) {
    console.error("Falta email o password para una cuenta, se omite.");
    continue;
  }
  const res = await fetch(`${URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      apikey: SERVICE_ROLE,
      Authorization: `Bearer ${SERVICE_ROLE}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: cuenta.email,
      password: cuenta.password,
      email_confirm: true,
    }),
  });
  const data = await res.json();
  console.log(cuenta.email, "->", res.status, res.ok ? "creada correctamente" : JSON.stringify(data));
}
