// app/api/cupones/route.ts
import { NextRequest, NextResponse } from "next/server"
import { verifyAccessToken } from "@/lib/auth"
import { Pool } from "pg"

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
})

async function verificarPersonal(request: NextRequest) {
  const tokenCookie = request.cookies.get("accessToken")?.value
  const authHeader  = request.headers.get("authorization")
  const token = tokenCookie ?? (authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null)
  if (!token) return null
  const payload = await verifyAccessToken(token)
  if (!payload || !["admin", "cajero"].includes(payload.rol)) return null
  return payload
}

// GET /api/cupones?codigo=DESCUENTO20&monto_base=100&id_cliente=5
// Valida el cupón y retorna el descuento calculado
export async function GET(request: NextRequest) {
  const payload = await verificarPersonal(request)
  if (!payload) return NextResponse.json({ message: "No autorizado" }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const codigo     = searchParams.get("codigo")
  const montoBase  = parseFloat(searchParams.get("monto_base") || "0")
  const idCliente  = searchParams.get("id_cliente")

  if (!codigo) return NextResponse.json({ message: "Código de cupón requerido" }, { status: 400 })

  try {
    const cuponRes = await pool.query(
      `SELECT * FROM cupon
       WHERE UPPER(codigo) = UPPER($1)
         AND activo = TRUE
         AND fecha_inicio <= CURRENT_DATE
         AND (fecha_fin IS NULL OR fecha_fin >= CURRENT_DATE)`,
      [codigo]
    )

    if (!cuponRes.rows[0])
      return NextResponse.json({ valido: false, message: "Cupón no válido o expirado" }, { status: 200 })

    const cupon = cuponRes.rows[0]

    // Verificar límite de uso
    if (cupon.uso_maximo !== null && cupon.uso_actual >= cupon.uso_maximo)
      return NextResponse.json({ valido: false, message: "Cupón agotado" }, { status: 200 })

    // Verificar monto mínimo
    if (cupon.monto_minimo && montoBase < Number(cupon.monto_minimo))
      return NextResponse.json({
        valido: false,
        message: `Monto mínimo para este cupón: Bs. ${cupon.monto_minimo}`
      }, { status: 200 })

    // Verificar si es solo primera compra
    if (cupon.solo_primera_compra && idCliente) {
      const historialRes = await pool.query(
        `SELECT COUNT(*) FROM compra WHERE id_usuario_cliente = $1 AND estado = 'pagada'`,
        [Number(idCliente)]
      )
      if (Number(historialRes.rows[0].count) > 0)
        return NextResponse.json({
          valido: false,
          message: "Este cupón es solo para primera compra"
        }, { status: 200 })
    }

    // Verificar que el cliente no lo haya usado ya
    if (idCliente) {
      const yaUso = await pool.query(
        `SELECT 1 FROM cupon_uso WHERE id_cupon = $1 AND id_usuario_cliente = $2`,
        [cupon.id_cupon, Number(idCliente)]
      )
      if (yaUso.rows.length > 0)
        return NextResponse.json({ valido: false, message: "Ya usaste este cupón" }, { status: 200 })
    }

    // Calcular descuento
    const descuento = cupon.tipo === "porcentaje"
      ? (montoBase * Number(cupon.valor)) / 100
      : Math.min(Number(cupon.valor), montoBase) // descuento fijo no puede superar el total

    return NextResponse.json({
      valido: true,
      cupon: {
        id_cupon:    cupon.id_cupon,
        codigo:      cupon.codigo,
        descripcion: cupon.descripcion,
        tipo:        cupon.tipo,
        valor:       cupon.valor,
      },
      descuento_calculado: Math.round(descuento * 100) / 100,
      monto_final:         Math.max(0, Math.round((montoBase - descuento) * 100) / 100),
      message: `Cupón válido — descuento: Bs. ${descuento.toFixed(2)}`,
    })
  } catch (error) {
    console.error("[GET /api/cupones]", error)
    return NextResponse.json({ message: "Error interno" }, { status: 500 })
  }
}

// GET /api/cupones/lista — listar todos los cupones (para admin)
export async function POST(request: NextRequest) {
  const payload = await verificarPersonal(request)
  if (!payload || payload.rol !== "admin")
    return NextResponse.json({ message: "Solo admin puede crear cupones" }, { status: 403 })

  try {
    const body = await request.json()
    const {
      codigo, descripcion, tipo = "porcentaje", valor,
      fecha_inicio, fecha_fin, uso_maximo,
      solo_primera_compra = false, monto_minimo = 0,
    } = body

    if (!codigo || !valor)
      return NextResponse.json({ message: "Código y valor son requeridos" }, { status: 400 })

    if (tipo === "porcentaje" && (valor <= 0 || valor > 100))
      return NextResponse.json({ message: "El porcentaje debe ser entre 1 y 100" }, { status: 400 })

    const res = await pool.query(
      `INSERT INTO cupon (codigo, descripcion, tipo, valor, fecha_inicio, fecha_fin, uso_maximo, solo_primera_compra, monto_minimo)
       VALUES (UPPER($1), $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [codigo, descripcion || null, tipo, valor,
       fecha_inicio || new Date().toISOString().split("T")[0],
       fecha_fin || null, uso_maximo || null,
       solo_primera_compra, monto_minimo]
    )

    return NextResponse.json({ message: "Cupón creado exitosamente", cupon: res.rows[0] }, { status: 201 })
  } catch (error: any) {
    console.error("[POST /api/cupones]", error)
    if (error.code === "23505")
      return NextResponse.json({ message: "Ya existe un cupón con ese código" }, { status: 409 })
    return NextResponse.json({ message: "Error interno" }, { status: 500 })
  }
}