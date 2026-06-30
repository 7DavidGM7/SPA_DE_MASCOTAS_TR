// app/api/admin/reportes/route.ts
// GET /api/admin/reportes?tipo=ventas|rentabilidad|ocupacion|insumos|nps&desde=&hasta=

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
  if (!payload || payload.rol !== "admin") return null
  return payload
}

export async function GET(request: NextRequest) {
  const payload = await verificarAuth(request)
  if (!payload) return NextResponse.json({ message: "No autorizado" }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const tipo  = searchParams.get("tipo") || "ventas"
  const desde = searchParams.get("desde") || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0]
  const hasta = searchParams.get("hasta") || new Date().toISOString().split("T")[0]

  try {
    // ── 1. VENTAS TOTALES Y FACTURACIÓN ──────────────────────────────────
    if (tipo === "ventas") {
      // Ingresos por servicios (cobra_cita → pago)
      const serviciosRes = await pool.query(
        `SELECT
           DATE_TRUNC('day', p.fecha) AS fecha,
           COUNT(cc.id_cobra)         AS cantidad_cobros,
           SUM(cc.monto_cobrado)      AS total_servicios,
           p.metodo_pago
         FROM cobra_cita cc
         JOIN pago p ON p.id_pago = cc.id_pago
         WHERE p.fecha BETWEEN $1 AND $2
           AND p.estado = 'aprobado'
         GROUP BY DATE_TRUNC('day', p.fecha), p.metodo_pago
         ORDER BY fecha DESC`,
        [desde, hasta]
      )

      // Ingresos por productos (efectua_pago)
      const productosRes = await pool.query(
        `SELECT
           DATE_TRUNC('day', ep.fecha) AS fecha,
           COUNT(ep.id_efectua)        AS cantidad_ventas,
           SUM(ep.monto_pagado)        AS total_productos,
           ep.metodo_pago
         FROM efectua_pago ep
         WHERE ep.fecha BETWEEN $1 AND $2
         GROUP BY DATE_TRUNC('day', ep.fecha), ep.metodo_pago
         ORDER BY fecha DESC`,
        [desde, hasta]
      )

      // Resumen por método de pago
      const metodoRes = await pool.query(
        `SELECT
           p.metodo_pago,
           COUNT(*)           AS cantidad,
           SUM(cc.monto_cobrado) AS total
         FROM cobra_cita cc
         JOIN pago p ON p.id_pago = cc.id_pago
         WHERE p.fecha BETWEEN $1 AND $2
           AND p.estado = 'aprobado'
         GROUP BY p.metodo_pago
         ORDER BY total DESC`,
        [desde, hasta]
      )

      // Totales generales
      const totalRes = await pool.query(
        `SELECT
           COALESCE(SUM(cc.monto_cobrado), 0) AS total_servicios,
           COUNT(cc.id_cobra)                 AS cantidad_servicios
         FROM cobra_cita cc
         JOIN pago p ON p.id_pago = cc.id_pago
         WHERE p.fecha BETWEEN $1 AND $2
           AND p.estado = 'aprobado'`,
        [desde, hasta]
      )

      const totalProdRes = await pool.query(
        `SELECT COALESCE(SUM(ep.monto_pagado),0) AS total_productos, COUNT(*) AS cantidad_ventas
         FROM efectua_pago ep WHERE ep.fecha BETWEEN $1 AND $2`,
        [desde, hasta]
      )

      return NextResponse.json({
        tipo: "ventas",
        desde, hasta,
        resumen: {
          total_servicios:  Number(totalRes.rows[0].total_servicios),
          cantidad_servicios: Number(totalRes.rows[0].cantidad_servicios),
          total_productos:  Number(totalProdRes.rows[0].total_productos),
          cantidad_ventas:  Number(totalProdRes.rows[0].cantidad_ventas),
          total_general:    Number(totalRes.rows[0].total_servicios) + Number(totalProdRes.rows[0].total_productos),
        },
        por_dia:        serviciosRes.rows,
        productos_dia:  productosRes.rows,
        por_metodo:     metodoRes.rows,
      })
    }

    // ── 2. RANKING DE RENTABILIDAD ────────────────────────────────────────
    if (tipo === "rentabilidad") {
      const serviciosRank = await pool.query(
        `SELECT
           s.nombre                          AS nombre,
           'servicio'                        AS tipo,
           COUNT(cc.id_cobra)                AS veces_vendido,
           SUM(cc.monto_cobrado)             AS ingresos_total,
           AVG(cc.monto_cobrado)             AS precio_promedio,
           0                                 AS costo_total,
           SUM(cc.monto_cobrado)             AS margen_total
         FROM cobra_cita cc
         JOIN cita c ON c.id_cita = cc.id_cita
         JOIN servicio s ON s.id_servicio = c.id_servicio
         JOIN pago p ON p.id_pago = cc.id_pago
         WHERE p.fecha BETWEEN $1 AND $2
           AND p.estado = 'aprobado'
         GROUP BY s.id_servicio, s.nombre
         ORDER BY margen_total DESC
         LIMIT 10`,
        [desde, hasta]
      )

      const productosRank = await pool.query(
        `SELECT
           p.nombre                          AS nombre,
           'producto'                        AS tipo,
           SUM(oc.cantidad_solicitada)       AS veces_vendido,
           SUM(oc.cantidad_solicitada * p.precio_venta) AS ingresos_total,
           AVG(p.precio_venta)               AS precio_promedio,
           SUM(oc.cantidad_solicitada * p.precio_costo) AS costo_total,
           SUM(oc.cantidad_solicitada * (p.precio_venta - p.precio_costo)) AS margen_total
         FROM orden_compra oc
         JOIN producto p ON p.id_producto = oc.id_producto
         WHERE oc.fecha BETWEEN $1 AND $2
         GROUP BY p.id_producto, p.nombre
         ORDER BY margen_total DESC
         LIMIT 10`,
        [desde, hasta]
      )

      return NextResponse.json({
        tipo: "rentabilidad",
        desde, hasta,
        servicios: serviciosRank.rows,
        productos: productosRank.rows,
      })
    }

    // ── 3. OCUPACIÓN GLOBAL ───────────────────────────────────────────────
    if (tipo === "ocupacion") {
      const ocupacionRes = await pool.query(
        `SELECT
           c.fecha_programada                AS fecha,
           COUNT(c.id_cita)                  AS citas_totales,
           COUNT(CASE WHEN c.estado_reserva IN ('completada','en_proceso') THEN 1 END) AS citas_atendidas,
           COUNT(CASE WHEN c.estado_reserva = 'cancelada' THEN 1 END)    AS canceladas,
           COUNT(CASE WHEN c.estado_reserva = 'no_asistio' THEN 1 END)   AS no_asistio,
           MAX(hs.capacidad_max)             AS capacidad_max,
           ROUND(
             COUNT(CASE WHEN c.estado_reserva IN ('completada','en_proceso') THEN 1 END) * 100.0
             / NULLIF(MAX(hs.capacidad_max), 0), 1
           )                                  AS porcentaje_ocupacion
         FROM cita c
         LEFT JOIN horario_spa hs ON hs.dia_semana = EXTRACT(ISODOW FROM c.fecha_programada)::int
         WHERE c.fecha_programada BETWEEN $1 AND $2
         GROUP BY c.fecha_programada
         ORDER BY c.fecha_programada DESC`,
        [desde, hasta]
      )

      // Ocupación por groomer
      const groomerOcupRes = await pool.query(
        `SELECT
           u.nombre || ' ' || u.apellido   AS groomer,
           COUNT(a.id_cita)                AS citas_asignadas,
           COUNT(CASE WHEN c.estado_reserva = 'completada' THEN 1 END) AS completadas,
           ROUND(
             COUNT(CASE WHEN c.estado_reserva = 'completada' THEN 1 END) * 100.0
             / NULLIF(COUNT(a.id_cita), 0), 1
           )                               AS tasa_completado
         FROM asigna a
         JOIN cita c ON c.id_cita = a.id_cita
         JOIN groomer g ON g.id_trabajador = a.id_trabajador_groomer
         JOIN trabajador_spa ts ON ts.id_trabajador = g.id_trabajador
         JOIN usuario u ON u.id_usuario = ts.id_usuario
         WHERE c.fecha_programada BETWEEN $1 AND $2
         GROUP BY u.id_usuario, u.nombre, u.apellido
         ORDER BY completadas DESC`,
        [desde, hasta]
      )

      const totalRes = await pool.query(
        `SELECT
           COUNT(*) AS total_citas,
           COUNT(CASE WHEN estado_reserva IN ('completada','en_proceso') THEN 1 END) AS atendidas,
           COUNT(CASE WHEN estado_reserva = 'cancelada' THEN 1 END) AS canceladas,
           ROUND(
             COUNT(CASE WHEN estado_reserva IN ('completada','en_proceso') THEN 1 END) * 100.0
             / NULLIF(COUNT(*),0), 1
           ) AS pct_ocupacion_global
         FROM cita
         WHERE fecha_programada BETWEEN $1 AND $2`,
        [desde, hasta]
      )

      return NextResponse.json({
        tipo: "ocupacion",
        desde, hasta,
        resumen: totalRes.rows[0],
        por_dia: ocupacionRes.rows,
        por_groomer: groomerOcupRes.rows,
      })
    }

    // ── 4. AUDITORÍA DE INSUMOS ───────────────────────────────────────────
    if (tipo === "insumos") {
      const auditRes = await pool.query(
        `SELECT
           p.nombre                                AS producto,
           p.categoria,
           COALESCE(SUM(e.cantidad_entregada), 0)  AS total_entregado,
           COALESCE(SUM(CASE WHEN e.estado='usado' THEN e.cantidad_entregada END), 0) AS total_usado,
           COALESCE(SUM(CASE WHEN e.estado='devuelto' THEN e.cantidad_entregada END), 0) AS total_devuelto,
           COALESCE(SUM(CASE WHEN e.estado='desperdiciado' THEN e.cantidad_entregada END), 0) AS total_desperdicio,
           ip.cantidad AS stock_actual,
           ip.stock_minimo
         FROM producto p
         LEFT JOIN entrega_insumo e ON e.id_producto = p.id_producto
           AND e.fecha_entrega BETWEEN $1 AND $2
         LEFT JOIN inventario_producto ip ON ip.id_producto = p.id_producto
         GROUP BY p.id_producto, p.nombre, p.categoria, ip.cantidad, ip.stock_minimo
         HAVING COALESCE(SUM(e.cantidad_entregada), 0) > 0
            OR ip.cantidad IS NOT NULL
         ORDER BY total_entregado DESC`,
        [desde, hasta]
      )

      // También mostrar uso registrado en tabla usa (sesión grooming)
      const usaRes = await pool.query(
        `SELECT
           p.nombre AS producto,
           p.categoria,
           SUM(u.cantidad_producto) AS total_usado_sesion,
           COUNT(DISTINCT u.id_sesion_grmm) AS sesiones
         FROM usa u
         JOIN producto p ON p.id_producto = u.id_producto
         JOIN sesion_grooming sg ON sg.id_sesion_grmm = u.id_sesion_grmm
         WHERE sg.fecha BETWEEN $1 AND $2
         GROUP BY p.id_producto, p.nombre, p.categoria
         ORDER BY total_usado_sesion DESC`,
        [desde, hasta]
      )

      return NextResponse.json({
        tipo: "insumos",
        desde, hasta,
        auditoria: auditRes.rows,
        uso_sesiones: usaRes.rows,
      })
    }

    // ── 5. SATISFACCIÓN / NPS ─────────────────────────────────────────────
    if (tipo === "nps") {
      const npsRes = await pool.query(
        `SELECT
           cal.puntuacion,
           COUNT(*) AS cantidad,
           ROUND(COUNT(*) * 100.0 / NULLIF(SUM(COUNT(*)) OVER (), 0), 1) AS porcentaje
         FROM calificacion cal
         GROUP BY cal.puntuacion
         ORDER BY cal.puntuacion DESC`
      )

      const promedioRes = await pool.query(
        `SELECT
           ROUND(AVG(puntuacion)::numeric, 2) AS promedio,
           COUNT(*) AS total_calificaciones,
           COUNT(CASE WHEN puntuacion >= 4 THEN 1 END) AS promotores,
           COUNT(CASE WHEN puntuacion = 3 THEN 1 END)  AS neutros,
           COUNT(CASE WHEN puntuacion <= 2 THEN 1 END) AS detractores
         FROM calificacion`
      )

      const comentariosRes = await pool.query(
        `SELECT
           cal.puntuacion,
           cal.queja_sugerencia AS comentario,
           cal.respondida,
           cal.respuesta
         FROM calificacion cal
         WHERE cal.queja_sugerencia IS NOT NULL
           AND cal.queja_sugerencia != ''
         ORDER BY cal.puntuacion ASC
         LIMIT 20`
      )

      const prom = promedioRes.rows[0]
      const total = Number(prom.total_calificaciones) || 1
      const npsScore = Math.round(
        ((Number(prom.promotores) - Number(prom.detractores)) / total) * 100
      )

      return NextResponse.json({
        tipo: "nps",
        resumen: {
          ...prom,
          nps_score: npsScore,
        },
        distribucion: npsRes.rows,
        comentarios:  comentariosRes.rows,
      })
    }

    return NextResponse.json({ message: "Tipo de reporte inválido" }, { status: 400 })

  } catch (error) {
    console.error("[GET /api/admin/reportes]", error)
    return NextResponse.json({ message: "Error interno al generar reporte" }, { status: 500 })
  }
}