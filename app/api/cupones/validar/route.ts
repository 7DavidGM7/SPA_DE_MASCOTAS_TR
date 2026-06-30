// app/api/cupones/validar/route.ts
//
// POST /api/cupones/validar
// Accesible por CUALQUIER usuario autenticado (cliente, cajero, admin).
// Body: { codigo: string, subtotal: number }
// Retorna: { valido, cupon?, descuento_calculado?, total_con_descuento?, message }
//
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

export async function POST(request: NextRequest) {
  // Cualquier usuario autenticado puede validar un cupón
  const payload = await getPayload(request)
  if (!payload) return NextResponse.json({ message: "No autorizado" }, { status: 403 })

  try {
    const body = await request.json()
    const { codigo, subtotal = 0 } = body as { codigo: string; subtotal: number }

    if (!codigo?.trim())
      return NextResponse.json({ valido: false, message: "Código de cupón requerido" }, { status: 400 })

    const idCliente = Number(payload.userId)

    // Buscar cupón activo y vigente
    const cuponRes = await pool.query(
      `SELECT * FROM cupon
       WHERE UPPER(codigo) = UPPER($1)
         AND activo = TRUE
         AND fecha_inicio <= CURRENT_DATE
         AND (fecha_fin IS NULL OR fecha_fin >= CURRENT_DATE)`,
      [codigo.trim()]
    )

    if (!cuponRes.rows[0])
      return NextResponse.json({ valido: false, message: "Cupón no válido o expirado" })

    const cupon = cuponRes.rows[0]

    // Límite global de usos
    if (cupon.uso_maximo !== null && cupon.uso_actual >= cupon.uso_maximo)
      return NextResponse.json({ valido: false, message: "Este cupón ya alcanzó su límite de usos" })

    // Monto mínimo de compra
    if (cupon.monto_minimo && subtotal < Number(cupon.monto_minimo))
      return NextResponse.json({
        valido: false,
        message: `El monto mínimo para este cupón es Bs. ${Number(cupon.monto_minimo).toFixed(2)}`,
      })

    // Solo primera compra
    if (cupon.solo_primera_compra) {
      const histRes = await pool.query(
        `SELECT COUNT(*) FROM compra WHERE id_usuario_cliente = $1 AND estado = 'pagada'`,
        [idCliente]
      )
      if (Number(histRes.rows[0].count) > 0)
        return NextResponse.json({ valido: false, message: "Este cupón es exclusivo para la primera compra" })
    }

    // El cliente ya usó este cupón
    const yaUso = await pool.query(
      `SELECT 1 FROM cupon_uso WHERE id_cupon = $1 AND id_usuario_cliente = $2`,
      [cupon.id_cupon, idCliente]
    )
    if (yaUso.rows.length > 0)
      return NextResponse.json({ valido: false, message: "Ya usaste este cupón anteriormente" })

    // Calcular descuento
    const descuento = cupon.tipo === "porcentaje"
      ? (subtotal * Number(cupon.valor)) / 100
      : Math.min(Number(cupon.valor), subtotal)

    const descuentoRedondeado   = Math.round(descuento * 100) / 100
    const totalConDescuento     = Math.max(0, Math.round((subtotal - descuento) * 100) / 100)

    return NextResponse.json({
      valido: true,
      id_cupon:             cupon.id_cupon,
      codigo:               cupon.codigo,
      descripcion:          cupon.descripcion ?? "",
      tipo:                 cupon.tipo,
      valor:                cupon.valor,
      descuento_calculado:  descuentoRedondeado,
      total_con_descuento:  totalConDescuento,
      message: `Cupón aplicado — descuento: Bs. ${descuentoRedondeado.toFixed(2)}`,
    })
  } catch (error) {
    console.error("[POST /api/cupones/validar]", error)
    return NextResponse.json({ message: "Error interno" }, { status: 500 })
  }
}