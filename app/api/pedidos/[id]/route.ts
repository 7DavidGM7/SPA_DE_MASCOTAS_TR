// app/api/pedidos/[id]/route.ts
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

// PATCH /api/pedidos/[id]
// Body: { estado: "pagada"|"anulada"|"pendiente", metodo_pago?: string }
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const payload = await getPayload(request)
  if (!payload || !["admin", "cajero"].includes(payload.rol))
    return NextResponse.json({ message: "No autorizado" }, { status: 403 })

  const { id: rawId } = await params
  const id = Number(rawId)
  if (isNaN(id)) return NextResponse.json({ message: "ID inválido" }, { status: 400 })

  const client = await pool.connect()
  try {
    // ── FIX: leer metodo_pago además de estado ─────────────────────────────
    const { estado, metodo_pago = "efectivo" } = await request.json()

    const estadosValidos = ["pendiente", "pagada", "anulada"]
    if (!estadosValidos.includes(estado))
      return NextResponse.json({ message: "Estado inválido" }, { status: 400 })

    // Obtener datos de la compra antes de modificar
    const compraCheck = await client.query(
      `SELECT co.*, u.nombre || ' ' || u.apellido AS nombre_cliente
       FROM compra co
       JOIN usuario u ON u.id_usuario = co.id_usuario_cliente
       WHERE co.id_compra = $1`,
      [id]
    )
    if (compraCheck.rowCount === 0)
      return NextResponse.json({ message: "Pedido no encontrado" }, { status: 404 })

    const compra = compraCheck.rows[0]

    await client.query("BEGIN")

    // Si se anula → devolver stock
    if (estado === "anulada") {
      const detalles = await client.query(
        `SELECT id_producto, cantidad FROM detalle_compra WHERE id_compra = $1`, [id]
      )
      for (const row of detalles.rows) {
        await client.query(
          `UPDATE inventario_producto
           SET cantidad = cantidad + $1,
               estado = CASE
                 WHEN cantidad + $1 = 0           THEN 'agotado'
                 WHEN cantidad + $1 <= stock_minimo THEN 'bajo'
                 ELSE 'disponible'
               END,
               ultima_actualizacion = NOW()
           WHERE id_producto = $2`,
          [row.cantidad, row.id_producto]
        )
      }
    }

    // Si se marca como pagada → registrar pago en tablas financieras
    if (estado === "pagada") {
      const metodosValidos = ["efectivo","tarjeta_credito","tarjeta_debito","transferencia","qr"]
      const metodoFinal = metodosValidos.includes(metodo_pago) ? metodo_pago : "efectivo"

      // Obtener id del cajero
      const cajeroRes = await client.query(
        `SELECT c.id_cajero FROM cajero c
         JOIN trabajador_spa ts ON ts.id_trabajador = c.id_trabajador
         WHERE ts.id_usuario = $1`,
        [Number(payload.userId)]
      )
      const id_cajero = cajeroRes.rows[0]?.id_cajero ?? null

      // Obtener recepcionista para tabla pago
      const recepRes = await client.query(
        `SELECT id_trabajador FROM recepcionista LIMIT 1`
      )
      const id_recepcionista = recepRes.rows[0]?.id_trabajador ?? id_cajero

      if (id_recepcionista) {
        // Insertar en pago
        const pagoRes = await client.query(
          `INSERT INTO pago (id_recepcionista, metodo_pago, monto, estado, fecha)
           VALUES ($1, $2, $3, 'aprobado', CURRENT_DATE)
           RETURNING id_pago`,
          [id_recepcionista, metodoFinal, Number(compra.total)]
        )
        const id_pago = pagoRes.rows[0].id_pago

        // Insertar en registra_compra
        if (id_cajero) {
          await client.query(
            `INSERT INTO registra_compra (id_compra, id_cajero, fecha, observaciones)
             VALUES ($1, $2, NOW(), $3)`,
            [id, id_cajero, `Cobrado en caja — ${metodoFinal}`]
          )
        }
      }
    }

    // Actualizar estado de la compra
    await client.query(
      `UPDATE compra SET estado = $1 WHERE id_compra = $2`, [estado, id]
    )

    await client.query("COMMIT")
    return NextResponse.json({ message: `Pedido marcado como ${estado}` })
  } catch (error) {
    await client.query("ROLLBACK")
    console.error("[pedidos PATCH]", error)
    return NextResponse.json({ message: "Error interno" }, { status: 500 })
  } finally {
    client.release()
  }
}