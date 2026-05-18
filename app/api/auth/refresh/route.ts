import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { verifyRefreshToken, generateAccessToken } from "@/lib/auth"
import type { Rol } from "@/lib/auth"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { refreshToken } = body

    if (!refreshToken) {
      return NextResponse.json({ message: "Refresh token requerido" }, { status: 400 })
    }

    const payload = await verifyRefreshToken(refreshToken)

    if (!payload) {
      return NextResponse.json({ message: "Sesión expirada, inicia sesión de nuevo" }, { status: 401 })
    }

    const usuario = await db.usuarios.findById(Number(payload.userId))

    if (!usuario) {
      return NextResponse.json({ message: "Usuario no encontrado" }, { status: 401 })
    }

    if (usuario.estado !== "activo") {
      return NextResponse.json({ message: "Cuenta inactiva o bloqueada" }, { status: 401 })
    }

    const rol = (usuario.rol ?? "cliente") as Rol

    const newAccessToken = await generateAccessToken({
      userId: String(usuario.id_usuario),
      email: usuario.email,
      nombre: usuario.nombre,
      apellido: usuario.apellido,
      rol,  // ← siempre actualizado desde la BD
    })

    return NextResponse.json(
      {
        accessToken: newAccessToken,
        user: {
          id: String(usuario.id_usuario),
          email: usuario.email,
          nombre: usuario.nombre,
          apellido: usuario.apellido,
          rol,  // ← enviado al frontend
        },
      },
      { status: 200 }
    )
  } catch (error) {
    console.error("[refresh] Error:", error)
    return NextResponse.json({ message: "Error interno del servidor" }, { status: 500 })
  }
}
