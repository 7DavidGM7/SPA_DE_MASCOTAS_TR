// app/api/horario/route.ts
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
  return await verifyAccessToken(token)
}

// GET /api/horario
// Devuelve: horario laboral del spa + feriados del mes actual/siguiente
// Query params: ?mes=YYYY-MM para ver un mes específico
export async function GET(request: NextRequest) {
  const payload = await verificarAuth(request)
  if (!payload) {
    return NextResponse.json({ message: "No autorizado" }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const mesParam = searchParams.get("mes") // formato YYYY-MM
    const fechaBase = mesParam ? new Date(`${mesParam}-01`) : new Date()
    const anio = fechaBase.getFullYear()
    const mes = fechaBase.getMonth() + 1

    // Horario laboral por día de semana
    const horarioRes = await pool.query(`
      SELECT id_horario, dia_semana, hora_inicio, hora_fin, capacidad_max, activo
      FROM horario_spa
      ORDER BY dia_semana ASC
    `)

    // Feriados del mes pedido y el siguiente (para vista de calendario)
    const feriadosRes = await pool.query(`
      SELECT id_feriado, fecha, nombre, descripcion, es_recuperable
      FROM feriado
      WHERE EXTRACT(YEAR FROM fecha) = $1
        AND EXTRACT(MONTH FROM fecha) BETWEEN $2 AND $3
      ORDER BY fecha ASC
    `, [anio, mes, mes + 1])

    // Nombres de días para facilitar el frontend
    const DIAS = ["", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"]
    const horario = horarioRes.rows.map((h) => ({
      ...h,
      dia_nombre: DIAS[h.dia_semana] ?? "Desconocido",
    }))

    return NextResponse.json({
      horario,
      feriados: feriadosRes.rows,
      mes_consultado: `${anio}-${String(mes).padStart(2, "0")}`,
    }, { status: 200 })
  } catch (error) {
    console.error("[horario GET]", error)
    return NextResponse.json({ message: "Error interno" }, { status: 500 })
  }
}

// POST /api/horario — solo admin puede modificar horario o agregar feriados
export async function POST(request: NextRequest) {
  const payload = await verificarAuth(request)
  if (!payload || payload.rol !== "admin") {
    return NextResponse.json({ message: "Solo el administrador puede modificar el horario" }, { status: 403 })
  }

  try {
    const body = await request.json()
    const { tipo } = body // "horario" | "feriado"

    if (tipo === "feriado") {
      const { fecha, nombre, descripcion, es_recuperable } = body
      if (!fecha || !nombre) {
        return NextResponse.json({ message: "Fecha y nombre son requeridos" }, { status: 400 })
      }
      const res = await pool.query(`
        INSERT INTO feriado (fecha, nombre, descripcion, es_recuperable)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (fecha) DO UPDATE SET nombre = $2, descripcion = $3
        RETURNING *
      `, [fecha, nombre, descripcion ?? null, es_recuperable ?? true])
      return NextResponse.json({ feriado: res.rows[0], message: "Feriado registrado" }, { status: 201 })
    }

    if (tipo === "horario") {
      const { dia_semana, hora_inicio, hora_fin, capacidad_max, activo } = body
      if (!dia_semana || !hora_inicio || !hora_fin) {
        return NextResponse.json({ message: "día, hora_inicio y hora_fin son requeridos" }, { status: 400 })
      }
      const res = await pool.query(`
        INSERT INTO horario_spa (dia_semana, hora_inicio, hora_fin, capacidad_max, activo)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (dia_semana) DO UPDATE
          SET hora_inicio = $2, hora_fin = $3,
              capacidad_max = $4, activo = $5
        RETURNING *
      `, [dia_semana, hora_inicio, hora_fin, capacidad_max ?? 8, activo ?? true])
      return NextResponse.json({ horario: res.rows[0], message: "Horario actualizado" }, { status: 200 })
    }

    return NextResponse.json({ message: "Tipo inválido. Usa 'horario' o 'feriado'" }, { status: 400 })
  } catch (error) {
    console.error("[horario POST]", error)
    return NextResponse.json({ message: "Error interno" }, { status: 500 })
  }
}