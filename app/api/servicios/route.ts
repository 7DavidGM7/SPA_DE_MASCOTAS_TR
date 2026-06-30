// app/api/servicios/route.ts
// GET /api/servicios — Lista todos los servicios activos con duración ajustada por tamaño de mascota
import { NextRequest, NextResponse } from "next/server"
import { Pool } from "pg"

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

// Multiplicadores de duración según tamaño de mascota (doc de requerimientos)
const AJUSTE_DURACION: Record<string, number> = {
  pequeño:  1.00,   // base
  mediano:  1.10,   // +10%
  grande:   1.15,   // +15%
  gigante:  1.30,   // +30%
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const tamanio = searchParams.get("tamanio")?.toLowerCase()   // opcional
    const soloActivos = searchParams.get("activos") !== "false"  // default true

    const result = await pool.query(
      `SELECT id_servicio, nombre, descripcion, duracion_base, precio, activo
       FROM servicio
       WHERE ($1::boolean = FALSE OR activo = TRUE)
       ORDER BY duracion_base`,
      [soloActivos]
    )

    const servicios = result.rows.map((s) => {
      const multiplicador = tamanio ? (AJUSTE_DURACION[tamanio] ?? 1.0) : null
      return {
        id_servicio:       s.id_servicio,
        nombre:            s.nombre,
        descripcion:       s.descripcion,
        duracion_min:      s.duracion_base,
        duracion_ajustada: multiplicador
          ? Math.ceil(s.duracion_base * multiplicador)
          : null,
        precio_base:       parseFloat(s.precio),
        activo:            s.activo,
      }
    })

    return NextResponse.json({ servicios }, { status: 200 })
  } catch (error) {
    console.error("[/api/servicios] Error:", error)
    return NextResponse.json({ message: "Error al obtener servicios" }, { status: 500 })
  }
}