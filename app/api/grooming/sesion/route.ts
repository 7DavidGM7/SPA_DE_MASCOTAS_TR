// app/api/grooming/sesion/route.ts
// POST /api/grooming/sesion — Crear sesión de grooming al iniciar servicio
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
  return await verifyAccessToken(token)
}

const TAREAS_DEFAULT = [
  "bano", "secado", "corte_pelo", "corte_unas",
  "limpieza_oidos", "glandulas_anales", "perfume"
]

// POST — Iniciar sesión de grooming
export async function POST(request: NextRequest) {
  const payload = await verificarAuth(request)
  if (!payload || !["groomer", "admin", "recepcionista"].includes(payload.rol))
    return NextResponse.json({ message: "No autorizado" }, { status: 403 })

  const client = await pool.connect()
  try {
    const { id_cita, id_trabajador_groomer } = await request.json()
    if (!id_cita || !id_trabajador_groomer)
      return NextResponse.json({ message: "id_cita e id_trabajador_groomer requeridos" }, { status: 400 })

    // Verificar que la cita existe y está confirmada
    const citaRes = await pool.query(
      "SELECT * FROM cita WHERE id_cita = $1", [id_cita]
    )
    if (!citaRes.rows[0])
      return NextResponse.json({ message: "Cita no encontrada" }, { status: 404 })

    const cita = citaRes.rows[0]

    // Verificar que no tenga ya una sesión activa
    if (cita.id_sesion_grmm) {
      const sesionExiste = await pool.query(
        "SELECT id_sesion_grmm FROM sesion_grooming WHERE id_sesion_grmm = $1", [cita.id_sesion_grmm]
      )
      if (sesionExiste.rows[0])
        return NextResponse.json({ message: "Esta cita ya tiene una sesión activa", id_sesion_grmm: cita.id_sesion_grmm })
    }

    await client.query("BEGIN")

    // Crear sesión de grooming
    const sesionRes = await client.query(
      `INSERT INTO sesion_grooming (id_trabajador_groomer, fecha, hora_inicio, estado)
       VALUES ($1, $2, $3, 'en_proceso')
       RETURNING id_sesion_grmm`,
      [id_trabajador_groomer, cita.fecha_programada, new Date().toTimeString().slice(0, 8)]
    )
    const id_sesion = sesionRes.rows[0].id_sesion_grmm

    // Vincular sesión con la cita
    await client.query(
      "UPDATE cita SET id_sesion_grmm = $1, estado_reserva = 'en_proceso' WHERE id_cita = $2",
      [id_sesion, id_cita]
    )

    // Crear checklist con tareas default
    for (const tarea of TAREAS_DEFAULT) {
      await client.query(
        "INSERT INTO checklist_grooming (id_sesion_grmm, tarea) VALUES ($1, $2) ON CONFLICT DO NOTHING",
        [id_sesion, tarea]
      )
    }

    await client.query("COMMIT")

    return NextResponse.json({
      message: "Sesión iniciada",
      id_sesion_grmm: id_sesion,
    }, { status: 201 })
  } catch (error) {
    await client.query("ROLLBACK")
    console.error("[POST /api/grooming/sesion]", error)
    return NextResponse.json({ message: "Error interno" }, { status: 500 })
  } finally {
    client.release()
  }
}