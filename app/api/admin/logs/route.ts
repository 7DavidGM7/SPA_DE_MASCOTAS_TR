// app/api/admin/logs/route.ts
import { NextRequest, NextResponse } from "next/server"
import { verifyAccessToken } from "@/lib/auth"
import { Pool } from "pg"

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
})

async function verificarAdmin(request: NextRequest) {
  const tokenCookie = request.cookies.get("accessToken")?.value
  const authHeader = request.headers.get("authorization")
  const tokenHeader = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null
  const token = tokenCookie ?? tokenHeader
  if (!token) return null
  const payload = await verifyAccessToken(token)
  if (!payload || payload.rol !== "admin") return null
  return payload
}

// GET /api/admin/logs?accion=CREAR_USUARIO&fecha=2026-05-01&pagina=1
export async function GET(request: NextRequest) {
  const admin = await verificarAdmin(request)
  if (!admin) return NextResponse.json({ message: "No autorizado" }, { status: 403 })

  try {
    const { searchParams } = new URL(request.url)
    const accion  = searchParams.get("accion")   // filtro opcional
    const fecha   = searchParams.get("fecha")    // filtro opcional YYYY-MM-DD
    const buscar  = searchParams.get("buscar")   // buscar en detalle
    const pagina  = Math.max(1, Number(searchParams.get("pagina") || "1"))
    const limite  = 20
    const offset  = (pagina - 1) * limite

    const condiciones: string[] = []
    const valores: (string | number)[] = []
    let i = 1

    if (accion) {
      condiciones.push(`l.accion = $${i++}`)
      valores.push(accion)
    }
    if (fecha) {
      condiciones.push(`DATE(l.created_at) = $${i++}`)
      valores.push(fecha)
    }
    if (buscar) {
      condiciones.push(`l.detalle ILIKE $${i++}`)
      valores.push(`%${buscar}%`)
    }

    const where = condiciones.length > 0 ? `WHERE ${condiciones.join(" AND ")}` : ""

    const [logsRes, totalRes] = await Promise.all([
      pool.query(
        `SELECT
          l.id_log,
          l.accion,
          l.entidad,
          l.entidad_id,
          l.detalle,
          l.ip,
          l.created_at,
          u.nombre || ' ' || u.apellido AS admin_nombre,
          u.email AS admin_email
         FROM logs l
         LEFT JOIN usuario u ON u.id_usuario = l.id_usuario
         ${where}
         ORDER BY l.created_at DESC
         LIMIT $${i} OFFSET $${i + 1}`,
        [...valores, limite, offset]
      ),
      pool.query(
        `SELECT COUNT(*) FROM logs l ${where}`,
        valores
      ),
    ])

    return NextResponse.json({
      logs: logsRes.rows,
      total: Number(totalRes.rows[0].count),
      pagina,
      totalPaginas: Math.ceil(Number(totalRes.rows[0].count) / limite),
    })
  } catch (error) {
    console.error("[admin/logs GET]", error)
    return NextResponse.json({ message: "Error interno" }, { status: 500 })
  }
}