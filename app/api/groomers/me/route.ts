// app/api/groomers/me/route.ts
// GET /api/groomers/me — Devuelve el id_trabajador del groomer logueado
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

    const result = await pool.query(
      `SELECT g.id_trabajador, g.especialidad, g.anos_experiencia
       FROM groomer g
       JOIN trabajador_spa ts ON ts.id_trabajador = g.id_trabajador
       WHERE ts.id_usuario = $1`,
      [Number(payload.userId)]
    )

    if (!result.rows[0])
      return NextResponse.json({ message: "No eres un groomer registrado" }, { status: 404 })

    return NextResponse.json(result.rows[0])
  } catch (error) {
    console.error("[GET /api/groomers/me]", error)
    return NextResponse.json({ message: "Error interno" }, { status: 500 })
  }
}