import { NextRequest, NextResponse } from "next/server"
import { db, verifyPassword } from "@/lib/db"
import { generateAccessToken, generateRefreshToken } from "@/lib/auth"
import type { Rol } from "@/lib/auth"

const MAX_INTENTOS = 5
const TIEMPO_BLOQUEO_MS = 15 * 60 * 1000

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password } = body

    if (!email || !password) {
      return NextResponse.json(
        { message: "Email y contraseña son requeridos" },
        { status: 400 }
      )
    }

    const usuario = await db.usuarios.findByEmail(email)

    if (!usuario) {
      await new Promise((r) => setTimeout(r, 500))
      return NextResponse.json({ message: "Credenciales inválidas" }, { status: 401 })
    }

    // Bloqueo temporal por intentos fallidos
    if (usuario.bloqueado_hasta) {
      const ahora = new Date()
      const bloqueadoHasta = new Date(usuario.bloqueado_hasta)
      if (ahora < bloqueadoHasta) {
        const minutosRestantes = Math.ceil((bloqueadoHasta.getTime() - ahora.getTime()) / 60000)
        return NextResponse.json(
          { message: `Cuenta bloqueada temporalmente. Intenta en ${minutosRestantes} minuto${minutosRestantes !== 1 ? "s" : ""}.`, bloqueado: true, minutosRestantes },
          { status: 429 }
        )
      } else {
        await db.usuarios.resetIntentosFallidos(usuario.id_usuario)
      }
    }

    if (usuario.estado === "bloqueado") {
      return NextResponse.json(
        { message: "Tu cuenta está bloqueada. Contacta al administrador." },
        { status: 403 }
      )
    }

    if (usuario.estado === "inactivo") {
      return NextResponse.json(
        { message: "Verifica tu correo electrónico antes de iniciar sesión.", needsVerification: true, email: usuario.email },
        { status: 403 }
      )
    }

    const isValidPassword = verifyPassword(password, usuario.password_hash, usuario.salt)

    if (!isValidPassword) {
      const intentosActuales = (usuario.intentos_fallidos ?? 0) + 1
      if (intentosActuales >= MAX_INTENTOS) {
        const bloqueadoHasta = new Date(Date.now() + TIEMPO_BLOQUEO_MS)
        await db.usuarios.bloquearTemporalmente(usuario.id_usuario, bloqueadoHasta, intentosActuales)
        return NextResponse.json(
          { message: "Demasiados intentos fallidos. Cuenta bloqueada por 15 minutos.", bloqueado: true, minutosRestantes: 15 },
          { status: 429 }
        )
      }
      await db.usuarios.incrementarIntentosFallidos(usuario.id_usuario, intentosActuales)
      const intentosRestantes = MAX_INTENTOS - intentosActuales
      return NextResponse.json(
        { message: `Credenciales inválidas. Te quedan ${intentosRestantes} intento${intentosRestantes !== 1 ? "s" : ""}.`, intentosRestantes },
        { status: 401 }
      )
    }

    await db.usuarios.resetIntentosFallidos(usuario.id_usuario)

    // ── Rol del usuario (viene de la BD, default 'cliente') ──
    const rol = (usuario.rol ?? "cliente") as Rol

    const tokenPayload = {
      userId: usuario.id_usuario.toString(),
      email: usuario.email,
      nombre: usuario.nombre,
      apellido: usuario.apellido,
      rol,  // ← incluido en el token
    }

    const accessToken = await generateAccessToken(tokenPayload)
    const refreshToken = await generateRefreshToken(tokenPayload)

    return NextResponse.json(
      {
        message: "Inicio de sesión exitoso",
        accessToken,
        refreshToken,
        user: {
          id: usuario.id_usuario,
          ci: usuario.ci,
          email: usuario.email,
          nombre: usuario.nombre,
          apellido: usuario.apellido,
          telefono: usuario.telefono,
          rol,  // ← enviado al frontend
        },
      },
      { status: 200 }
    )
  } catch (error) {
    console.error("[login] Error:", error)
    return NextResponse.json({ message: "Error interno del servidor" }, { status: 500 })
  }
}
