// app/api/admin/disponibilidad/[id]/route.ts
// DELETE /api/admin/disponibilidad/[id] — Eliminar disponibilidad de un groomer
import { NextRequest, NextResponse } from "next/server"
import { Pool } from "pg"
import { verifyAccessToken } from "@/lib/auth"

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
})

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const token =
    request.cookies.get("accessToken")?.value ??
    request.headers.get("authorization")?.replace("Bearer ", "")
  if (!token) return NextResponse.json({ message: "No autorizado" }, { status: 403 })

  const payload = await verifyAccessToken(token)
  if (!payload || !["admin", "recepcionista"].includes(payload.rol))
    return NextResponse.json({ message: "No autorizado" }, { status: 403 })

  const { id } = await context.params

  try {
    const result = await pool.query(
      "DELETE FROM disponibilidad_groomer WHERE id_disponibilidad = $1 RETURNING id_disponibilidad",
      [id]
    )
    if (!result.rows[0])
      return NextResponse.json({ message: "No encontrado" }, { status: 404 })

    return NextResponse.json({ message: "Disponibilidad eliminada" })
  } catch (error) {
    console.error("[DELETE /api/admin/disponibilidad/:id]", error)
    return NextResponse.json({ message: "Error interno" }, { status: 500 })
  }
}