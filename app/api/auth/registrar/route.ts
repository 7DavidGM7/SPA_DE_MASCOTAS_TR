import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { sendVerificationEmail } from "@/lib/email"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { ci, nombre, apellido, telefono, email, password } = body

    // Validar campos requeridos
    if (!ci || !nombre || !apellido || !email || !password) {
      return NextResponse.json(
        { message: "CI, nombre, apellido, email y contraseña son requeridos" },
        { status: 400 }
      )
    }

    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { message: "El formato del email no es válido" },
        { status: 400 }
      )
    }

    // Validar longitud de password
    if (password.length < 8) {
      return NextResponse.json(
        { message: "La contraseña debe tener al menos 8 caracteres" },
        { status: 400 }
      )
    }

    // Verificar si el email ya existe
    const existingEmail = await db.usuarios.findByEmail(email)
    if (existingEmail) {
      return NextResponse.json(
        { message: "Este correo electrónico ya está registrado" },
        { status: 400 }
      )
    }

    // Verificar si el CI ya existe
    const existingCi = await db.usuarios.findByCi(ci)
    if (existingCi) {
      return NextResponse.json(
        { message: "Este número de documento ya está registrado" },
        { status: 400 }
      )
    }

    // Asegurarse de que la tabla de tokens existe
    await db.initTokensTable()

    // Crear usuario (estado: 'inactivo' hasta verificar email)
    const usuario = await db.usuarios.create({
      ci,
      nombre,
      apellido,
      email,
      telefono,
      password,
    })

    if (!usuario) {
      return NextResponse.json(
        { message: "Error al crear el usuario. Verifica la conexión a la base de datos." },
        { status: 500 }
      )
    }

    // Crear registro en tabla cliente (si falla, no interrumpimos el flujo)
    try {
      await db.clientes.crear(usuario.id_usuario)
    } catch (clienteError) {
      console.warn("[Registro] No se pudo crear registro en tabla cliente:", clienteError)
      // No retornamos error — el usuario puede funcionar sin el registro en cliente
    }

    // Generar token de verificación
    const token = await db.tokens.crear(usuario.id_usuario, 'email')

    if (!token) {
      // El usuario fue creado pero no se pudo generar el token
      // El usuario puede solicitar reenvío
      console.error("[Registro] No se pudo generar token para:", email)
      return NextResponse.json(
        { 
          message: "Cuenta creada, pero hubo un error al generar el código de verificación. Por favor, solicita el reenvío.",
          email: email,
        },
        { status: 201 }
      )
    }

    // ENVIAR EMAIL REAL con el token
    const emailEnviado = await sendVerificationEmail(email, nombre, token)

    if (!emailEnviado) {
      // El token se creó en BD pero el email falló
      // En desarrollo mostramos el token, en producción informamos del problema
      console.error("[Registro] El email no pudo ser enviado a:", email)
      console.log("=== TOKEN DE VERIFICACIÓN (email falló) ===")
      console.log(`Email: ${email}`)
      console.log(`Token: ${token}`)
      console.log("==========================================")

      return NextResponse.json(
        {
          message: "Cuenta creada, pero hubo un problema al enviar el email. Contacta al soporte.",
          email: email,
          // Solo en desarrollo para poder probar sin email
          ...(process.env.NODE_ENV !== "production" && { 
            token,
            debug: "Email no enviado - usa este token para probar" 
          }),
        },
        { status: 201 }
      )
    }

    // Todo bien: usuario creado + email enviado
    return NextResponse.json(
      {
        message: "Registro exitoso. Hemos enviado un código de verificación a tu correo.",
        email: email,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error("[Registro] Error inesperado:", error)
    return NextResponse.json(
      { message: "Error interno del servidor" },
      { status: 500 }
    )
  }
}
