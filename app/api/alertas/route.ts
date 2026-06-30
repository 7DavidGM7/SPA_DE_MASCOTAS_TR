// app/api/alertas/route.ts
// GET /api/alertas — Alertas de inventario: bajo stock, alto consumo, reabastecimiento

import { NextRequest, NextResponse } from "next/server"
import { Pool } from "pg"
import { verifyAccessToken } from "@/lib/auth"

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
})

async function verificarToken(request: NextRequest) {
  const token =
    request.cookies.get("accessToken")?.value ??
    request.headers.get("authorization")?.replace("Bearer ", "")
  if (!token) return null
  return await verifyAccessToken(token)
}

export async function GET(request: NextRequest) {
  const payload = await verificarToken(request)
  if (!payload) return NextResponse.json({ message: "No autenticado" }, { status: 401 })

  if (!["admin", "cajero", "recepcionista"].includes(payload.rol)) {
    return NextResponse.json({ message: "No autorizado" }, { status: 403 })
  }

  try {
    // ── 1. Bajo stock de productos de tienda ─────────────────────────────
    const bajoStockProductos = await pool.query(`
      SELECT
        p.id_producto,
        p.nombre,
        p.categoria,
        ip.cantidad        AS stock_actual,
        ip.stock_minimo,
        ip.stock_maximo,
        ip.estado,
        CASE
          WHEN ip.cantidad = 0           THEN 'agotado'
          WHEN ip.cantidad <= ip.stock_minimo THEN 'bajo'
          ELSE 'ok'
        END AS nivel_alerta,
        -- Cuánto comprar para llegar al máximo
        GREATEST(0, COALESCE(ip.stock_maximo, ip.stock_minimo * 3) - ip.cantidad)
          AS cantidad_recomendada_compra
      FROM inventario_producto ip
      JOIN producto p ON p.id_producto = ip.id_producto
      WHERE p.activo = true
        AND ip.cantidad <= ip.stock_minimo
      ORDER BY ip.cantidad ASC
    `)

    // ── 2. Bajo stock de insumos técnicos (productos usados en grooming) ──
    const bajoStockInsumos = await pool.query(`
      SELECT
        p.id_producto,
        p.nombre,
        p.categoria,
        ip.cantidad       AS stock_actual,
        ip.stock_minimo,
        ip.estado,
        -- Consumo promedio últimos 30 días
        COALESCE(consumo.total_usado, 0) AS consumo_30_dias,
        CASE
          WHEN ip.cantidad = 0 THEN 'agotado'
          ELSE 'bajo'
        END AS nivel_alerta
      FROM inventario_producto ip
      JOIN producto p        ON p.id_producto = ip.id_producto
      JOIN producto_uso pu   ON pu.id_producto = p.id_producto
      LEFT JOIN (
        SELECT
          u.id_producto,
          SUM(u.cantidad_producto) AS total_usado
        FROM usa u
        WHERE u.fecha >= CURRENT_DATE - INTERVAL '30 days'
        GROUP BY u.id_producto
      ) consumo ON consumo.id_producto = p.id_producto
      WHERE p.activo = true
        AND ip.cantidad <= ip.stock_minimo
      ORDER BY ip.cantidad ASC
    `)

    // ── 3. Alto consumo por groomer (últimos 30 días) ─────────────────────
    const altoConsumo = await pool.query(`
      SELECT
        u_gr.nombre || ' ' || u_gr.apellido AS nombre_groomer,
        g.id_trabajador,
        p.nombre        AS producto,
        p.categoria,
        SUM(u.cantidad_producto) AS total_consumido,
        COUNT(DISTINCT u.id_sesion_grmm) AS sesiones,
        ROUND(SUM(u.cantidad_producto)::numeric /
          NULLIF(COUNT(DISTINCT u.id_sesion_grmm), 0), 2) AS promedio_por_sesion
      FROM usa u
      JOIN producto p ON p.id_producto = u.id_producto
      JOIN sesion_grooming sg ON sg.id_sesion_grmm = u.id_sesion_grmm
      JOIN groomer g ON g.id_trabajador = sg.id_trabajador_groomer
      JOIN trabajador_spa ts ON ts.id_trabajador = g.id_trabajador
      JOIN usuario u_gr ON u_gr.id_usuario = ts.id_usuario
      WHERE u.fecha >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY g.id_trabajador, u_gr.nombre, u_gr.apellido, p.nombre, p.categoria
      HAVING SUM(u.cantidad_producto) > 10  -- umbral de alto consumo
      ORDER BY total_consumido DESC
      LIMIT 10
    `)

    // ── 4. Recomendaciones de reabastecimiento ────────────────────────────
    const reabastecimiento = await pool.query(`
      SELECT
        p.id_producto,
        p.nombre,
        p.categoria,
        ip.cantidad        AS stock_actual,
        ip.stock_minimo,
        COALESCE(ip.stock_maximo, ip.stock_minimo * 3) AS stock_objetivo,
        GREATEST(0, COALESCE(ip.stock_maximo, ip.stock_minimo * 3) - ip.cantidad)
          AS cantidad_a_pedir,
        -- Último proveedor que lo surtió
        prov.nombre_empresa AS proveedor_sugerido,
        prov.email          AS email_proveedor,
        prov.telefono       AS telefono_proveedor,
        -- Precio unitario de la última orden
        oc.precio_unitario  AS precio_referencia
      FROM inventario_producto ip
      JOIN producto p ON p.id_producto = ip.id_producto
      LEFT JOIN (
        SELECT DISTINCT ON (oc.id_producto)
          oc.id_producto, oc.id_proveedor, oc.precio_unitario
        FROM orden_compra oc
        WHERE oc.estado != 'cancelada'
        ORDER BY oc.id_producto, oc.fecha DESC
      ) oc ON oc.id_producto = p.id_producto
      LEFT JOIN proveedor prov ON prov.id_proveedor = oc.id_proveedor
      WHERE p.activo = true
        AND ip.cantidad <= ip.stock_minimo
        AND GREATEST(0, COALESCE(ip.stock_maximo, ip.stock_minimo * 3) - ip.cantidad) > 0
      ORDER BY ip.cantidad ASC
    `)

    // ── 5. Resumen de totales para los badges ─────────────────────────────
    const totalAlertasProductos = bajoStockProductos.rows.length
    const totalAlertasInsumos   = bajoStockInsumos.rows.length
    const totalAltoConsumo      = altoConsumo.rows.length
    const totalReabastecimiento = reabastecimiento.rows.length
    const totalAlertas = totalAlertasProductos + totalAlertasInsumos

    return NextResponse.json({
      resumen: {
        total_alertas:     totalAlertas,
        bajo_stock_productos: totalAlertasProductos,
        bajo_stock_insumos:   totalAlertasInsumos,
        alto_consumo:         totalAltoConsumo,
        reabastecimiento:     totalReabastecimiento,
      },
      bajo_stock_productos: bajoStockProductos.rows,
      bajo_stock_insumos:   bajoStockInsumos.rows,
      alto_consumo:         altoConsumo.rows,
      reabastecimiento:     reabastecimiento.rows,
    })
  } catch (error) {
    console.error("[GET /api/alertas]", error)
    return NextResponse.json({ message: "Error interno" }, { status: 500 })
  }
}