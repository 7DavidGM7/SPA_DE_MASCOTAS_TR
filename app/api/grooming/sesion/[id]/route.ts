// app/api/grooming/sesion/[id]/route.ts
// CAMBIO respecto al original:
//   - accion === "cerrar": después del COMMIT inserta notificación
//     tipo 'grooming_listo' al cliente dueño de la mascota.
//   - Todo lo demás es idéntico al original.

import { NextRequest, NextResponse } from "next/server"
import { Pool } from "pg"
import { verifyAccessToken } from "@/lib/auth"

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
})

async function verificarAuth(request: NextRequest) {
  const token =
    request.cookies.get("accessToken")?.value ??
    request.headers.get("authorization")?.replace("Bearer ", "")
  if (!token) return null
  return await verifyAccessToken(token)
}

// ── GET ────────────────────────────────────────────────────────────────────
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const payload = await verificarAuth(request)
  if (!payload) return NextResponse.json({ message: "No autorizado" }, { status: 401 })

  const { id } = await context.params

  try {
    const sesionRes = await pool.query(
      `SELECT sg.*,
              c.id_cita, c.id_mascota, c.id_servicio, c.notas AS notas_cita,
              m.nombre AS nombre_mascota, m.especie, m.raza, m.tamanio,
              m.temperamento, m.observaciones_medicas,
              s.nombre AS nombre_servicio, s.duracion_base,
              u.nombre || ' ' || u.apellido AS nombre_groomer
       FROM sesion_grooming sg
       LEFT JOIN cita c ON c.id_sesion_grmm = sg.id_sesion_grmm
       LEFT JOIN mascota m ON m.id_mascota = c.id_mascota
       LEFT JOIN servicio s ON s.id_servicio = c.id_servicio
       LEFT JOIN trabajador_spa ts ON ts.id_trabajador = sg.id_trabajador_groomer
       LEFT JOIN usuario u ON u.id_usuario = ts.id_usuario
       WHERE sg.id_sesion_grmm = $1`,
      [id]
    )
    if (!sesionRes.rows[0])
      return NextResponse.json({ message: "Sesión no encontrada" }, { status: 404 })

    const sesion = sesionRes.rows[0]

    const fichaRes = await pool.query(
      "SELECT * FROM ficha_grooming WHERE id_sesion_grmm = $1 LIMIT 1", [id]
    )

    const checkRes = await pool.query(
      "SELECT * FROM checklist_grooming WHERE id_sesion_grmm = $1 ORDER BY tarea", [id]
    )

    const insumosRes = await pool.query(
      `SELECT u.*, p.nombre AS nombre_producto, p.categoria
       FROM usa u
       JOIN producto p ON p.id_producto = u.id_producto
       WHERE u.id_sesion_grmm = $1`,
      [id]
    )

    let entregasRes = { rows: [] as any[] }
    if (sesion.id_cita) {
      try {
        entregasRes = await pool.query(
          `SELECT
             e.id_entrega,
             e.id_producto,
             p.nombre              AS nombre_producto,
             p.categoria,
             e.cantidad_entregada,
             e.estado,
             e.fecha_entrega,
             e.notas               AS notas_entrega,
             u_e.nombre || ' ' || u_e.apellido AS entregado_por
           FROM entrega_insumo e
           JOIN producto p       ON p.id_producto = e.id_producto
           LEFT JOIN usuario u_e ON u_e.id_usuario = e.id_usuario_entrego
           WHERE e.id_cita = $1
             AND e.id_trabajador_groomer = $2
           ORDER BY e.fecha_entrega ASC`,
          [sesion.id_cita, sesion.id_trabajador_groomer]
        )
      } catch (e: any) {
        if (e.code !== "42P01") throw e
      }
    }

    return NextResponse.json({
      sesion,
      ficha:     fichaRes.rows[0] || null,
      checklist: checkRes.rows,
      insumos:   insumosRes.rows,
      entregas:  entregasRes.rows,
    })
  } catch (error) {
    console.error("[GET /api/grooming/sesion/:id]", error)
    return NextResponse.json({ message: "Error interno" }, { status: 500 })
  }
}

// ── PATCH ──────────────────────────────────────────────────────────────────
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const payload = await verificarAuth(request)
  if (!payload || !["groomer", "admin"].includes(payload.rol))
    return NextResponse.json({ message: "No autorizado" }, { status: 403 })

  const { id } = await context.params
  const body = await request.json()
  const { accion } = body

  const client = await pool.connect()
  try {
    await client.query("BEGIN")

    // ── Guardar/actualizar ficha técnica ────────────────────────────────
    if (accion === "guardar_ficha") {
      const {
        id_mascota, estado_mascota, nivel_estres,
        condicion_pelaje, condicion_piel, tipo_corte_realizado,
        foto_antes_url, foto_despues_url, recomendaciones_duenio,
        proxima_visita_sugerida
      } = body

      const fichaExiste = await client.query(
        "SELECT id_ficha FROM ficha_grooming WHERE id_sesion_grmm = $1", [id]
      )

      if (fichaExiste.rows[0]) {
        await client.query(
          `UPDATE ficha_grooming SET
             estado_mascota          = COALESCE($1, estado_mascota),
             nivel_estres            = COALESCE($2, nivel_estres),
             condicion_pelaje        = COALESCE($3, condicion_pelaje),
             condicion_piel          = COALESCE($4, condicion_piel),
             tipo_corte_realizado    = COALESCE($5, tipo_corte_realizado),
             foto_antes_url          = COALESCE($6, foto_antes_url),
             foto_despues_url        = COALESCE($7, foto_despues_url),
             recomendaciones_duenio  = COALESCE($8, recomendaciones_duenio),
             proxima_visita_sugerida = COALESCE($9, proxima_visita_sugerida)
           WHERE id_sesion_grmm = $10`,
          [estado_mascota, nivel_estres, condicion_pelaje, condicion_piel,
           tipo_corte_realizado, foto_antes_url, foto_despues_url,
           recomendaciones_duenio, proxima_visita_sugerida || null, id]
        )
      } else {
        await client.query(
          `INSERT INTO ficha_grooming
             (id_mascota, id_sesion_grmm, fecha, estado_mascota, nivel_estres,
              condicion_pelaje, condicion_piel, tipo_corte_realizado,
              foto_antes_url, foto_despues_url, recomendaciones_duenio, proxima_visita_sugerida)
           VALUES ($1, $2, CURRENT_DATE, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [id_mascota, id, estado_mascota || "relajado", nivel_estres || 1,
           condicion_pelaje || "bueno", condicion_piel || "normal",
           tipo_corte_realizado || null, foto_antes_url || null,
           foto_despues_url || null, recomendaciones_duenio || null,
           proxima_visita_sugerida || null]
        )
      }
      await client.query("COMMIT")
      return NextResponse.json({ message: "Ficha guardada" })
    }

    // ── Actualizar ítem del checklist ───────────────────────────────────
    if (accion === "checklist") {
      const { tarea, completada, observacion } = body
      await client.query(
        `UPDATE checklist_grooming
         SET completada = $1, observacion = $2
         WHERE id_sesion_grmm = $3 AND tarea = $4`,
        [completada, observacion || null, id, tarea]
      )
      await client.query("COMMIT")
      return NextResponse.json({ message: "Checklist actualizado" })
    }

    // ── Registrar insumo usado ──────────────────────────────────────────
    if (accion === "insumo") {
      const { id_producto, id_sala_servicio, cantidad, estado_producto } = body
      if (!id_producto || !id_sala_servicio)
        return NextResponse.json({ message: "id_producto e id_sala_servicio requeridos" }, { status: 400 })

      const stockRes = await client.query(
        "SELECT cantidad FROM inventario_producto WHERE id_producto = $1", [id_producto]
      )
      const stockActual = stockRes.rows[0]?.cantidad ?? 0
      if (stockActual < (cantidad || 1)) {
        await client.query("ROLLBACK")
        return NextResponse.json(
          { message: `Stock insuficiente. Disponible: ${stockActual}` },
          { status: 409 }
        )
      }

      await client.query(
        `INSERT INTO usa (id_sesion_grmm, id_sala_servicio, id_producto, cantidad_producto, estado_producto, fecha)
         VALUES ($1, $2, $3, $4, $5, CURRENT_DATE)`,
        [id, id_sala_servicio, id_producto, cantidad || 1, estado_producto || "lleno"]
      )

      await client.query(
        `UPDATE inventario_producto
         SET cantidad = cantidad - $1, ultima_actualizacion = NOW(),
             estado = CASE
               WHEN (cantidad - $1) <= 0            THEN 'agotado'
               WHEN (cantidad - $1) <= stock_minimo THEN 'bajo'
               ELSE 'disponible'
             END
         WHERE id_producto = $2`,
        [cantidad || 1, id_producto]
      )

      await client.query("COMMIT")
      return NextResponse.json({ message: "Insumo registrado y stock descontado" })
    }

    // ── Confirmar uso de insumo entregado por recepción ─────────────────
    if (accion === "confirmar_entrega") {
      const { id_entrega, estado } = body

      const estadosValidos = ["usado", "devuelto", "desperdiciado"]
      if (!id_entrega || !estadosValidos.includes(estado)) {
        await client.query("ROLLBACK")
        return NextResponse.json(
          { message: "id_entrega y estado (usado/devuelto/desperdiciado) son requeridos" },
          { status: 400 }
        )
      }

      const entregaRes = await client.query(
        `SELECT e.id_entrega, e.cantidad_entregada, e.id_producto, e.estado
         FROM entrega_insumo e
         JOIN sesion_grooming sg ON sg.id_sesion_grmm = $1
         WHERE e.id_entrega = $2
           AND e.id_trabajador_groomer = sg.id_trabajador_groomer`,
        [id, id_entrega]
      )

      if (!entregaRes.rows[0]) {
        await client.query("ROLLBACK")
        return NextResponse.json({ message: "Entrega no encontrada" }, { status: 404 })
      }

      const entrega = entregaRes.rows[0]

      if (estado === "devuelto") {
        await client.query(
          `UPDATE inventario_producto
           SET cantidad = cantidad + $1,
               ultima_actualizacion = NOW(),
               estado = CASE
                 WHEN (cantidad + $1) > stock_minimo THEN 'disponible'
                 ELSE estado
               END
           WHERE id_producto = $2`,
          [entrega.cantidad_entregada, entrega.id_producto]
        )
      }

      await client.query(
        "UPDATE entrega_insumo SET estado = $1 WHERE id_entrega = $2",
        [estado, id_entrega]
      )

      await client.query("COMMIT")
      return NextResponse.json({
        message: `Insumo marcado como "${estado}"${estado === "devuelto" ? " — stock repuesto" : ""}`,
      })
    }

    // ── Cerrar sesión ───────────────────────────────────────────────────
    if (accion === "cerrar") {
      const pendientesRes = await client.query(
        "SELECT COUNT(*) AS total FROM checklist_grooming WHERE id_sesion_grmm = $1 AND completada = FALSE",
        [id]
      )
      const pendientes = parseInt(pendientesRes.rows[0].total)
      if (pendientes > 0) {
        await client.query("ROLLBACK")
        return NextResponse.json(
          { message: `El checklist tiene ${pendientes} tarea(s) sin completar` },
          { status: 409 }
        )
      }

      await client.query(
        `UPDATE sesion_grooming
         SET estado = 'completada', hora_fin_real = $1
         WHERE id_sesion_grmm = $2`,
        [new Date().toTimeString().slice(0, 8), id]
      )

      await client.query(
        `UPDATE cita SET estado_reserva = 'completada'
         WHERE id_sesion_grmm = $1`,
        [id]
      )

      // ── NUEVO: notificación "grooming_listo" al cliente ───────────────
      // Obtenemos datos del cliente, mascota y recomendaciones del groomer
      const datosNotifRes = await client.query(
        `SELECT
           c.id_usuario_cliente,
           m.nombre       AS nombre_mascota,
           s.nombre       AS nombre_servicio,
           fg.recomendaciones_duenio,
           fg.proxima_visita_sugerida,
           u_g.nombre || ' ' || u_g.apellido AS nombre_groomer
         FROM sesion_grooming sg
         LEFT JOIN cita c     ON c.id_sesion_grmm = sg.id_sesion_grmm
         LEFT JOIN mascota m  ON m.id_mascota      = c.id_mascota
         LEFT JOIN servicio s ON s.id_servicio     = c.id_servicio
         LEFT JOIN ficha_grooming fg ON fg.id_sesion_grmm = sg.id_sesion_grmm
         LEFT JOIN trabajador_spa ts ON ts.id_trabajador = sg.id_trabajador_groomer
         LEFT JOIN usuario u_g ON u_g.id_usuario = ts.id_usuario
         WHERE sg.id_sesion_grmm = $1`,
        [id]
      )

      const datos = datosNotifRes.rows[0]

      if (datos?.id_usuario_cliente) {
        // Construir mensaje con recomendaciones si las hay
        const recomendacionTexto = datos.recomendaciones_duenio
          ? ` Recomendaciones del groomer: "${datos.recomendaciones_duenio}".`
          : ""
        const proximaVisitaTexto = datos.proxima_visita_sugerida
          ? ` Próxima visita sugerida: ${new Date(datos.proxima_visita_sugerida).toLocaleDateString("es-BO", { day: "numeric", month: "long" })}.`
          : ""

        await client.query(
          `INSERT INTO notificacion
             (id_usuario, tipo, titulo, mensaje, canal, entidad, entidad_id)
           VALUES ($1, 'grooming_listo', $2, $3, 'app', 'sesion_grooming', $4)`,
          [
            datos.id_usuario_cliente,
            `🐾 ¡${datos.nombre_mascota || "Tu mascota"} está lista para recoger!`,
            `El servicio de ${datos.nombre_servicio || "grooming"} de ${datos.nombre_mascota || "tu mascota"} ha finalizado. Puedes venir a recogerla cuando gustes.${recomendacionTexto}${proximaVisitaTexto} ¡Gracias por confiar en nosotros! 🌟`,
            Number(id),
          ]
        )
      }
      // ─────────────────────────────────────────────────────────────────

      await client.query("COMMIT")
      return NextResponse.json({ message: "Servicio finalizado. El cliente puede recoger a su mascota." })
    }

    await client.query("ROLLBACK")
    return NextResponse.json({ message: "Acción no reconocida" }, { status: 400 })

  } catch (error) {
    await client.query("ROLLBACK")
    console.error("[PATCH /api/grooming/sesion/:id]", error)
    return NextResponse.json({ message: "Error interno" }, { status: 500 })
  } finally {
    client.release()
  }
}
