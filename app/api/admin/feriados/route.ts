// app/api/admin/feriados/route.ts
// GET  /api/admin/feriados — Lista feriados
// POST /api/admin/feriados — Crear feriado

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

export async function GET(request: NextRequest) {
  const payload = await verificarAuth(request)
  if (!payload) return NextResponse.json({ message: "No autorizado" }, { status: 403 })

  try {
    const { searchParams } = new URL(request.url)
    const anio = searchParams.get("anio") || new Date().getFullYear()

    const result = await pool.query(
      `SELECT id_feriado, fecha, nombre, descripcion, es_recuperable
       FROM feriado
       WHERE EXTRACT(YEAR FROM fecha) = $1
       ORDER BY fecha`,
      [anio]
    )
    return NextResponse.json({ feriados: result.rows })
  } catch (error) {
    console.error("[GET /api/admin/feriados]", error)
    return NextResponse.json({ message: "Error interno" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const payload = await verificarAuth(request)
  if (!payload) return NextResponse.json({ message: "No autorizado" }, { status: 403 })

  try {
    const { fecha, nombre, descripcion, es_recuperable } = await request.json()

    if (!fecha || !nombre)
      return NextResponse.json({ message: "fecha y nombre son requeridos" }, { status: 400 })

    // Verificar que no exista ya ese feriado
    const existe = await pool.query("SELECT 1 FROM feriado WHERE fecha = $1", [fecha])
    if (existe.rows.length > 0)
      return NextResponse.json({ message: "Ya existe un feriado en esa fecha" }, { status: 409 })

    const result = await pool.query(
      `INSERT INTO feriado (fecha, nombre, descripcion, es_recuperable)
       VALUES ($1, $2, $3, $4)
       RETURNING id_feriado, fecha, nombre, descripcion, es_recuperable`,
      [fecha, nombre.trim(), descripcion?.trim() || null, es_recuperable ?? false]
    )

    return NextResponse.json(
      { message: "Feriado registrado", feriado: result.rows[0] },
      { status: 201 }
    )
  } catch (error) {
    console.error("[POST /api/admin/feriados]", error)
    return NextResponse.json({ message: "Error interno" }, { status: 500 })
  }
}