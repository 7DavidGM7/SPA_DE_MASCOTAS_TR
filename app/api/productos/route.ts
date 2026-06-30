// app/api/productos/route.ts
import { NextRequest, NextResponse } from "next/server"
import { verifyAccessToken } from "@/lib/auth"
import { Pool } from "pg"

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
})

// Cualquier usuario autenticado (cliente, cajero, admin, etc.)
async function verificarAuth(request: NextRequest) {
  const tokenCookie = request.cookies.get("accessToken")?.value
  const authHeader  = request.headers.get("authorization")
  const token = tokenCookie ?? (authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null)
  if (!token) return null
  return await verifyAccessToken(token)
}

// Solo cajero / admin (para POST)
async function verificarPersonal(request: NextRequest) {
  const payload = await verificarAuth(request)
  if (!payload || !["admin", "cajero"].includes(payload.rol)) return null
  return payload
}

// GET /api/productos?categoria=&buscar=&pagina=&soloActivos=
// Accesible por cualquier usuario logueado.
// El cliente solo ve productos activos con stock > 0.
// El cajero/admin ve todos (incluidos inactivos).
export async function GET(request: NextRequest) {
  const payload = await verificarAuth(request)
  if (!payload) return NextResponse.json({ message: "No autorizado" }, { status: 403 })

  const esCliente = payload.rol === "cliente"

  try {
    const { searchParams } = new URL(request.url)
    const categoria = searchParams.get("categoria")
    const buscar    = searchParams.get("buscar")
    const pagina    = Math.max(1, Number(searchParams.get("pagina") || "1"))
    const limite    = 12
    const offset    = (pagina - 1) * limite

    const conds: string[] = []
    const vals: (string | number)[] = []
    let i = 1

    // Clientes solo ven productos activos
    if (esCliente) {
      conds.push(`p.activo = TRUE`)
    }

    if (categoria) { conds.push(`p.categoria = $${i++}`); vals.push(categoria) }
    if (buscar)    { conds.push(`p.nombre ILIKE $${i++}`); vals.push(`%${buscar}%`) }

    const where = conds.length ? `WHERE ${conds.join(" AND ")}` : ""

    const [prodRes, totalRes] = await Promise.all([
      pool.query(
        `SELECT
           p.id_producto, p.nombre, p.descripcion, p.categoria, p.activo, p.imagen_url,
           COALESCE(pv.precio_venta, 0)       AS precio_venta,
           COALESCE(pv.precio_costo, 0)       AS precio_costo,
           pv.presentacion, pv.marca, pv.codigo_barras,
           COALESCE(inv.cantidad, 0)           AS stock_actual,
           COALESCE(inv.stock_minimo, 5)       AS stock_minimo,
           COALESCE(inv.estado, 'disponible')  AS estado_stock
         FROM producto p
         LEFT JOIN producto_venta pv      ON pv.id_producto  = p.id_producto
         LEFT JOIN inventario_producto inv ON inv.id_producto = p.id_producto
         ${where}
         ORDER BY p.nombre
         LIMIT $${i} OFFSET $${i + 1}`,
        [...vals, limite, offset]
      ),
      pool.query(
        `SELECT COUNT(*) FROM producto p ${where}`,
        vals
      ),
    ])

    return NextResponse.json({
      productos:    prodRes.rows,
      total:        Number(totalRes.rows[0].count),
      pagina,
      totalPaginas: Math.ceil(Number(totalRes.rows[0].count) / limite),
    })
  } catch (error) {
    console.error("[productos GET]", error)
    return NextResponse.json({ message: "Error interno" }, { status: 500 })
  }
}

// POST /api/productos — crear nuevo producto (solo cajero/admin)
export async function POST(request: NextRequest) {
  const personal = await verificarPersonal(request)
  if (!personal) return NextResponse.json({ message: "No autorizado" }, { status: 403 })

  const client = await pool.connect()
  try {
    const body = await request.json()
    const {
      nombre, descripcion, categoria, imagen_url,
      precio_venta, precio_costo, presentacion, marca, codigo_barras,
      stock_inicial = 0, stock_minimo = 5,
    } = body

    if (!nombre || !categoria)
      return NextResponse.json({ message: "Nombre y categoría son requeridos" }, { status: 400 })
    if (precio_venta == null || precio_costo == null)
      return NextResponse.json({ message: "Precio de venta y costo son requeridos" }, { status: 400 })

    await client.query("BEGIN")

    const prodRes = await client.query(
      `INSERT INTO producto (nombre, descripcion, categoria, activo, imagen_url)
       VALUES ($1, $2, $3, TRUE, $4) RETURNING id_producto`,
      [nombre, descripcion || null, categoria, imagen_url || null]
    )
    const id = prodRes.rows[0].id_producto

    await client.query(
      `INSERT INTO producto_venta (id_producto, precio_venta, precio_costo, presentacion, marca, codigo_barras)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [id, precio_venta, precio_costo, presentacion || null, marca || null, codigo_barras || null]
    )

    const estadoInicial = Number(stock_inicial) === 0 ? "agotado"
      : Number(stock_inicial) <= Number(stock_minimo) ? "bajo" : "disponible"

    await client.query(
      `INSERT INTO inventario_producto (id_producto, cantidad, stock_minimo, estado)
       VALUES ($1, $2, $3, $4)`,
      [id, stock_inicial, stock_minimo, estadoInicial]
    )

    await client.query("COMMIT")
    return NextResponse.json({ message: "Producto creado exitosamente", id_producto: id }, { status: 201 })
  } catch (error: any) {
    await client.query("ROLLBACK")
    console.error("[productos POST]", error)
    if (error.code === "23505")
      return NextResponse.json({ message: "El código de barras ya está registrado" }, { status: 409 })
    return NextResponse.json({ message: "Error interno al crear el producto" }, { status: 500 })
  } finally {
    client.release()
  }
}