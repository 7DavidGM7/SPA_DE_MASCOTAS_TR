// app/api/citas/route.ts
import { NextRequest, NextResponse } from "next/server"
import { Pool } from "pg"
import { verifyAccessToken } from "@/lib/auth"
import { notifCitaSolicitada } from "@/lib/notificaciones"

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

const AJUSTE_DURACION: Record<string, number> = {
  pequenio: 1.00, mediano: 1.10, grande: 1.15, gigante: 1.30,
}

async function verificarToken(request: NextRequest) {
  const tokenCookie = request.cookies.get("accessToken")?.value
  const authHeader = request.headers.get("authorization")
  const tokenHeader = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null
  const token = tokenCookie ?? tokenHeader
  if (!token) return null
  return await verifyAccessToken(token)
}

// ── GET /api/citas ──────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const payload = await verificarToken(request)
    if (!payload) return NextResponse.json({ message: "No autenticado" }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const fecha     = searchParams.get("fecha")
    const estado    = searchParams.get("estado")
    const idGroomer = searchParams.get("id_groomer")
    const idCliente = searchParams.get("id_cliente")
    const esCliente = payload.rol === "cliente"

    const result = await pool.query(
      `SELECT
         c.id_cita, c.fecha_programada, c.hora_programada,
         c.estado_reserva, c.canal_reserva, c.notas, c.fecha_creacion,
         u_cli.nombre || ' ' || u_cli.apellido AS nombre_cliente,
         u_cli.telefono AS telefono_cliente,
         c.id_servicio,
         s.nombre AS nombre_servicio,
         s.duracion_base AS duracion_ajustada,
         s.precio AS precio_calculado,
         c.id_mascota,
         m.nombre AS nombre_mascota, m.especie, m.tamanio,
         u_grm.nombre || ' ' || u_grm.apellido AS nombre_groomer,
         a.id_trabajador_groomer
       FROM cita c
       JOIN usuario u_cli ON c.id_usuario_cliente = u_cli.id_usuario
       LEFT JOIN servicio s ON c.id_servicio = s.id_servicio
       LEFT JOIN mascota m ON c.id_mascota = m.id_mascota
       LEFT JOIN asigna a ON c.id_cita = a.id_cita
       LEFT JOIN groomer g ON a.id_trabajador_groomer = g.id_trabajador
       LEFT JOIN trabajador_spa ts ON g.id_trabajador = ts.id_trabajador
       LEFT JOIN usuario u_grm ON ts.id_usuario = u_grm.id_usuario
       WHERE
         ($1::date IS NULL OR c.fecha_programada = $1)
         AND ($2::text IS NULL OR c.estado_reserva = $2)
         AND ($3::int IS NULL OR a.id_trabajador_groomer = $3)
         AND ($4::int IS NULL OR c.id_usuario_cliente = $4)
         AND ($5::boolean = FALSE OR c.id_usuario_cliente = $6)
       ORDER BY c.fecha_programada, c.hora_programada`,
      [
        fecha || null,
        estado || null,
        idGroomer ? Number(idGroomer) : null,
        idCliente ? Number(idCliente) : null,
        esCliente,
        esCliente ? Number(payload.userId) : null,
      ]
    )

    return NextResponse.json({ citas: result.rows })
  } catch (error) {
    console.error("[GET /api/citas]", error)
    return NextResponse.json({ message: "Error al obtener citas" }, { status: 500 })
  }
}

// ── POST /api/citas ─────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const payload = await verificarToken(request)
    if (!payload) return NextResponse.json({ message: "No autenticado" }, { status: 401 })

    const body = await request.json()
    const { id_mascota, id_servicio, fecha_programada, hora_programada, notas, canal_reserva, id_cliente } = body

    if (!id_mascota || !id_servicio || !fecha_programada || !hora_programada) {
      return NextResponse.json(
        { message: "Campos requeridos: id_mascota, id_servicio, fecha_programada, hora_programada" },
        { status: 400 }
      )
    }

    const esCliente = payload.rol === "cliente"
    let idUsuarioCliente: number

    if (esCliente) {
      idUsuarioCliente = Number(payload.userId)
    } else {
      if (!id_cliente) return NextResponse.json({ message: "Recepción debe enviar id_cliente" }, { status: 400 })
      idUsuarioCliente = Number(id_cliente)
    }

    if (esCliente) {
      const mascotaRes = await pool.query(
        `SELECT id_mascota FROM mascota WHERE id_mascota = $1 AND id_usuario_cliente = $2`,
        [id_mascota, idUsuarioCliente]
      )
      if (!mascotaRes.rows[0])
        return NextResponse.json({ message: "La mascota no pertenece a tu cuenta" }, { status: 403 })
    }

    const datosRes = await pool.query(
      `SELECT s.duracion_base, s.precio, s.nombre AS nombre_servicio,
              m.tamanio, m.temperamento, m.nombre AS nombre_mascota
       FROM servicio s, mascota m
       WHERE s.id_servicio = $1 AND m.id_mascota = $2`,
      [id_servicio, id_mascota]
    )
    if (!datosRes.rows[0])
      return NextResponse.json({ message: "Servicio o mascota no encontrado" }, { status: 404 })

    const { duracion_base, precio, nombre_servicio, tamanio, temperamento, nombre_mascota } = datosRes.rows[0]
    const multiplicador = AJUSTE_DURACION[tamanio?.toLowerCase()] ?? 1.0
    let duracionAjustada = Math.ceil(duracion_base * multiplicador)
    if (["nervioso", "agresivo", "inquieto"].includes(temperamento?.toLowerCase() ?? ""))
      duracionAjustada += 15

    const [hh, mm] = hora_programada.split(":").map(Number)
    const inicioMin = hh * 60 + mm
    const finMin    = inicioMin + duracionAjustada
    const horaFin   = `${String(Math.floor(finMin / 60)).padStart(2, "0")}:${String(finMin % 60).padStart(2, "0")}`

    const capacidadRes = await pool.query(
      `SELECT hs.capacidad_max, COUNT(c.id_cita) AS citas_en_slot
       FROM horario_spa hs
       CROSS JOIN LATERAL (
         SELECT c.id_cita FROM cita c
         LEFT JOIN servicio sv ON c.id_servicio = sv.id_servicio
         WHERE c.fecha_programada = $1
           AND c.estado_reserva NOT IN ('cancelada', 'no_asistio')
           AND c.hora_programada < $3::time
           AND (c.hora_programada + (COALESCE(sv.duracion_base, 60) || ' minutes')::interval) > $2::time
       ) c
       WHERE hs.dia_semana = CASE EXTRACT(DOW FROM $1::date)::int WHEN 0 THEN 7
         ELSE EXTRACT(DOW FROM $1::date)::int END
       GROUP BY hs.capacidad_max`,
      [fecha_programada, hora_programada, horaFin]
    )
    const cap = capacidadRes.rows[0]
    if (cap && parseInt(cap.citas_en_slot) >= parseInt(cap.capacidad_max))
      return NextResponse.json({ message: "No hay capacidad disponible en ese horario" }, { status: 409 })

    const feriadoCheck = await pool.query(`SELECT 1 FROM feriado WHERE fecha = $1`, [fecha_programada])
    if (feriadoCheck.rows.length > 0)
      return NextResponse.json({ message: "No se puede agendar: día feriado" }, { status: 409 })

    try {
      const bloqueoCheck = await pool.query(
        `SELECT 1 FROM bloqueo WHERE fecha = $1 AND id_trabajador_groomer IS NULL
         AND (hora_inicio IS NULL OR (hora_inicio < $3::time AND hora_fin > $2::time))`,
        [fecha_programada, hora_programada, horaFin]
      )
      if (bloqueoCheck.rows.length > 0)
        return NextResponse.json({ message: "No se puede agendar: horario bloqueado" }, { status: 409 })
    } catch (e: any) { if (e.code !== "42P01") throw e }

    const client = await pool.connect()
    try {
      await client.query("BEGIN")

      await client.query(
        `INSERT INTO cliente (id_usuario_cliente, acepta_notificaciones)
         VALUES ($1, true) ON CONFLICT (id_usuario_cliente) DO NOTHING`,
        [idUsuarioCliente]
      )

      const estadoInicial = esCliente ? "pendiente" : "confirmada"
      const canalFinal    = canal_reserva || (esCliente ? "web" : "presencial")

      const citaRes = await client.query(
        `INSERT INTO cita (id_usuario_cliente, id_servicio, id_mascota, fecha_programada,
           hora_programada, canal_reserva, estado_reserva, notas)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id_cita`,
        [idUsuarioCliente, id_servicio, id_mascota, fecha_programada,
         hora_programada, canalFinal, estadoInicial, notas || null]
      )
      const id_cita = citaRes.rows[0].id_cita

      await client.query(
        `INSERT INTO logs (id_usuario, accion, entidad, entidad_id, detalle, ip)
         VALUES ($1,'CREAR_CITA','cita',$2,$3,$4)`,
        [Number(payload.userId), id_cita,
         `Cita creada: ${fecha_programada} ${hora_programada} — servicio ${id_servicio}`,
         request.headers.get("x-forwarded-for") || "unknown"]
      )

      await client.query("COMMIT")

      // ── NOTIFICACIÓN: cita solicitada o confirmada ────────────────────────
      // Obtener datos del cliente para la notificación (fuera de la transacción)
      try {
        const clienteRes = await pool.query(
          `SELECT u.nombre, u.telefono FROM usuario u WHERE u.id_usuario = $1`,
          [idUsuarioCliente]
        )
        const clienteData = clienteRes.rows[0]

        if (clienteData?.telefono) {
          // Formatear fecha legible
          const fechaObj = new Date(`${fecha_programada}T${hora_programada}`)
          const fechaLegible = fechaObj.toLocaleDateString("es-BO", {
            weekday: "long", day: "numeric", month: "long"
          })
          const horaLegible = hora_programada.slice(0, 5)

          await notifCitaSolicitada({
            id_usuario:     idUsuarioCliente,
            nombre_cliente: clienteData.nombre,
            telefono:       clienteData.telefono,
            nombre_mascota,
            fecha:          fechaLegible,
            hora:           horaLegible,
            servicio:       nombre_servicio,
            id_cita,
          })
        }
      } catch (notifErr) {
        // Nunca romper el flujo principal por un error de notificación
        console.error("[POST /api/citas] Error al enviar notificación:", notifErr)
      }

      return NextResponse.json(
        {
          message: esCliente
            ? "Solicitud de cita enviada. Recepción la confirmará pronto."
            : "Cita creada y confirmada.",
          id_cita,
          estado: estadoInicial,
          hora_fin: horaFin,
          duracion_ajustada: duracionAjustada,
        },
        { status: 201 }
      )
    } catch (err) {
      await client.query("ROLLBACK")
      throw err
    } finally {
      client.release()
    }
  } catch (error) {
    console.error("[POST /api/citas]", error)
    return NextResponse.json({ message: "Error al crear la cita" }, { status: 500 })
  }
}