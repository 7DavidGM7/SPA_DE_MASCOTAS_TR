// app/api/entregas/route.ts
// GET  /api/entregas          — listar entregas (con filtros)
// POST /api/entregas          — registrar entrega de insumos a un groomer

import { NextRequest, NextResponse } from "next/server"
import { Pool } from "pg"
import { verifyAccessToken } from "@/lib/auth"
import { registrarLog, getIP } from "@/lib/logger"

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

// ── GET /api/entregas ────────────────────────────────────────────────────────
// Query params opcionales:
//   ?id_groomer=1       → filtrar por groomer
//   ?id_cita=5          → filtrar por cita
//   ?estado=entregado   → filtrar por estado
//   ?fecha=YYYY-MM-DD   → filtrar por fecha de entrega
export async function GET(request: NextRequest) {
  const payload = await verificarToken(request)
  if (!payload) {
    return NextResponse.json({ message: "No autenticado" }, { status: 401 })
  }

  // Solo recepción, cajero, admin y groomer pueden ver entregas
  if (!["admin", "recepcionista", "cajero", "groomer"].includes(payload.rol)) {
    return NextResponse.json({ message: "No autorizado" }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const idGroomer = searchParams.get("id_groomer")
    const idCita    = searchParams.get("id_cita")
    const estado    = searchParams.get("estado")
    const fecha     = searchParams.get("fecha")

    // Si es groomer, solo puede ver sus propias entregas
    let groomerFiltro = idGroomer ? Number(idGroomer) : null
    if (payload.rol === "groomer") {
      const groomerRes = await pool.query(
        `SELECT g.id_trabajador
         FROM groomer g
         JOIN trabajador_spa ts ON ts.id_trabajador = g.id_trabajador
         WHERE ts.id_usuario = $1`,
        [Number(payload.userId)]
      )
      if (!groomerRes.rows[0]) {
        return NextResponse.json({ entregas: [] })
      }
      groomerFiltro = groomerRes.rows[0].id_trabajador
    }

    const result = await pool.query(
      `SELECT
         e.id_entrega,
         e.id_producto,
         p.nombre              AS nombre_producto,
         p.categoria,
         ip.cantidad           AS stock_actual,
         e.id_trabajador_groomer,
         u_g.nombre || ' ' || u_g.apellido AS nombre_groomer,
         e.id_cita,
         c.fecha_programada,
         c.hora_programada,
         e.cantidad_entregada,
         e.estado,
         e.fecha_entrega,
         e.notas,
         u_e.nombre || ' ' || u_e.apellido AS entregado_por
       FROM entrega_insumo e
       JOIN producto p ON p.id_producto = e.id_producto
       LEFT JOIN inventario_producto ip ON ip.id_producto = e.id_producto
       JOIN groomer g ON g.id_trabajador = e.id_trabajador_groomer
       JOIN trabajador_spa ts ON ts.id_trabajador = g.id_trabajador
       JOIN usuario u_g ON u_g.id_usuario = ts.id_usuario
       LEFT JOIN cita c ON c.id_cita = e.id_cita
       LEFT JOIN usuario u_e ON u_e.id_usuario = e.id_usuario_entrego
       WHERE ($1::int  IS NULL OR e.id_trabajador_groomer = $1)
         AND ($2::int  IS NULL OR e.id_cita = $2)
         AND ($3::text IS NULL OR e.estado = $3)
         AND ($4::date IS NULL OR e.fecha_entrega::date = $4)
       ORDER BY e.fecha_entrega DESC`,
      [groomerFiltro, idCita || null, estado || null, fecha || null]
    )

    return NextResponse.json({ entregas: result.rows })
  } catch (error) {
    console.error("[GET /api/entregas]", error)
    return NextResponse.json({ message: "Error interno" }, { status: 500 })
  }
}

// ── POST /api/entregas ───────────────────────────────────────────────────────
// Body esperado:
// {
//   id_trabajador_groomer: number,   ← groomer que recibe
//   id_cita: number,                 ← cita vinculada (opcional)
//   insumos: [                       ← lista de insumos a entregar
//     { id_producto: number, cantidad: number, notas?: string }
//   ]
// }
export async function POST(request: NextRequest) {
  const payload = await verificarToken(request)
  if (!payload) {
    return NextResponse.json({ message: "No autenticado" }, { status: 401 })
  }

  // Solo recepción y admin pueden entregar insumos
  if (!["admin", "recepcionista"].includes(payload.rol)) {
    return NextResponse.json(
      { message: "Solo recepción o admin pueden registrar entregas de insumos" },
      { status: 403 }
    )
  }

  const client = await pool.connect()
  try {
    const body = await request.json()
    const { id_trabajador_groomer, id_cita, insumos } = body

    // ── Validaciones básicas ──────────────────────────────────────────────
    if (!id_trabajador_groomer) {
      return NextResponse.json({ message: "El groomer receptor es requerido" }, { status: 400 })
    }
    if (!Array.isArray(insumos) || insumos.length === 0) {
      return NextResponse.json({ message: "Debes incluir al menos un insumo" }, { status: 400 })
    }

    // Verificar que el groomer existe
    const groomerRes = await pool.query(
      `SELECT g.id_trabajador, u.nombre || ' ' || u.apellido AS nombre
       FROM groomer g
       JOIN trabajador_spa ts ON ts.id_trabajador = g.id_trabajador
       JOIN usuario u ON u.id_usuario = ts.id_usuario
       WHERE g.id_trabajador = $1`,
      [id_trabajador_groomer]
    )
    if (!groomerRes.rows[0]) {
      return NextResponse.json({ message: "Groomer no encontrado" }, { status: 404 })
    }

    // Verificar que la cita existe (si se proporcionó)
    if (id_cita) {
      const citaRes = await pool.query(
        "SELECT id_cita, estado_reserva FROM cita WHERE id_cita = $1",
        [id_cita]
      )
      if (!citaRes.rows[0]) {
        return NextResponse.json({ message: "La cita no existe" }, { status: 404 })
      }
      if (!["confirmada", "en_proceso"].includes(citaRes.rows[0].estado_reserva)) {
        return NextResponse.json(
          { message: `La cita debe estar confirmada o en proceso para entregar insumos (estado actual: ${citaRes.rows[0].estado_reserva})` },
          { status: 409 }
        )
      }
    }

    // Verificar stock disponible para cada insumo ANTES de iniciar la transacción
    const erroresStock: string[] = []
    for (const item of insumos) {
      if (!item.id_producto || !item.cantidad || item.cantidad <= 0) {
        return NextResponse.json(
          { message: "Cada insumo debe tener id_producto y cantidad mayor a 0" },
          { status: 400 }
        )
      }

      const stockRes = await pool.query(
        `SELECT ip.cantidad AS stock, p.nombre
         FROM inventario_producto ip
         JOIN producto p ON p.id_producto = ip.id_producto
         WHERE ip.id_producto = $1`,
        [item.id_producto]
      )

      if (!stockRes.rows[0]) {
        erroresStock.push(`Producto #${item.id_producto} no tiene inventario registrado`)
        continue
      }

      const stockDisponible = parseFloat(stockRes.rows[0].stock)
      if (stockDisponible < item.cantidad) {
        erroresStock.push(
          `Stock insuficiente de "${stockRes.rows[0].nombre}": disponible ${stockDisponible}, solicitado ${item.cantidad}`
        )
      }
    }

    if (erroresStock.length > 0) {
      return NextResponse.json(
        { message: "Stock insuficiente", errores: erroresStock },
        { status: 409 }
      )
    }

    // ── Transacción: registrar entregas y descontar stock ─────────────────
    await client.query("BEGIN")

    const entregasCreadas: number[] = []

    for (const item of insumos) {
      // 1. Insertar en entrega_insumo
      const entregaRes = await client.query(
        `INSERT INTO entrega_insumo
           (id_producto, id_trabajador_groomer, id_cita, cantidad_entregada,
            estado, id_usuario_entrego, notas)
         VALUES ($1, $2, $3, $4, 'entregado', $5, $6)
         RETURNING id_entrega`,
        [
          item.id_producto,
          id_trabajador_groomer,
          id_cita || null,
          item.cantidad,
          Number(payload.userId),
          item.notas || null,
        ]
      )
      entregasCreadas.push(entregaRes.rows[0].id_entrega)

      // 2. Descontar del inventario
      await client.query(
        `UPDATE inventario_producto
         SET cantidad = cantidad - $1,
             ultima_actualizacion = NOW(),
             estado = CASE
               WHEN (cantidad - $1) <= 0         THEN 'agotado'
               WHEN (cantidad - $1) <= stock_minimo THEN 'bajo'
               ELSE 'disponible'
             END
         WHERE id_producto = $2`,
        [item.cantidad, item.id_producto]
      )
    }

    await client.query("COMMIT")

    // Log de auditoría
    await registrarLog({
      id_usuario: Number(payload.userId),
      accion: "ENTREGA_INSUMOS",
      entidad: "entrega_insumo",
      entidad_id: entregasCreadas[0],
      detalle: `Entregó ${insumos.length} insumo(s) al groomer #${id_trabajador_groomer}${id_cita ? ` para cita #${id_cita}` : ""}`,
      ip: getIP(request),
    })

    // Verificar si algún producto quedó en bajo stock para avisar
    const alertasRes = await pool.query(
      `SELECT p.nombre, ip.cantidad, ip.stock_minimo, ip.estado
       FROM inventario_producto ip
       JOIN producto p ON p.id_producto = ip.id_producto
       WHERE ip.id_producto = ANY($1::int[])
         AND ip.estado IN ('bajo', 'agotado')`,
      [insumos.map((i: any) => i.id_producto)]
    )

    return NextResponse.json(
      {
        message: `Entrega registrada: ${insumos.length} insumo(s) entregados al groomer ${groomerRes.rows[0].nombre}`,
        ids_entrega: entregasCreadas,
        alertas_stock: alertasRes.rows,  // productos que quedaron en bajo stock
      },
      { status: 201 }
    )
  } catch (error) {
    await client.query("ROLLBACK")
    console.error("[POST /api/entregas]", error)
    return NextResponse.json({ message: "Error interno al registrar la entrega" }, { status: 500 })
  } finally {
    client.release()
  }
}