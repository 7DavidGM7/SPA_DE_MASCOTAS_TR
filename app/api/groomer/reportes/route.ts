// app/api/groomer/reportes/route.ts
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

// GET /api/groomer/reportes?desde=YYYY-MM-DD&hasta=YYYY-MM-DD&id_groomer=N
// - groomer: solo ve sus propios datos (id_groomer se obtiene automáticamente)
// - admin:   puede pasar id_groomer como query param para ver cualquiera
export async function GET(request: NextRequest) {
  const payload = await getPayload(request)
  if (!payload || !["groomer", "admin"].includes(payload.rol))
    return NextResponse.json({ message: "No autorizado" }, { status: 403 })

  const { searchParams } = new URL(request.url)

  // Rango de fechas (default: últimos 30 días)
  const hasta = searchParams.get("hasta") || new Date().toISOString().split("T")[0]
  const desdeDefault = new Date()
  desdeDefault.setDate(desdeDefault.getDate() - 30)
  const desde = searchParams.get("desde") || desdeDefault.toISOString().split("T")[0]

  try {
    // Determinar id_trabajador del groomer
    let id_trabajador: number | null = null

    if (payload.rol === "groomer") {
      // Groomer siempre ve sus propios datos
      const grRes = await pool.query(
        `SELECT ts.id_trabajador FROM trabajador_spa ts
         WHERE ts.id_usuario = $1`,
        [Number(payload.userId)]
      )
      if (!grRes.rows[0])
        return NextResponse.json({ message: "No se encontró perfil de groomer" }, { status: 404 })
      id_trabajador = grRes.rows[0].id_trabajador
    } else {
      // Admin puede filtrar por groomer específico
      const idParam = searchParams.get("id_groomer")
      if (idParam) id_trabajador = Number(idParam)
    }

    // ── 1. PRODUCTIVIDAD INDIVIDUAL ──────────────────────────────────────
    const productividadQuery = id_trabajador
      ? `SELECT
           COUNT(sg.id_sesion_grmm)::int                          AS total_servicios,
           ROUND(AVG(
             EXTRACT(EPOCH FROM (sg.hora_fin_real - sg.hora_inicio)) / 60
           )::numeric, 1)                                         AS tiempo_promedio_min,
           COUNT(CASE WHEN sg.estado = 'completada' THEN 1 END)::int AS completadas,
           COUNT(CASE WHEN sg.estado = 'cancelada'  THEN 1 END)::int AS canceladas,
           COUNT(DISTINCT sg.fecha)::int                          AS dias_trabajados,
           ROUND(COUNT(sg.id_sesion_grmm)::numeric /
             NULLIF(COUNT(DISTINCT sg.fecha), 0), 1)              AS promedio_por_dia,
           u.nombre || ' ' || u.apellido                          AS nombre_groomer,
           g.especialidad,
           g.anos_experiencia
         FROM sesion_grooming sg
         JOIN groomer g       ON g.id_trabajador = sg.id_trabajador_groomer
         JOIN trabajador_spa ts ON ts.id_trabajador = g.id_trabajador
         JOIN usuario u       ON u.id_usuario = ts.id_usuario
         WHERE sg.id_trabajador_groomer = $1
           AND sg.fecha BETWEEN $2 AND $3
         GROUP BY u.nombre, u.apellido, g.especialidad, g.anos_experiencia`
      : `SELECT
           COUNT(sg.id_sesion_grmm)::int                          AS total_servicios,
           ROUND(AVG(
             EXTRACT(EPOCH FROM (sg.hora_fin_real - sg.hora_inicio)) / 60
           )::numeric, 1)                                         AS tiempo_promedio_min,
           COUNT(CASE WHEN sg.estado = 'completada' THEN 1 END)::int AS completadas,
           COUNT(CASE WHEN sg.estado = 'cancelada'  THEN 1 END)::int AS canceladas,
           COUNT(DISTINCT sg.fecha)::int                          AS dias_trabajados,
           ROUND(COUNT(sg.id_sesion_grmm)::numeric /
             NULLIF(COUNT(DISTINCT sg.fecha), 0), 1)              AS promedio_por_dia,
           'Todos los groomers' AS nombre_groomer,
           '' AS especialidad, 0 AS anos_experiencia
         FROM sesion_grooming sg
         WHERE sg.fecha BETWEEN $1 AND $2`

    const prodParams = id_trabajador ? [id_trabajador, desde, hasta] : [desde, hasta]
    const prodRes = await pool.query(productividadQuery, prodParams)

    // Servicios por tipo (ranking)
    const serviciosTipoRes = await pool.query(
      `SELECT
         s.nombre AS servicio,
         COUNT(c.id_cita)::int AS cantidad
       FROM cita c
       JOIN servicio s ON s.id_servicio = c.id_servicio
       JOIN asigna a   ON a.id_cita = c.id_cita
       WHERE ${id_trabajador ? "a.id_trabajador_groomer = $1 AND" : ""}
             c.fecha_programada BETWEEN ${id_trabajador ? "$2" : "$1"} AND ${id_trabajador ? "$3" : "$2"}
             AND c.estado_reserva = 'completada'
       GROUP BY s.nombre
       ORDER BY cantidad DESC
       LIMIT 5`,
      id_trabajador ? [id_trabajador, desde, hasta] : [desde, hasta]
    )

    // ── 2. HISTORIAL DE SERVICIOS (fichas cerradas) ──────────────────────
    const historialRes = await pool.query(
      `SELECT
         sg.id_sesion_grmm,
         sg.fecha,
         sg.hora_inicio,
         sg.hora_fin_real,
         sg.estado,
         sg.observaciones,
         m.nombre   AS nombre_mascota,
         m.especie,
         m.tamanio,
         u_cli.nombre || ' ' || u_cli.apellido AS nombre_cliente,
         s.nombre   AS nombre_servicio,
         fg.condicion_pelaje,
         fg.condicion_piel,
         fg.tipo_corte_realizado,
         fg.estado_mascota,
         fg.nivel_estres,
         fg.foto_antes_url,
         fg.foto_despues_url,
         fg.recomendaciones_duenio,
         u_gr.nombre || ' ' || u_gr.apellido AS nombre_groomer
       FROM sesion_grooming sg
       JOIN groomer g         ON g.id_trabajador = sg.id_trabajador_groomer
       JOIN trabajador_spa ts ON ts.id_trabajador = g.id_trabajador
       JOIN usuario u_gr      ON u_gr.id_usuario  = ts.id_usuario
       LEFT JOIN cita c       ON c.id_sesion_grmm = sg.id_sesion_grmm
       LEFT JOIN mascota m    ON m.id_mascota      = c.id_mascota
       LEFT JOIN usuario u_cli ON u_cli.id_usuario = c.id_usuario_cliente
       LEFT JOIN servicio s   ON s.id_servicio     = c.id_servicio
       LEFT JOIN ficha_grooming fg ON fg.id_sesion_grmm = sg.id_sesion_grmm
       WHERE ${id_trabajador ? "sg.id_trabajador_groomer = $1 AND" : ""}
             sg.fecha BETWEEN ${id_trabajador ? "$2" : "$1"} AND ${id_trabajador ? "$3" : "$2"}
             AND sg.estado = 'completada'
       ORDER BY sg.fecha DESC, sg.hora_inicio DESC
       LIMIT 50`,
      id_trabajador ? [id_trabajador, desde, hasta] : [desde, hasta]
    )

    // ── 3. CONSUMO PERSONAL DE INSUMOS ───────────────────────────────────
    const consumoRes = await pool.query(
      `SELECT
         p.nombre   AS nombre_producto,
         p.categoria,
         SUM(u.cantidad_usada)::numeric        AS total_usado,
         SUM(u.cantidad_devuelta)::numeric     AS total_devuelto,
         SUM(u.cantidad_merma)::numeric        AS total_merma,
         COUNT(DISTINCT sg.id_sesion_grmm)::int AS sesiones_uso,
         ROUND(SUM(u.cantidad_usada) /
           NULLIF(COUNT(DISTINCT sg.id_sesion_grmm), 0)::numeric, 2) AS promedio_por_sesion
       FROM usa u
       JOIN producto p ON p.id_producto = u.id_producto
       JOIN sesion_grooming sg ON sg.id_sesion_grmm = u.id_sesion_grmm
       WHERE ${id_trabajador ? "u.id_trabajador_groomer = $1 AND" : ""}
             sg.fecha BETWEEN ${id_trabajador ? "$2" : "$1"} AND ${id_trabajador ? "$3" : "$2"}
       GROUP BY p.nombre, p.categoria
       ORDER BY total_usado DESC`,
      id_trabajador ? [id_trabajador, desde, hasta] : [desde, hasta]
    )

    // Consumo diario (para gráfico de tendencia)
    const consumoDiarioRes = await pool.query(
      `SELECT
         sg.fecha::text,
         COUNT(DISTINCT sg.id_sesion_grmm)::int AS sesiones,
         COALESCE(SUM(u.cantidad_usada), 0)::numeric AS insumos_usados
       FROM sesion_grooming sg
       LEFT JOIN usa u ON u.id_sesion_grmm = sg.id_sesion_grmm
         ${id_trabajador ? "AND u.id_trabajador_groomer = $1" : ""}
       WHERE ${id_trabajador ? "sg.id_trabajador_groomer = $1 AND" : ""}
             sg.fecha BETWEEN ${id_trabajador ? "$2" : "$1"} AND ${id_trabajador ? "$3" : "$2"}
       GROUP BY sg.fecha
       ORDER BY sg.fecha ASC`,
      id_trabajador ? [id_trabajador, desde, hasta] : [desde, hasta]
    )

    return NextResponse.json({
      periodo: { desde, hasta },
      productividad:    prodRes.rows[0] ?? null,
      servicios_por_tipo: serviciosTipoRes.rows,
      historial:        historialRes.rows,
      consumo_insumos:  consumoRes.rows,
      consumo_diario:   consumoDiarioRes.rows,
    })
  } catch (error) {
    console.error("[groomer/reportes GET]", error)
    return NextResponse.json({ message: "Error interno" }, { status: 500 })
  }
}