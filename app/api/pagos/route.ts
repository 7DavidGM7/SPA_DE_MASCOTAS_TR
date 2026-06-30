// app/api/pagos/route.ts
// CAMBIOS respecto al original:
//   - POST: después del COMMIT, inserta notificación tipo 'pago_registrado' al cliente
//   - El resto del archivo es idéntico al original
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

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/pagos?fecha=YYYY-MM-DD
// ─────────────────────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const payload = await getPayload(request)
  if (!payload || !["admin", "cajero"].includes(payload.rol))
    return NextResponse.json({ message: "No autorizado" }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const fecha = searchParams.get("fecha") || new Date().toISOString().split("T")[0]

  try {
    const citasPendientesRes = await pool.query(
      `SELECT
         c.id_cita,
         c.fecha_programada,
         c.hora_programada,
         c.estado_reserva,
         u.nombre || ' ' || u.apellido AS nombre_cliente,
         u.telefono                     AS telefono_cliente,
         u.id_usuario                   AS id_usuario_cliente,
         cl.id_usuario_cliente          AS id_cliente_tabla,
         m.nombre   AS nombre_mascota,
         m.especie,
         s.nombre   AS nombre_servicio,
         s.precio   AS precio_servicio
       FROM cita c
       JOIN usuario u  ON u.id_usuario = c.id_usuario_cliente
       LEFT JOIN cliente cl ON cl.id_usuario_cliente = c.id_usuario_cliente
       LEFT JOIN mascota m  ON m.id_mascota  = c.id_mascota
       LEFT JOIN servicio s ON s.id_servicio = c.id_servicio
       WHERE c.fecha_programada = $1
         AND c.estado_reserva IN ('confirmada', 'completada')
         AND c.id_cita NOT IN (SELECT id_cita FROM cobra_cita)
       ORDER BY c.hora_programada`,
      [fecha]
    )

    const pedidosPendientesRes = await pool.query(
      `SELECT
         co.id_compra,
         co.total,
         co.descuento_aplicado,
         co.cupones_uso,
         co.fecha,
         co.estado,
         u.nombre || ' ' || u.apellido AS nombre_cliente,
         u.telefono                     AS telefono_cliente,
         u.email                        AS email_cliente,
         COUNT(dc.id_detalle_compra)::int AS cantidad_items
       FROM compra co
       JOIN usuario u  ON u.id_usuario = co.id_usuario_cliente
       LEFT JOIN detalle_compra dc ON dc.id_compra = co.id_compra
       WHERE co.estado = 'pendiente'
       GROUP BY co.id_compra, u.nombre, u.apellido, u.telefono, u.email
       ORDER BY co.fecha DESC, co.id_compra DESC`,
      []
    )

    const idsPedidos = pedidosPendientesRes.rows.map((r: any) => r.id_compra)
    let itemsPedidos: any[] = []
    if (idsPedidos.length > 0) {
      const itemsRes = await pool.query(
        `SELECT dc.id_compra, p.nombre AS nombre_producto,
                dc.cantidad, dc.precio_unitario, dc.subtotal
         FROM detalle_compra dc
         JOIN producto p ON p.id_producto = dc.id_producto
         WHERE dc.id_compra = ANY($1::int[])`,
        [idsPedidos]
      )
      itemsPedidos = itemsRes.rows
    }

    const pedidosPendientes = pedidosPendientesRes.rows.map((p: any) => ({
      ...p,
      items: itemsPedidos.filter((i: any) => i.id_compra === p.id_compra),
    }))

    const cobrosHoyRes = await pool.query(
      `SELECT
         cc.id_cobra,
         cc.monto_cobrado,
         cc.fecha,
         p.metodo_pago,
         p.estado      AS estado_pago,
         cc.id_cita,
         u.nombre || ' ' || u.apellido AS nombre_cliente,
         m.nombre      AS nombre_mascota,
         s.nombre      AS nombre_servicio,
         f.nro_factura,
         co.total      AS total_compra,
         COALESCE(co.descuento_aplicado, 0) AS descuento_aplicado
       FROM cobra_cita cc
       JOIN pago p     ON p.id_pago  = cc.id_pago
       JOIN cita c     ON c.id_cita  = cc.id_cita
       JOIN usuario u  ON u.id_usuario = c.id_usuario_cliente
       LEFT JOIN mascota m  ON m.id_mascota  = c.id_mascota
       LEFT JOIN servicio s ON s.id_servicio = c.id_servicio
       LEFT JOIN factura f  ON f.id_pago = p.id_pago
       LEFT JOIN compra co  ON co.id_cita = c.id_cita
       WHERE cc.fecha = $1
       ORDER BY cc.id_cobra DESC`,
      [fecha]
    )

    const totalesRes = await pool.query(
      `SELECT
         COUNT(*)::int                                          AS total_cobros,
         COALESCE(SUM(cc.monto_cobrado), 0)::numeric           AS total_monto,
         COALESCE(SUM(CASE WHEN p.metodo_pago='efectivo'        THEN cc.monto_cobrado ELSE 0 END),0)::numeric AS efectivo,
         COALESCE(SUM(CASE WHEN p.metodo_pago='qr'              THEN cc.monto_cobrado ELSE 0 END),0)::numeric AS qr,
         COALESCE(SUM(CASE WHEN p.metodo_pago='transferencia'   THEN cc.monto_cobrado ELSE 0 END),0)::numeric AS transferencia,
         COALESCE(SUM(CASE WHEN p.metodo_pago='tarjeta_credito' THEN cc.monto_cobrado ELSE 0 END),0)::numeric AS tarjeta_credito,
         COALESCE(SUM(CASE WHEN p.metodo_pago='tarjeta_debito'  THEN cc.monto_cobrado ELSE 0 END),0)::numeric AS tarjeta_debito
       FROM cobra_cita cc
       JOIN pago p ON p.id_pago = cc.id_pago
       WHERE cc.fecha = $1`,
      [fecha]
    )

    return NextResponse.json({
      fecha,
      citas_pendientes:   citasPendientesRes.rows,
      pedidos_pendientes: pedidosPendientes,
      cobros_hoy:         cobrosHoyRes.rows,
      totales:            totalesRes.rows[0],
    })
  } catch (error) {
    console.error("[pagos GET]", error)
    return NextResponse.json({ message: "Error interno" }, { status: 500 })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/pagos — registrar cobro de cita
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const payload = await getPayload(request)
  if (!payload || !["admin", "cajero"].includes(payload.rol))
    return NextResponse.json({ message: "No autorizado" }, { status: 403 })

  const client = await pool.connect()
  try {
    const body = await request.json()
    const {
      id_cita, metodo_pago, monto_cobrado,
      descuento_aplicado = 0, codigo_cupon,
      emitir_factura = false, datos_fiscales,
    } = body

    if (!id_cita || !metodo_pago || monto_cobrado == null)
      return NextResponse.json({ message: "Faltan campos requeridos" }, { status: 400 })

    const metodosValidos = ["efectivo","tarjeta_credito","tarjeta_debito","transferencia","qr"]
    if (!metodosValidos.includes(metodo_pago))
      return NextResponse.json({ message: "Método de pago inválido" }, { status: 400 })

    // Verificar cita — también traemos datos del cliente, mascota y servicio
    // para construir el mensaje de notificación
    const citaRes = await client.query(
      `SELECT
         c.*,
         u.nombre AS cliente_nombre,
         u.apellido AS cliente_apellido,
         u.telefono,
         u.id_usuario AS id_usuario_cliente,
         m.nombre AS nombre_mascota,
         s.nombre AS nombre_servicio
       FROM cita c
       JOIN usuario u ON u.id_usuario = c.id_usuario_cliente
       LEFT JOIN mascota m ON m.id_mascota = c.id_mascota
       LEFT JOIN servicio s ON s.id_servicio = c.id_servicio
       WHERE c.id_cita = $1`,
      [id_cita]
    )
    if (!citaRes.rows[0])
      return NextResponse.json({ message: "Cita no encontrada" }, { status: 404 })

    const cita = citaRes.rows[0]

    if (!["confirmada","completada"].includes(cita.estado_reserva))
      return NextResponse.json({ message: "La cita debe estar confirmada o completada" }, { status: 409 })

    const yaCobrada = await client.query(
      `SELECT id_cobra FROM cobra_cita WHERE id_cita = $1`, [id_cita]
    )
    if (yaCobrada.rows.length > 0)
      return NextResponse.json({ message: "Esta cita ya fue cobrada" }, { status: 409 })

    // Obtener cajero
    const cajeroRes = await client.query(
      `SELECT c.id_cajero FROM cajero c
       JOIN trabajador_spa ts ON ts.id_trabajador = c.id_trabajador
       WHERE ts.id_usuario = $1`,
      [Number(payload.userId)]
    )
    if (!cajeroRes.rows[0])
      return NextResponse.json({ message: "No se encontró el perfil de cajero" }, { status: 404 })

    const id_cajero = cajeroRes.rows[0].id_cajero

    const recepRes = await client.query(
      `SELECT id_trabajador FROM recepcionista LIMIT 1`
    )
    const id_recepcionista = recepRes.rows[0]?.id_trabajador ?? id_cajero

    await client.query("BEGIN")

    // Insertar pago
    const pagoRes = await client.query(
      `INSERT INTO pago (id_recepcionista, metodo_pago, monto, estado, fecha)
       VALUES ($1, $2, $3, 'aprobado', CURRENT_DATE)
       RETURNING id_pago`,
      [id_recepcionista, metodo_pago, monto_cobrado]
    )
    const id_pago = pagoRes.rows[0].id_pago

    // Insertar cobra_cita
    await client.query(
      `INSERT INTO cobra_cita (id_cita, id_cajero, id_pago, fecha, monto_cobrado)
       VALUES ($1, $2, $3, CURRENT_DATE, $4)`,
      [id_cita, id_cajero, id_pago, monto_cobrado]
    )

    // Marcar cita completada
    await client.query(
      `UPDATE cita SET estado_reserva = 'completada' WHERE id_cita = $1`,
      [id_cita]
    )

    // Factura si se solicita
    let nro_factura: string | null = null
    if (emitir_factura) {
      nro_factura = `FAC-${Date.now()}-${id_pago}`
      await client.query(
        `INSERT INTO factura (id_pago, nro_factura, total, estado, datos_fiscales, fecha_emision)
         VALUES ($1, $2, $3, 'emitida', $4, CURRENT_DATE)`,
        [id_pago, nro_factura, monto_cobrado, datos_fiscales || null]
      )
    }

    // ── NUEVO: notificación "pago_registrado" al cliente ─────────────────
    // Construir mensaje con los datos de la cita
    const metodoPagoLabel: Record<string, string> = {
      efectivo:        "efectivo",
      qr:              "QR",
      transferencia:   "transferencia",
      tarjeta_credito: "tarjeta de crédito",
      tarjeta_debito:  "tarjeta de débito",
    }
    const descuentoTexto = Number(descuento_aplicado) > 0
      ? ` (descuento de Bs. ${Number(descuento_aplicado).toFixed(2)} aplicado)`
      : ""
    const facturaTexto = nro_factura ? ` · Factura: ${nro_factura}` : ""

    await client.query(
      `INSERT INTO notificacion
         (id_usuario, tipo, titulo, mensaje, canal, entidad, entidad_id)
       VALUES ($1, 'pago_registrado', $2, $3, 'app', 'cita', $4)`,
      [
        cita.id_usuario_cliente,
        "✅ Pago registrado exitosamente",
        `Hemos recibido tu pago de Bs. ${Number(monto_cobrado).toFixed(2)} mediante ${metodoPagoLabel[metodo_pago] || metodo_pago}${descuentoTexto} por el servicio de ${cita.nombre_servicio || "grooming"} de ${cita.nombre_mascota || "tu mascota"}.${facturaTexto} ¡Gracias por tu preferencia! 🐾`,
        id_cita,
      ]
    )
    // ─────────────────────────────────────────────────────────────────────

    await client.query("COMMIT")

    return NextResponse.json({
      message:            "Pago registrado correctamente",
      id_pago,
      monto_cobrado,
      metodo_pago,
      descuento_aplicado,
      nro_factura,
    }, { status: 201 })

  } catch (error: any) {
    await client.query("ROLLBACK")
    console.error("[pagos POST]", error)
    return NextResponse.json({ message: error.message || "Error interno" }, { status: 500 })
  } finally {
    client.release()
  }
}