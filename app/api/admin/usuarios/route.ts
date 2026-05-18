// app/api/admin/usuarios/route.ts
import { NextRequest, NextResponse } from "next/server"
import { db, hashPassword } from "@/lib/db"
import { verifyAccessToken } from "@/lib/auth"
import { registrarLog, getIP } from "@/lib/logger"
import { Pool } from "pg"

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
})

// ── Auth: lee el token desde header Authorization (el frontend lo manda así) ──
async function verificarAdmin(request: NextRequest) {
  // Lee desde cookie (guardada por auth-context) O desde header Authorization
  const tokenCookie = request.cookies.get("accessToken")?.value
  const authHeader = request.headers.get("authorization")
  const tokenHeader = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null
  const token = tokenCookie ?? tokenHeader

  if (!token) return null
  const payload = await verifyAccessToken(token)
  if (!payload || payload.rol !== "admin") return null
  return payload
}

// ── GET: listar todos los usuarios con su rol detectado ──────────────────────
export async function GET(request: NextRequest) {
  const admin = await verificarAdmin(request)
  if (!admin) {
    return NextResponse.json({ message: "No autorizado" }, { status: 403 })
  }

  try {
    const result = await pool.query(`
      SELECT
        u.id_usuario,
        u.nombre,
        u.apellido,
        u.email,
        u.estado,
        u.fecha_registro,
        u.rol
      FROM usuario u
      ORDER BY u.fecha_registro DESC
    `)
    return NextResponse.json({ usuarios: result.rows }, { status: 200 })
  } catch (error) {
    console.error("[admin/usuarios GET]", error)
    return NextResponse.json({ message: "Error interno" }, { status: 500 })
  }
}

// ── POST: crear cuenta con inserción en cascada según rol ────────────────────
export async function POST(request: NextRequest) {
  const admin = await verificarAdmin(request)
  if (!admin) {
    return NextResponse.json({ message: "No autorizado" }, { status: 403 })
  }

  const client = await pool.connect()
  try {
    const body = await request.json()
    const {
      rol, ci, nombre, apellido, email, telefono, password,
      // trabajador_spa
      fecha_nacimiento, fecha_contrato, direccion,
      // recepcionista
      seguro_salud, asegurado, turno_recepcion,
      // groomer
      especialidad, anos_experiencia, certificaciones,
      // cajero
      turno_cajero, limite_descuento,
    } = body

    // ── Validaciones básicas ──────────────────────────────────────────────
    const rolesValidos = ["recepcionista", "cajero", "groomer", "cliente"]
    if (!rolesValidos.includes(rol)) {
      return NextResponse.json({ message: "Rol inválido" }, { status: 400 })
    }
    if (!ci || !nombre || !apellido || !email || !password) {
      return NextResponse.json({ message: "CI, nombre, apellido, email y contraseña son requeridos" }, { status: 400 })
    }
    if (password.length < 8) {
      return NextResponse.json({ message: "La contraseña debe tener al menos 8 caracteres" }, { status: 400 })
    }
    if (rol !== "cliente" && !fecha_contrato) {
      return NextResponse.json({ message: "La fecha de contrato es requerida para trabajadores" }, { status: 400 })
    }
    if (rol !== "cliente" && !direccion) {
      return NextResponse.json({ message: "La dirección es requerida para trabajadores" }, { status: 400 })
    }
    if (rol === "groomer" && !especialidad) {
      return NextResponse.json({ message: "La especialidad es requerida para groomer" }, { status: 400 })
    }

    const emailExiste = await db.usuarios.findByEmail(email)
    if (emailExiste) {
      return NextResponse.json({ message: "Ya existe una cuenta con ese correo" }, { status: 409 })
    }
    const ciExiste = await db.usuarios.findByCi(ci)
    if (ciExiste) {
      return NextResponse.json({ message: "Ya existe una cuenta con ese CI" }, { status: 409 })
    }

    // ── Transacción ───────────────────────────────────────────────────────
    await client.query("BEGIN")

    // 1. Insertar en usuario
    const { hash, salt } = hashPassword(password)
    const usuarioRes = await client.query(
      `INSERT INTO usuario (ci, nombre, apellido, email, telefono, password_hash, salt, estado, rol)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'activo', $8)
       RETURNING id_usuario`,
      [ci, nombre, apellido, email.toLowerCase(), telefono || null, hash, salt, rol]
    )
    const id_usuario = usuarioRes.rows[0].id_usuario

    // 2. Insertar en tabla específica según rol
    if (rol === "cliente") {
      await client.query(
        `INSERT INTO cliente (id_usuario_cliente, acepta_notificaciones)
         VALUES ($1, TRUE) ON CONFLICT (id_usuario_cliente) DO NOTHING`,
        [id_usuario]
      )
    } else {
      // Paso intermedio: trabajador_spa
      const trabajadorRes = await client.query(
        `INSERT INTO trabajador_spa (id_usuario, ci, fecha_nacimiento, fecha_contrato, direccion, estado)
         VALUES ($1, $2, $3, $4, $5, 'activo')
         RETURNING id_trabajador`,
        [id_usuario, ci, fecha_nacimiento || null, fecha_contrato, direccion]
      )
      const id_trabajador = trabajadorRes.rows[0].id_trabajador

      if (rol === "recepcionista") {
        await client.query(
          `INSERT INTO recepcionista (id_trabajador, seguro_salud, asegurado, turno)
           VALUES ($1, $2, $3, $4)`,
          [id_trabajador, seguro_salud || null, asegurado === true || asegurado === "true", turno_recepcion || "mañana"]
        )
      } else if (rol === "groomer") {
        await client.query(
          `INSERT INTO groomer (id_trabajador, especialidad, anos_experiencia, certificaciones)
           VALUES ($1, $2, $3, $4)`,
          [id_trabajador, especialidad, parseInt(anos_experiencia) || 0, certificaciones || null]
        )
      } else if (rol === "cajero") {
        await client.query(
          `INSERT INTO cajero (id_trabajador, turno, limite_descuento, activo)
           VALUES ($1, $2, $3, TRUE)`,
          [id_trabajador, turno_cajero || "mañana", parseFloat(limite_descuento) || 0]
        )
      }
    }

    await client.query("COMMIT")

     await registrarLog({
      id_usuario: Number(admin.userId),
      accion: "CREAR_USUARIO",
      entidad: rol,
      entidad_id: id_usuario,
      detalle: `Creó cuenta de ${rol}: ${nombre} ${apellido} (${email})`,
      ip: getIP(request),
    })
 

    return NextResponse.json(
      { message: `Cuenta de ${rol} creada exitosamente` },
      { status: 201 }
    )
  } catch (error) {
    await client.query("ROLLBACK")
    console.error("[admin/usuarios POST]", error)
    return NextResponse.json({ message: "Error interno al crear la cuenta" }, { status: 500 })
  } finally {
    client.release()
  }
}