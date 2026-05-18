// lib/auth-edge.ts
// ─────────────────────────────────────────────────────────────────────────────
// Solo funciones de verificación JWT — compatibles con Edge Runtime.
// NO importa 'crypto' de Node.js, solo 'jose' que es Edge-safe.
// El middleware DEBE importar desde aquí, nunca desde lib/auth.ts
// ─────────────────────────────────────────────────────────────────────────────
import { jwtVerify } from "jose"
import type { Rol } from "./auth"

export type { Rol }

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "fallback-secret-change-in-production"
)

export interface JWTPayload {
  userId: string
  email: string
  nombre: string
  apellido: string
  rol: Rol
}

export async function verifyAccessTokenEdge(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET)
    return payload as unknown as JWTPayload
  } catch {
    return null
  }
}
