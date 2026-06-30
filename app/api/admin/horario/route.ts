// app/api/admin/horario/route.ts
// GET  /api/admin/horario — Lista horario del spa + feriados + bloqueos
// POST /api/admin/horario — Actualiza horario de un día

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

// ── GET /api/admin/horario ─────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const payload = await verificarAuth(request)
  if (!payload) return NextResponse.json({ message: "No autorizado" }, { status: 403 })

  try {
    const { searchParams } = new URL(request.url)
    const mes  = searchParams.get("mes")   // YYYY-MM
    const anio = searchParams.get("anio")  // YYYY

    // Horario semanal del spa
    const horarioRes = await pool.query(
      `SELECT id_horario, dia_semana, hora_inicio, hora_fin, capacidad_max, activo
       FROM horario_spa
       ORDER BY dia_semana`
    )

    // Feriados del mes/año solicitado
    let feriadosRes = { rows: [] as any[] }
    if (mes) {
      feriadosRes = await pool.query(
        `SELECT id_feriado, fecha, nombre, descripcion, es_recuperable
         FROM feriado
         WHERE TO_CHAR(fecha, 'YYYY-MM') = $1
         ORDER BY fecha`,
        [mes]
      )
    } else if (anio) {
      feriadosRes = await pool.query(
        `SELECT id_feriado, fecha, nombre, descripcion, es_recuperable
         FROM feriado
         WHERE EXTRACT(YEAR FROM fecha) = $1
         ORDER BY fecha`,
        [anio]
      )
    } else {
      feriadosRes = await pool.query(
        `SELECT id_feriado, fecha, nombre, descripcion, es_recuperable
         FROM feriado
         WHERE fecha >= CURRENT_DATE
         ORDER BY fecha
         LIMIT 20`
      )
    }

    // Bloqueos próximos (si tabla existe)
    let bloqueosRes = { rows: [] as any[] }
    try {
      bloqueosRes = await pool.query(
        `SELECT b.id_bloqueo, b.fecha, b.hora_inicio, b.hora_fin,
                b.motivo, b.descripcion, b.id_trabajador_groomer,
                u.nombre || ' ' || u.apellido AS nombre_groomer
         FROM bloqueo b
         LEFT JOIN groomer g ON b.id_trabajador_groomer = g.id_trabajador
         LEFT JOIN trabajador_spa ts ON g.id_trabajador = ts.id_trabajador
         LEFT JOIN usuario u ON ts.id_usuario = u.id_usuario
         WHERE b.fecha >= CURRENT_DATE
         ORDER BY b.fecha, b.hora_inicio NULLS FIRST
         LIMIT 30`
      )
    } catch (e: any) {
      if (e.code !== "42P01") throw e
    }

    return NextResponse.json({
      horario:  horarioRes.rows,
      feriados: feriadosRes.rows,
      bloqueos: bloqueosRes.rows,
    })
  } catch (error) {
    console.error("[GET /api/admin/horario]", error)
    return NextResponse.json({ message: "Error interno" }, { status: 500 })
  }
}

// ── POST /api/admin/horario — Actualizar horario de un día ─────────────────
export async function POST(request: NextRequest) {
  const payload = await verificarAuth(request)
  if (!payload) return NextResponse.json({ message: "No autorizado" }, { status: 403 })

  try {
    const body = await request.json()
    const { dia_semana, hora_inicio, hora_fin, capacidad_max, activo } = body

    if (dia_semana === undefined)
      return NextResponse.json({ message: "dia_semana es requerido" }, { status: 400 })

    await pool.query(
      `UPDATE horario_spa
       SET hora_inicio   = COALESCE($1, hora_inicio),
           hora_fin      = COALESCE($2, hora_fin),
           capacidad_max = COALESCE($3, capacidad_max),
           activo        = COALESCE($4, activo)
       WHERE dia_semana = $5`,
      [hora_inicio || null, hora_fin || null, capacidad_max || null,
       activo !== undefined ? activo : null, dia_semana]
    )

    return NextResponse.json({ message: "Horario actualizado correctamente" })
  } catch (error) {
    console.error("[POST /api/admin/horario]", error)
    return NextResponse.json({ message: "Error interno" }, { status: 500 })
  }
}