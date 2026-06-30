// app/api/citas/[id]/route.ts
import { NextRequest, NextResponse } from "next/server"
import { Pool } from "pg"
import { verifyAccessToken } from "@/lib/auth"
import { registrarLog, getIP } from "@/lib/logger"
import { notifCitaConfirmada, notifCitaCancelada } from "@/lib/notificaciones"

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

// ── GET /api/citas/[id] ────────────────────────────────────────────────────
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const payload = await verificarAuth(request)
  if (!payload) return NextResponse.json({ message: "No autorizado" }, { status: 401 })

  const { id } = await context.params

  try {
    const result = await pool.query(`
      SELECT
        c.*,
        u.nombre AS cliente_nombre, u.apellido AS cliente_apellido,
        u.telefono AS cliente_telefono, u.email AS cliente_email,
        s.nombre AS servicio_nombre, s.duracion_base, s.precio,
        m.nombre AS mascota_nombre, m.especie, m.raza, m.tamanio, m.temperamento,
        g_u.nombre AS groomer_nombre, g_u.apellido AS groomer_apellido
      FROM cita c
      JOIN usuario u ON u.id_usuario = c.id_usuario_cliente
      LEFT JOIN servicio s ON s.id_servicio = c.id_servicio
      LEFT JOIN mascota m ON m.id_mascota = c.id_mascota
      LEFT JOIN asigna a ON a.id_cita = c.id_cita
      LEFT JOIN groomer g ON g.id_trabajador = a.id_trabajador_groomer
      LEFT JOIN trabajador_spa ts ON ts.id_trabajador = g.id_trabajador
      LEFT JOIN usuario g_u ON g_u.id_usuario = ts.id_usuario
      WHERE c.id_cita = $1
    `, [id])

    if (result.rows.length === 0)
      return NextResponse.json({ message: "Cita no encontrada" }, { status: 404 })

    const cita = result.rows[0]
    if (payload.rol === "cliente" && String(cita.id_usuario_cliente) !== payload.userId)
      return NextResponse.json({ message: "No autorizado" }, { status: 403 })

    return NextResponse.json({ cita })
  } catch (error) {
    console.error("[GET /api/citas/:id]", error)
    return NextResponse.json({ message: "Error interno" }, { status: 500 })
  }
}

// ── PATCH /api/citas/[id] ─────────────────────────────────────────────────
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const payload = await verificarAuth(request)
  if (!payload) return NextResponse.json({ message: "No autorizado" }, { status: 401 })

  const { id } = await context.params

  try {
    const body = await request.json()
    const { estado_reserva, notas, motivo_cancelacion, id_groomer } = body

    if (!estado_reserva)
      return NextResponse.json({ message: "estado_reserva es requerido" }, { status: 400 })

    const estadosValidos = ["pendiente","confirmada","completada","cancelada","no_asistio","reprogramada","en_proceso"]
    if (!estadosValidos.includes(estado_reserva))
      return NextResponse.json({ message: "Estado inválido" }, { status: 400 })

    // Obtener cita con datos del cliente y mascota para notificaciones
    const citaRes = await pool.query(
      `SELECT c.*,
              u.nombre AS cliente_nombre, u.telefono AS cliente_telefono,
              m.nombre AS mascota_nombre,
              s.nombre AS servicio_nombre
       FROM cita c
       JOIN usuario u ON u.id_usuario = c.id_usuario_cliente
       LEFT JOIN mascota m ON m.id_mascota = c.id_mascota
       LEFT JOIN servicio s ON s.id_servicio = c.id_servicio
       WHERE c.id_cita = $1`,
      [id]
    )
    if (citaRes.rows.length === 0)
      return NextResponse.json({ message: "Cita no encontrada" }, { status: 404 })

    const cita = citaRes.rows[0]

    // Validaciones por rol
    if (payload.rol === "cliente") {
      if (String(cita.id_usuario_cliente) !== payload.userId)
        return NextResponse.json({ message: "No puedes modificar citas de otro cliente" }, { status: 403 })
      if (estado_reserva !== "cancelada")
        return NextResponse.json({ message: "Los clientes solo pueden cancelar citas" }, { status: 403 })
      if (!["pendiente", "confirmada"].includes(cita.estado_reserva))
        return NextResponse.json({ message: "Esta cita no se puede cancelar" }, { status: 409 })
      const fechaCita = new Date(`${cita.fecha_programada}T${cita.hora_programada}`)
      if ((fechaCita.getTime() - Date.now()) / (1000 * 60 * 60) < 24)
        return NextResponse.json({ message: "Solo puedes cancelar con al menos 24 horas de anticipación" }, { status: 409 })
    }

    if (payload.rol === "groomer") {
      if (!["completada", "en_proceso"].includes(estado_reserva))
        return NextResponse.json({ message: "El groomer solo puede marcar en proceso o completada" }, { status: 403 })
    }

    const notasUpdate = motivo_cancelacion
      ? `${cita.notas ?? ""}\nCancelación: ${motivo_cancelacion}`.trim()
      : notas ?? cita.notas

    const { nueva_fecha, nueva_hora } = body

    if (estado_reserva === "reprogramada" && nueva_fecha && nueva_hora) {
      const [nhh, nmm] = nueva_hora.split(":").map(Number)
      const nuevoInicioMin = nhh * 60 + nmm

      const solapamiento = await pool.query(
        `SELECT c.id_cita FROM cita c
         LEFT JOIN servicio s ON c.id_servicio = s.id_servicio
         WHERE c.fecha_programada = $1
           AND c.id_cita != $2
           AND c.estado_reserva NOT IN ('cancelada','no_asistio')
           AND (EXTRACT(HOUR FROM c.hora_programada)*60+EXTRACT(MINUTE FROM c.hora_programada))
               < ($3 + COALESCE(s.duracion_base,60))
           AND (EXTRACT(HOUR FROM c.hora_programada)*60+EXTRACT(MINUTE FROM c.hora_programada)
               + COALESCE(s.duracion_base,60)) > $3`,
        [nueva_fecha, id, nuevoInicioMin]
      )
      if (solapamiento.rows.length > 0)
        return NextResponse.json({ message: "El nuevo horario se solapa con otra cita." }, { status: 409 })

      await pool.query(
        `UPDATE cita SET estado_reserva=$1, notas=$2, fecha_programada=$3, hora_programada=$4 WHERE id_cita=$5`,
        [estado_reserva, notasUpdate, nueva_fecha, nueva_hora, id]
      )
      await pool.query("UPDATE asigna SET fecha=$1 WHERE id_cita=$2", [nueva_fecha, id])
    } else {
      await pool.query(
        "UPDATE cita SET estado_reserva=$1, notas=$2 WHERE id_cita=$3",
        [estado_reserva, notasUpdate, id]
      )
    }

    // Asignar groomer al confirmar
    if (estado_reserva === "confirmada" && id_groomer) {
      const [hh, mm] = String(cita.hora_programada).slice(0, 5).split(":").map(Number)
      const inicioMin = hh * 60 + mm

      const groomerOcupado = await pool.query(
        `SELECT c.id_cita FROM cita c
         JOIN asigna a ON a.id_cita = c.id_cita
         JOIN servicio s ON s.id_servicio = c.id_servicio
         WHERE a.id_trabajador_groomer = $1
           AND c.fecha_programada = $2
           AND c.id_cita != $3
           AND c.estado_reserva NOT IN ('cancelada','no_asistio')
           AND (EXTRACT(HOUR FROM c.hora_programada)*60+EXTRACT(MINUTE FROM c.hora_programada))
               < ($4 + COALESCE(s.duracion_base,60))
           AND (EXTRACT(HOUR FROM c.hora_programada)*60+EXTRACT(MINUTE FROM c.hora_programada)
               + COALESCE(s.duracion_base,60)) > $4`,
        [id_groomer, cita.fecha_programada, id, inicioMin]
      )
      if (groomerOcupado.rows.length > 0)
        return NextResponse.json({ message: "El groomer ya tiene una cita en ese horario." }, { status: 409 })

      const recepRes = await pool.query(
        `SELECT ts.id_trabajador FROM trabajador_spa ts
         JOIN recepcionista r ON r.id_trabajador = ts.id_trabajador
         WHERE ts.id_usuario = $1`,
        [Number(payload.userId)]
      )
      const idTrabajadorRecep = recepRes.rows[0]?.id_trabajador ?? null

      const asignaExiste = await pool.query("SELECT id_asigna FROM asigna WHERE id_cita=$1", [id])
      if (asignaExiste.rows.length === 0) {
        if (idTrabajadorRecep) {
          await pool.query(
            `INSERT INTO asigna (id_trabajador_groomer,id_trabajador_recepcionista,id_cita,fecha)
             VALUES ($1,$2,$3,$4)`,
            [id_groomer, idTrabajadorRecep, id, cita.fecha_programada]
          )
        } else {
          await pool.query(
            `INSERT INTO asigna (id_trabajador_groomer,id_trabajador_recepcionista,id_cita,fecha)
             VALUES ($1,(SELECT id_trabajador FROM recepcionista LIMIT 1),$2,$3)`,
            [id_groomer, id, cita.fecha_programada]
          )
        }
      } else {
        await pool.query("UPDATE asigna SET id_trabajador_groomer=$1 WHERE id_cita=$2", [id_groomer, id])
      }
    }

    // Log detalle_cita
    try {
      await pool.query(
        `INSERT INTO detalle_cita (id_cita,descripcion,id_usuario_modifico) VALUES ($1,$2,$3)`,
        [id, `Estado: ${cita.estado_reserva} → ${estado_reserva}${motivo_cancelacion ? ` | Motivo: ${motivo_cancelacion}` : ""}`, Number(payload.userId)]
      )
    } catch (e: any) { console.warn("[detalle_cita]", e.message) }

    await registrarLog({
      id_usuario: Number(payload.userId),
      accion: `CITA_${estado_reserva.toUpperCase()}`,
      entidad: "cita", entidad_id: Number(id),
      detalle: `Cita #${id} → ${estado_reserva}`,
      ip: getIP(request),
    })

    // ── NOTIFICACIONES según el nuevo estado ──────────────────────────────
    // Solo si el cliente tiene teléfono registrado
    try {
      const telefono = cita.cliente_telefono

      if (estado_reserva === "confirmada" && telefono) {
        const fechaObj = new Date(`${cita.fecha_programada}T${cita.hora_programada}`)
        await notifCitaConfirmada({
          id_usuario:     cita.id_usuario_cliente,
          nombre_cliente: cita.cliente_nombre,
          telefono,
          nombre_mascota: cita.mascota_nombre ?? "tu mascota",
          fecha: fechaObj.toLocaleDateString("es-BO", { weekday:"long", day:"numeric", month:"long" }),
          hora:  String(cita.hora_programada).slice(0, 5),
          servicio: cita.servicio_nombre ?? "Grooming",
          id_cita: Number(id),
        })
      }

      if (estado_reserva === "cancelada" && telefono) {
        const fechaObj = new Date(cita.fecha_programada)
        await notifCitaCancelada({
          id_usuario:     cita.id_usuario_cliente,
          nombre_cliente: cita.cliente_nombre,
          telefono,
          nombre_mascota: cita.mascota_nombre ?? "tu mascota",
          fecha: fechaObj.toLocaleDateString("es-BO", { weekday:"long", day:"numeric", month:"long" }),
          id_cita: Number(id),
        })
      }
    } catch (notifErr) {
      // Nunca romper el flujo principal por error de notificación
      console.error("[PATCH /api/citas/:id] Error al enviar notificación:", notifErr)
    }

    return NextResponse.json({
      message: `Cita actualizada a "${estado_reserva}" correctamente`,
      id_cita: Number(id),
      nuevo_estado: estado_reserva,
    })
  } catch (error) {
    console.error("[PATCH /api/citas/:id]", error)
    return NextResponse.json({ message: "Error interno" }, { status: 500 })
  }
}