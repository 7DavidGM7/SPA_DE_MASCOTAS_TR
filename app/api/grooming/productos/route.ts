// app/api/grooming/productos/route.ts
// GET /api/grooming/productos — Lista productos con stock disponible
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
      `SELECT p.id_producto, p.nombre, p.categoria,
              ip.cantidad AS stock, ip.estado AS estado_stock,
              ip.stock_minimo, ip.id_inventario
       FROM producto p
       JOIN inventario_producto ip ON ip.id_producto = p.id_producto
       WHERE p.activo = TRUE
         AND ip.estado != 'agotado'
       ORDER BY p.categoria, p.nombre`
    )
    return NextResponse.json({ productos: result.rows })
  } catch (error) {
    console.error("[GET /api/grooming/productos]", error)
    return NextResponse.json({ message: "Error interno" }, { status: 500 })
  }
}