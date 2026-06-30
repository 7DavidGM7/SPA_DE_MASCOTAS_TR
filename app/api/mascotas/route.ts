// app/api/mascotas/route.ts
// GET  /api/mascotas — Lista mascotas del cliente autenticado
// POST /api/mascotas — Registra una nueva mascota
import { NextRequest, NextResponse } from "next/server"
import { Pool } from "pg"
import { verifyAccessToken } from "@/lib/auth"

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
})

// Mismo helper que usan tus otras APIs existentes
async function verificarToken(request: NextRequest) {
  const tokenCookie = request.cookies.get("accessToken")?.value        // ← nombre real
  const authHeader = request.headers.get("authorization")
  const tokenHeader = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null
  const token = tokenCookie ?? tokenHeader
  if (!token) return null
  return await verifyAccessToken(token)
}

export async function GET(request: NextRequest) {
  try {
    const payload = await verificarToken(request)
    if (!payload) {
      return NextResponse.json({ message: "No autenticado" }, { status: 401 })
    }

    // El JWT guarda el id como STRING en el campo "userId" (ver lib/auth.ts)
    const idUsuarioLogueado = Number(payload.userId)

    // Admins y recepción pueden ver mascotas de cualquier cliente con ?id_cliente=X
    const { searchParams } = new URL(request.url)
    const idClienteParam = searchParams.get("id_cliente")

    let idClienteFinal: number

    if (idClienteParam && ["admin", "recepcionista"].includes(payload.rol)) {
      idClienteFinal = Number(idClienteParam)
    } else {
      idClienteFinal = idUsuarioLogueado           // ← era payload.id_usuario (no existe)
    }

    const result = await pool.query(
      `SELECT
         m.id_mascota,
         m.nombre,
         m.especie,
         m.raza,
         m.edad,
         m.tamanio,
         m.peso_kg,
         m.color_pelaje,
         m.foto_url,
         m.activa,
         m.observaciones_medicas
       FROM mascota m
       WHERE m.id_usuario_cliente = $1
         AND m.activa = TRUE
       ORDER BY m.nombre`,
      [idClienteFinal]
    )

    return NextResponse.json({ mascotas: result.rows })
  } catch (error) {
    console.error("[GET /api/mascotas] Error:", error)
    return NextResponse.json({ message: "Error al obtener mascotas" }, { status: 500 })
  }
}

// ── POST /api/mascotas ─────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const payload = await verificarToken(request)
    if (!payload) {
      return NextResponse.json({ message: "No autenticado" }, { status: 401 })
    }

    const idUsuario = Number(payload.userId)
    const body = await request.json()

    const {
      nombre,
      especie,
      raza,
      tamanio,
      fecha_nacimiento,   // opcional → calculamos edad
      peso_kg,
      color_pelaje,
      temperamento,
      observaciones_medicas,  // alergias + notas médicas
    } = body

    // ── Validaciones básicas ──────────────────────────────────────────────
    if (!nombre || !especie || !tamanio) {
      return NextResponse.json(
        { message: "Campos requeridos: nombre, especie, tamanio" },
        { status: 400 }
      )
    }

    const especiesValidas = ["perro", "gato", "otro"]
    if (!especiesValidas.includes(especie.toLowerCase())) {
      return NextResponse.json(
        { message: "Especie inválida. Usa: perro, gato, otro" },
        { status: 400 }
      )
    }

    // Tamaños válidos según tu BD actualizada
    const tamaniosValidos = ["pequenio", "mediano", "grande", "gigante"]
    if (!tamaniosValidos.includes(tamanio.toLowerCase())) {
      return NextResponse.json(
        { message: "Tamaño inválido. Usa: pequenio, mediano, grande, gigante" },
        { status: 400 }
      )
    }

    const temperamentosValidos = ["tranquilo", "nervioso", "agresivo", "inquieto"]
    if (temperamento && !temperamentosValidos.includes(temperamento.toLowerCase())) {
      return NextResponse.json(
        { message: "Temperamento inválido. Usa: tranquilo, nervioso, agresivo, inquieto" },
        { status: 400 }
      )
    }

    // ── Calcular edad a partir de fecha_nacimiento ────────────────────────
    let edad: number | null = null
    if (fecha_nacimiento) {
      const nacimiento = new Date(fecha_nacimiento)
      const hoy = new Date()
      edad = hoy.getFullYear() - nacimiento.getFullYear()
      if (
        hoy.getMonth() < nacimiento.getMonth() ||
        (hoy.getMonth() === nacimiento.getMonth() && hoy.getDate() < nacimiento.getDate())
      ) {
        edad--
      }
      if (edad < 0) edad = 0
    }

    // ── Insertar mascota ──────────────────────────────────────────────────
    // Verificar si la columna temperamento ya existe (fue agregada con ALTER TABLE)
    // La insertamos solo si existe para evitar error en BD sin el ALTER ejecutado
    let insertResult
    try {
      insertResult = await pool.query(
        `INSERT INTO mascota
           (id_usuario_cliente, nombre, especie, raza, tamanio,
            edad, peso_kg, color_pelaje, temperamento, observaciones_medicas, activa)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, TRUE)
         RETURNING id_mascota, nombre, especie, raza, tamanio,
                   edad, peso_kg, color_pelaje, temperamento, observaciones_medicas`,
        [
          idUsuario,
          nombre.trim(),
          especie.toLowerCase(),
          raza?.trim() || null,
          tamanio.toLowerCase(),
          edad,
          peso_kg ? Number(peso_kg) : null,
          color_pelaje?.trim() || null,
          temperamento?.toLowerCase() || "tranquilo",
          observaciones_medicas?.trim() || null,
        ]
      )
    } catch (e: any) {
      // Si temperamento no existe todavía, insertar sin ese campo
      if (e.code === "42703") {
        insertResult = await pool.query(
          `INSERT INTO mascota
             (id_usuario_cliente, nombre, especie, raza, tamanio,
              edad, peso_kg, color_pelaje, observaciones_medicas, activa)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, TRUE)
           RETURNING id_mascota, nombre, especie, raza, tamanio,
                     edad, peso_kg, color_pelaje, observaciones_medicas`,
          [
            idUsuario,
            nombre.trim(),
            especie.toLowerCase(),
            raza?.trim() || null,
            tamanio.toLowerCase(),
            edad,
            peso_kg ? Number(peso_kg) : null,
            color_pelaje?.trim() || null,
            observaciones_medicas?.trim() || null,
          ]
        )
      } else {
        throw e
      }
    }
    const result = insertResult

    // ── Log de auditoría ──────────────────────────────────────────────────
    await pool.query(
      `INSERT INTO logs (id_usuario, accion, entidad, entidad_id, detalle)
       VALUES ($1, 'REGISTRAR_MASCOTA', 'mascota', $2, $3)`,
      [idUsuario, result.rows[0].id_mascota, `Mascota registrada: ${nombre}`]
    )

    return NextResponse.json(
      { message: "Mascota registrada exitosamente", mascota: result.rows[0] },
      { status: 201 }
    )
  } catch (error) {
    console.error("[POST /api/mascotas] Error:", error)
    return NextResponse.json({ message: "Error al registrar mascota" }, { status: 500 })
  }
}