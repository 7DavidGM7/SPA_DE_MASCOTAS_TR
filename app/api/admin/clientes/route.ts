// app/api/admin/clientes/route.ts
// GET /api/admin/clientes?q=texto — Busca clientes por nombre, apellido o email
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
  if (!payload || !["admin", "recepcionista"].includes(payload.rol))
    return NextResponse.json({ message: "No autorizado" }, { status: 403 })

  try {
    const { searchParams } = new URL(request.url)
    const q = searchParams.get("q")?.trim()

    if (!q || q.length < 2)
      return NextResponse.json({ clientes: [] })

    const result = await pool.query(
      `SELECT u.id_usuario, u.nombre, u.apellido, u.email, u.telefono
       FROM usuario u
       JOIN cliente c ON c.id_usuario_cliente = u.id_usuario
       WHERE u.estado = 'activo'
         AND (
           LOWER(u.nombre)   ILIKE $1
           OR LOWER(u.apellido) ILIKE $1
           OR LOWER(u.email)    ILIKE $1
           OR u.ci              ILIKE $1
         )
       ORDER BY u.nombre, u.apellido
       LIMIT 10`,
      [`%${q.toLowerCase()}%`]
    )

    return NextResponse.json({ clientes: result.rows })
  } catch (error) {
    console.error("[GET /api/admin/clientes]", error)
    return NextResponse.json({ message: "Error interno" }, { status: 500 })
  }
}