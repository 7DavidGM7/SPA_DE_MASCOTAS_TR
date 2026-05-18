import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { sendVerificationEmail } from "@/lib/email"

// POST: Verificar el código de 6 dígitos
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, token } = body

    if (!email || !token) {
      return NextResponse.json(
        { message: "Email y token son requeridos" },
        { status: 400 }
      )
    }

    const resultado = await db.tokens.verificar(email, token, 'email')

    if (!resultado.success) {
      return NextResponse.json(
        { message: resultado.message },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { message: "¡Cuenta verificada exitosamente! Ya puedes iniciar sesión." },
      { status: 200 }
    )
  } catch (error) {
    console.error("[Verificar] Error:", error)
    return NextResponse.json(
      { message: "Error interno del servidor" },
      { status: 500 }
    )
  }
}

// PUT: Reenviar código de verificación por email
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { email } = body

    if (!email) {
      return NextResponse.json(
        { message: "El email es requerido" },
        { status: 400 }
      )
    }

    const resultado = await db.tokens.reenviar(email)

    if (!resultado.success) {
      return NextResponse.json(
        { message: resultado.message },
        { status: 400 }
      )
    }

    // Buscar el nombre del usuario para personalizar el email
    const usuario = await db.usuarios.findByEmail(email)
    const nombre = usuario?.nombre || "Usuario"

    // Enviar email real con el nuevo token
    const emailEnviado = await sendVerificationEmail(email, nombre, resultado.token!)

    if (!emailEnviado) {
      console.error("[Reenviar] Email no pudo ser enviado a:", email)
      console.log("=== NUEVO TOKEN (email falló) ===")
      console.log(`Email: ${email}  Token: ${resultado.token}`)
      console.log("================================")

      return NextResponse.json(
        {
          message: "Hubo un problema al enviar el correo. Por favor, intenta de nuevo o contacta soporte.",
          ...(process.env.NODE_ENV !== "production" && { 
            token: resultado.token,
            debug: "Email no enviado - usa este token para probar"
          }),
        },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { message: "Se ha enviado un nuevo código de verificación a tu correo." },
      { status: 200 }
    )
  } catch (error) {
    console.error("[Reenviar] Error:", error)
    return NextResponse.json(
      { message: "Error interno del servidor" },
      { status: 500 }
    )
  }
}
