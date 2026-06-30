// app/api/admin/bloqueos/route.ts
// GET  /api/admin/bloqueos — Lista bloqueos
// POST /api/admin/bloqueos — Crear bloqueo

import { NextRequest, NextResponse } from "next/server"
import { Pool } from "pg"
import { verifyAccessToken } from "@/lib/auth"

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
})

async function verificarAuth(request: NextRequest) {
  const token =
    request.cookies.get("accessToken")?.value ??
    request.headers.get("authorization")?.replace("Bearer ", "")
  if (!token) return null
  const payload = await verifyAccessToken(token)
  if (!payload || !["admin", "recepcionista"].includes(payload.rol)) return null
  return payload
}

export async function GET(request: NextRequest) {
  const payload = await verificarAuth(request)
  if (!payload) return NextResponse.json({ message: "No autorizado" }, { status: 403 })

  try {
    const result = await pool.query(
      `SELECT b.id_bloqueo, b.fecha, b.hora_inicio, b.hora_fin,
              b.motivo, b.descripcion, b.id_trabajador_groomer,
              u.nombre || ' ' || u.apellido AS nombre_groomer
       FROM bloqueo b
       LEFT JOIN groomer g ON b.id_trabajador_groomer = g.id_trabajador
       LEFT JOIN trabajador_spa ts ON g.id_trabajador = ts.id_trabajador
       LEFT JOIN usuario u ON ts.id_usuario = u.id_usuario
       WHERE b.fecha >= CURRENT_DATE
       ORDER BY b.fecha, b.hora_inicio NULLS FIRST`
    )
    return NextResponse.json({ bloqueos: result.rows })
  } catch (e: any) {
    if (e.code === "42P01")
      return NextResponse.json({ bloqueos: [], message: "Tabla bloqueo no creada aún" })
    return NextResponse.json({ message: "Error interno" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const payload = await verificarAuth(request)
  if (!payload) return NextResponse.json({ message: "No autorizado" }, { status: 403 })

  try {
    const {
      fecha, hora_inicio, hora_fin,
      motivo, descripcion, id_trabajador_groomer
    } = await request.json()

    if (!fecha || !motivo)
      return NextResponse.json({ message: "fecha y motivo son requeridos" }, { status: 400 })

    const motivosValidos = ["feriado", "mantenimiento", "ausencia", "emergencia", "otros"]
    if (!motivosValidos.includes(motivo))
      return NextResponse.json({ message: `Motivo inválido. Usa: ${motivosValidos.join(", ")}` }, { status: 400 })

    // Verificar que no haya citas confirmadas en esa fecha/hora antes de bloquear
    const citasConflicto = await pool.query(
      `SELECT COUNT(*) AS total FROM cita
       WHERE fecha_programada = $1
         AND estado_reserva NOT IN ('cancelada', 'no_asistio')
         AND ($2::time IS NULL OR hora_programada < $3::time)
         AND ($2::time IS NULL OR hora_programada >= $2::time)`,
      [fecha, hora_inicio || null, hora_fin || null]
    )

    const totalConflicto = parseInt(citasConflicto.rows[0].total)
    if (totalConflicto > 0) {
      return NextResponse.json(
        { message: `Hay ${totalConflicto} cita(s) activa(s) en ese horario. Cancélalas primero.` },
        { status: 409 }
      )
    }

    const result = await pool.query(
      `INSERT INTO bloqueo
         (fecha, hora_inicio, hora_fin, motivo, descripcion, id_trabajador_groomer, creado_por)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id_bloqueo, fecha, hora_inicio, hora_fin, motivo, descripcion`,
      [
        fecha,
        hora_inicio || null,
        hora_fin || null,
        motivo,
        descripcion?.trim() || null,
        id_trabajador_groomer || null,
        Number(payload.userId),
      ]
    )

    return NextResponse.json(
      { message: "Bloqueo registrado", bloqueo: result.rows[0] },
      { status: 201 }
    )
  } catch (e: any) {
    if (e.code === "42P01")
      return NextResponse.json(
        { message: "La tabla bloqueo no existe. Ejecuta el SQL 001_tablas_faltantes.sql en Neon." },
        { status: 500 }
      )
    console.error("[POST /api/admin/bloqueos]", e)
    return NextResponse.json({ message: "Error interno" }, { status: 500 })
  }
}