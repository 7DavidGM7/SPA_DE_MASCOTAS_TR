// app/api/notificaciones/recordatorios/route.ts
// Este endpoint lo llamas con un cron job (o manualmente para probar)
// GET /api/notificaciones/recordatorios?secret=TU_CRON_SECRET
import { NextRequest, NextResponse } from "next/server"
import { Pool } from "pg"
import { notifRecordatorio24h, notifRecordatorio2h } from "@/lib/notificaciones"

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
})

export async function GET(request: NextRequest) {
  // Proteger con secret para que no lo llame cualquiera
  const { searchParams } = new URL(request.url)
  const secret = searchParams.get("secret")
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ message: "No autorizado" }, { status: 403 })
  }

  try {
    const ahora   = new Date()
    const en24h   = new Date(ahora.getTime() + 24 * 60 * 60 * 1000)
    const en2h    = new Date(ahora.getTime() +  2 * 60 * 60 * 1000)
    const ventana = 15 * 60 * 1000 // ventana de 15 minutos para no duplicar

    // Citas que ocurren en ~24 horas y no tienen recordatorio enviado
    const citas24h = await pool.query(
      `SELECT
         c.id_cita, c.fecha_programada, c.hora_programada,
         u.id_usuario, u.nombre AS nombre_cliente, u.telefono,
         m.nombre AS nombre_mascota
       FROM cita c
       JOIN cliente cl ON cl.id_usuario_cliente = c.id_usuario_cliente
       JOIN usuario u  ON u.id_usuario = cl.id_usuario_cliente
       JOIN mascota m  ON m.id_mascota = c.id_mascota
       WHERE c.estado_reserva = 'confirmada'
         AND (c.fecha_programada + c.hora_programada::interval) BETWEEN $1 AND $2
         AND NOT EXISTS (
           SELECT 1 FROM notificacion n
           WHERE n.entidad = 'cita' AND n.entidad_id = c.id_cita
             AND n.tipo = 'recordatorio_24h'
         )`,
      [en24h, new Date(en24h.getTime() + ventana)]
    )

    // Citas que ocurren en ~2 horas
    const citas2h = await pool.query(
      `SELECT
         c.id_cita, c.fecha_programada, c.hora_programada,
         u.id_usuario, u.nombre AS nombre_cliente, u.telefono,
         m.nombre AS nombre_mascota
       FROM cita c
       JOIN cliente cl ON cl.id_usuario_cliente = c.id_usuario_cliente
       JOIN usuario u  ON u.id_usuario = cl.id_usuario_cliente
       JOIN mascota m  ON m.id_mascota = c.id_mascota
       WHERE c.estado_reserva = 'confirmada'
         AND (c.fecha_programada + c.hora_programada::interval) BETWEEN $1 AND $2
         AND NOT EXISTS (
           SELECT 1 FROM notificacion n
           WHERE n.entidad = 'cita' AND n.entidad_id = c.id_cita
             AND n.tipo = 'recordatorio_2h'
         )`,
      [en2h, new Date(en2h.getTime() + ventana)]
    )

    const enviados = { recordatorio_24h: 0, recordatorio_2h: 0 }

    for (const c of citas24h.rows) {
      if (!c.telefono) continue
      await notifRecordatorio24h({
        id_usuario:     c.id_usuario,
        nombre_cliente: c.nombre_cliente,
        telefono:       c.telefono,
        nombre_mascota: c.nombre_mascota,
        fecha: new Date(c.fecha_programada).toLocaleDateString("es-BO", { weekday: "long", day: "numeric", month: "long" }),
        hora:  c.hora_programada.slice(0, 5),
        id_cita: c.id_cita,
      })
      enviados.recordatorio_24h++
    }

    for (const c of citas2h.rows) {
      if (!c.telefono) continue
      await notifRecordatorio2h({
        id_usuario:     c.id_usuario,
        nombre_cliente: c.nombre_cliente,
        telefono:       c.telefono,
        nombre_mascota: c.nombre_mascota,
        hora:  c.hora_programada.slice(0, 5),
        id_cita: c.id_cita,
      })
      enviados.recordatorio_2h++
    }

    return NextResponse.json({
      message: "Recordatorios procesados",
      enviados,
      timestamp: ahora.toISOString(),
    })
  } catch (error) {
    console.error("[recordatorios]", error)
    return NextResponse.json({ message: "Error interno" }, { status: 500 })
  }
}