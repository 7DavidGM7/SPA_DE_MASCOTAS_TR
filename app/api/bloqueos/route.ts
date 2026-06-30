// app/api/bloqueos/route.ts
import { NextRequest, NextResponse } from "next/server"
import { Pool } from "pg"
import { verifyAccessToken } from "@/lib/auth"
import { registrarLog, getIP } from "@/lib/logger"

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

// GET /api/bloqueos — listar disponibilidad de groomers y feriados
export async function GET(request: NextRequest) {
  const payload = await verificarAuth(request)
  if (!payload) {
    return NextResponse.json({ message: "No autorizado" }, { status: 401 })
  }
  if (!["admin", "recepcionista"].includes(payload.rol)) {
    return NextResponse.json({ message: "Solo recepción o admin pueden ver bloqueos" }, { status: 403 })
  }

  try {
    // Disponibilidad de todos los groomers
    const disponibilidadRes = await pool.query(`
      SELECT
        dg.id_disponibilidad, dg.id_trabajador, dg.dia_semana,
        dg.hora_inicio, dg.hora_fin, dg.activo,
        u.nombre, u.apellido, g.especialidad
      FROM disponibilidad_groomer dg
      JOIN groomer g ON g.id_trabajador = dg.id_trabajador
      JOIN trabajador_spa ts ON ts.id_trabajador = g.id_trabajador
      JOIN usuario u ON u.id_usuario = ts.id_usuario
      ORDER BY u.nombre, dg.dia_semana
    `)

    // Feriados próximos (próximos 3 meses)
    const feriadosRes = await pool.query(`
      SELECT * FROM feriado
      WHERE fecha >= CURRENT_DATE
        AND fecha <= CURRENT_DATE + INTERVAL '3 months'
      ORDER BY fecha
    `)

    return NextResponse.json({
      disponibilidad_groomers: disponibilidadRes.rows,
      feriados: feriadosRes.rows,
    }, { status: 200 })

  } catch (error) {
    console.error("[bloqueos GET]", error)
    return NextResponse.json({ message: "Error interno" }, { status: 500 })
  }
}

// POST /api/bloqueos — registrar disponibilidad de groomer o bloqueo de fecha
export async function POST(request: NextRequest) {
  const payload = await verificarAuth(request)
  if (!payload) {
    return NextResponse.json({ message: "No autorizado" }, { status: 401 })
  }
  if (!["admin", "recepcionista"].includes(payload.rol)) {
    return NextResponse.json({ message: "Solo recepción o admin pueden registrar bloqueos" }, { status: 403 })
  }

  try {
    const body = await request.json()
    const { tipo } = body

    // ── Tipo 1: disponibilidad de groomer ────────────────────────────────────
    if (tipo === "disponibilidad_groomer") {
      const { id_trabajador, dia_semana, hora_inicio, hora_fin, activo } = body

      if (!id_trabajador || !dia_semana || !hora_inicio || !hora_fin) {
        return NextResponse.json(
          { message: "id_trabajador, dia_semana, hora_inicio y hora_fin son requeridos" },
          { status: 400 }
        )
      }

      // Verificar que el groomer existe
      const groomerRes = await pool.query(
        "SELECT id_trabajador FROM groomer WHERE id_trabajador = $1",
        [id_trabajador]
      )
      if (groomerRes.rows.length === 0) {
        return NextResponse.json({ message: "Groomer no encontrado" }, { status: 404 })
      }

      const res = await pool.query(`
        INSERT INTO disponibilidad_groomer
          (id_trabajador, dia_semana, hora_inicio, hora_fin, activo)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (id_trabajador, dia_semana)
        DO UPDATE SET hora_inicio = $3, hora_fin = $4, activo = $5
        RETURNING *
      `, [id_trabajador, dia_semana, hora_inicio, hora_fin, activo ?? true])

      await registrarLog({
        id_usuario: Number(payload.userId),
        accion: "BLOQUEO_DISPONIBILIDAD",
        entidad: "disponibilidad_groomer",
        entidad_id: res.rows[0].id_disponibilidad,
        detalle: `Disponibilidad groomer #${id_trabajador} día ${dia_semana}: ${hora_inicio}-${hora_fin}`,
        ip: getIP(request),
      })

      return NextResponse.json({
        message: "Disponibilidad del groomer actualizada",
        disponibilidad: res.rows[0],
      }, { status: 201 })
    }

    // ── Tipo 2: feriado / bloqueo de día completo ────────────────────────────
    if (tipo === "feriado") {
      const { fecha, nombre, descripcion, es_recuperable } = body

      if (!fecha || !nombre) {
        return NextResponse.json({ message: "Fecha y nombre son requeridos" }, { status: 400 })
      }

      // Verificar que no hay citas ese día
      const citasRes = await pool.query(`
        SELECT COUNT(*) AS total FROM cita
        WHERE fecha_programada = $1
          AND estado_reserva IN ('pendiente', 'confirmada')
      `, [fecha])

      const totalCitas = parseInt(citasRes.rows[0].total)
      if (totalCitas > 0) {
        return NextResponse.json({
          message: `Hay ${totalCitas} cita(s) activas ese día. Cancélalas primero antes de bloquear la fecha.`,
          citas_activas: totalCitas,
        }, { status: 409 })
      }

      const res = await pool.query(`
        INSERT INTO feriado (fecha, nombre, descripcion, es_recuperable)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (fecha) DO UPDATE
          SET nombre = $2, descripcion = $3, es_recuperable = $4
        RETURNING *
      `, [fecha, nombre, descripcion ?? null, es_recuperable ?? false])

      await registrarLog({
        id_usuario: Number(payload.userId),
        accion: "BLOQUEO_FERIADO",
        entidad: "feriado",
        entidad_id: res.rows[0].id_feriado,
        detalle: `Feriado/bloqueo registrado: ${nombre} el ${fecha}`,
        ip: getIP(request),
      })

      return NextResponse.json({
        message: "Bloqueo de fecha registrado correctamente",
        feriado: res.rows[0],
      }, { status: 201 })
    }

    return NextResponse.json(
      { message: "Tipo inválido. Usa 'disponibilidad_groomer' o 'feriado'" },
      { status: 400 }
    )

  } catch (error) {
    console.error("[bloqueos POST]", error)
    return NextResponse.json({ message: "Error interno" }, { status: 500 })
  }
}

// DELETE /api/bloqueos?tipo=feriado&id=5 — eliminar un bloqueo
export async function DELETE(request: NextRequest) {
  const payload = await verificarAuth(request)
  if (!payload || !["admin", "recepcionista"].includes(payload.rol)) {
    return NextResponse.json({ message: "No autorizado" }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const tipo = searchParams.get("tipo")
    const id = searchParams.get("id")

    if (!tipo || !id) {
      return NextResponse.json({ message: "tipo e id son requeridos" }, { status: 400 })
    }

    if (tipo === "feriado") {
      await pool.query("DELETE FROM feriado WHERE id_feriado = $1", [id])
      return NextResponse.json({ message: "Feriado eliminado" }, { status: 200 })
    }

    if (tipo === "disponibilidad_groomer") {
      await pool.query(
        "UPDATE disponibilidad_groomer SET activo = false WHERE id_disponibilidad = $1",
        [id]
      )
      return NextResponse.json({ message: "Disponibilidad desactivada" }, { status: 200 })
    }

    return NextResponse.json({ message: "Tipo inválido" }, { status: 400 })
  } catch (error) {
    console.error("[bloqueos DELETE]", error)
    return NextResponse.json({ message: "Error interno" }, { status: 500 })
  }
}