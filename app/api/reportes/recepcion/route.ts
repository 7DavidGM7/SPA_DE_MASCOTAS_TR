// app/api/reportes/recepcion/route.ts
// GET /api/reportes/recepcion?tipo=cronograma|canceladas|inventario_critico&fecha=YYYY-MM-DD
import { NextRequest, NextResponse } from "next/server"
import { verifyAccessToken } from "@/lib/auth"
import { Pool } from "pg"

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
})

async function verificarAcceso(request: NextRequest) {
  const tokenCookie = request.cookies.get("accessToken")?.value
  const authHeader  = request.headers.get("authorization")
  const token = tokenCookie ?? (authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null)
  if (!token) return null
  const payload = await verifyAccessToken(token)
  if (!payload || !["admin", "recepcionista", "cajero"].includes(payload.rol)) return null
  return payload
}

export async function GET(request: NextRequest) {
  const payload = await verificarAcceso(request)
  if (!payload) return NextResponse.json({ message: "No autorizado" }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const tipo  = searchParams.get("tipo") || "cronograma"
  const fecha = searchParams.get("fecha") || new Date().toISOString().split("T")[0]

  try {
    // ── 1. CRONOGRAMA DIARIO ──────────────────────────────────────────────
    if (tipo === "cronograma") {
      const res = await pool.query(`
        SELECT
          c.id_cita,
          c.hora_programada,
          c.estado_reserva,
          c.notas,
          u.nombre || ' ' || u.apellido  AS nombre_cliente,
          u.telefono                      AS telefono_cliente,
          m.nombre                        AS nombre_mascota,
          m.especie,
          m.tamanio,
          m.temperamento,
          s.nombre                        AS nombre_servicio,
          s.duracion_base,
          s.precio                        AS precio_servicio,
          -- groomer asignado
          ug.nombre || ' ' || ug.apellido AS nombre_groomer,
          -- estado de pago
          CASE WHEN cc.id_cobra IS NOT NULL THEN 'pagado'
               WHEN c.estado_reserva IN ('completada','confirmada') THEN 'pendiente_pago'
               ELSE 'sin_cobro'
          END                             AS estado_pago,
          cc.monto_cobrado,
          p.metodo_pago
        FROM cita c
        JOIN usuario u       ON u.id_usuario   = c.id_usuario_cliente
        LEFT JOIN mascota m  ON m.id_mascota   = c.id_mascota
        LEFT JOIN servicio s ON s.id_servicio  = c.id_servicio
        LEFT JOIN asigna a   ON a.id_cita      = c.id_cita
        LEFT JOIN groomer g  ON g.id_trabajador = a.id_trabajador_groomer
        LEFT JOIN trabajador_spa ts ON ts.id_trabajador = g.id_trabajador
        LEFT JOIN usuario ug ON ug.id_usuario  = ts.id_usuario
        LEFT JOIN cobra_cita cc ON cc.id_cita  = c.id_cita
        LEFT JOIN pago p     ON p.id_pago      = cc.id_pago
        WHERE c.fecha_programada = $1
          AND c.estado_reserva NOT IN ('cancelada', 'no_asistio')
        ORDER BY c.hora_programada
      `, [fecha])

      // Resumen del día
      const resumen = await pool.query(`
        SELECT
          COUNT(*)::int                                                          AS total,
          COUNT(*) FILTER (WHERE estado_reserva = 'pendiente')::int             AS pendientes,
          COUNT(*) FILTER (WHERE estado_reserva = 'confirmada')::int            AS confirmadas,
          COUNT(*) FILTER (WHERE estado_reserva = 'en_proceso')::int            AS en_proceso,
          COUNT(*) FILTER (WHERE estado_reserva = 'completada')::int            AS completadas,
          COALESCE(SUM(s.precio), 0)                                            AS ingresos_esperados
        FROM cita c
        LEFT JOIN servicio s ON s.id_servicio = c.id_servicio
        WHERE c.fecha_programada = $1
          AND c.estado_reserva NOT IN ('cancelada', 'no_asistio')
      `, [fecha])

      return NextResponse.json({
        tipo: "cronograma",
        fecha,
        resumen: resumen.rows[0],
        citas:   res.rows,
      })
    }

    // ── 2. CITAS CANCELADAS / NO-SHOW ────────────────────────────────────
    if (tipo === "canceladas") {
      // Permite rango: fecha = fecha_inicio, fecha_fin opcional
      const fechaFin = searchParams.get("fecha_fin") || fecha

      const res = await pool.query(`
        SELECT
          c.id_cita,
          c.fecha_programada,
          c.hora_programada,
          c.estado_reserva,
          c.notas,
          c.fecha_creacion,
          u.nombre || ' ' || u.apellido AS nombre_cliente,
          u.telefono                    AS telefono_cliente,
          u.email                       AS email_cliente,
          m.nombre                      AS nombre_mascota,
          m.especie,
          s.nombre                      AS nombre_servicio,
          s.precio                      AS precio_servicio,
          -- historial de modificaciones (último cambio de estado)
          dc.fecha_modificacion,
          dc.descripcion                AS motivo_cambio
        FROM cita c
        JOIN usuario u       ON u.id_usuario  = c.id_usuario_cliente
        LEFT JOIN mascota m  ON m.id_mascota  = c.id_mascota
        LEFT JOIN servicio s ON s.id_servicio = c.id_servicio
        LEFT JOIN LATERAL (
          SELECT fecha_modificacion, descripcion
          FROM detalle_cita
          WHERE id_cita = c.id_cita
          ORDER BY fecha_modificacion DESC
          LIMIT 1
        ) dc ON true
        WHERE c.estado_reserva IN ('cancelada', 'no_asistio')
          AND c.fecha_programada BETWEEN $1 AND $2
        ORDER BY c.fecha_programada DESC, c.hora_programada
      `, [fecha, fechaFin])

      // Estadísticas del período
      const stats = await pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE estado_reserva = 'cancelada')::int  AS total_canceladas,
          COUNT(*) FILTER (WHERE estado_reserva = 'no_asistio')::int AS total_no_show,
          COUNT(DISTINCT c.id_usuario_cliente)::int                  AS clientes_afectados,
          COALESCE(SUM(s.precio), 0)                                 AS ingresos_perdidos
        FROM cita c
        LEFT JOIN servicio s ON s.id_servicio = c.id_servicio
        WHERE c.estado_reserva IN ('cancelada', 'no_asistio')
          AND c.fecha_programada BETWEEN $1 AND $2
      `, [fecha, fechaFin])

      // Top clientes con más cancelaciones
      const topCancelaciones = await pool.query(`
        SELECT
          u.nombre || ' ' || u.apellido AS nombre_cliente,
          u.telefono,
          COUNT(*) FILTER (WHERE c.estado_reserva = 'cancelada')::int  AS cancelaciones,
          COUNT(*) FILTER (WHERE c.estado_reserva = 'no_asistio')::int AS no_shows
        FROM cita c
        JOIN usuario u ON u.id_usuario = c.id_usuario_cliente
        WHERE c.estado_reserva IN ('cancelada', 'no_asistio')
          AND c.fecha_programada BETWEEN $1 AND $2
        GROUP BY u.id_usuario, u.nombre, u.apellido, u.telefono
        HAVING COUNT(*) > 1
        ORDER BY COUNT(*) DESC
        LIMIT 10
      `, [fecha, fechaFin])

      return NextResponse.json({
        tipo:    "canceladas",
        fecha_inicio: fecha,
        fecha_fin:    fechaFin,
        stats:   stats.rows[0],
        citas:   res.rows,
        top_cancelaciones: topCancelaciones.rows,
      })
    }

    // ── 3. INVENTARIO CRÍTICO ─────────────────────────────────────────────
    if (tipo === "inventario_critico") {
      // Productos de venta con stock bajo o agotado
      const productosVenta = await pool.query(`
        SELECT
          p.id_producto,
          p.nombre,
          p.categoria,
          p.activo,
          pv.precio_venta,
          pv.precio_costo,
          pv.marca,
          pv.presentacion,
          inv.cantidad          AS stock_actual,
          inv.stock_minimo,
          inv.stock_maximo,
          inv.estado            AS estado_stock,
          inv.ultima_actualizacion,
          -- proveedor sugerido (último que proveyó este producto)
          pr.nombre_empresa     AS proveedor_sugerido,
          pr.telefono           AS telefono_proveedor,
          pr.email              AS email_proveedor,
          -- consumo últimos 30 días (ventas)
          COALESCE((
            SELECT SUM(dc.cantidad)
            FROM detalle_compra dc
            JOIN compra comp ON comp.id_compra = dc.id_compra
            WHERE dc.id_producto = p.id_producto
              AND comp.fecha >= CURRENT_DATE - INTERVAL '30 days'
              AND comp.estado = 'pagada'
          ), 0)::int            AS ventas_30_dias,
          -- cantidad recomendada a pedir
          GREATEST(
            COALESCE(inv.stock_maximo, inv.stock_minimo * 3) - inv.cantidad,
            0
          )::int                AS cantidad_a_pedir
        FROM producto p
        JOIN producto_venta pv     ON pv.id_producto  = p.id_producto
        JOIN inventario_producto inv ON inv.id_producto = p.id_producto
        LEFT JOIN LATERAL (
          SELECT pr2.nombre_empresa, pr2.telefono, pr2.email
          FROM orden_compra oc
          JOIN proveedor pr2 ON pr2.id_proveedor = oc.id_proveedor
          WHERE oc.id_producto = p.id_producto
          ORDER BY oc.fecha DESC
          LIMIT 1
        ) pr ON true
        WHERE inv.estado IN ('bajo', 'agotado')
          AND p.activo = TRUE
        ORDER BY
          CASE inv.estado WHEN 'agotado' THEN 0 WHEN 'bajo' THEN 1 ELSE 2 END,
          inv.cantidad ASC
      `)

      // Insumos de grooming con stock bajo
      const insumosGrooming = await pool.query(`
        SELECT
          p.id_producto,
          p.nombre,
          p.categoria,
          pu.especie_aplicable,
          inv.cantidad          AS stock_actual,
          inv.stock_minimo,
          inv.estado            AS estado_stock,
          inv.ultima_actualizacion,
          -- consumo real últimos 30 días (sesiones grooming)
          COALESCE((
            SELECT SUM(u2.cantidad_usada)
            FROM usa u2
            JOIN sesion_grooming sg ON sg.id_sesion_grmm = u2.id_sesion_grmm
            WHERE u2.id_producto = p.id_producto
              AND sg.fecha >= CURRENT_DATE - INTERVAL '30 days'
          ), 0)::numeric(10,2)  AS consumo_30_dias
        FROM producto p
        JOIN producto_uso pu        ON pu.id_producto   = p.id_producto
        JOIN inventario_producto inv ON inv.id_producto = p.id_producto
        WHERE inv.estado IN ('bajo', 'agotado')
          AND p.activo = TRUE
        ORDER BY
          CASE inv.estado WHEN 'agotado' THEN 0 ELSE 1 END,
          inv.cantidad ASC
      `)

      // Resumen
      const resumen = await pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE inv.estado = 'agotado')::int  AS productos_agotados,
          COUNT(*) FILTER (WHERE inv.estado = 'bajo')::int     AS productos_bajo_stock,
          COALESCE(SUM(
            CASE WHEN inv.estado IN ('bajo','agotado')
            THEN GREATEST(
              COALESCE(inv.stock_maximo, inv.stock_minimo * 3) - inv.cantidad, 0
            ) * COALESCE(pv.precio_costo, 0) END
          ), 0)                                                AS inversion_requerida
        FROM inventario_producto inv
        JOIN producto p ON p.id_producto = inv.id_producto
        LEFT JOIN producto_venta pv ON pv.id_producto = p.id_producto
        WHERE p.activo = TRUE
      `)

      return NextResponse.json({
        tipo: "inventario_critico",
        fecha,
        resumen: resumen.rows[0],
        productos_venta:   productosVenta.rows,
        insumos_grooming:  insumosGrooming.rows,
      })
    }

    return NextResponse.json({ message: "Tipo de reporte no válido" }, { status: 400 })

  } catch (error) {
    console.error("[GET /api/reportes/recepcion]", error)
    return NextResponse.json({ message: "Error interno" }, { status: 500 })
  }
}