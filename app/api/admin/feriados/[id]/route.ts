// app/api/admin/feriados/[id]/route.ts
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

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const payload = await verificarAuth(request)
  if (!payload) return NextResponse.json({ message: "No autorizado" }, { status: 403 })

  const { id } = await context.params

  try {
    const result = await pool.query(
      "DELETE FROM feriado WHERE id_feriado = $1 RETURNING id_feriado",
      [id]
    )
    if (result.rows.length === 0)
      return NextResponse.json({ message: "Feriado no encontrado" }, { status: 404 })

    return NextResponse.json({ message: "Feriado eliminado" })
  } catch (error) {
    console.error("[DELETE /api/admin/feriados/:id]", error)
    return NextResponse.json({ message: "Error interno" }, { status: 500 })
  }
}