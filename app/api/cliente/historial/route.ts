// app/api/cliente/historial/route.ts
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

// GET /api/cliente/historial
// Devuelve: resumen, servicios con fichas+fotos, compras con cupones
export async function GET(request: NextRequest) {
  const payload = await getPayload(request)
  if (!payload || payload.rol !== "cliente")
    return NextResponse.json({ message: "No autorizado" }, { status: 403 })

  const idCliente = Number(payload.userId)

  try {
    // ── 1. RESUMEN GENERAL ───────────────────────────────────────────────
    const resumenRes = await pool.query(
      `SELECT
         COUNT(DISTINCT c.id_cita)::int                                   AS total_citas,
         COUNT(DISTINCT CASE WHEN c.estado_reserva = 'completada' THEN c.id_cita END)::int AS servicios_completados,
         COUNT(DISTINCT m.id_mascota)::int                                AS total_mascotas,
         COUNT(DISTINCT co.id_compra)::int                                AS total_compras,
         COALESCE(SUM(CASE WHEN co.estado = 'pagada' THEN co.total END), 0)::numeric AS gasto_total,
         COUNT(DISTINCT cu_uso.id_cupon)::int                             AS cupones_usados,
         MIN(c.fecha_programada)::text                                    AS primera_cita,
         MAX(CASE WHEN c.estado_reserva = 'completada'
           THEN c.fecha_programada END)::text                             AS ultima_visita
       FROM usuario u
       LEFT JOIN cita c     ON c.id_usuario_cliente = u.id_usuario
       LEFT JOIN mascota m  ON m.id_usuario_cliente = u.id_usuario AND m.activa = TRUE
       LEFT JOIN compra co  ON co.id_usuario_cliente = u.id_usuario
       LEFT JOIN cupon_uso cu_uso ON cu_uso.id_usuario_cliente = u.id_usuario
       WHERE u.id_usuario = $1`,
      [idCliente]
    )

    // ── 2. SERVICIOS COMPLETADOS CON FICHA Y FOTOS ───────────────────────
    const serviciosRes = await pool.query(
      `SELECT
         c.id_cita,
         c.fecha_programada::text,
         c.hora_programada::text,
         c.estado_reserva,
         s.nombre        AS nombre_servicio,
         s.precio        AS precio_servicio,
         m.nombre        AS nombre_mascota,
         m.especie,
         m.tamanio,
         u_gr.nombre || ' ' || u_gr.apellido AS nombre_groomer,
         -- Ficha técnica
         fg.condicion_pelaje,
         fg.condicion_piel,
         fg.tipo_corte_realizado,
         fg.estado_mascota,
         fg.nivel_estres,
         fg.foto_antes_url,
         fg.foto_despues_url,
         fg.recomendaciones_duenio,
         fg.proxima_visita_sugerida::text
       FROM cita c
       JOIN usuario u       ON u.id_usuario = c.id_usuario_cliente
       LEFT JOIN servicio s ON s.id_servicio = c.id_servicio
       LEFT JOIN mascota m  ON m.id_mascota  = c.id_mascota
       LEFT JOIN asigna a   ON a.id_cita = c.id_cita
       LEFT JOIN groomer g  ON g.id_trabajador = a.id_trabajador_groomer
       LEFT JOIN trabajador_spa ts ON ts.id_trabajador = g.id_trabajador
       LEFT JOIN usuario u_gr ON u_gr.id_usuario = ts.id_usuario
       LEFT JOIN sesion_grooming sg ON sg.id_sesion_grmm = c.id_sesion_grmm
       LEFT JOIN ficha_grooming fg  ON fg.id_sesion_grmm = sg.id_sesion_grmm
       WHERE c.id_usuario_cliente = $1
         AND c.estado_reserva = 'completada'
       ORDER BY c.fecha_programada DESC`,
      [idCliente]
    )

    // ── 3. GALERÍA: solo servicios con fotos ─────────────────────────────
    const galeriaRes = serviciosRes.rows.filter(
      (r: any) => r.foto_antes_url || r.foto_despues_url
    ).map((r: any) => ({
      id_cita:        r.id_cita,
      fecha:          r.fecha_programada,
      nombre_mascota: r.nombre_mascota,
      especie:        r.especie,
      nombre_servicio:r.nombre_servicio,
      nombre_groomer: r.nombre_groomer,
      foto_antes_url: r.foto_antes_url,
      foto_despues_url:r.foto_despues_url,
    }))

    // ── 4. COMPRAS Y CUPONES USADOS ───────────────────────────────────────
    const comprasRes = await pool.query(
      `SELECT
         co.id_compra,
         co.fecha::text,
         co.total,
         co.estado,
         co.descuento_aplicado,
         -- Cupón usado si aplica
         c_cup.codigo     AS cupon_codigo,
         c_cup.descripcion AS cupon_descripcion,
         c_cup.tipo       AS cupon_tipo,
         c_cup.valor      AS cupon_valor,
         cu.descuento_monto,
         -- Items
         COUNT(dc.id_detalle_compra)::int AS cantidad_items
       FROM compra co
       LEFT JOIN cupon_uso cu     ON cu.id_compra = co.id_compra
       LEFT JOIN cupon c_cup      ON c_cup.id_cupon = cu.id_cupon
       LEFT JOIN detalle_compra dc ON dc.id_compra = co.id_compra
       WHERE co.id_usuario_cliente = $1
       GROUP BY co.id_compra, co.fecha, co.total, co.estado,
                co.descuento_aplicado, c_cup.codigo, c_cup.descripcion,
                c_cup.tipo, c_cup.valor, cu.descuento_monto
       ORDER BY co.fecha DESC`,
      [idCliente]
    )

    // Items de cada compra
    const idsCompras = comprasRes.rows.map((r: any) => r.id_compra)
    let itemsCompras: any[] = []
    if (idsCompras.length > 0) {
      const itemsRes = await pool.query(
        `SELECT dc.id_compra, p.nombre AS nombre_producto,
                dc.cantidad, dc.precio_unitario, dc.subtotal
         FROM detalle_compra dc
         JOIN producto p ON p.id_producto = dc.id_producto
         WHERE dc.id_compra = ANY($1::int[])`,
        [idsCompras]
      )
      itemsCompras = itemsRes.rows
    }

    const compras = comprasRes.rows.map((c: any) => ({
      ...c,
      items: itemsCompras.filter((i: any) => i.id_compra === c.id_compra),
    }))

    // ── 5. CUPONES DISPONIBLES (activos, no usados por este cliente) ──────
    const cuponesDispRes = await pool.query(
      `SELECT
         cu.id_cupon, cu.codigo, cu.descripcion, cu.tipo, cu.valor,
         cu.fecha_fin, cu.monto_minimo, cu.solo_primera_compra,
         cu.uso_maximo, cu.uso_actual
       FROM cupon cu
       WHERE cu.activo = TRUE
         AND (cu.fecha_fin IS NULL OR cu.fecha_fin >= CURRENT_DATE)
         AND (cu.uso_maximo IS NULL OR cu.uso_actual < cu.uso_maximo)
         AND cu.id_cupon NOT IN (
           SELECT id_cupon FROM cupon_uso WHERE id_usuario_cliente = $1
         )
       ORDER BY cu.fecha_fin ASC NULLS LAST`,
      [idCliente]
    )

    return NextResponse.json({
      resumen:            resumenRes.rows[0] ?? null,
      servicios:          serviciosRes.rows,
      galeria:            galeriaRes,
      compras,
      cupones_disponibles: cuponesDispRes.rows,
    })
  } catch (error) {
    console.error("[cliente/historial GET]", error)
    return NextResponse.json({ message: "Error interno" }, { status: 500 })
  }
}