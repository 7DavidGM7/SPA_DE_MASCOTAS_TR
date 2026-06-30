// app/api/slots/route.ts
// GET /api/slots?fecha=YYYY-MM-DD&id_servicio=1&id_mascota=1&id_groomer=2(opcional)
// Devuelve los slots horarios disponibles para agendar una cita
import { NextRequest, NextResponse } from "next/server"
import { Pool } from "pg"

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

const AJUSTE_DURACION: Record<string, number> = {
  pequenio: 1.00,   // pequeño
  mediano:  1.10,   // +10%
  grande:   1.15,   // +15%
  gigante:  1.30,   // +30%
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number)
  return h * 60 + m
}

function minutesToTime(m: number): string {
  const h = Math.floor(m / 60)
  const min = m % 60
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const fecha       = searchParams.get("fecha")
    const idServicio  = searchParams.get("id_servicio")
    const idMascota   = searchParams.get("id_mascota")
    const idGroomer   = searchParams.get("id_groomer") // opcional

    if (!fecha || !idServicio || !idMascota) {
      return NextResponse.json(
        { message: "Parámetros requeridos: fecha, id_servicio, id_mascota" },
        { status: 400 }
      )
    }

    const fechaObj  = new Date(fecha + "T00:00:00")
    const rawDay    = fechaObj.getDay()
    const diaSemana = rawDay === 0 ? 7 : rawDay  // BD: 1=Lun...7=Dom

    // 1. Verificar que el spa está abierto ese día
    const horarioRes = await pool.query(
      `SELECT hora_inicio, hora_fin, capacidad_max, activo
       FROM horario_spa WHERE dia_semana = $1`,
      [diaSemana]
    )
    // Domingo (7) = spa cerrado
    // ✅ PONER ESTO
    if (!horarioRes.rows[0] || !horarioRes.rows[0].activo) {
      return NextResponse.json({ slots: [], mensaje: "El spa no atiende ese día" })
    }

    // 2. Verificar feriados
    const feriadoRes = await pool.query(
      `SELECT id_feriado FROM feriado WHERE fecha = $1`,
      [fecha]
    )
    if (feriadoRes.rows.length > 0) {
      return NextResponse.json({ slots: [], mensaje: "Día feriado, no hay atención" })
    }

    const { hora_inicio, hora_fin, capacidad_max } = horarioRes.rows[0]
    // PG devuelve TIME como "09:00:00" — tomar solo HH:MM para timeToMinutes
    const inicioSpa = timeToMinutes(String(hora_inicio).slice(0, 5))
    const finSpa    = timeToMinutes(String(hora_fin).slice(0, 5))

    // 3. Obtener duración ajustada del servicio según tamaño de mascota
    const servicioRes = await pool.query(
      `SELECT s.duracion_base, m.tamanio, m.temperamento
       FROM servicio s, mascota m
       WHERE s.id_servicio = $1 AND m.id_mascota = $2`,
      [idServicio, idMascota]
    )
    if (!servicioRes.rows[0]) {
      return NextResponse.json({ message: "Servicio o mascota no encontrado" }, { status: 404 })
    }

    const { duracion_base, tamanio, temperamento } = servicioRes.rows[0]

    // Ajuste por tamaño
    const multiplicador = AJUSTE_DURACION[tamanio?.toLowerCase()] ?? 1.0
    let duracion = Math.ceil(duracion_base * multiplicador)

    // Ajuste adicional por temperamento (parcial 2)
    // Nervioso/agresivo/inquieto: +15 min extra por precaución
    const temperamentosComplejos = ["nervioso", "agresivo", "inquieto"]
    if (temperamento && temperamentosComplejos.includes(temperamento.toLowerCase())) {
      duracion += 15
    }

    // 4. Obtener citas ya reservadas ese día (para calcular ocupación)
    // Citas del día — usa id_servicio directo en cita (sin cita_servicio)
    const citasQuery = idGroomer
      ? `SELECT c.hora_programada, s.duracion_base AS duracion_ajustada, a.id_trabajador_groomer
         FROM cita c
         LEFT JOIN servicio s ON c.id_servicio = s.id_servicio
         LEFT JOIN asigna a ON c.id_cita = a.id_cita
         WHERE c.fecha_programada = $1
           AND c.estado_reserva NOT IN ('cancelada', 'no_asistio')
           AND a.id_trabajador_groomer = $2`
      : `SELECT c.hora_programada, s.duracion_base AS duracion_ajustada, a.id_trabajador_groomer
         FROM cita c
         LEFT JOIN servicio s ON c.id_servicio = s.id_servicio
         LEFT JOIN asigna a ON c.id_cita = a.id_cita
         WHERE c.fecha_programada = $1
           AND c.estado_reserva NOT IN ('cancelada', 'no_asistio')`

    const citasRes = idGroomer
      ? await pool.query(citasQuery, [fecha, idGroomer])
      : await pool.query(citasQuery, [fecha])

    // 5. Obtener bloqueos del día (si la tabla existe)
    let bloqueosRes = { rows: [] as any[] }
    try {
      bloqueosRes = await pool.query(
        `SELECT hora_inicio, hora_fin FROM bloqueo
         WHERE fecha = $1
           AND ($2::integer IS NULL OR id_trabajador_groomer = $2 OR id_trabajador_groomer IS NULL)`,
        [fecha, idGroomer || null]
      )
    } catch (e: any) {
      // Tabla bloqueo aún no creada — continuar sin bloqueos
      if (e.code !== "42P01") throw e
    }

    // 6. Generar slots cada 30 minutos y marcar disponibilidad
    const slots: Array<{
      hora_inicio: string
      hora_fin: string
      disponible: boolean
      razon?: string
    }> = []

    const INTERVALO = 30 // cada 30 min muestra un slot

    for (let inicio = inicioSpa; inicio + duracion <= finSpa; inicio += INTERVALO) {
      const fin = inicio + duracion
      const horaInicioStr = minutesToTime(inicio)
      const horaFinStr    = minutesToTime(fin)

      let disponible = true
      let razon = ""

      // Verificar bloqueos
      for (const b of bloqueosRes.rows) {
        if (!b.hora_inicio) { disponible = false; razon = "Día bloqueado"; break }
        const bInicio = timeToMinutes(b.hora_inicio)
        const bFin    = timeToMinutes(b.hora_fin)
        if (inicio < bFin && fin > bInicio) {
          disponible = false; razon = "Horario bloqueado"; break
        }
      }

      // Verificar solapamiento con citas existentes
      if (disponible) {
        let citasEnSlot = 0
        for (const c of citasRes.rows) {
          const cInicio = timeToMinutes(String(c.hora_programada).slice(0, 5))
          const cFin    = cInicio + (c.duracion_ajustada || 60)
          if (inicio < cFin && fin > cInicio) {
            citasEnSlot++
          }
        }

        if (idGroomer) {
          // Si se pidió groomer específico: máximo 1 cita a la vez
          if (citasEnSlot >= 1) {
            disponible = false; razon = "Groomer ocupado"
          }
        } else {
          // Sin groomer específico: verificar capacidad total
          if (citasEnSlot >= capacidad_max) {
            disponible = false; razon = "Sin capacidad disponible"
          }
        }
      }

      slots.push({ hora_inicio: horaInicioStr, hora_fin: horaFinStr, disponible, razon })
    }

    return NextResponse.json({
      fecha,
      id_servicio:        Number(idServicio),
      id_mascota:         Number(idMascota),
      duracion_ajustada:  duracion,
      tamanio_mascota:    tamanio,
      temperamento:       temperamento,
      ajuste_temperamento: temperamentosComplejos.includes(temperamento?.toLowerCase() ?? "") ? 15 : 0,
      slots,
    })
  } catch (error) {
    console.error("[/api/slots] Error:", error)
    return NextResponse.json({ message: "Error al calcular slots" }, { status: 500 })
  }
}