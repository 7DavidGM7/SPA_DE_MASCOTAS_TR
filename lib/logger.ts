// lib/logger.ts
// Función utilitaria para registrar acciones en la tabla logs
// Úsala en cualquier route: await registrarLog({ ... })

import { Pool } from "pg"

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
})

interface LogEntry {
  id_usuario?: number | null   // quién hizo la acción (admin)
  accion: string               // ej: "CREAR_USUARIO", "BLOQUEAR_USUARIO", "LOGIN"
  entidad?: string             // ej: "usuario", "recepcionista"
  entidad_id?: number | null   // id del registro afectado
  detalle?: string             // descripción legible
  ip?: string                  // IP del request
}

export async function registrarLog(entry: LogEntry): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO logs (id_usuario, accion, entidad, entidad_id, detalle, ip)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        entry.id_usuario ?? null,
        entry.accion,
        entry.entidad ?? null,
        entry.entidad_id ?? null,
        entry.detalle ?? null,
        entry.ip ?? null,
      ]
    )
  } catch (error) {
    // Los logs nunca deben romper el flujo principal
    console.error("[Logger] Error al registrar log:", error)
  }
}

// Extrae la IP real del request (funciona con proxies/Vercel)
export function getIP(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")
  if (forwarded) return forwarded.split(",")[0].trim()
  return request.headers.get("x-real-ip") ?? "desconocida"
}