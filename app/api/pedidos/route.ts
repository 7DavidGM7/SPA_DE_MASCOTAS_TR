// app/api/pedidos/route.ts
// CAMBIO respecto al original:
//   POST: después del COMMIT llama a notificarPedidoWA() para enviar
//   WhatsApp al cliente con el detalle de su pedido.
//   El pedido se registra igual aunque el WA falle.

import { NextRequest, NextResponse } from "next/server"
import { verifyAccessToken } from "@/lib/auth"
import { Pool } from "pg"
import { notificarPedidoWA } from "@/lib/whatsapp"   // ← NUEVO

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

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/pedidos
// ─────────────────────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const payload = await getPayload(request)
  if (!payload) return NextResponse.json({ message: "No autorizado" }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const estado  = searchParams.get("estado")
  const pagina  = Math.max(1, Number(searchParams.get("pagina") || "1"))
  const limite  = 15
  const offset  = (pagina - 1) * limite

  try {
    const conds: string[] = []
    const vals:  (string | number)[] = []
    let i = 1

    if (payload.rol === "cliente") {
      conds.push(`c.id_usuario_cliente = $${i++}`)
      vals.push(Number(payload.userId))
    }
    if (estado) { conds.push(`c.estado = $${i++}`); vals.push(estado) }

    const where = conds.length ? `WHERE ${conds.join(" AND ")}` : ""

    const [comprasRes, totalRes] = await Promise.all([
      pool.query(
        `SELECT
           c.id_compra, c.fecha, c.total, c.estado,
           c.descuento_aplicado, c.cupones_uso,
           u.nombre || ' ' || u.apellido AS nombre_cliente,
           u.email AS email_cliente, u.telefono AS telefono_cliente,
           COUNT(dc.id_detalle_compra)::int AS cantidad_items
         FROM compra c
         JOIN cliente cl ON cl.id_usuario_cliente = c.id_usuario_cliente
         JOIN usuario u  ON u.id_usuario = cl.id_usuario_cliente
         LEFT JOIN detalle_compra dc ON dc.id_compra = c.id_compra
         ${where}
         GROUP BY c.id_compra, u.nombre, u.apellido, u.email, u.telefono
         ORDER BY c.fecha DESC, c.id_compra DESC
         LIMIT $${i} OFFSET $${i + 1}`,
        [...vals, limite, offset]
      ),
      pool.query(
        `SELECT COUNT(DISTINCT c.id_compra)
         FROM compra c
         JOIN cliente cl ON cl.id_usuario_cliente = c.id_usuario_cliente
         JOIN usuario u  ON u.id_usuario = cl.id_usuario_cliente
         ${where}`,
        vals
      ),
    ])

    const ids = comprasRes.rows.map((r: any) => r.id_compra)
    let detalles: any[] = []
    if (ids.length > 0) {
      const detRes = await pool.query(
        `SELECT dc.id_compra, dc.id_producto, p.nombre AS nombre_producto,
                p.imagen_url, dc.cantidad, dc.precio_unitario, dc.subtotal
         FROM detalle_compra dc
         JOIN producto p ON p.id_producto = dc.id_producto
         WHERE dc.id_compra = ANY($1::int[])`,
        [ids]
      )
      detalles = detRes.rows
    }

    let cuponesUsados: any[] = []
    if (ids.length > 0) {
      const cupRes = await pool.query(
        `SELECT cu.id_compra, c.codigo, cu.descuento_monto
         FROM cupon_uso cu JOIN cupon c ON c.id_cupon = cu.id_cupon
         WHERE cu.id_compra = ANY($1::int[])`,
        [ids]
      )
      cuponesUsados = cupRes.rows
    }

    const compras = comprasRes.rows.map((c: any) => ({
      ...c,
      items: detalles.filter((d: any) => d.id_compra === c.id_compra),
      cupon: cuponesUsados.find((cu: any) => cu.id_compra === c.id_compra) ?? null,
    }))

    return NextResponse.json({
      compras,
      total: Number(totalRes.rows[0].count),
      pagina,
      totalPaginas: Math.ceil(Number(totalRes.rows[0].count) / limite),
    })
  } catch (error) {
    console.error("[pedidos GET]", error)
    return NextResponse.json({ message: "Error interno" }, { status: 500 })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/pedidos — cliente confirma carrito
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const payload = await getPayload(request)
  if (!payload || payload.rol !== "cliente")
    return NextResponse.json({ message: "Solo clientes pueden hacer pedidos" }, { status: 403 })

  const client = await pool.connect()
  try {
    const body = await request.json()
    const {
      items,
      cupon,
    }: {
      items: { id_producto: number; cantidad: number }[]
      cupon?: { id_cupon: number; codigo: string; descuento_calculado: number }
    } = body

    if (!items || items.length === 0)
      return NextResponse.json({ message: "El carrito está vacío" }, { status: 400 })

    const idCliente = Number(payload.userId)

    // Obtener datos del cliente (nombre + teléfono para WA)
    const clienteRes = await client.query(
      `SELECT u.nombre || ' ' || u.apellido AS nombre_cliente, u.telefono
       FROM usuario u WHERE u.id_usuario = $1`,
      [idCliente]
    )
    const datosCliente = clienteRes.rows[0]

    // Verificar stock y precios
    const productIds = items.map((i) => i.id_producto)
    const prodRes = await client.query(
      `SELECT p.id_producto, p.nombre, p.activo,
              pv.precio_venta,
              COALESCE(inv.cantidad, 0) AS stock_actual
       FROM producto p
       JOIN producto_venta pv ON pv.id_producto = p.id_producto
       LEFT JOIN inventario_producto inv ON inv.id_producto = p.id_producto
       WHERE p.id_producto = ANY($1::int[])`,
      [productIds]
    )

    const prodMap: Record<number, any> = {}
    for (const row of prodRes.rows) prodMap[row.id_producto] = row

    for (const item of items) {
      const prod = prodMap[item.id_producto]
      if (!prod)
        return NextResponse.json({ message: `Producto #${item.id_producto} no encontrado` }, { status: 404 })
      if (!prod.activo)
        return NextResponse.json({ message: `"${prod.nombre}" ya no está disponible` }, { status: 409 })
      if (prod.stock_actual < item.cantidad)
        return NextResponse.json(
          { message: `Stock insuficiente para "${prod.nombre}" (disponible: ${prod.stock_actual})` },
          { status: 409 }
        )
    }

    // Validar cupón si viene
    let descuentoFinal = 0
    if (cupon) {
      const cupCheck = await client.query(
        `SELECT * FROM cupon WHERE id_cupon = $1 AND codigo = $2 AND activo = TRUE`,
        [cupon.id_cupon, cupon.codigo]
      )
      if (cupCheck.rowCount === 0)
        return NextResponse.json({ message: "El cupón ya no es válido" }, { status: 409 })

      const c = cupCheck.rows[0]

      const yaUsado = await client.query(
        `SELECT COUNT(*) FROM cupon_uso WHERE id_cupon = $1 AND id_usuario_cliente = $2`,
        [c.id_cupon, idCliente]
      )
      if (Number(yaUsado.rows[0].count) > 0)
        return NextResponse.json({ message: "Ya usaste este cupón" }, { status: 409 })

      if (c.uso_maximo !== null && c.uso_actual >= c.uso_maximo)
        return NextResponse.json({ message: "El cupón alcanzó su límite de usos" }, { status: 409 })

      descuentoFinal = Math.round(cupon.descuento_calculado * 100) / 100
    }

    await client.query("BEGIN")

    // Calcular subtotal y armar líneas
    let subtotal = 0
    const lineas = items.map((item) => {
      const precio   = Number(prodMap[item.id_producto].precio_venta)
      const lineaSub = precio * item.cantidad
      subtotal += lineaSub
      return { ...item, precio_unitario: precio, subtotal: lineaSub }
    })

    const totalFinal = Math.max(0, subtotal - descuentoFinal)

    // Crear compra
    const compraRes = await client.query(
      `INSERT INTO compra (id_usuario_cliente, total, estado, fecha, descuento_aplicado, cupones_uso)
       VALUES ($1, $2, 'pendiente', CURRENT_DATE, $3, $4)
       RETURNING id_compra`,
      [idCliente, totalFinal, descuentoFinal, cupon ? 1 : 0]
    )
    const id_compra = compraRes.rows[0].id_compra

    // Insertar detalles
    for (const linea of lineas) {
      await client.query(
        `INSERT INTO detalle_compra (id_compra, id_producto, cantidad, precio_unitario, subtotal, fecha)
         VALUES ($1, $2, $3, $4, $5, CURRENT_DATE)`,
        [id_compra, linea.id_producto, linea.cantidad, linea.precio_unitario, linea.subtotal]
      )
    }

    // Descontar stock
    for (const item of items) {
      await client.query(
        `UPDATE inventario_producto
         SET cantidad = cantidad - $1,
             estado = CASE
               WHEN cantidad - $1 = 0            THEN 'agotado'
               WHEN cantidad - $1 <= stock_minimo THEN 'bajo'
               ELSE 'disponible'
             END,
             ultima_actualizacion = NOW()
         WHERE id_producto = $2`,
        [item.cantidad, item.id_producto]
      )
    }

    // Registrar uso de cupón
    if (cupon && descuentoFinal > 0) {
      await client.query(
        `INSERT INTO cupon_uso (id_cupon, id_usuario_cliente, id_compra, descuento_monto)
         VALUES ($1, $2, $3, $4)`,
        [cupon.id_cupon, idCliente, id_compra, descuentoFinal]
      )
      await client.query(
        `UPDATE cupon SET uso_actual = uso_actual + 1 WHERE id_cupon = $1`,
        [cupon.id_cupon]
      )
    }

    await client.query("COMMIT")

    // ── NUEVO: notificación WhatsApp al cliente ────────────────────────
    // Se llama DESPUÉS del COMMIT — si falla, el pedido ya quedó registrado
    if (datosCliente?.telefono) {
      const itemsWA = lineas.map((l) => ({
        nombre:   prodMap[l.id_producto].nombre,
        cantidad: l.cantidad,
        subtotal: l.subtotal,
      }))

      // No hacemos await para no bloquear la respuesta al cliente
      notificarPedidoWA({
        telefono:       datosCliente.telefono,
        nombre_cliente: datosCliente.nombre_cliente,
        id_compra,
        items:          itemsWA,
        total:          totalFinal,
        descuento:      descuentoFinal,
      }).then((r) => {
        if (!r.ok) console.warn(`[WhatsApp pedido #${id_compra}] ${r.error}`)
      })
    }
    // ─────────────────────────────────────────────────────────────────

    return NextResponse.json({
      message:  "Pedido registrado correctamente",
      id_compra,
      subtotal,
      descuento: descuentoFinal,
      total:     totalFinal,
    }, { status: 201 })

  } catch (error) {
    await client.query("ROLLBACK")
    console.error("[pedidos POST]", error)
    return NextResponse.json({ message: "Error interno al registrar el pedido" }, { status: 500 })
  } finally {
    client.release()
  }
}