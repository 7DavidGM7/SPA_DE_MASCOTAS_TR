// app/api/pagos/cierre/route.ts
// MEJORAS respecto al original:
//   - Incluye pedidos de productos (compra sin id_cita) en los totales y detalle
//   - Agrega campo `tipo` en detalle ('servicio' | 'producto') para distinguir en el reporte
//   - Incluye pedidos_pendientes_productos en el resumen
import { NextRequest, NextResponse } from "next/server"
import { verifyAccessToken } from "@/lib/auth"
import { Pool } from "pg"

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
})

async function verificarCajero(request: NextRequest) {
  const tokenCookie = request.cookies.get("accessToken")?.value
  const authHeader  = request.headers.get("authorization")
  const token = tokenCookie ?? (authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null)
  if (!token) return null
  const payload = await verifyAccessToken(token)
  if (!payload || !["admin", "cajero"].includes(payload.rol)) return null
  return payload
}

export async function GET(request: NextRequest) {
  const payload = await verificarCajero(request)
  if (!payload) return NextResponse.json({ message: "No autorizado" }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const fecha = searchParams.get("fecha") || new Date().toISOString().split("T")[0]

  try {
    // ── 1. Cobros de CITAS (cobra_cita) ──────────────────────────────────
    const porMetodoCitas = await pool.query(`
      SELECT
        p.metodo_pago,
        COUNT(*)::int         AS cantidad,
        SUM(cc.monto_cobrado) AS total
      FROM cobra_cita cc
      JOIN pago p ON p.id_pago = cc.id_pago
      WHERE cc.fecha = $1
      GROUP BY p.metodo_pago
    `, [fecha])

    // ── 2. Cobros de PEDIDOS de productos (registra_compra + pago) ───────
    //    Los pedidos cobrados quedan en estado='pagada' en compra.
    //    El método de pago se registró en la tabla pago al hacer PATCH /api/pagos.
    const porMetodoPedidos = await pool.query(`
      SELECT
        p.metodo_pago,
        COUNT(*)::int         AS cantidad,
        SUM(comp.total)       AS total
      FROM compra comp
      JOIN registra_compra rc ON rc.id_compra = comp.id_compra
      JOIN cajero ca           ON ca.id_cajero  = rc.id_cajero
      -- El pago asociado se busca via pago: usamos el más reciente del mismo día
      LEFT JOIN LATERAL (
        SELECT p2.metodo_pago
        FROM pago p2
        WHERE p2.fecha = $1
          AND p2.monto = comp.total
          AND p2.estado = 'aprobado'
        ORDER BY p2.id_pago DESC
        LIMIT 1
      ) p ON true
      WHERE comp.estado  = 'pagada'
        AND comp.id_cita IS NULL
        AND comp.fecha   = $1
      GROUP BY p.metodo_pago
    `, [fecha])

    // ── 3. Combinar métodos ───────────────────────────────────────────────
    const metodosMap: Record<string, { cantidad: number; total: number }> = {}
    for (const row of [...porMetodoCitas.rows, ...porMetodoPedidos.rows]) {
      const m = row.metodo_pago || "efectivo"
      if (!metodosMap[m]) metodosMap[m] = { cantidad: 0, total: 0 }
      metodosMap[m].cantidad += Number(row.cantidad)
      metodosMap[m].total    += Number(row.total)
    }
    const porMetodo = Object.entries(metodosMap)
      .map(([metodo_pago, v]) => ({ metodo_pago, ...v }))
      .sort((a, b) => b.total - a.total)

    // ── 4. Resumen general ────────────────────────────────────────────────
    const resumenCitas = await pool.query(`
      SELECT
        COUNT(*)::int                                     AS cobros_citas,
        COALESCE(SUM(cc.monto_cobrado), 0)                AS total_citas,
        COALESCE(SUM(comp.descuento_aplicado), 0)         AS descuentos_citas,
        COUNT(f.id_factura)::int                          AS facturas_emitidas
      FROM cobra_cita cc
      JOIN pago p ON p.id_pago = cc.id_pago
      LEFT JOIN compra comp ON comp.id_cita = cc.id_cita AND comp.fecha = $1
      LEFT JOIN factura f   ON f.id_pago    = p.id_pago
      WHERE cc.fecha = $1
    `, [fecha])

    const resumenPedidos = await pool.query(`
      SELECT
        COUNT(*)::int                             AS cobros_pedidos,
        COALESCE(SUM(comp.total), 0)              AS total_pedidos,
        COALESCE(SUM(comp.descuento_aplicado), 0) AS descuentos_pedidos
      FROM compra comp
      WHERE comp.estado  = 'pagada'
        AND comp.id_cita IS NULL
        AND comp.fecha   = $1
    `, [fecha])

    const rc = resumenCitas.rows[0]
    const rp = resumenPedidos.rows[0]
    const totalBruto      = Number(rc.total_citas) + Number(rp.total_pedidos)
    const totalDescuentos = Number(rc.descuentos_citas) + Number(rp.descuentos_pedidos)

    const resumen = {
      total_transacciones: Number(rc.cobros_citas) + Number(rp.cobros_pedidos),
      cobros_citas:         Number(rc.cobros_citas),
      cobros_pedidos:       Number(rp.cobros_pedidos),
      total_bruto:          totalBruto,
      total_citas:          Number(rc.total_citas),
      total_pedidos:        Number(rp.total_pedidos),
      total_descuentos:     totalDescuentos,
      total_neto:           totalBruto,
      facturas_emitidas:    Number(rc.facturas_emitidas),
    }

    // ── 5. Detalle cobros de CITAS ────────────────────────────────────────
    const detalleCitas = await pool.query(`
      SELECT
        cc.id_cobra                             AS id,
        'servicio'                              AS tipo,
        cc.monto_cobrado,
        p.metodo_pago,
        c.hora_programada,
        u.nombre || ' ' || u.apellido           AS cliente,
        m.nombre                                AS mascota,
        s.nombre                                AS concepto,
        COALESCE(comp.descuento_aplicado, 0)    AS descuento_aplicado,
        f.nro_factura,
        TO_CHAR(cc.fecha, 'DD/MM/YYYY')         AS fecha_str
      FROM cobra_cita cc
      JOIN pago p    ON p.id_pago   = cc.id_pago
      JOIN cita c    ON c.id_cita   = cc.id_cita
      JOIN usuario u ON u.id_usuario = c.id_usuario_cliente
      LEFT JOIN mascota m  ON m.id_mascota  = c.id_mascota
      LEFT JOIN servicio s ON s.id_servicio = c.id_servicio
      LEFT JOIN compra comp ON comp.id_cita = c.id_cita AND comp.fecha = $1
      LEFT JOIN factura f   ON f.id_pago    = p.id_pago
      WHERE cc.fecha = $1
      ORDER BY cc.id_cobra
    `, [fecha])

    // ── 6. Detalle cobros de PEDIDOS ──────────────────────────────────────
    const detallePedidos = await pool.query(`
      SELECT
        comp.id_compra                            AS id,
        'producto'                                AS tipo,
        comp.total                                AS monto_cobrado,
        COALESCE(p2.metodo_pago, 'efectivo')      AS metodo_pago,
        NULL                                      AS hora_programada,
        u.nombre || ' ' || u.apellido             AS cliente,
        NULL                                      AS mascota,
        CONCAT(comp.id_compra::text, ' - pedido (', COUNT(dc.id_detalle_compra), ' prod.)') AS concepto,
        comp.descuento_aplicado,
        NULL                                      AS nro_factura,
        TO_CHAR(comp.fecha, 'DD/MM/YYYY')         AS fecha_str
      FROM compra comp
      JOIN cliente cl  ON cl.id_usuario_cliente = comp.id_usuario_cliente
      JOIN usuario u   ON u.id_usuario          = cl.id_usuario_cliente
      LEFT JOIN detalle_compra dc ON dc.id_compra = comp.id_compra
      LEFT JOIN LATERAL (
        SELECT p3.metodo_pago
        FROM pago p3
        WHERE p3.fecha  = $1
          AND p3.monto  = comp.total
          AND p3.estado = 'aprobado'
        ORDER BY p3.id_pago DESC
        LIMIT 1
      ) p2 ON true
      WHERE comp.estado  = 'pagada'
        AND comp.id_cita IS NULL
        AND comp.fecha   = $1
      GROUP BY comp.id_compra, comp.total, comp.descuento_aplicado,
               comp.fecha, u.nombre, u.apellido, p2.metodo_pago
      ORDER BY comp.id_compra
    `, [fecha])

    const detalle = [...detalleCitas.rows, ...detallePedidos.rows]
      .sort((a, b) => (a.hora_programada || "99:99").localeCompare(b.hora_programada || "99:99"))

    // ── 7. Pendientes del día ─────────────────────────────────────────────
    const pendientesCitas = await pool.query(`
      SELECT COUNT(*)::int AS pendientes_cobro
      FROM cita c
      WHERE c.fecha_programada = $1
        AND c.estado_reserva IN ('completada', 'confirmada')
        AND NOT EXISTS (SELECT 1 FROM cobra_cita cc WHERE cc.id_cita = c.id_cita)
    `, [fecha])

    const pendientesPedidos = await pool.query(`
      SELECT COUNT(*)::int AS pendientes_pedidos
      FROM compra
      WHERE estado  = 'pendiente'
        AND id_cita IS NULL
        AND fecha   = $1
    `, [fecha])

    return NextResponse.json({
      fecha,
      resumen,
      por_metodo:                porMetodo,
      detalle,
      pendientes_cobro:          pendientesCitas.rows[0].pendientes_cobro,
      pendientes_pedidos:        pendientesPedidos.rows[0].pendientes_pedidos,
    })
  } catch (error) {
    console.error("[GET /api/pagos/cierre]", error)
    return NextResponse.json({ message: "Error interno" }, { status: 500 })
  }
}