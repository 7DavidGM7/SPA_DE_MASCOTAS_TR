// app/api/notificaciones/route.ts
import { NextRequest, NextResponse } from "next/server"
import { verifyAccessToken } from "@/lib/auth"
import { Pool } from "pg"

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
})

async function getPayload(request: NextRequest) {
  const tokenCookie = request.cookies.get("accessToken")?.value
  const authHeader  = request.headers.get("authorization")
  const token = tokenCookie ?? (authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null)
  if (!token) return null
  return await verifyAccessToken(token)
}

// GET /api/notificaciones?solo_no_leidas=true&limite=20
// Devuelve las notificaciones del usuario logueado
export async function GET(request: NextRequest) {
  const payload = await getPayload(request)
  if (!payload) return NextResponse.json({ message: "No autorizado" }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const soloNoLeidas = searchParams.get("solo_no_leidas") === "true"
  const limite = Math.min(50, Number(searchParams.get("limite") || "20"))

  try {
    const conds = [`id_usuario = $1`]
    const vals: (number | boolean)[] = [Number(payload.userId)]
    let i = 2

    if (soloNoLeidas) { conds.push(`leida = $${i++}`); vals.push(false) }

    const res = await pool.query(
      `SELECT
         id_notificacion, tipo, titulo, mensaje, leida,
         canal, whatsapp_enviado, entidad, entidad_id, created_at
       FROM notificacion
       WHERE ${conds.join(" AND ")}
       ORDER BY created_at DESC
       LIMIT $${i}`,
      [...vals, limite]
    )

    const noLeidas = await pool.query(
      `SELECT COUNT(*) FROM notificacion WHERE id_usuario = $1 AND leida = FALSE`,
      [Number(payload.userId)]
    )

    return NextResponse.json({
      notificaciones: res.rows,
      no_leidas: Number(noLeidas.rows[0].count),
    })
  } catch (error) {
    console.error("[notificaciones GET]", error)
    return NextResponse.json({ message: "Error interno" }, { status: 500 })
  }
}

// PATCH /api/notificaciones — marcar como leídas
// Body: { ids: number[] } o { todas: true }
export async function PATCH(request: NextRequest) {
  const payload = await getPayload(request)
  if (!payload) return NextResponse.json({ message: "No autorizado" }, { status: 403 })

  try {
    const body = await request.json()
    const idUsuario = Number(payload.userId)

    if (body.todas) {
      await pool.query(
        `UPDATE notificacion SET leida = TRUE WHERE id_usuario = $1 AND leida = FALSE`,
        [idUsuario]
      )
      return NextResponse.json({ message: "Todas marcadas como leídas" })
    }

    if (body.ids && Array.isArray(body.ids) && body.ids.length > 0) {
      await pool.query(
        `UPDATE notificacion SET leida = TRUE
         WHERE id_notificacion = ANY($1::int[]) AND id_usuario = $2`,
        [body.ids, idUsuario]
      )
      return NextResponse.json({ message: "Notificaciones marcadas como leídas" })
    }

    return NextResponse.json({ message: "Nada que actualizar" })
  } catch (error) {
    console.error("[notificaciones PATCH]", error)
    return NextResponse.json({ message: "Error interno" }, { status: 500 })
  }
}