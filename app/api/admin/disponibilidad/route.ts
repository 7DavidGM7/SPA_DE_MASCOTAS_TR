// app/api/admin/disponibilidad/route.ts
// GET  /api/admin/disponibilidad — Lista todas las disponibilidades de groomers
// POST /api/admin/disponibilidad — Asignar horario a un groomer
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
      `SELECT dg.id_disponibilidad, dg.id_trabajador, dg.dia_semana,
              dg.hora_inicio, dg.hora_fin, dg.activo,
              u.nombre, u.apellido, g.especialidad
       FROM disponibilidad_groomer dg
       JOIN groomer g ON g.id_trabajador = dg.id_trabajador
       JOIN trabajador_spa ts ON ts.id_trabajador = g.id_trabajador
       JOIN usuario u ON u.id_usuario = ts.id_usuario
       ORDER BY dg.id_trabajador, dg.dia_semana`
    )
    return NextResponse.json({ disponibilidades: result.rows })
  } catch (error) {
    console.error("[GET /api/admin/disponibilidad]", error)
    return NextResponse.json({ message: "Error interno" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const payload = await verificarAuth(request)
  if (!payload) return NextResponse.json({ message: "No autorizado" }, { status: 403 })

  try {
    const { id_trabajador, dia_semana, hora_inicio, hora_fin } = await request.json()

    if (!id_trabajador || !dia_semana || !hora_inicio || !hora_fin)
      return NextResponse.json({ message: "Todos los campos son requeridos" }, { status: 400 })

    if (hora_fin <= hora_inicio)
      return NextResponse.json({ message: "La hora fin debe ser mayor a la hora inicio" }, { status: 400 })

    // Usar ON CONFLICT para actualizar si ya existe ese groomer+dia
    const result = await pool.query(
      `INSERT INTO disponibilidad_groomer
         (id_trabajador, dia_semana, hora_inicio, hora_fin, activo)
       VALUES ($1, $2, $3, $4, TRUE)
       ON CONFLICT (id_trabajador, dia_semana)
       DO UPDATE SET hora_inicio = $3, hora_fin = $4, activo = TRUE
       RETURNING id_disponibilidad`,
      [id_trabajador, dia_semana, hora_inicio, hora_fin]
    )

    return NextResponse.json({
      message: "Disponibilidad asignada",
      id_disponibilidad: result.rows[0].id_disponibilidad
    }, { status: 201 })
  } catch (error) {
    console.error("[POST /api/admin/disponibilidad]", error)
    return NextResponse.json({ message: "Error interno" }, { status: 500 })
  }
}