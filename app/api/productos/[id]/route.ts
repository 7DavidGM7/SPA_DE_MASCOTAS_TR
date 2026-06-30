// app/api/productos/[id]/route.ts
import { NextRequest, NextResponse } from "next/server"
import { verifyAccessToken } from "@/lib/auth"
import { Pool } from "pg"

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
})

async function verificarPersonal(request: NextRequest) {
  const tokenCookie = request.cookies.get("accessToken")?.value
  const authHeader = request.headers.get("authorization")
  const token = tokenCookie ?? (authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null)
  if (!token) return null
  const payload = await verifyAccessToken(token)
  if (!payload || !["admin", "cajero"].includes(payload.rol)) return null
  return payload
}

// PATCH /api/productos/[id] — editar producto
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const personal = await verificarPersonal(request)
  if (!personal) return NextResponse.json({ message: "No autorizado" }, { status: 403 })

  const client = await pool.connect()
  try {
    const { id: rawId } = await params          // ← FIX: await params
    const id = Number(rawId)
    if (isNaN(id)) return NextResponse.json({ message: "ID inválido" }, { status: 400 })

    const body = await request.json()
    const {
      nombre, descripcion, categoria, imagen_url, activo,
      precio_venta, precio_costo, presentacion, marca, codigo_barras,
      stock_actual, stock_minimo,
    } = body

    await client.query("BEGIN")

    // Actualizar producto base
    if (nombre || descripcion !== undefined || categoria || imagen_url !== undefined || activo !== undefined) {
      const sets: string[] = []
      const vals: (string | boolean | null)[] = []
      let i = 1
      if (nombre)                    { sets.push(`nombre=$${i++}`);      vals.push(nombre) }
      if (descripcion !== undefined) { sets.push(`descripcion=$${i++}`); vals.push(descripcion) }
      if (categoria)                 { sets.push(`categoria=$${i++}`);   vals.push(categoria) }
      if (imagen_url !== undefined)  { sets.push(`imagen_url=$${i++}`);  vals.push(imagen_url) }
      if (activo !== undefined)      { sets.push(`activo=$${i++}`);      vals.push(activo) }
      if (sets.length) {
        await client.query(
          `UPDATE producto SET ${sets.join(", ")} WHERE id_producto=$${i}`,
          [...vals, id]
        )
      }
    }

    // Actualizar precio/venta (upsert)
    if (precio_venta != null || precio_costo != null || presentacion || marca || codigo_barras !== undefined) {
      await client.query(
        `INSERT INTO producto_venta (id_producto, precio_venta, precio_costo, presentacion, marca, codigo_barras)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (id_producto) DO UPDATE SET
           precio_venta  = COALESCE(EXCLUDED.precio_venta, producto_venta.precio_venta),
           precio_costo  = COALESCE(EXCLUDED.precio_costo, producto_venta.precio_costo),
           presentacion  = COALESCE(EXCLUDED.presentacion, producto_venta.presentacion),
           marca         = COALESCE(EXCLUDED.marca, producto_venta.marca),
           codigo_barras = COALESCE(EXCLUDED.codigo_barras, producto_venta.codigo_barras)`,
        [id, precio_venta || null, precio_costo || null, presentacion || null, marca || null, codigo_barras ?? null]
      )
    }

    // Actualizar inventario (upsert)
    if (stock_actual != null || stock_minimo != null) {
      const newStock = stock_actual != null ? Number(stock_actual) : null
      const newMin   = stock_minimo != null ? Number(stock_minimo) : 5
      const estado = newStock === 0 ? "agotado" : newStock != null && newStock <= newMin ? "bajo" : "disponible"

      await client.query(
        `INSERT INTO inventario_producto (id_producto, cantidad, stock_minimo, estado, ultima_actualizacion)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (id_producto) DO UPDATE SET
           cantidad             = COALESCE($2, inventario_producto.cantidad),
           stock_minimo         = COALESCE($3, inventario_producto.stock_minimo),
           estado               = $4,
           ultima_actualizacion = NOW()`,
        [id, newStock, newMin, estado]
      )
    }

    await client.query("COMMIT")
    return NextResponse.json({ message: "Producto actualizado correctamente" })
  } catch (error: any) {
    await client.query("ROLLBACK")
    console.error("[productos PATCH]", error)
    if (error.code === "23505")
      return NextResponse.json({ message: "El código de barras ya existe" }, { status: 409 })
    return NextResponse.json({ message: "Error interno" }, { status: 500 })
  } finally {
    client.release()
  }
}

// DELETE /api/productos/[id] — desactivar (soft delete)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const personal = await verificarPersonal(request)
  if (!personal) return NextResponse.json({ message: "No autorizado" }, { status: 403 })

  try {
    const { id: rawId } = await params          // ← FIX: await params
    const id = Number(rawId)
    if (isNaN(id)) return NextResponse.json({ message: "ID inválido" }, { status: 400 })

    await pool.query(
      "UPDATE producto SET activo = FALSE WHERE id_producto = $1",
      [id]
    )
    return NextResponse.json({ message: "Producto desactivado" })
  } catch (error) {
    console.error("[productos DELETE]", error)
    return NextResponse.json({ message: "Error interno" }, { status: 500 })
  }
}