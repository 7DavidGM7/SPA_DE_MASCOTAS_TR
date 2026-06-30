// app/api/recepcion/registrar/route.ts
// POST /api/recepcion/registrar — Recepción registra un cliente + mascota opcional
import { NextRequest, NextResponse } from "next/server"
import { Pool } from "pg"
import { verifyAccessToken } from "@/lib/auth"
import { hashPassword } from "@/lib/db"

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
})

async function verificarAuth(request: NextRequest) {
  const token =
    request.cookies.get("accessToken")?.value ??
    request.headers.get("authorization")?.replace("Bearer ", "")
  if (!token) return null
  const payload = await verifyAccessToken(token)
  if (!payload || !["admin", "recepcionista"].includes(payload.rol)) return null
  return payload
}

export async function POST(request: NextRequest) {
  const payload = await verificarAuth(request)
  if (!payload) return NextResponse.json({ message: "No autorizado" }, { status: 403 })

  const client = await pool.connect()
  try {
    const body = await request.json()
    const { cliente, mascota } = body

    // ── Validaciones cliente ──────────────────────────────────────────────
    const { ci, nombre, apellido, telefono, email, acepta_notificaciones } = cliente || {}
    if (!ci || !nombre || !apellido || !email) {
      return NextResponse.json(
        { message: "CI, nombre, apellido y email son requeridos" },
        { status: 400 }
      )
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json({ message: "Email inválido" }, { status: 400 })
    }

    // Verificar duplicados
    const emailExiste = await pool.query(
      "SELECT id_usuario FROM usuario WHERE email = $1", [email.toLowerCase()]
    )
    if (emailExiste.rows.length > 0)
      return NextResponse.json({ message: "Ese email ya está registrado" }, { status: 409 })

    const ciExiste = await pool.query(
      "SELECT id_usuario FROM usuario WHERE ci = $1", [ci]
    )
    if (ciExiste.rows.length > 0)
      return NextResponse.json({ message: "Ese CI ya está registrado" }, { status: 409 })

    await client.query("BEGIN")

    // ── Crear usuario con contraseña temporal (CI del cliente) ────────────
    const passwordTemporal = ci  // El cliente cambia su contraseña al primer login
    const { hash, salt } = hashPassword(passwordTemporal)

    const usuarioRes = await client.query(
      `INSERT INTO usuario
         (ci, nombre, apellido, email, telefono, password_hash, salt, estado, rol)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'activo', 'cliente')
       RETURNING id_usuario, nombre, apellido, email`,
      [ci, nombre.trim(), apellido.trim(), email.toLowerCase(),
       telefono?.trim() || null, hash, salt]
    )
    const nuevoUsuario = usuarioRes.rows[0]
    const idUsuario = nuevoUsuario.id_usuario

    // ── Crear registro en tabla cliente ───────────────────────────────────
    await client.query(
      `INSERT INTO cliente (id_usuario_cliente, acepta_notificaciones)
       VALUES ($1, $2)`,
      [idUsuario, acepta_notificaciones ?? true]
    )

    // ── Registrar mascota si viene en el body ─────────────────────────────
    let mascotaCreada = null
    if (mascota?.nombre && mascota?.especie && mascota?.tamanio) {
      const {
        nombre: nombreMascota, especie, raza, tamanio,
        fecha_nacimiento, peso_kg, color_pelaje,
        temperamento, observaciones_medicas
      } = mascota

      let edad = null
      if (fecha_nacimiento) {
        const nac = new Date(fecha_nacimiento)
        const hoy = new Date()
        edad = hoy.getFullYear() - nac.getFullYear()
        if (hoy.getMonth() < nac.getMonth() ||
           (hoy.getMonth() === nac.getMonth() && hoy.getDate() < nac.getDate())) edad--
        if (edad < 0) edad = 0
      }

      try {
        const mascotaRes = await client.query(
          `INSERT INTO mascota
             (id_usuario_cliente, nombre, especie, raza, tamanio,
              edad, peso_kg, color_pelaje, temperamento, observaciones_medicas, activa)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, TRUE)
           RETURNING id_mascota, nombre, especie, tamanio`,
          [idUsuario, nombreMascota.trim(), especie.toLowerCase(),
           raza?.trim() || null, tamanio.toLowerCase(), edad,
           peso_kg ? Number(peso_kg) : null, color_pelaje?.trim() || null,
           temperamento?.toLowerCase() || "tranquilo",
           observaciones_medicas?.trim() || null]
        )
        mascotaCreada = mascotaRes.rows[0]
      } catch (e: any) {
        // Si falla por temperamento (columna no existe), insertar sin ella
        if (e.code === "42703") {
          const mascotaRes = await client.query(
            `INSERT INTO mascota
               (id_usuario_cliente, nombre, especie, raza, tamanio,
                edad, peso_kg, color_pelaje, observaciones_medicas, activa)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, TRUE)
             RETURNING id_mascota, nombre, especie, tamanio`,
            [idUsuario, nombreMascota.trim(), especie.toLowerCase(),
             raza?.trim() || null, tamanio.toLowerCase(), edad,
             peso_kg ? Number(peso_kg) : null, color_pelaje?.trim() || null,
             observaciones_medicas?.trim() || null]
          )
          mascotaCreada = mascotaRes.rows[0]
        } else throw e
      }
    }

    // ── Log ───────────────────────────────────────────────────────────────
    await client.query(
      `INSERT INTO logs (id_usuario, accion, entidad, entidad_id, detalle)
       VALUES ($1, 'REGISTRAR_CLIENTE', 'usuario', $2, $3)`,
      [Number(payload.userId), idUsuario,
       `Recepción registró cliente: ${nombre} ${apellido} (${email})`]
    )

    await client.query("COMMIT")

    return NextResponse.json({
      message: "Cliente registrado exitosamente",
      cliente: {
        id_usuario: idUsuario,
        nombre: nuevoUsuario.nombre,
        apellido: nuevoUsuario.apellido,
        email: nuevoUsuario.email,
        password_temporal: ci,
      },
      mascota: mascotaCreada,
    }, { status: 201 })

  } catch (error: any) {
    await client.query("ROLLBACK")
    console.error("[POST /api/recepcion/registrar]", error)
    return NextResponse.json({ message: "Error interno al registrar" }, { status: 500 })
  } finally {
    client.release()
  }
}