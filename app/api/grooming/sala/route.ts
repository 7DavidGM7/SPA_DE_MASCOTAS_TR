// app/api/grooming/sala/route.ts
// GET /api/grooming/sala — Devuelve la primera sala de servicio disponible
import { NextRequest, NextResponse } from "next/server"
import { Pool } from "pg"
import { verifyAccessToken } from "@/lib/auth"

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
})

export async function GET(request: NextRequest) {
  const token =
    request.cookies.get("accessToken")?.value ??
    request.headers.get("authorization")?.replace("Bearer ", "")
  if (!token) return NextResponse.json({ message: "No autenticado" }, { status: 401 })
  const payload = await verifyAccessToken(token)
  if (!payload) return NextResponse.json({ message: "Token inválido" }, { status: 401 })

  try {
    const result = await pool.query(
      `SELECT id_sala_servicio, nombre, capacidad
       FROM sala_de_servicio
       ORDER BY id_sala_servicio
       LIMIT 1`
    )
    if (!result.rows[0])
      return NextResponse.json({ message: "No hay salas registradas" }, { status: 404 })

    return NextResponse.json(result.rows[0])
  } catch (error) {
    console.error("[GET /api/grooming/sala]", error)
    return NextResponse.json({ message: "Error interno" }, { status: 500 })
  }
}