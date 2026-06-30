// app/api/groomers/route.ts
// GET /api/groomers — Lista groomers disponibles para asignación
import { NextRequest, NextResponse } from "next/server"
import { Pool } from "pg"
import { verifyAccessToken } from "@/lib/auth"

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
})

export async function GET(request: NextRequest) {
  try {
    const token =
      request.cookies.get("accessToken")?.value ??
      request.headers.get("authorization")?.replace("Bearer ", "")
    if (!token) return NextResponse.json({ message: "No autenticado" }, { status: 401 })
    const payload = await verifyAccessToken(token)
    if (!payload) return NextResponse.json({ message: "Token inválido" }, { status: 401 })

    const result = await pool.query(`
      SELECT
        g.id_trabajador,
        u.nombre,
        u.apellido,
        g.especialidad,
        g.anos_experiencia
      FROM groomer g
      JOIN trabajador_spa ts ON ts.id_trabajador = g.id_trabajador
      JOIN usuario u ON u.id_usuario = ts.id_usuario
      WHERE u.estado = 'activo'
      ORDER BY u.nombre, u.apellido
    `)

    return NextResponse.json({ groomers: result.rows })
  } catch (error) {
    console.error("[GET /api/groomers]", error)
    return NextResponse.json({ message: "Error al obtener groomers" }, { status: 500 })
  }
}